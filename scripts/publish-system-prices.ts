/**
 * Publication des prix publics des systèmes HELIOSTORES (décision client du 2026-10-21) :
 * active une version du classeur SITUATION DES TARIF et renseigne sa devise et sa base fiscale. Seule la colonne
 * « Prix final HELIOSTORES » est ensuite lue par le catalogue (src/server/pricing/system-prices.ts).
 *
 *   pnpm system-prices:publish --currency EUR --tax HT                # dernière version importée du classeur
 *   pnpm system-prices:publish --currency EUR --tax HT --version 2    # version précise
 *   pnpm supplier-prices:import --rollback xlsx-situation-des-tarif   # revenir à la version précédente
 *
 * Aucun montant n'est imprimé. Codes de sortie : 0 succès · 2 usage · 5 refus (version absente ou rejetée).
 */
import "dotenv/config";

const ACTOR = { actorUserId: null, actorEmail: "cli:system-prices:publish" };

async function main() {
  const argv = process.argv.slice(2);
  const val = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const currency = val("--currency");
  const version = val("--version");
  const tax = val("--tax");
  if (!currency || !/^[A-Z]{3}$/.test(currency) || (tax !== "HT" && tax !== "TTC") || (version != null && !/^\d+$/.test(version))) {
    console.error("Usage : pnpm system-prices:publish --currency <ISO, ex. EUR> --tax <HT|TTC> [--version <n>]");
    return 2;
  }
  const { prisma } = await import("../src/lib/prisma");
  const { PUBLIC_PRICE_SOURCE_KEY } = await import("../src/server/pricing/source");
  const { activateSupplierPriceList, SupplierPriceError } = await import("../src/server/supplier-prices/import");
  const { audit } = await import("../src/server/audit");
  try {
    const list = await prisma.supplierPriceList.findFirst({ where: { sourceKey: PUBLIC_PRICE_SOURCE_KEY, ...(version ? { version: Number(version) } : {}) }, orderBy: { version: "desc" }, select: { id: true, version: true, status: true, currency: true } });
    if (!list) { console.error(`Aucune version du classeur « ${PUBLIC_PRICE_SOURCE_KEY} »${version ? ` v${version}` : ""}.`); return 5; }
    await prisma.supplierPriceList.update({
      where: { id: list.id },
      data: {
        currency,
        currencyNote: `Devise ${currency} fixée par décision client du 2026-10-21 (le classeur n'indique aucune devise ; les fiches DOCX mentionnent DH).`,
        taxBasis: tax,
        nature: "SALE",
        natureNote: `Décision client du 2026-10-21 : la colonne « Prix final HELIOSTORES » est le prix public affiché sur le site, ${tax}.`,
      },
    });
    await audit({ ...ACTOR, action: "supplierPrices.publicCurrency", entity: "SupplierPriceList", entityId: list.id, before: { currency: list.currency }, after: { currency, taxBasis: tax, nature: "SALE" } });
    const r = await activateSupplierPriceList(list.id, ACTOR, "supplierPrices.publish");
    const rows = await prisma.supplierPriceRow.count({ where: { listId: list.id, amountRole: "PRIX_FINAL", kind: "GRID", amountMinor: { not: null }, status: { not: "REJECTED" } } });
    console.log(`Classeur v${list.version} actif (${currency}, ${tax})${r.previous ? `, v${r.previous.version} archivée` : ""} : ${rows} cellule(s) « Prix final HELIOSTORES » dans la version (seules celles des familles publiées sont affichées).`);
    return 0;
  } catch (e) {
    if (e instanceof SupplierPriceError) { console.error(e.message); return 5; }
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

main().then((c) => { process.exitCode = c; }).catch((e) => { console.error(e); process.exit(1); });
