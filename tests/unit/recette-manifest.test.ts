import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildHeliostoresCatalog } from "@/server/catalog/heliostores-data";

/**
 * Manifeste de l'audit des tarifs (/audit-tarifs) : structure attendue des grilles du PDF fournisseur, SANS montant.
 * La CI n'a pas le PDF : elle vérifie seulement que le manifeste reste cohérent avec le catalogue du code (familles,
 * bornes techniques, correspondances commerciales) et ne contient aucun montant. Ce test ne prouve PAS la conformité
 * des prix au PDF (audit intégral : sur le VPS, scripts/recette/audit-tarifs/run.sh).
 */
const manifest = JSON.parse(readFileSync("scripts/recette/audit-tarifs/manifest.json", "utf8")) as {
  grids: Array<{ id: string; product: string; system: string; familySlug: string; kind: string; unit: string; dims: number[]; widths?: number[]; columns?: number[][]; sold?: boolean; visual: string; pageIndex: number }>;
  policy: { discountBps: number; marginBps: number; vatBps: number };
};
const catalog = buildHeliostoresCatalog();
const SYSTEMS: Record<string, string> = { HelioSky: "SB 350", HelioMax: "SB 450", HelioLux: "SOLID", HelioScreen: "R 120 ZiiiP", HelioRoof: "VÉRANDA V ZiiiP", HelioSun: "CASABLANCA", HelioShade: "CORSICA", HelioPro: "JAMAICA", HelioSquare: "MADEIRA" };

describe("manifeste de l'audit des tarifs", () => {
  it("aucun montant : seules des structures (axes, pages) et la politique décidée", () => {
    const text = readFileSync("scripts/recette/audit-tarifs/manifest.json", "utf8");
    expect(text).not.toMatch(/catalogueEur|amountMinor|montant"\s*:/);
    expect(manifest.policy).toEqual({ discountBps: 3700, marginBps: 2500, vatBps: 2000, rounding: "nearest_99_ttc", $comment: expect.any(String) });
  });

  it("correspondances commerciales → systèmes fournisseur (jamais les anciennes associations VZIP / FTS)", () => {
    for (const g of manifest.grids) expect([g.product, g.system]).toEqual([g.product, SYSTEMS[g.product]]);
    expect(JSON.stringify(manifest)).not.toMatch(/\bFTS\b|VZIP(?!.*ZiiiP)/);
  });

  it("chaque grille vendue correspond à une famille du catalogue, axes croissants et dans les bornes techniques du code", () => {
    for (const g of manifest.grids.filter((x) => x.sold !== false)) {
      const fam = catalog.families.find((f) => f.slug === g.familySlug);
      expect(fam?.systemRules, g.id).toBeTruthy();
      const r = fam!.systemRules!;
      const scale = g.unit === "cm" ? 10 : 1;
      const dims = g.dims.map((d) => d * scale);
      expect([...dims].sort((a, b) => a - b), g.id).toEqual(dims);
      const dimRule = g.id === "helioscreen" ? r.dims.height! : r.dims.depth!;
      if (dimRule.valuesMm?.length) for (const d of dims) expect(dimRule.valuesMm, `${g.id} ${d}`).toContain(d);
      else expect(Math.max(...dims), g.id).toBeLessThanOrEqual(dimRule.maxMm);
      const widths = (g.widths ?? g.columns!.map((c) => c[1]!)).map((w) => w * scale);
      expect(Math.max(...widths), g.id).toBeLessThanOrEqual(r.dims.width.maxMm);
      expect(g.visual, g.id).toMatch(/contrôlé visuellement|non contrôlé visuellement/);
    }
  });
});
