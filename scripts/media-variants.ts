/**
 * Variante intermédiaire (1080 px, WebP) des photos et rendus publiés plus larges (pas des schémas, déjà légers) : servie par `srcset` aux écrans mobiles
 * haute densité, qui chargeaient sinon l'image complète. L'original et la variante 640 px restent inchangés ; la
 * variante s'ajoute à `provenance.variants.medium` (mêmes règles d'accès que le média, /api/media).
 *
 *   pnpm media:variants            # simulation : liste les médias concernés et le gain estimé
 *   pnpm media:variants --apply    # écrit les variantes manquantes (idempotent)
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const MEDIUM_W = 1080;
const apply = process.argv.includes("--apply");

async function main() {
  const sharp = (await import("sharp")).default;
  const { prisma } = await import("../src/lib/prisma");
  const { storeMediaBuffer, resolveMediaFile, MEDIA_URL_PREFIX } = await import("../src/server/media/storage");
  const file = (url: string | undefined) => (url?.startsWith(MEDIA_URL_PREFIX) ? resolveMediaFile(url.slice(MEDIA_URL_PREFIX.length)) : null);
  const rows = await prisma.media.findMany({ where: { kind: "image", status: "PUBLISHED", nature: { in: ["PHOTO", "RENDER"] }, width: { gt: MEDIUM_W }, mimeType: { in: ["image/webp", "image/jpeg", "image/png"] } }, select: { id: true, path: true, width: true, sizeBytes: true, provenance: true } });
  let done = 0, skipped = 0, before = 0, after = 0;
  for (const m of rows) {
    const prov = (m.provenance ?? {}) as { variants?: Record<string, { path?: string }> } & Record<string, unknown>;
    const existing = file(prov.variants?.medium?.path);
    if (existing && existsSync(existing)) { skipped += 1; continue; }
    const src = file(m.path);
    if (!src || !existsSync(src)) { console.warn(`fichier absent : ${m.id}`); continue; }
    const buf = await readFile(src);
    const out = await sharp(buf).resize({ width: MEDIUM_W, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer({ resolveWithObject: true });
    if (out.data.length >= buf.length * 0.9) { skipped += 1; continue; } // gain négligeable : pas de variante
    before += buf.length; after += out.data.length;
    if (apply) {
      const stored = await storeMediaBuffer(out.data, "image/webp");
      await prisma.media.update({ where: { id: m.id }, data: { provenance: { ...prov, variants: { ...(prov.variants ?? {}), medium: { path: stored.url, width: out.info.width, height: out.info.height } } } as never } });
    }
    done += 1;
  }
  console.log(`${apply ? "variantes écrites" : "variantes à écrire (simulation)"} : ${done} ; ignorés : ${skipped} ; ${Math.round(before / 1024)} Ko → ${Math.round(after / 1024)} Ko pour les images concernées`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
