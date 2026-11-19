/**
 * Reclassement des relevés d'avant les niveaux (comparabilité forte / partielle / insuffisante) en niveaux A/B/C/D,
 * commande normalisée et société vendeuse — d'après les champs et l'analyse déjà enregistrés (raison de la
 * comparabilité, commande, modèle). Chaque relevé modifié garde son état précédent dans l'historique (révision,
 * motif). Statut « à valider » : un classement automatique n'est jamais présenté comme validé.
 *
 *   tsx scripts/market/reclassify-legacy.ts            # aperçu (aucune écriture)
 *   tsx scripts/market/reclassify-legacy.ts --apply
 *
 * Règles (docs/pricing/benchmark-europe.md § 4) :
 * - « à partir de » ou dimensions absentes → D ;
 * - fiche contradictoire, incohérente → D ;
 * - forte → B ; partielle → B si l'analyse conclut au même type de produit sans réserve de gamme ou de technique
 *   (acier, entrée de gamme, génération précédente, toile enroulable au lieu d'une toiture plissée, accessoire d'une
 *   autre pergola…), sinon C ; insuffisante → C ;
 * - aucun A : aucun relevé existant ne cite le système fournisseur.
 * Le niveau retenu par configuration reste plafonné par les données (cotes, implantation, motorisation, périmètre).
 */
import "dotenv/config";

const apply = process.argv.includes("--apply");

const SAME_TYPE = /même type|même principe|même concept|comparable à|proche (de )?helio|correspond à la version|= version|semi-coffre motorisé|coffre intégral motorisé|store banne coffre intégral|demi-coffre motorisé|bioclimatique (alu )?(autoportante|adossée|motorisée)|lames (alu )?orientables motorisées|lames alu (orientables )?motorisées|pergola (à )?toile (adossée )?motorisée|toile motorisée/i;
const RED_FLAGS: Array<[RegExp, string]> = [
  [/acier/i, "matériau différent (acier)"],
  [/entrée de gamme/i, "entrée de gamme"],
  [/génération précédente|déstockage/i, "génération précédente en déstockage"],
  [/enroulable|pas PVC|pas une to|polyester enduite|acrylique/i, "toiture en toile différente (enroulable / acrylique / polyester au lieu d'une toiture plissée PVC)"],
  [/accessoire/i, "vendu comme accessoire d'une autre pergola"],
  [/manuel|manivelle|non motoris/i, "manœuvre manuelle"],
  [/interrupteur/i, "commande par interrupteur"],
  [/indisponible/i, "produit indisponible en ligne"],
];
const BROKEN = /contradictoire|incohérence/i;

function controlKindOf(text: string): string {
  const t = text.toLowerCase();
  const motor = /motoris|moteur|électrique|electrique|vérin|verin|toit électrique|toit motorisé/.test(t);
  if (/manivelle|manuel|treuil/.test(t) && !/secours/.test(t) && !motor) return "manual";
  if (/interrupteur|filaire/.test(t)) return "wired";
  if (/télécommande|telecommande|radio|rts|\bio\b|bluetooth|appli/.test(t) && !/sans télécommande|pas de télécommande|télécommande non|inclusion non/.test(t)) return "radio";
  if (motor) return "motor";
  return "unknown";
}

function sellerOf(retailer: string, manufacturer: string): string {
  const base = retailer.replace(/\s*\(.*?\)\s*/g, "").trim();
  // place de marché : le vendeur réel est un tiers ; la marque sert de société vendeuse (indépendance prudente)
  if (/marketplace|partenaire/i.test(retailer) && manufacturer.trim()) return manufacturer.trim().toLowerCase();
  return base.toLowerCase();
}

async function main() {
  const { prisma } = await import("../../src/lib/prisma");
  const { updateObservation, observationSchema } = await import("../../src/server/market/observations");
  const actor = { actorEmail: "script:reclassify-legacy" };
  try {
    const rows = await prisma.marketObservation.findMany({ where: { status: "ACTIVE", matchLevel: null }, orderBy: { observedAt: "asc" } });
    const tally: Record<string, number> = {};
    let changed = 0;
    for (const o of rows) {
      const why: string[] = [];
      const reason = `${o.comparabilityReason} ${o.notes}`;
      let level: "A" | "B" | "C" | "D";
      if (o.priceKind === "from") { level = "D"; why.push("prix « à partir de »"); }
      else if (o.widthMm == null || (o.depthMm == null && o.heightMm == null)) { level = "D"; why.push("dimensions non indiquées"); }
      else if (o.comparability !== "STRONG" && BROKEN.test(reason)) { level = "D"; why.push("fiche contradictoire ou incohérente"); }
      else if (o.comparability === "STRONG") { level = "B"; why.push("comparabilité forte du relevé"); }
      else if (o.comparability === "PARTIAL") {
        const flags = RED_FLAGS.filter(([re]) => re.test(reason)).map(([, l]) => l);
        if (SAME_TYPE.test(reason) && !flags.some((f) => /acier|entrée de gamme|génération|toiture en toile|accessoire/.test(f))) { level = "B"; why.push("même type de produit selon l'analyse du relevé"); if (flags.length) why.push(`réserves : ${flags.join(", ")}`); }
        else { level = "C"; why.push(flags.length ? `différences importantes : ${flags.join(", ")}` : "même besoin, équivalence technique non établie"); }
      } else { level = "C"; why.push("comparabilité insuffisante : contexte seulement"); }
      const controlKind = controlKindOf(`${o.control} ${o.model} ${o.options}`);
      const sellerGroup = o.sellerGroup || sellerOf(o.retailer, o.manufacturer);
      tally[`${o.familySlug} ${level}`] = (tally[`${o.familySlug} ${level}`] ?? 0) + 1;
      const input = observationSchema.parse({ ...o, matchLevel: level, matchReason: `Reclassement automatique du 2026-11-19 d'après l'analyse enregistrée : ${why.join(" ; ")}`, controlKind, sellerGroup, collectionMethod: o.collectionMethod || (/curl|HTML statique/i.test(o.access) ? "curl" : ""), validation: "TO_VALIDATE", scope: o.scope ?? {}, specs: o.specs ?? {}, differences: o.differences ?? [], unknownFields: o.unknownFields ?? [], deliversTo: o.deliversTo ?? {}, fx: o.fx ?? null });
      changed++;
      if (apply) await updateObservation(o.id, o.revision, input, "reclassement en niveaux A/B/C/D (benchmark 2026-11-19), à valider", actor);
    }
    console.log(`Relevés à reclasser : ${rows.length} ; ${apply ? "reclassés" : "aperçu"} : ${changed}`);
    for (const [k, n] of Object.entries(tally).sort()) console.log(`  ${k} : ${n}`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main().then((c) => process.exit(c), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
