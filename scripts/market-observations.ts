/**
 * Comparatif marché — import des relevés concurrents (fichier PRIVÉ, hors Git) et première version de la politique
 * de coût. Aucun montant imprimé. Contrôle : empreinte des prix publics (grilles de vente publiées) avant et après,
 * qui doit être identique.
 *
 *   tsx scripts/market-observations.ts --file <releves.json> [--apply]
 *   tsx scripts/market-observations.ts --policy-init <remise %> --valid-from AAAA-MM-JJ --note "<source>" [--apply]
 * La politique n'est créée que si aucune version n'existe ; ensuite elle se modifie dans l'administration.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const apply = process.argv.includes("--apply");
  const { prisma } = await import("../src/lib/prisma");
  const fingerprint = async () => {
    const rows = await prisma.supplierPriceRow.findMany({ where: { list: { scope: "GRID", nature: "SALE", status: "ACTIVE" } }, select: { listId: true, kind: true, code: true, dimAmm: true, widthMinMm: true, widthMaxMm: true, amountMinor: true, conditions: true }, orderBy: [{ listId: "asc" }, { kind: "asc" }, { code: "asc" }, { dimAmm: "asc" }, { widthMinMm: "asc" }] });
    const lists = await prisma.supplierPriceList.findMany({ where: { scope: "GRID", nature: "SALE", status: "ACTIVE" }, select: { id: true, version: true, validFrom: true, validTo: true }, orderBy: { id: "asc" } });
    return { hash: createHash("sha256").update(JSON.stringify([lists, rows])).digest("hex").slice(0, 16), lists: lists.length, rows: rows.length };
  };
  const actor = { actorEmail: "script:market-observations" };
  try {
    const before = await fingerprint();
    console.log(`Prix publics avant : ${before.lists} grille(s) de vente publiée(s), ${before.rows} ligne(s), empreinte ${before.hash}`);
    const pol = arg("--policy-init");
    if (pol) {
      const { createPolicyVersion, DEFAULT_DIRECT_COSTS } = await import("../src/server/market/policy");
      const existing = await prisma.costPolicyVersion.count();
      const bps = Math.round(Number(pol.replace(",", ".")) * 100);
      const from = new Date(`${arg("--valid-from") ?? ""}T00:00:00`);
      if (existing) console.log(`Politique de coût : ${existing} version(s) déjà présente(s) — rien créé (modification dans l'administration).`);
      else if (!Number.isInteger(bps) || Number.isNaN(from.getTime())) { console.error("Remise ou date d'effet invalide."); return 2; }
      else if (!apply) console.log("Politique de coût : version 1 à créer (aperçu ; --apply pour créer).");
      else {
        const v = await createPolicyVersion({ validFrom: from, discountBps: bps, eligibility: { structure: "ELIGIBLE" }, directCosts: DEFAULT_DIRECT_COSTS, marginTargetBps: null, contributionTargetBps: null, staleDays: 120, dimToleranceBps: 1000, rounding: { stepMinor: 1000, basis: "TTC" }, note: arg("--note") ?? "" }, actor);
        console.log(`Politique de coût : version ${v.version} créée (effet le ${v.validFrom.toLocaleDateString("fr-FR")}).`);
      }
    }
    const file = arg("--file");
    if (file) {
      const { importObservations } = await import("../src/server/market/observations");
      const data = JSON.parse(readFileSync(file, "utf8")) as unknown[];
      if (!Array.isArray(data)) { console.error("Tableau JSON attendu."); return 2; }
      const name = file.split("/").pop()!.replace(/[^\w.-]/g, "_");
      const r = await importObservations(data.map((input, i) => ({ line: i + 1, input })), `import:${name}`, actor, { dryRun: !apply });
      console.log(`Relevés${apply ? "" : " (aperçu)"} : ${r.created} ${apply ? "créé(s)" : "à créer"}, ${r.unchanged} déjà présent(s), ${r.rejected.length} rejeté(s)`);
      for (const x of r.rejected) console.log(`  ligne ${x.line} : ${x.error}`);
      if (r.rejected.length) return 1;
    }
    const after = await fingerprint();
    console.log(`Prix publics après : empreinte ${after.hash} — ${after.hash === before.hash ? "inchangés" : "MODIFIÉS (anomalie)"}`);
    return after.hash === before.hash ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().then((c) => process.exit(c), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
