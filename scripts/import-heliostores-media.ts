/**
 * Import idempotent des médias HELIOSTORES dans la médiathèque (manifeste src/server/media/heliostores-media.ts).
 *
 *   pnpm media:heliostores --dir private/heliostores/media-staging            # aperçu
 *   pnpm media:heliostores --dir private/heliostores/media-staging --apply    # importe / met à jour
 *   # en Docker (dossier privé monté en lecture seule, jamais copié dans l'image) :
 *   docker compose -f docker/compose.prod.yml --env-file .env.prod run --rm \
 *     -v /opt/pergola/private/heliostores/media-staging:/staging:ro migrate pnpm media:heliostores --dir /staging --apply
 *
 * Pour chaque entrée : contrôle du fichier (signature, dimensions), variantes web WebP (≤ 1600 px et ≤ 640 px,
 * jamais agrandies), média PUBLIÉ avec provenance (fichier + page ou URL + date), crédit, autorisation et
 * association au produit (rôle, légende, teinte, pose). Une entrée déjà importée (même clé, même empreinte) n'est
 * pas réécrite ; seules ses métadonnées sont mises à jour — sauf si ses fichiers manquent dans le stockage, qui sont
 * alors régénérés depuis le dossier privé.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const MAX_W = 1600;
const SMALL_W = 640;

async function main() {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf("--dir");
  const apply = args.includes("--apply");
  if (dirIdx < 0 || !args[dirIdx + 1]) {
    console.error("Usage : pnpm media:heliostores --dir <dossier privé> [--apply]");
    process.exit(2);
  }
  const dir = path.resolve(args[dirIdx + 1]!);
  const sharp = (await import("sharp")).default;
  const { prisma } = await import("../src/lib/prisma");
  const { storeMediaBuffer, resolveMediaFile, MEDIA_URL_PREFIX } = await import("../src/server/media/storage");
  const { existsSync } = await import("node:fs");
  const { HELIOSTORES_MEDIA, HELIOSTORES_MEDIA_AUTHORIZATION } = await import("../src/server/media/heliostores-media");

  const families = new Map((await prisma.productFamily.findMany({ select: { id: true, slug: true } })).map((f) => [f.slug, f.id]));
  let created = 0, updated = 0, missing = 0, refused = 0;
  for (const m of HELIOSTORES_MEDIA) {
    const familyId = families.get(m.familySlug);
    if (!familyId) { console.warn(`! ${m.key} : famille ${m.familySlug} absente`); refused += 1; continue; }
    let buf: Buffer;
    try { buf = await readFile(path.join(dir, m.file)); } catch { console.warn(`! ${m.key} : fichier absent (${m.file})`); missing += 1; continue; }
    const sha256 = createHash("sha256").update(buf).digest("hex");
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format ?? "")) { console.warn(`! ${m.key} : format non pris en charge`); refused += 1; continue; }
    if (meta.width < 300) { console.warn(`! ${m.key} : image trop petite (${meta.width} px)`); refused += 1; continue; }
    const provenanceBase = {
      key: m.key,
      sha256,
      source: m.source,
      productRepresented: m.productRepresented,
      match: m.match,
      matchNote: m.matchNote ?? null,
      authorization: HELIOSTORES_MEDIA_AUTHORIZATION,
      original: { width: meta.width, height: meta.height, format: meta.format },
    };
    const sourceText = m.source.type === "pdf" ? `${m.source.file}, p. ${m.source.page} (${m.source.ref})` : `${m.source.url} (page ${m.source.pageUrl}, récupéré le ${m.source.retrievedAt})`;
    const common = {
      alt: m.alt,
      title: m.caption,
      nature: m.nature,
      status: "PUBLISHED" as const,
      source: sourceText,
      credit: m.credit,
      license: "Usage autorisé par le client pour le site HELIOSTORES",
      rightsNote: `${HELIOSTORES_MEDIA_AUTHORIZATION}${m.matchNote ? ` Rattachement : ${m.matchNote}.` : ""}`,
      visibleOptions: m.visibleOptions ?? "",
      sortOrder: m.sortOrder,
      validatedBy: "import:heliostores",
      validatedAt: new Date(),
    };
    const existing = await prisma.media.findFirst({ where: { provenance: { path: ["key"], equals: m.key } } });
    const prov = existing?.provenance as { sha256?: string; variants?: unknown } | null;
    if (!apply) {
      console.log(`${existing ? (prov?.sha256 === sha256 ? "=" : "~") : "+"} ${m.key} → ${m.familySlug} (${m.role}, ${meta.width}×${meta.height})`);
      continue;
    }
    let mediaId: string;
    const filePresent = (url: string | undefined) => {
      const full = url ? resolveMediaFile(url.slice(MEDIA_URL_PREFIX.length)) : null;
      return !!full && existsSync(full);
    };
    const smallPath = (prov?.variants as { small?: { path?: string } } | undefined)?.small?.path;
    // même source et fichiers présents dans le stockage : métadonnées seulement ; fichier perdu (volume restauré partiellement) : régénéré
    if (existing && prov?.sha256 === sha256 && filePresent(existing.path) && filePresent(smallPath)) {
      await prisma.media.update({ where: { id: existing.id }, data: { ...common, provenance: { ...provenanceBase, variants: prov.variants } as never } });
      mediaId = existing.id;
      updated += 1;
    } else {
      const img = sharp(buf).rotate();
      const main = await img.clone().resize({ width: Math.min(MAX_W, meta.width), withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
      const small = await img.clone().resize({ width: Math.min(SMALL_W, meta.width), withoutEnlargement: true }).webp({ quality: 78 }).toBuffer({ resolveWithObject: true });
      const storedMain = await storeMediaBuffer(main.data, "image/webp");
      const storedSmall = await storeMediaBuffer(small.data, "image/webp");
      const data = { ...common, kind: "image", path: storedMain.url, mimeType: "image/webp", width: main.info.width, height: main.info.height, sizeBytes: main.data.length, provenance: { ...provenanceBase, variants: { small: { path: storedSmall.url, width: small.info.width, height: small.info.height } } } as never };
      if (existing) { await prisma.media.update({ where: { id: existing.id }, data }); mediaId = existing.id; updated += 1; }
      else { mediaId = (await prisma.media.create({ data })).id; created += 1; }
    }
    await prisma.productMedia.deleteMany({ where: { mediaId } });
    await prisma.productMedia.create({ data: { familyId, mediaId, role: m.role, caption: m.caption, sortOrder: m.sortOrder, finishCode: m.finishCode ?? null, mounting: m.mounting ?? null, tags: [m.nature.toLowerCase(), m.match] } });
  }
  console.log(`${apply ? "Import" : "Aperçu"} : ${created} créé(s), ${updated} mis à jour, ${missing} fichier(s) absent(s), ${refused} refusé(s) — ${HELIOSTORES_MEDIA.length} entrée(s) au manifeste`);
  await prisma.$disconnect();
  if (missing || refused) process.exitCode = 3;
}

main().catch((e) => { console.error(e); process.exit(1); });
