/**
 * Rapport du benchmark marché (lecture seule) : par produit et configuration, niveaux A/B/C/D, statut, vendeurs
 * indépendants, fourchette et prix conseillé. Aucune collecte, aucune écriture en base.
 *
 *   tsx scripts/market/benchmark-report.ts --out <dossier privé> [--label avant|apres]
 *
 * Sorties : `<out>/rapport-<label>.md` et `.json` (PRIVÉS : montants, vendeurs) et `<out>/resume-public-<label>.md`
 * (publiable : effectifs et statuts seulement, aucun montant, aucune référence fournisseur).
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const out = arg("--out");
  if (!out) { console.error("--out <dossier> requis (dossier privé, hors Git)"); return 2; }
  if (!/(^|\/)private\//.test(out)) { console.error("Le rapport contient des montants : dossier private/ obligatoire."); return 2; }
  const label = (arg("--label") ?? "rapport").replace(/[^\w-]/g, "_");
  mkdirSync(out, { recursive: true });
  const { prisma } = await import("../../src/lib/prisma");
  const { adviceOverview } = await import("../../src/server/market/advice");
  const { ADVICE_STATUS_FR, USAGE_FR } = await import("../../src/domain/market-benchmark");
  try {
    const t0 = Date.now();
    const o = await adviceOverview();
    const ms = Date.now() - t0;
    const eur = (m: number | null | undefined) => (m == null ? "—" : `${(m / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`);
    const priv: string[] = [`# Benchmark marché — ${label} (${new Date().toISOString()})`, "", `Relevés actifs : ${o.observations} ; produits comparés : ${o.compared.any}/${o.compared.total} (dont ${o.compared.direct} en comparaison directe) ; calcul ${ms} ms.`, ""];
    const pub: string[] = [`# Benchmark marché — résumé publiable (${label})`, "", "Aucun montant, aucun vendeur, aucune référence fournisseur.", "", `- Relevés actifs : ${o.observations}`, `- Produits comparés (au moins une configuration avec fourchette) : ${o.compared.any} / ${o.compared.total} ; comparaison directe : ${o.compared.direct}`, "", "| Produit | Relevés | A | B | C | D | Configurations : statut |", "|---|---:|---:|---:|---:|---:|---|"];
    const json: unknown[] = [];
    for (const p of o.products) {
      priv.push(`## ${p.name} (${p.familySlug}) — ${p.observations} relevés : A ${p.levels.A}, B ${p.levels.B}, C ${p.levels.C}, D ${p.levels.D}`, "");
      if (p.skipped.length) priv.push(`Non étudiées : ${p.skipped.join(" ; ")}`, "");
      priv.push("| Configuration | Mon prix TTC | Marge cible TTC | Fourchette TTC | Conseillé TTC | Statut | Vendeurs A/B/C |", "|---|---:|---:|---|---:|---|---|");
      for (const c of p.configs) {
        priv.push(`| ${c.text} | ${eur(c.current?.ttcMinor)} | ${eur(c.target?.ttcMinor)} | ${c.advice?.rangeTtc ? `${eur(c.advice.rangeTtc.min)} – ${eur(c.advice.rangeTtc.max)}` : "—"} | ${eur(c.advice?.ttcMinor)} | ${ADVICE_STATUS_FR[c.position.status]} | ${c.position.sellers.direct}/${c.position.sellers.indicative - c.position.sellers.direct}/${c.position.sellers.context} |`);
      }
      priv.push("");
      for (const c of p.configs) {
        if (c.advice?.conflict) priv.push(`- Conflit (${c.key}) : ${c.advice.conflict}`);
        if (c.position.status === "insufficient" && c.position.missing.length) priv.push(`- Manque (${c.key}) : ${c.position.missing.map((m) => `${m.reason} (${m.n})`).join(" ; ")}`);
        for (const e of c.evals.filter((x) => x.usage === "direct" || x.usage === "indicative")) priv.push(`  - ${c.key} · ${e.level} ${USAGE_FR[e.usage]} · ${e.obs.retailer} (${e.obs.country}) · ${eur(e.comparableHtMinor)} HT · ${e.obs.url}`);
      }
      priv.push("");
      pub.push(`| ${p.name} | ${p.observations} | ${p.levels.A} | ${p.levels.B} | ${p.levels.C} | ${p.levels.D} | ${p.configs.map((c) => `${c.key} : ${ADVICE_STATUS_FR[c.position.status]}`).join(" ; ")} |`);
      json.push({ familySlug: p.familySlug, name: p.name, levels: p.levels, observations: p.observations, skipped: p.skipped, configs: p.configs.map((c) => ({ key: c.key, text: c.text, current: c.current, target: c.target, position: { status: c.position.status, sellers: c.position.sellers, range: c.position.range, outliers: c.position.outliers, missing: c.position.missing }, advice: c.advice, margin: c.margin, offers: c.evals.map((e) => ({ id: e.obs.id, retailer: e.obs.retailer, country: e.obs.country, url: e.obs.url, level: e.level, usage: e.usage, priceScope: e.priceScope, comparableHtMinor: e.comparableHtMinor, why: [...e.levelWhy, ...e.usageWhy] })) })) });
    }
    writeFileSync(join(out, `rapport-${label}.md`), priv.join("\n"), { mode: 0o600 });
    writeFileSync(join(out, `rapport-${label}.json`), JSON.stringify(json, null, 1), { mode: 0o600 });
    writeFileSync(join(out, `resume-public-${label}.md`), pub.join("\n"), { mode: 0o600 });
    console.log(pub.join("\n"));
    console.log(`\nRapport privé : ${join(out, `rapport-${label}.md`)} (calcul ${ms} ms)`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main().then((c) => process.exit(c), (e) => { console.error(e instanceof Error ? e.stack : e); process.exit(1); });
