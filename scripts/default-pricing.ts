/**
 * Politique de vente par défaut — marge brute cible appliquée aux grilles de vente publiées (moteur des grilles).
 * Aperçu par défaut ; --apply pour écrire. Aucun montant imprimé (comptes et empreinte des prix publics seulement).
 *
 *   tsx scripts/default-pricing.ts --policy-margin 25 --valid-from AAAA-MM-JJ --note "<source>"   # nouvelle version de la politique
 *   tsx scripts/default-pricing.ts --prepare            # brouillons recalculés (idempotent)
 *   tsx scripts/default-pricing.ts --publish            # vérifie et publie les brouillons de la politique en vigueur
 *   tsx scripts/default-pricing.ts --projects           # réévalue les projets enregistrés non contractualisés
 * Les options se combinent (ordre : politique, brouillons, publication, projets).
 */
import "dotenv/config";
import { createHash } from "node:crypto";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const has = (n: string) => process.argv.includes(n);

async function main() {
  const apply = has("--apply");
  const { prisma } = await import("../src/lib/prisma");
  const fingerprint = async () => {
    const rows = await prisma.supplierPriceRow.findMany({ where: { list: { scope: "GRID", nature: "SALE", status: "ACTIVE" } }, select: { listId: true, kind: true, code: true, dimAmm: true, widthMinMm: true, widthMaxMm: true, amountMinor: true, conditions: true }, orderBy: [{ listId: "asc" }, { kind: "asc" }, { code: "asc" }, { dimAmm: "asc" }, { widthMinMm: "asc" }] });
    const lists = await prisma.supplierPriceList.findMany({ where: { scope: "GRID", nature: "SALE", status: "ACTIVE" }, select: { id: true, version: true, validFrom: true, validTo: true }, orderBy: { id: "asc" } });
    return { hash: createHash("sha256").update(JSON.stringify([lists, rows])).digest("hex").slice(0, 16), lists: lists.length, rows: rows.length };
  };
  const actor = { actorEmail: "script:default-pricing" };
  try {
    const before = await fingerprint();
    console.log(`Prix publics avant : ${before.lists} grille(s) de vente publiée(s), ${before.rows} ligne(s), empreinte ${before.hash}`);
    const { policyAt, createPolicyVersion } = await import("../src/server/market/policy");
    const margin = arg("--policy-margin");
    if (margin) {
      const bps = Math.round(Number(margin.replace(",", ".")) * 100);
      const from = new Date(`${arg("--valid-from") ?? ""}T00:00:00`);
      const cur = await policyAt();
      if (!cur) { console.error("Aucune politique de coût : créez d'abord la version 1 (remise revendeur)."); return 2; }
      if (!Number.isInteger(bps) || bps < 0 || bps > 9500 || Number.isNaN(from.getTime())) { console.error("Marge ou date d'effet invalide."); return 2; }
      if (cur.marginTargetBps === bps) console.log(`Politique de coût : v${cur.version} définit déjà cette marge cible — rien créé.`);
      else if (!apply) console.log(`Politique de coût : nouvelle version à créer depuis v${cur.version} (remise et éligibilités reprises) — aperçu.`);
      else {
        const v = await createPolicyVersion({ ...cur, validFrom: from, marginTargetBps: bps, note: arg("--note") ?? "" }, actor);
        console.log(`Politique de coût : version ${v.version} créée (effet le ${v.validFrom.toLocaleDateString("fr-FR")}).`);
      }
    }
    const { previewDefaultPricing, prepareDefaultPricing, publishDefaultPricing } = await import("../src/server/market/default-pricing");
    const report = (rows: Awaited<ReturnType<typeof previewDefaultPricing>>["rows"]) => {
      for (const r of rows) {
        const s = r.supplements;
        const state = r.refused ? `REFUSÉ : ${r.refused}` : r.draft ? (r.draft.created ? `brouillon v${r.draft.version} créé` : `version v${r.draft.version} identique (rien créé)`) : "à créer";
        console.log(`  ${r.familySlug}${r.variantKey ? `/${r.variantKey}` : ""} (vente v${r.current.version}, catalogue v${r.base?.version ?? "?"}) : ${r.changedCells}/${r.cells} cellule(s) modifiée(s) ; suppléments recalculés ${s.eligible.length + s.not_eligible.length}, conservés (éligibilité inconnue) ${s.unknown_kept.length}, % ${s.percent.length}, à chiffrer ${s.pending.length} — ${state}`);
      }
    };
    if (has("--prepare") || (!has("--publish") && !has("--projects") && !margin)) {
      if (!apply) { const p = await previewDefaultPricing(); console.log(`Aperçu (politique v${p.policy.version}) :`); report(p.rows); }
      else { const p = await prepareDefaultPricing(actor); console.log(`Brouillons (politique v${p.policy.version}) :`); report(p.rows); }
    }
    if (has("--publish")) {
      const cur = await policyAt();
      const drafts = await prisma.supplierPriceList.findMany({ where: { scope: "GRID", nature: "SALE", status: "DRAFT", notes: { startsWith: `Politique de coût v${cur?.version ?? 0} :` } }, select: { id: true, sourceKey: true, version: true } });
      if (!apply) console.log(`Publication : ${drafts.length} brouillon(s) de la politique v${cur?.version} à publier — aperçu.`);
      else {
        const res = await publishDefaultPricing(drafts.map((d) => d.id), actor);
        for (const r of res) console.log(`  ${r.sourceKey} v${r.version} : ${r.ok ? "publiée" : `ÉCHEC — ${r.error}`}`);
        if (res.some((r) => !r.ok)) return 1;
      }
    }
    if (has("--projects")) {
      // projets enregistrés non contractualisés : sans devis accepté ni commande ; les devis gardent leur instantané
      const configs = await prisma.configuration.findMany({ where: { quotes: { none: { status: "ACCEPTED" } }, cartLines: { none: {} } }, select: { id: true } });
      if (!apply) console.log(`Projets à réévaluer : ${configs.length} — aperçu.`);
      else {
        const { getConfigurationWithRevalidation } = await import("../src/server/configuration/service");
        let changed = 0;
        for (const c of configs) { const r = await getConfigurationWithRevalidation({ id: c.id }); if (r?.diff) changed++; }
        console.log(`Projets réévalués : ${configs.length}, dont ${changed} avec un résultat mis à jour (avis affiché au client à l'ouverture).`);
      }
    }
    const after = await fingerprint();
    console.log(`Prix publics après : empreinte ${after.hash} — ${after.hash === before.hash ? "inchangés" : "modifiés (publication)"}`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main().then((c) => process.exit(c), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
