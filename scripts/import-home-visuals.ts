/**
 * Import idempotent des visuels du carrousel de l'accueil (manifeste src/server/media/home-visuals.ts).
 *
 *   pnpm media:home --dir inputs/heliostores/homepage            # aperçu
 *   pnpm media:home --dir inputs/heliostores/homepage --apply    # importe / met à jour
 *   # en Docker (dossier fourni monté en lecture seule, jamais copié dans l'image) :
 *   docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod run --rm --no-deps \
 *     -v /opt/pergola/inputs/heliostores/homepage:/staging:ro migrate pnpm media:home --dir /staging --apply
 *
 * Pour chaque entrée : contrôle du fichier (signature, dimensions), variantes WebP et AVIF à 640, 1080 px et à la
 * largeur d'origine (jamais agrandies), noms publics descriptifs, média PUBLIÉ de nature RENDER sans rattachement à
 * un produit (les fiches produit ne changent pas), provenance (fichier d'origine, empreinte, date de réception,
 * cadrage). L'original n'est ni modifié ni copié. Même empreinte et fichiers présents : métadonnées seulement ; sinon
 * les variantes sont régénérées et les anciennes supprimées du stockage.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const WIDTHS = [640, 1080] as const;

async function main() {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf("--dir");
  const apply = args.includes("--apply");
  if (dirIdx < 0 || !args[dirIdx + 1]) {
    console.error("Usage : pnpm media:home --dir <dossier des originaux> [--apply]");
    process.exit(2);
  }
  const dir = path.resolve(args[dirIdx + 1]!);
  const sharp = (await import("sharp")).default;
  const { prisma } = await import("../src/lib/prisma");
  const { storeMediaBuffer, resolveMediaFile, removeMediaByUrl, MEDIA_URL_PREFIX } = await import("../src/server/media/storage");
  const { HOME_VISUALS, HOME_VISUALS_RECEIVED, HOME_VISUALS_RIGHTS } = await import("../src/server/media/home-visuals");
  const present = (url: string) => { const f = url.startsWith(MEDIA_URL_PREFIX) ? resolveMediaFile(url.slice(MEDIA_URL_PREFIX.length)) : null; return !!f && existsSync(f); };

  let created = 0, updated = 0, regenerated = 0, missing = 0, refused = 0;
  for (const v of HOME_VISUALS) {
    let buf: Buffer;
    try { buf = await readFile(path.join(dir, v.file)); } catch { console.warn(`! ${v.key} : fichier absent (${v.file})`); missing += 1; continue; }
    const sha256 = createHash("sha256").update(buf).digest("hex");
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format ?? "")) { console.warn(`! ${v.key} : format non pris en charge`); refused += 1; continue; }
    if (meta.width < 1200) { console.warn(`! ${v.key} : image trop étroite pour un plein écran (${meta.width} px)`); refused += 1; continue; }
    const existing = await prisma.media.findFirst({ where: { provenance: { path: ["key"], equals: v.key } } });
    const prov = existing?.provenance as { sha256?: string; files?: string[]; variants?: unknown } | null;
    const same = !!existing && prov?.sha256 === sha256 && (prov.files ?? []).length > 0 && (prov.files ?? []).every(present);
    if (!apply) { console.log(`${existing ? (same ? "=" : "~") : "+"} ${v.key} → ${v.category} (${meta.width}×${meta.height})`); continue; }

    const common = {
      kind: "image", nature: "RENDER" as const, status: "PUBLISHED" as const,
      alt: v.alt, title: v.title,
      source: `Fichier fourni par le client : ${v.file} (dossier de l'accueil, reçu le ${HOME_VISUALS_RECEIVED})`,
      license: "Visuel fourni par le client pour le site HELIOSTORES",
      credit: "",
      rightsNote: HOME_VISUALS_RIGHTS,
      sortOrder: v.sortOrder,
      validatedBy: "import:accueil",
      validatedAt: new Date(),
    };
    const provenanceBase = {
      key: v.key, placement: "home-hero", category: v.category, generated: true,
      description: "Visualisation photoréaliste générée (ni photographie du fabricant, ni réalisation, ni modèle précis)",
      sha256, original: { file: v.file, width: meta.width, height: meta.height, format: meta.format, receivedAt: HOME_VISUALS_RECEIVED },
      focus: v.focus,
    };
    if (same) {
      await prisma.media.update({ where: { id: existing!.id }, data: { ...common, provenance: { ...(prov as object), ...provenanceBase } as never } });
      updated += 1;
      continue;
    }
    const img = sharp(buf).rotate();
    const widths = [...WIDTHS.filter((w) => w < meta.width!), meta.width];
    const out: { w: number; h: number; webp: string; avif: string; bytes: number }[] = [];
    for (const w of widths) {
      const r = img.clone().resize({ width: w, withoutEnlargement: true });
      const webp = await r.clone().webp({ quality: 84, effort: 6, smartSubsample: true }).toBuffer({ resolveWithObject: true });
      const avif = await r.clone().avif({ quality: 60, effort: 6 }).toBuffer();
      const sw = await storeMediaBuffer(webp.data, "image/webp", { slug: `${v.slug}-${w}` });
      const sa = await storeMediaBuffer(avif, "image/avif", { slug: `${v.slug}-${w}` });
      out.push({ w: webp.info.width, h: webp.info.height, webp: sw.url, avif: sa.url, bytes: webp.data.length });
    }
    const main = out[out.length - 1]!;
    const small = out.find((o) => o.w === 640), medium = out.find((o) => o.w === 1080);
    const variants = {
      ...(small ? { small: { path: small.webp, width: small.w, height: small.h } } : {}),
      ...(medium ? { medium: { path: medium.webp, width: medium.w, height: medium.h } } : {}),
      avif: out.map((o) => ({ path: o.avif, width: o.w, height: o.h })),
    };
    const files = out.flatMap((o) => [o.webp, o.avif]);
    const data = { ...common, path: main.webp, mimeType: "image/webp", width: main.w, height: main.h, sizeBytes: main.bytes, provenance: { ...provenanceBase, variants, files } as never };
    if (existing) {
      await prisma.media.update({ where: { id: existing.id }, data });
      for (const f of [existing.path, ...(prov?.files ?? [])]) if (!files.includes(f)) await removeMediaByUrl(f);
      regenerated += 1;
    } else {
      await prisma.media.create({ data });
      created += 1;
    }
    console.log(`${v.key} : ${out.map((o) => `${o.w} px`).join(", ")} → ${main.webp}`);
  }
  console.log(`${apply ? "Import" : "Aperçu"} : ${created} créé(s), ${regenerated} régénéré(s), ${updated} mis à jour, ${missing} absent(s), ${refused} refusé(s) — ${HOME_VISUALS.length} entrée(s) au manifeste`);
  await prisma.$disconnect();
  if (missing || refused) process.exitCode = 3;
}

main().catch((e) => { console.error(e); process.exit(1); });
