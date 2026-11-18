/**
 * Désactive les grilles de vente publiées d'une ou plusieurs familles (même effet que « Désactiver » dans
 * Administration → Tarifs) : la famille repasse « sur devis », la version reste consultable et peut être reprise
 * en brouillon puis republiée. Journalisé (tariffs.deactivate). Aucun montant n'est imprimé.
 *
 *   TARIFF_ACTOR="exploitation:motif" pnpm exec tsx scripts/tariffs-deactivate.ts casablanca helioscreen
 */
import "dotenv/config";

async function main() {
  const families = process.argv.slice(2).filter(Boolean);
  if (!families.length) throw new Error("indiquez au moins un slug de famille");
  const actorEmail = process.env.TARIFF_ACTOR?.trim();
  if (!actorEmail) throw new Error("TARIFF_ACTOR requis (auteur et motif de la désactivation)");
  const { deactivateGrid } = await import("../src/server/tariffs/grids");
  const { prisma } = await import("../src/lib/prisma");
  try {
    const active = await prisma.supplierPriceList.findMany({ where: { scope: "GRID", status: "ACTIVE", familySlug: { in: families } }, select: { id: true, familySlug: true, variantKey: true, version: true, sourceKey: true } });
    for (const g of active) {
      await deactivateGrid(g.id, { actorUserId: null, actorEmail });
      console.log(`désactivée : ${g.familySlug}${g.variantKey ? ` / ${g.variantKey}` : ""} (v${g.version})`);
    }
    if (!active.length) console.log("Aucune grille publiée pour ces familles.");
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e instanceof Error ? `${e.name} : ${e.message.split("\n")[0]}` : "Erreur"); process.exit(1); });
