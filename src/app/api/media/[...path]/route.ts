import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { EXT_TO_MIME, resolveMediaFile } from "@/server/media/storage";

/** Sert un média téléversé. Seuls les noms générés (hex + extension) sont acceptés : pas de traversée. */
export async function GET(_req: Request, ctx: RouteContext<"/api/media/[...path]">) {
  const { path: segments } = await ctx.params;
  if (segments.length !== 1) return new Response("Introuvable", { status: 404 });
  const name = segments[0]!;
  const full = resolveMediaFile(name);
  if (!full) return new Response("Introuvable", { status: 404 });
  const mime = EXT_TO_MIME[path.extname(name).slice(1)];
  if (!mime) return new Response("Introuvable", { status: 404 });
  try {
    const st = await stat(full);
    if (!st.isFile()) return new Response("Introuvable", { status: 404 });
    const body = await readFile(full);
    const headers: Record<string, string> = {
      "Content-Type": mime,
      "Content-Length": String(st.size),
      "Cache-Control": "public, max-age=31536000, immutable",
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
