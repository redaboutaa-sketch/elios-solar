/**
 * Contrôle du catalogue importé (aucun montant imprimé) : relit le fichier normalisé PRIVÉ (lecture CSV simple,
 * indépendante de l'import) et compare, pour chaque cellule des produits publiés, le prix de la structure calculé par le
 * moteur de la boutique (catalogue chargé depuis la base) :
 *  - à la cote exacte de la cellule ;
 *  - à une cote intermédiaire (1 mm au-dessus de la cote précédente de la grille) : règle « dimension supérieure ».
 *
 *   tsx scripts/pricing-check.ts --file <catalogue.csv>
 * Code de sortie 1 si une anomalie est trouvée.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

const MOUNT: Record<string, "freestanding" | "wall" | undefined> = { autoportante: "freestanding", murale: "wall" };

async function main() {
  const i = process.argv.indexOf("--file");
  const file = i > 0 ? process.argv[i + 1] : undefined;
  if (!file) { console.error("Usage : tsx scripts/pricing-check.ts --file <catalogue.csv>"); return 2; }
  const [head, ...lines] = readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean).map((l) => l.split(";"));
  const col = (n: string) => head!.indexOf(n);
  const { prisma } = await import("../src/lib/prisma");
  const { loadCatalog } = await import("../src/server/catalog/load");
  const { evaluate } = await import("../src/domain/engine");
  const { defaultSystemInput } = await import("../src/domain/system");
  try {
    const catalog = await loadCatalog({ fresh: true });
    const cells = lines.filter((c) => c[col("type_ligne")] === "grille").map((c) => {
      const f = c[col("unite")] === "cm" ? 10 : 1;
      return { family: c[col("produit")]!, variant: c[col("variante")]!, dim: Number(c[col("dim_a")]) * f, wMin: Number(c[col("largeur_min")]) * f, wMax: Number(c[col("largeur_max")]) * f, amountMinor: Math.round(Number(c[col("montant")]) * 100) };
    });
    let checked = 0, bad = 0;
    const report = new Map<string, { ok: number; ko: number; skipped: number }>();
    for (const fam of catalog.families) {
      const table = fam.systemPrices;
      if (!table?.cells.length || !fam.systemRules) continue;
      const published = new Set(Object.keys(table.variants ?? { "": null }));
      for (const cell of cells.filter((c) => c.family === fam.slug && published.has(c.variant))) {
        const key = `${fam.slug}/${cell.variant || "—"}`;
        const r = report.get(key) ?? { ok: 0, ko: 0, skipped: 0 };
        report.set(key, r);
        const rules = fam.systemRules;
        const base = { ...defaultSystemInput(fam.slug, rules), options: [], sides: {}, installation: "self" as const, ...(MOUNT[cell.variant] ? { mounting: MOUNT[cell.variant]! } : {}) };
        const dims = [...new Set(cells.filter((c) => c.family === cell.family && c.variant === cell.variant).map((c) => c.dim))].sort((a, b) => a - b);
        const prev = dims[dims.indexOf(cell.dim) - 1];
        const probes = [cell.dim, ...(prev != null && cell.dim - prev > 1 ? [prev + 1] : [])];
        for (const dim of probes) {
          const axis = table.dimAKey === "hauteur" ? { heightMm: dim } : { depthMm: dim };
          const fixed = rules.fixedSizes?.find((z) => z.widthMm === cell.wMax && z.depthMm === dim);
          if (rules.fixedSizes?.length && !fixed) { r.skipped++; continue; }
          const input = { ...base, widthMm: cell.wMin === cell.wMax ? cell.wMax : cell.wMin, ...axis, ...(fixed ? { sizeCode: fixed.code, heightMm: fixed.heightMm ?? base.heightMm } : {}) };
          const res = evaluate(catalog, input);
          // configuration bloquée par une règle du site (cote hors des bornes du modèle) : non comparable, comptée à part
          if (res.priceStatus === "blocked" || res.priceStatus === "custom") { r.skipped++; continue; }
          checked++;
          if (res.systemPrice?.amountMinor === cell.amountMinor) r.ok++;
          else { r.ko++; bad++; if (bad <= 20) console.log(`  ✗ ${key} cote ${dim} × largeur ${input.widthMm} : ${res.systemPrice ? "montant différent" : `pas de prix (${res.priceStatus})`}`); }
        }
      }
    }
    for (const [k, r] of [...report].sort()) console.log(`${k.padEnd(28)} conformes ${r.ok} · écarts ${r.ko} · non comparables (bornes ou tailles du site) ${r.skipped}`);
    console.log(`\nCellules contrôlées : ${checked} · anomalies : ${bad}`);
    return bad ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e instanceof Error ? e.message.split("\n")[0] : "Erreur"); process.exit(1); });
