import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { EXT_TO_MIME, MEDIA_URL_PREFIX, resolveMediaFile } from "@/server/media/storage";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Access = "public" | "customer" | "admin" | "none";

/**
 * Règle d'accès : public si le média est publié (ou logo/favicon des réglages) et n'est rattaché
 * à aucun document restreint ; document « client » publié → compte connecté ; brouillons,
 * documents internes ou non publiés → administration uniquement.
 */
async function accessFor(name: string): Promise<Access> {
  const url = `${MEDIA_URL_PREFIX}${name}`;
  // une variante réduite (vignette) suit les règles d'accès de son média
  const media = (await prisma.media.findFirst({ where: { path: url }, select: { id: true, status: true, documents: { select: { status: true, audience: true } } } }))
    ?? (await prisma.media.findFirst({ where: { provenance: { path: ["variants", "small", "path"], equals: url } }, select: { id: true, status: true, documents: { select: { status: true, audience: true } } } }))
    ?? (await prisma.media.findFirst({ where: { provenance: { path: ["variants", "medium", "path"], equals: url } }, select: { id: true, status: true, documents: { select: { status: true, audience: true } } } }))
    // variantes listées (WebP / AVIF des visuels de l'accueil, scripts/import-home-visuals.ts)
    ?? (await prisma.media.findFirst({ where: { provenance: { path: ["files"], array_contains: [url] } }, select: { id: true, status: true, documents: { select: { status: true, audience: true } } } }));
  if (!media) return "none";
  const docs = media.documents;
  if (docs.length > 0) {
    if (docs.some((d) => d.status === "PUBLISHED" && d.audience === "PUBLIC")) return "public";
    if (docs.some((d) => d.status === "PUBLISHED" && d.audience === "CUSTOMER")) return "customer";
    return "admin";
  }
  if (media.status === "PUBLISHED") return "public";
  const inSettings = await prisma.siteSettings.count({ where: { OR: [{ logoMediaId: media.id }, { faviconMediaId: media.id }] } });
  return inSettings > 0 ? "public" : "admin";
}

/** Sert un média téléversé. Seuls les noms générés (hex + extension) sont acceptés : pas de traversée. */
export async function GET(req: Request, ctx: RouteContext<"/api/media/[...path]">) {
  const { path: segments } = await ctx.params;
  if (segments.length !== 1) return new Response("Introuvable", { status: 404 });
  const name = segments[0]!;
  const full = resolveMediaFile(name);
  if (!full) return new Response("Introuvable", { status: 404 });
  const mime = EXT_TO_MIME[path.extname(name).slice(1)];
  if (!mime) return new Response("Introuvable", { status: 404 });
  const access = await accessFor(name);
  if (access === "none") return new Response("Introuvable", { status: 404 });
  if (access !== "public") {
    const session = await auth.api.getSession({ headers: req.headers });
    const role = (session?.user as { role?: string } | undefined)?.role;
    const isAdmin = role === "ADMIN" || role === "MANAGER";
    if (!session || (access === "admin" && !isAdmin)) return new Response("Introuvable", { status: 404 });
  }
  try {
    const st = await stat(full);
    if (!st.isFile()) return new Response("Introuvable", { status: 404 });
    const body = await readFile(full);
    const headers: Record<string, string> = {
      "Content-Type": mime,
      "Content-Length": String(st.size),
      "Cache-Control": access === "public" ? "public, max-age=31536000, immutable" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    // SVG : aucun script ni ressource externe, même ouvert directement.
    if (mime === "image/svg+xml") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
    if (mime === "application/pdf") headers["Content-Disposition"] = `inline; filename="${name}"`;
    return new Response(new Uint8Array(body), { status: 200, headers });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
