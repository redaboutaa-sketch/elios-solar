import { describe, expect, it } from "vitest";
import { evaluate } from "@/domain/engine";
import { findCell, priceFromGrid, validateGrid } from "@/domain/pricing-grid";
import type { PergolaCustomInput, PriceGridSnapshot } from "@/domain/types";
import { DEMO_PRICE_GRID, buildDemoCatalog } from "@/server/catalog/demo-data";

const catalog = buildDemoCatalog();
const custom = (over: Partial<PergolaCustomInput> = {}): PergolaCustomInput => ({ kind: "pergola_custom", widthMm: 3200, lengthMm: 4500, heightMm: 2500, mounting: "freestanding", finishCode: "ANTHRACITE", sides: {}, options: [], installation: "self", delivery: { countryCode: "FR", postalCode: "69000" }, ...over });
const NOW = new Date("2026-10-19T12:00:00Z");

describe("grille tarifaire sur mesure", () => {
  it("prend le prix de la cellule (pas de m²) et applique les suppléments", () => {
    const r = priceFromGrid(DEMO_PRICE_GRID, { widthMm: 3200, lengthMm: 4500, heightMm: 2700, mounting: "wall", finishCode: "ANTHRACITE_WHITE_BLADES", closureSlugs: ["paroi-vitree", "paroi-vitree"], now: NOW });
    expect(r.status).toBe("priced");
    if (r.status !== "priced") return;
    expect(r.baseCents).toBe(539_000);
    // bicolore +150 €, adossée −120 €, hauteur 2 tranches × 60 €, 2 parois × 1 900 €
    expect(r.totalCents).toBe(539_000 + 15_000 - 12_000 + 2 * 6_000 + 2 * 190_000);
    // même surface, autre forme : prix différent (aucune proportionnalité à la surface)
    const a = priceFromGrid(DEMO_PRICE_GRID, { widthMm: 3000, lengthMm: 4000, heightMm: 2500, mounting: "freestanding", finishCode: "ANTHRACITE", now: NOW });
    const b = priceFromGrid(DEMO_PRICE_GRID, { widthMm: 4000, lengthMm: 3000, heightMm: 2500, mounting: "freestanding", finishCode: "ANTHRACITE", now: NOW });
    expect(a.status === "priced" && b.status === "priced" && a.totalCents !== b.totalCents).toBe(true);
  });

  it("zone sans tarif, hors bornes, pas invalide et grille expirée → pas de prix", () => {
    expect(priceFromGrid(DEMO_PRICE_GRID, { widthMm: 3800, lengthMm: 5500, heightMm: 2500, mounting: "wall", finishCode: "WHITE", now: NOW }).status).toBe("no_cell");
    expect(priceFromGrid(DEMO_PRICE_GRID, { widthMm: 4500, lengthMm: 4000, heightMm: 2500, mounting: "wall", finishCode: "WHITE", now: NOW }).status).toBe("out_of_bounds");
    expect(priceFromGrid(DEMO_PRICE_GRID, { widthMm: 3205, lengthMm: 4000, heightMm: 2500, mounting: "wall", finishCode: "WHITE", now: NOW }).status).toBe("out_of_bounds");
    expect(priceFromGrid(DEMO_PRICE_GRID, { widthMm: 3200, lengthMm: 4000, heightMm: 2500, mounting: "wall", finishCode: "BLACK", now: NOW }).status).toBe("finish_unavailable");
    expect(priceFromGrid({ ...DEMO_PRICE_GRID, validTo: "2026-06-30T00:00:00Z" }, { widthMm: 3200, lengthMm: 4000, heightMm: 2500, mounting: "wall", finishCode: "WHITE", now: NOW }).status).toBe("expired");
  });

  it("détecte doublons, chevauchements contradictoires, zones sans tarif et unités suspectes", () => {
    const v = validateGrid(DEMO_PRICE_GRID);
    expect(v.errors).toHaveLength(0);
    expect(v.gaps.some((g) => g.mounting === "wall" && g.widthMm[0] === 3510 && g.lengthMm[0] === 5010)).toBe(true);
    expect(validateGrid({ ...DEMO_PRICE_GRID, widthMm: { min: 2, max: 4, step: 1 } }).warnings.map((w) => w.code)).toContain("unit_suspect");
    const bad: PriceGridSnapshot = { ...DEMO_PRICE_GRID, cells: [...DEMO_PRICE_GRID.cells, DEMO_PRICE_GRID.cells[0]!, { ...DEMO_PRICE_GRID.cells[1]!, priceCents: 1 }] };
    const codes = validateGrid(bad).errors.map((e) => e.code);
    expect(codes).toContain("duplicate");
    expect(codes).toContain("overlap");
    expect(validateGrid(bad).warnings.map((w) => w.code)).toContain("price_suspect");
    expect(findCell(bad, { widthMm: 2500, lengthMm: 3500, mounting: "wall", finishCode: "WHITE" }).status).toBe("ambiguous");
  });

  it("grille fictive : estimation affichée mais jamais prix ferme ni achat", () => {
    const r = evaluate(catalog, custom(), NOW);
    expect(r.totals.totalGrossCents).toBe(539_000);
    expect(r.purchasable).toBe(false);
    expect(r.totals.isFinal).toBe(false);
    expect(r.issues.some((i) => i.code === "custom_estimate")).toBe(true);
  });

  it("grille fournisseur validée : configuration chiffrée et achetable ; hors grille → devis", () => {
    const verified = { ...catalog, custom: { ...catalog.custom, quoteOnly: false, grids: [{ ...DEMO_PRICE_GRID, isDemo: false, dataStatus: "supplier_verified" as const }] } };
    const r = evaluate(verified, custom({ sides: { left: { closureFamilySlug: "store-vertical-zip" } } }), NOW);
    expect(r.purchasable).toBe(true);
    expect(r.totals.isFinal).toBe(true);
    expect(r.totals.goodsGrossCents).toBe(539_000 + 95_000);
    const off = evaluate(verified, custom({ widthMm: 3800, lengthMm: 5500, mounting: "wall" }), NOW);
    expect(off.purchasable).toBe(false);
    expect(off.issues.some((i) => i.code === "custom_grid_no_cell")).toBe(true);
    const unpriced = evaluate(verified, custom({ options: [{ familySlug: "bandes-led", qty: 1 }] }), NOW);
    expect(unpriced.purchasable).toBe(false);
    expect(unpriced.issues.some((i) => i.code === "custom_item_unpriced")).toBe(true);
  });
});
