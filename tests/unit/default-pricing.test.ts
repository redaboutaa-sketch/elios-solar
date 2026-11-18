import { describe, expect, it } from "vitest";
import { marginOf, netCostOf, policySaleMinor, validMarginBps } from "@/domain/market";

/** Politique de vente par défaut : montants FICTIFS, attendus calculés à la main. */
describe("politique de vente par défaut (marge brute cible sur le prix de vente)", () => {
  it("contrôle : catalogue 4 000 € HT, remise 37 %, marge 25 % → achat 2 520 €, vente 3 360 €, marge 840 € (25 %)", () => {
    const sale = policySaleMinor(400_000, "ELIGIBLE", 3700, 2500)!;
    expect(sale).toBe(336_000);
    const cost = netCostOf({ currency: "EUR", taxBasis: "HT", vatRateBps: 2000, lines: [{ code: "structure", label: "Structure", amountMinor: 400_000 }], pending: [], totalMinor: 400_000, totalTtcMinor: null, partial: false, listVersion: 1 }, [], { discountBps: 3700, eligibility: {} });
    expect(cost.knownNetMinor).toBe(252_000);
    const m = marginOf(sale, cost.knownNetMinor);
    expect(m.grossMinor).toBe(84_000);
    expect(m.onPriceBps).toBe(2500); // marge sur vente
    expect(m.onCostBps).toBe(3333); // majoration du coût : 840 / 2 520 = 33,33 % (à ne pas confondre)
  });

  it("produit entièrement éligible : vente = catalogue × 0,84", () => {
    for (const c of [100, 12_345, 465_500, 999_999]) expect(policySaleMinor(c, "ELIGIBLE", 3700, 2500)).toBe(Math.round(((c - Math.floor((c * 3700 + 5000) / 10_000)) * 4) / 3));
    expect(policySaleMinor(465_500, "ELIGIBLE", 3700, 2500)).toBe(391_020);
  });

  it("ligne non éligible : prix catalogue ÷ 0,75, jamais × 0,84", () => {
    expect(policySaleMinor(30_000, "NOT_ELIGIBLE", 3700, 2500)).toBe(40_000);
    expect(policySaleMinor(10_000, "NOT_ELIGIBLE", 3700, 2500)).toBe(13_333);
  });

  it("éligibilité inconnue : aucun prix promis à la marge cible (null)", () => {
    expect(policySaleMinor(76_900, "UNKNOWN", 3700, 2500)).toBeNull();
  });

  it("marge invalide refusée", () => {
    expect(validMarginBps(2500)).toBe(true);
    expect(validMarginBps(10_000)).toBe(false);
    expect(() => policySaleMinor(1000, "ELIGIBLE", 3700, 10_000)).toThrow();
    expect(() => policySaleMinor(1000, "ELIGIBLE", 3700, -1)).toThrow();
  });

  it("remise appliquée une seule fois : marge exacte sur un coût déjà net", () => {
    // achat net déclaré non éligible (déjà net) : aucune seconde remise
    const sale = policySaleMinor(252_000, "NOT_ELIGIBLE", 3700, 2500)!;
    expect(sale).toBe(336_000);
  });
});
