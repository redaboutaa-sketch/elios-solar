/**
 * Génère les rendus originaux (PNG 1600 px) depuis les scènes SVG procédurales et les associe
 * aux fiches produit. Idempotent : relancer ne crée pas de doublon.
 *
 *   pnpm renders:generate                 # toutes les familles
 *   pnpm renders:generate pergola-solis   # une ou plusieurs familles
 */
import "dotenv/config";

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { seedDemoRenders } = await import("../src/server/media/demo-renders");
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const t0 = Date.now();
  const r = await seedDemoRenders(prisma, { only, log: (m) => console.log(m) });
  console.log(`Rendus : ${r.created} créés, ${r.regenerated} régénérés, ${r.skipped} déjà présents ; ${r.linked} associations ; ${r.documents} document(s) de démonstration — ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
