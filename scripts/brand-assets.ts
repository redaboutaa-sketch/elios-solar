/**
 * Dérive les fichiers web de l'identité HELIOSTORES à partir du SEUL fichier fourni par le client :
 * inputs/heliostores/PHOTO-2026-10-20-17-17-24.jpg (1230×347, logo sur fond noir pur ; dossier privé, non versionné).
 *
 *   pnpm exec tsx scripts/brand-assets.ts
 *
 * Aucun lettrage n'est redessiné ni recoloré : la couche alpha est reconstruite en « dé-prémultipliant »
 * chaque pixel contre le noir avec la couleur de premier plan connue de sa zone (HELIO + soleil, STORES, ®),
 * à la résolution d'origine (aucun rééchantillonnage du logo). Provenance détaillée : docs/heliostores/identite.md.
 */
import path from "node:path";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "inputs/heliostores/PHOTO-2026-10-20-17-17-24.jpg");
const OUT = path.join(ROOT, "public/brand");
const APP = path.join(ROOT, "src/app");

/** Couleurs mesurées (médiane des pixels de cœur, fond exclu). */
const FG = {
  helio: [0x44, 0x66, 0x4d], // HELIO + soleil
  stores: [0x8a, 0xb4, 0xa8], // STORES
  reg: [0xb0, 0xb8, 0xa6], // ®
} as const;
/** Fond sombre des plaques et icônes (proche du noir d'origine), = --color-night du site. */
const NIGHT = { r: 0x0b, g: 0x0f, b: 0x0d };

/** Zones mesurées sur l'original : HELIO + soleil à gauche de x=516, ® au-dessus de y=129 à droite de x=1160. */
function zone(x: number, y: number): readonly number[] {
  if (x < 516) return FG.helio;
  if (x >= 1160 && y < 129) return FG.reg;
  return FG.stores;
}

const smooth = (a: number, b: number, t: number) => { const u = Math.min(1, Math.max(0, (t - a) / (b - a))); return u * u * (3 - 2 * u); };

async function main() {
  const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  if (W !== 1230 || H !== 347) throw new Error(`Dimensions inattendues ${W}×${H}`);
  const rgba = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3, o = (y * W + x) * 4;
      const p = [data[i]!, data[i + 1]!, data[i + 2]!];
      const f = zone(x, y);
      // pixel = alpha × couleur (sur noir) → alpha par projection des moindres carrés sur la couleur connue
      let a = (p[0]! * f[0]! + p[1]! * f[1]! + p[2]! * f[2]!) / (f[0]! ** 2 + f[1]! ** 2 + f[2]! ** 2);
      a = Math.min(1, Math.max(0, a));
      if (a < 0.04) a = 0; // bruit JPEG du fond noir
      // couleur : pixel d'origine dé-prémultiplié au cœur, couleur connue sur les bords très transparents
      const w = smooth(0.35, 0.9, a);
      for (let c = 0; c < 3; c++) {
        const un = a > 0 ? Math.min(255, p[c]! / a) : f[c]!;
        rgba[o + c] = Math.round(f[c]! * (1 - w) + un * w);
      }
      rgba[o + 3] = Math.round(a * 255);
    }
  }
  await mkdir(OUT, { recursive: true });
  const logo = sharp(rgba, { raw: { width: W, height: H, channels: 4 } });

  // 1. Logo transparent, couleurs d'origine (fonds sombres) — PNG + WebP, mêmes dimensions.
  await logo.clone().png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(path.join(OUT, "heliostores-logo.png"));
  await logo.clone().webp({ quality: 92, alphaQuality: 100, effort: 6, smartSubsample: true }).toFile(path.join(OUT, "heliostores-logo.webp"));

  // 2. Variante « fonds clairs » : logo intact posé sur une plaque sombre arrondie (aucune recoloration).
  const padX = 60, padY = 40, pw = W + padX * 2, ph = H + padY * 2, r = 36;
  const plate = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}"><rect width="${pw}" height="${ph}" rx="${r}" fill="rgb(${NIGHT.r},${NIGHT.g},${NIGHT.b})"/></svg>`);
  const logoPng = await logo.clone().png().toBuffer();
  const plated = sharp(plate).composite([{ input: logoPng, left: padX, top: padY }]);
  await plated.clone().png({ compressionLevel: 9 }).toFile(path.join(OUT, "heliostores-logo-plaque.png"));
  await plated.clone().webp({ quality: 92, alphaQuality: 100, effort: 6 }).toFile(path.join(OUT, "heliostores-logo-plaque.webp"));

  // 3. Marque « soleil » (point du i) : boîte englobante mesurée x 311–384, y 48–121 (74×74), marge 6 px.
  const sun = await logo.clone().extract({ left: 305, top: 42, width: 86, height: 86 }).png().toBuffer();
  await sharp(sun).png({ compressionLevel: 9 }).toFile(path.join(OUT, "heliostores-soleil.png"));

  // 4. Icônes d'application : soleil agrandi (Lanczos) centré sur fond sombre.
  const icon = async (size: number, rounded: boolean, file: string) => {
    const inner = Math.round(size * 0.68);
    const mark = await sharp(sun).resize(inner, inner, { kernel: "lanczos3" }).png().toBuffer();
    const rx = rounded ? Math.round(size * 0.22) : 0;
    const base = sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${rx}" fill="rgb(${NIGHT.r},${NIGHT.g},${NIGHT.b})"/></svg>`));
    const off = Math.round((size - inner) / 2);
    await base.composite([{ input: mark, left: off, top: off }]).png({ compressionLevel: 9 }).toFile(file);
  };
  await icon(512, true, path.join(APP, "icon.png"));
  await icon(180, false, path.join(APP, "apple-icon.png"));
  await icon(512, false, path.join(OUT, "heliostores-icone-512.png"));
  console.log("Fichiers de marque générés dans public/brand et src/app (icon.png, apple-icon.png).");
}

main().catch((e) => { console.error(e); process.exit(1); });
