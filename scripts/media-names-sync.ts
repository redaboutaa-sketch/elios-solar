/**
 * Applique la nomenclature HELIO (2026-10-31) aux textes des médias déjà importés : texte alternatif et titre
 * (`Media.alt`, `Media.title`) et légende de l'association au produit (`ProductMedia.caption`). Sans fichier : seules
 * les métadonnées changent.
 *
 * Une valeur n'est réécrite que si elle ne diffère du manifeste (src/server/media/heliostores-media*.ts) QUE par
 * l'ancien nom commercial : une retouche faite dans l'administration est conservée (signalée, jamais écrasée).
 *
 *   node_modules/.bin/tsx scripts/media-names-sync.ts            # aperçu
 *   node_modules/.bin/tsx scripts/media-names-sync.ts --apply    # applique (idempotent, trace AuditLog)
 */
import "dotenv/config";
import { NAME_ALIASES } from "../src/domain/nomenclature";

/** Remplace les anciens noms commerciaux (alias) par le nom public actuel. */
export function withCurrentNames(text: string): string {
  let out = text;
  for (const a of [...NAME_ALIASES].sort((x, y) => y.alias.length - x.alias.length)) out = out.replace(new RegExp(`\\b${a.alias}\\b`, "g"), a.name);
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { prisma } = await import("../src/lib/prisma");
  const { HELIOSTORES_MEDIA } = await import("../src/server/media/heliostores-media");
  let changed = 0, kept = 0, absent = 0;
  const plan = (current: string | null, target: string) => (current === target ? "same" : current != null && withCurrentNames(current) === target ? "rename" : "edited");
  for (const m of HELIOSTORES_MEDIA) {
    const media = await prisma.media.findFirst({ where: { provenance: { path: ["key"], equals: m.key } }, select: { id: true, alt: true, title: true, products: { select: { id: true, caption: true } } } });
    if (!media) { absent += 1; continue; }
    const data: { alt?: string; title?: string } = {};
    for (const [field, target] of [["alt", m.alt], ["title", m.caption]] as const) {
      const p = plan(media[field], target);
      if (p === "rename") data[field] = target;
      else if (p === "edited") { kept += 1; console.log(`= ${m.key}.${field} : valeur modifiée en administration, conservée`); }
    }
    const links = media.products.filter((l) => plan(l.caption, m.caption) === "rename");
    for (const l of media.products.filter((x) => plan(x.caption, m.caption) === "edited")) { kept += 1; console.log(`= ${m.key}.caption (${l.id}) : légende modifiée en administration, conservée`); }
    if (!Object.keys(data).length && !links.length) continue;
    changed += 1;
    console.log(`~ ${m.key} : ${[...Object.keys(data), ...(links.length ? ["caption"] : [])].join(", ")}`);
    if (apply) {
      if (Object.keys(data).length) await prisma.media.update({ where: { id: media.id }, data });
      for (const l of links) await prisma.productMedia.update({ where: { id: l.id }, data: { caption: m.caption } });
    }
  }
  if (apply && changed) await prisma.auditLog.create({ data: { action: "media.names_sync", entity: "Media", entityId: "heliostores", after: { changed, kept, nomenclature: "2026-10-31" } as never } });
  console.log(`${apply ? "Appliqué" : "Aperçu"} : ${changed} média(s) renommé(s), ${kept} valeur(s) conservée(s), ${absent} absent(s) de la médiathèque — ${HELIOSTORES_MEDIA.length} entrée(s) au manifeste`);
  await prisma.$disconnect();
}

if (process.argv[1]?.endsWith("media-names-sync.ts")) main().catch((e) => { console.error(e); process.exit(1); });
