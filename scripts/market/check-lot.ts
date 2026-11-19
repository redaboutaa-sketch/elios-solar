/**
 * Contrôle d'un lot de relevés AVANT import (aucune écriture en base) :
 * - schéma du relevé (mêmes règles que l'import et l'administration) ;
 * - preuve : le montant observé (et le prix normal, s'il existe) figure dans les citations ; cotes citées ;
 * - capture privée présente si elle est déclarée ;
 * - doublons dans le lot (même vendeur, modèle, cotes, implantation, date) ;
 * - cohérence : promotion < prix normal, niveau A seulement avec un système fournisseur cité.
 * Un relevé qui échoue n'est pas importé tel quel : il est corrigé, ou importé « à revérifier » (--mark-recheck écrit
 * un lot corrigé à côté du lot d'origine).
 *
 *   tsx scripts/market/check-lot.ts <lot.json> [--mark-recheck]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const fmtVariants = (minor: number): string[] => {
  const e = Math.floor(minor / 100), c = minor % 100;
  const int = String(e);
  const groups = int.replace(/\B(?=(\d{3})+(?!\d))/g, "§");
  const seps = ["", " ", " ", " ", ".", ","];
  const out = new Set<string>();
  for (const s of seps) {
    const g = groups.replace(/§/g, s);
    out.add(c ? `${g},${String(c).padStart(2, "0")}` : g);
    out.add(c ? `${g}.${String(c).padStart(2, "0")}` : g);
    if (!c) { out.add(`${g},00`); out.add(`${g}.00`); out.add(`${g},-`); }
  }
  return [...out];
};
const norm = (s: string) => s.replace(/[  ]/g, " ");

async function main() {
  const file = process.argv[2];
  if (!file) { console.error("usage : check-lot.ts <lot.json> [--mark-recheck]"); return 2; }
  const { observationSchema, withLegacyComparability } = await import("../../src/server/market/observations");
  const raw = JSON.parse(readFileSync(file, "utf8")) as { lot?: string; records?: Record<string, unknown>[]; sources?: unknown[] } | Record<string, unknown>[];
  const records = (Array.isArray(raw) ? raw : raw.records ?? []) as Record<string, unknown>[];
  const base = dirname(file).replace(/\/lots$/, "");
  const problems: Array<{ i: number; who: string; issues: string[] }> = [];
  const seen = new Map<string, number>();
  let ok = 0;
  for (const [i, r] of records.entries()) {
    const issues: string[] = [];
    const who = `${r.retailer ?? "?"} — ${String(r.model ?? "?").slice(0, 60)}`;
    const p = observationSchema.safeParse(withLegacyComparability(r));
    if (!p.success) issues.push(...p.error.issues.slice(0, 4).map((x) => `schéma ${x.path.join(".")} : ${x.message}`));
    const ev = norm(String(r.evidence ?? ""));
    for (const k of ["priceMinor", "regularPriceMinor"] as const) {
      const v = r[k];
      if (typeof v === "number" && v > 0 && !fmtVariants(v).some((f) => ev.includes(f))) issues.push(`${k} ${v / 100} absent des citations`);
    }
    if (typeof r.capture === "string" && r.capture && !existsSync(join(base, r.capture))) issues.push(`capture absente : ${r.capture}`);
    if (r.matchLevel === "A" && !String(r.supplierSystem ?? "").trim()) issues.push("niveau A sans système fournisseur cité");
    if (typeof r.promoPriceMinor === "number" && typeof r.regularPriceMinor === "number" && r.promoPriceMinor >= r.regularPriceMinor) issues.push("promotion ≥ prix normal");
    // doublon = même page, mêmes cotes, même date (deux domaines d'une même société restent deux annonces d'UN vendeur)
    const key = [r.url, r.widthMm, r.depthMm, r.heightMm, r.mounting, r.controlKind, r.options, r.priceMinor, r.observedAt].join("|").toLowerCase();
    if (seen.has(key)) issues.push(`doublon de l'entrée ${seen.get(key)! + 1}`); else seen.set(key, i);
    if (issues.length) problems.push({ i, who, issues }); else ok++;
  }
  const levels = records.reduce<Record<string, number>>((a, r) => ({ ...a, [String(r.matchLevel ?? "—")]: (a[String(r.matchLevel ?? "—")] ?? 0) + 1 }), {});
  const countries = records.reduce<Record<string, number>>((a, r) => ({ ...a, [String(r.country ?? "?")]: (a[String(r.country ?? "?")] ?? 0) + 1 }), {});
  console.log(`${file} : ${records.length} relevé(s), ${ok} conforme(s), ${problems.length} à corriger ; niveaux ${JSON.stringify(levels)} ; pays ${JSON.stringify(countries)} ; sources examinées ${Array.isArray(raw) ? "—" : (raw.sources ?? []).length}`);
  for (const p of problems) console.log(`  #${p.i + 1} ${p.who} : ${p.issues.join(" ; ")}`);
  if (process.argv.includes("--mark-recheck") && problems.length) {
    const fixed = records.map((r, i) => {
      const pr = problems.find((p) => p.i === i);
      if (!pr) return r;
      // schéma invalide : relevé écarté (jamais importé) ; preuve incomplète : importé « à revérifier », hors calcul
      if (pr.issues.some((x) => x.startsWith("schéma") || x.startsWith("doublon"))) return null;
      return { ...r, validation: "TO_RECHECK", notes: [String(r.notes ?? ""), `Contrôle du lot : ${pr.issues.join(" ; ")}`].filter(Boolean).join("\n") };
    }).filter(Boolean);
    const out = file.replace(/\.json$/, ".controle.json");
    writeFileSync(out, JSON.stringify({ ...(Array.isArray(raw) ? {} : raw), records: fixed }, null, 1), { mode: 0o600 });
    console.log(`Lot contrôlé écrit : ${out} (${fixed.length} relevé(s) ; écartés : ${records.length - fixed.length})`);
  }
  return problems.length ? 1 : 0;
}

main().then((c) => process.exit(c), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
