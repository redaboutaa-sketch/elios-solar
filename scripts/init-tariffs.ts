/**
 * Initialise les grilles administrées (écran Tarifs) depuis l'import existant du classeur SITUATION DES TARIF.
 * Idempotent : sans effet si l'initialisation a déjà eu lieu ou s'il n'y a pas d'import. Aussi appelé par le seed.
 * Aucun montant n'est imprimé.
 *
 *   pnpm tariffs:init
 */
import "dotenv/config";

async function main() {
  const { initTariffGrids } = await import("../src/server/tariffs/init");
  const { prisma } = await import("../src/lib/prisma");
  try {
    const r = await initTariffGrids();
    if (r.status === "none") console.log("Aucun import du classeur : rien à initialiser.");
    else if (r.status === "done") console.log("Grilles déjà initialisées depuis le dernier import du classeur.");
    else console.log(`Grilles créées : ${r.result!.created.length} (inchangées : ${r.result!.unchanged.length}).`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e instanceof Error ? `${e.name} : ${e.message.split("\n")[0]}` : "Erreur"); process.exit(1); });
