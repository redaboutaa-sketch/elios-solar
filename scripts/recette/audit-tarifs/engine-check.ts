/**
 * Niveau B de /audit-tarifs : référence PDF indépendante → moteur serveur (fonction `evaluate`, catalogue chargé de la
 * base indiquée par DATABASE_URL — une copie de recette, jamais la production).
 *
 * Le résultat ATTENDU est calculé ici, à partir de la référence PDF et de la politique du manifeste (jamais avec la
 * fonction testée ni en relisant la base) : cellule retenue (plus petite tranche ≥ cote ; première tranche sous la grille
 * si la cote respecte le minimum technique documenté), prix de vente HT de la cellule, TTC arrondi à la terminaison 99 €
 * quand le moteur ne présente que la structure (aucun supplément, aucun élément à chiffrer).
 *
 *   DATABASE_URL=… tsx scripts/recette/audit-tarifs/engine-check.ts <reference.json> <sortie-dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

type Cell = { dim: number; dimMm: number; widthMinMm: number; widthMaxMm: number; catalogueEur: number | null; widthLabel: string | number };
type Grid = { knownConflicts?: Array<{ dimMm: number; widthBelowMm: number; reason: string }>; id: string; product: string; familySlug: string; variantKey: string; kind: "matrix" | "awning"; sold?: boolean; unit: string; dimAxis?: string; tech?: { widthMin?: number; dimMin?: number; fixedSizes?: boolean }; cells: Cell[]; pagePrinted: number; system: string };
type Ref = { policy: { discountBps: number; marginBps: number; vatBps: number }; grids: Grid[]; document: { sha256Checked: string } };

const ref: Ref = JSON.parse(readFileSync(process.argv[2]!, "utf8"));
const outDir = process.argv[3]!;
const P = ref.policy;
const saleCents = (eur: number) => Math.round((eur * 100 * (10000 - P.discountBps)) / (10000 - P.marginBps));
const ttc = (ht: number) => ht + Math.round((ht * P.vatBps) / 10000);
/** TTC à la terminaison 99 € la plus proche (égalité au supérieur, sous 99 € inchangé) — règle écrite ici, indépendante. */
const round99 = (t: number) => {
  if (t < 9900) return t;
  const lower = Math.floor((t - 9900) / 10000) * 10000 + 9900;
  return t - lower >= lower + 10000 - t ? lower + 10000 : lower;
};
const MOUNT: Record<string, "freestanding" | "wall"> = { autoportante: "freestanding", murale: "wall" };

async function main() {
  const { loadCatalog } = await import("../../../src/server/catalog/load");
  const { evaluate } = await import("../../../src/domain/engine");
  const { defaultSystemInput } = await import("../../../src/domain/system");
  const { prisma } = await import("../../../src/lib/prisma");
  const catalog = await loadCatalog({ fresh: true });
  const results: Array<Record<string, unknown>> = [];
  for (const g of ref.grids.filter((x) => x.sold !== false)) {
    const fam = catalog.families.find((f) => f.slug === g.familySlug);
    if (!fam?.systemRules) { results.push({ grid: g.id, status: "bloqué", reason: "famille absente du catalogue chargé" }); continue; }
    const rules = fam.systemRules;
    const d0 = defaultSystemInput(fam.slug, rules);
    const base = { ...d0, fabricCode: d0.fabricCode ?? rules.fabrics?.[0]?.code, options: [], sides: {}, installation: "self" as const, ...(MOUNT[g.variantKey] ? { mounting: MOUNT[g.variantKey]! } : {}) };
    const cells = g.cells.filter((c) => c.catalogueEur != null);
    const dims = [...new Set(cells.map((c) => c.dimMm))].sort((a, b) => a - b);
    const byHeight = g.dimAxis === "hauteur";
    const pick = (w: number, d: number): Cell | null => {
      const dd = dims.find((x) => x >= d) ?? null;
      if (dd == null) return null;
      const row = cells.filter((c) => c.dimMm === dd).sort((a, b) => a.widthMaxMm - b.widthMaxMm);
      // matrice : colonne immédiatement supérieure ; store banne : plage de largeur contenant la cote (début = largeur minimale de la ligne)
      return g.kind === "matrix" ? row.find((c) => c.widthMaxMm >= w) ?? null : row.find((c) => w >= c.widthMinMm && w <= c.widthMaxMm) ?? null;
    };
    const run = (label: string, w: number, d: number, expect: Cell | null | "none", extra: Record<string, unknown> = {}) => {
      const size = g.tech?.fixedSizes ? rules.fixedSizes?.find((z) => z.widthMm === w && z.depthMm === d) : undefined;
      const input = { ...base, widthMm: w, ...(byHeight ? { heightMm: d } : { depthMm: d }), ...(size ? { sizeCode: size.code } : {}), ...extra };
      const conflict = g.knownConflicts?.find((k) => k.dimMm === d && w < k.widthBelowMm);
      if (conflict) { results.push({ grid: g.id, product: g.product, case: label, widthMm: w, dimMm: d, status: "sans objet", detail: conflict.reason }); return; }
      const r = evaluate(catalog, input);
      const sp = r.systemPrice;
      const want = expect === "none" ? null : expect;
      const row: Record<string, unknown> = { grid: g.id, product: g.product, case: label, widthMm: w, dimMm: d, expectedCell: want ? { dimMm: want.dimMm, widthMaxMm: want.widthMaxMm, page: g.pagePrinted } : null };
      if (!want) {
        row.status = sp ? "échoué" : "réussi";
        row.detail = sp ? `prix affiché hors grille (${sp.amountMinor})` : `aucun prix (${r.priceStatus}${r.priceDetail ? `/${r.priceDetail.code}` : ""})`;
      } else {
        const exp = saleCents(want.catalogueEur!);
        const b = r.priceBreakdown;
        const structureOnly = !!b && !b.partial && b.lines.filter((l) => l.code !== "arrondi" && !/^arrondi|rounding/.test(l.code)).length === 1;
        // store banne : cellule = plage de largeur (le moteur rapporte la largeur réelle dans la plage) ; matrice : colonne exacte
        const okCell = !!sp && sp.amountMinor === exp && sp.grid.dimMm === want.dimMm && (g.kind === "awning" ? sp.grid.widthMm >= want.widthMinMm && sp.grid.widthMm <= want.widthMaxMm : sp.grid.widthMm === want.widthMaxMm);
        const okReal = !!sp && sp.requested?.widthMm === w && sp.requested?.dimMm === d;
        const expTtc = structureOnly ? round99(ttc(exp)) : null;
        const okTtc = expTtc == null || b?.totalTtcMinor === expTtc;
        row.status = okCell && okReal && okTtc ? "réussi" : "échoué";
        row.expectedSaleHtMinor = exp; row.engineSaleHtMinor = sp?.amountMinor ?? null; row.engineGrid = sp?.grid ?? null; row.selection = sp?.selection ?? null;
        row.expectedTtcMinor = expTtc; row.engineTtcMinor = b?.totalTtcMinor ?? null; row.partial = b?.partial ?? null;
        row.totalCompared = structureOnly ? "structure seule : total TTC comparé" : "suppléments ou éléments à chiffrer présents : cellule comparée, total non comparé ici";
        if (!sp) row.detail = `aucun prix : ${r.priceStatus}${r.priceDetail ? `/${r.priceDetail.code}` : ""} ; ${r.issues.filter((i) => i.severity === "blocking").map((i) => i.code).join(",")}`;
      }
      results.push(row);
    };
    const widths = [...new Set(cells.map((c) => c.widthMaxMm))].sort((a, b) => a - b);
    for (const c of cells) {
      // cote exacte de la cellule (matrice : largeur de colonne ; store banne : borne haute de la plage)
      run("cellule exacte", c.widthMaxMm, c.dimMm, c);
      if (g.tech?.fixedSizes) continue;
      // cote intermédiaire : 1 mm au-dessus de la tranche précédente sur chaque axe → même cellule (tranche supérieure)
      const pd = dims[dims.indexOf(c.dimMm) - 1];
      const pw = g.kind === "matrix" ? widths[widths.indexOf(c.widthMaxMm) - 1] : c.widthMinMm - 1;
      if (pd != null && pw != null && (g.kind === "matrix" || g.kind === "awning")) {
        if (g.kind === "matrix") run("cote intermédiaire (tranche supérieure)", pw + 1, pd + 1, c);
        else if (c.widthMinMm < c.widthMaxMm) run("largeur intermédiaire dans la plage", c.widthMinMm + 1, c.dimMm, c);
      }
    }
    if (g.kind === "matrix" && !g.tech?.fixedSizes) {
      const lastD = dims[dims.length - 1]!, lastW = widths[widths.length - 1]!;
      run("au-delà de la dernière tranche (avancée/hauteur)", lastW, lastD + 1, "none");
      run("au-delà de la dernière tranche (largeur)", lastW + 1, lastD, "none");
      if (g.tech?.dimMin != null && g.tech.dimMin < dims[0]!) run("sous la première tranche, minimum technique documenté → première tranche", Math.max(g.tech.widthMin ?? widths[0]!, 0), g.tech.dimMin, pick(widths[0]!, dims[0]!));
      if (g.tech?.widthMin != null && g.tech.widthMin < widths[0]!) run("largeur sous la première tranche, minimum technique → première tranche", g.tech.widthMin, dims[0]!, pick(widths[0]!, dims[0]!));
      if (g.tech?.dimMin != null) run("sous le minimum technique → aucun prix", g.tech.widthMin ?? widths[0]!, g.tech.dimMin - 1, "none");
    }
    if (g.familySlug === "sevilla") {
      // cas signalés : 3 700 × 3 990 → tranche 4 000 × 4 000 ; 1 500 × 2 000 → première tranche
      run("cas signalé 3 700 × 3 990, hauteur 2 450", 3700, 3990, pick(3700, 3990), { heightMm: 2450 });
      run("cas signalé 1 500 × 2 000", 1500, 2000, pick(1500, 3000), { heightMm: 2450 });
    }
  }
  await prisma.$disconnect();
  mkdirSync(outDir, { recursive: true });
  const count = (s: string) => results.filter((r) => r.status === s).length;
  const summary = { cas: results.length, réussi: count("réussi"), échoué: count("échoué"), bloqué: count("bloqué"), sansObjet: count("sans objet"), référence: ref.document.sha256Checked };
  writeFileSync(`${outDir}/engine-B.json`, JSON.stringify({ summary, results }, null, 1));
  console.log(JSON.stringify(summary));
  for (const r of results.filter((x) => x.status !== "réussi" && x.status !== "sans objet").slice(0, 40)) console.log("ÉCART", JSON.stringify(r));
  return summary.échoué + summary.bloqué > 0 ? 1 : 0;
}

main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(2); });
