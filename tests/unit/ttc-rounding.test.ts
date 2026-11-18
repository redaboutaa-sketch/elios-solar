import { describe, expect, it } from "vitest";
import { evaluate } from "@/domain/engine";
import { defaultSystemInput, type SystemInput } from "@/domain/system";
import { applyBpsHalfUp, roundTo99, roundTtcTo99, ROUNDING_LINE, type PriceSupplement, type SystemPriceTable } from "@/domain/system-pricing";
import { buildHeliostoresCatalog } from "@/server/catalog/heliostores-data";

/**
 * Arrondi commercial TTC à la terminaison 99 € (décision du client du 2026-11-13). Grilles FICTIVES ; attendus calculés
 * à la main. Ordre : HT de la grille → TTC → un seul arrondi du TTC → HT final = TTC ÷ 1,2 au centime, TVA = TTC − HT.
 */
describe("terminaison 99 € la plus proche", () => {
  it("exemples validés par le client (TTC)", () => {
    expect(roundTo99(707_616).roundedMinor).toBe(709_900);
    expect(roundTo99(545_376).roundedMinor).toBe(549_900);
    expect(roundTo99(469_224).roundedMinor).toBe(469_900);
    expect(roundTo99(80_640).roundedMinor).toBe(79_900);
    expect(roundTo99(60_984).roundedMinor).toBe(59_900);
  });
  it("égalité : montant supérieur ; déjà terminé par 99 € : inchangé ; sous 99 € : conservé et signalé", () => {
    expect(roundTo99(14_900)).toEqual({ roundedMinor: 19_900, adjustmentMinor: 5_000, exception: null });
    expect(roundTo99(709_900)).toEqual({ roundedMinor: 709_900, adjustmentMinor: 0, exception: null });
    expect(roundTo99(9_900)).toEqual({ roundedMinor: 9_900, adjustmentMinor: 0, exception: null });
    expect(roundTo99(5_000)).toEqual({ roundedMinor: 5_000, adjustmentMinor: 0, exception: "below_99" });
    expect(roundTo99(9_899).exception).toBe("below_99");
  });
});

describe("ventilation HT / TVA / TTC", () => {
  it("5 896,80 € HT → 7 076,16 € TTC → 7 099 € TTC = 5 915,83 € HT + 1 183,17 € TVA", () => {
    expect(roundTtcTo99(589_680, 2000)).toEqual({ computedHtMinor: 589_680, computedTtcMinor: 707_616, ttcMinor: 709_900, adjustmentTtcMinor: 2_284, htMinor: 591_583, vatMinor: 118_317, ventilationMinor: 0, exception: null });
  });
  it("TTC final exact pour tout montant ; écart de ventilation de la TVA au plus d'un centime, documenté", () => {
    for (let ht = 8_300; ht < 2_000_000; ht += 997) {
      const r = roundTtcTo99(ht, 2000);
      if (r.exception) { expect(r.ttcMinor).toBe(ht + applyBpsHalfUp(ht, 2000)); continue; }
      expect(r.ttcMinor % 10_000).toBe(9_900);
      expect(r.htMinor + r.vatMinor).toBe(r.ttcMinor);
      expect(Math.abs(r.ventilationMinor)).toBeLessThanOrEqual(1);
      expect(r.ventilationMinor).toBe(r.vatMinor - applyBpsHalfUp(r.htMinor, 2000));
      // jamais de double arrondi : réarrondir le TTC final ne change rien
      expect(roundTo99(r.ttcMinor).roundedMinor).toBe(r.ttcMinor);
    }
  });
  it("autre taux (TVA de la grille) : même règle, TTC exact", () => {
    const r = roundTtcTo99(100_000, 1000); // 1 100 € TTC → 1 099 €
    expect(r).toMatchObject({ ttcMinor: 109_900, htMinor: 99_909, vatMinor: 9_991 });
  });
});

const real = buildHeliostoresCatalog();
const rules = (slug: string) => real.families.find((f) => f.slug === slug)!.systemRules!;
const meta = (supplements: PriceSupplement[] = []) => ({ currency: "EUR", taxBasis: "HT" as const, dimRule: "round_up" as const, vatRateBps: 2000, listVersion: 4, supplements, saleRounding: "nearest_99_ttc" as const });
const table = (supplements: PriceSupplement[] = []): SystemPriceTable => ({ currency: "EUR", taxBasis: "HT", dimAKey: "projection", listVersion: 4, variants: { autoportante: meta(supplements) }, cells: [{ variantKey: "autoportante", dimAmm: 1930, widthMinMm: 2000, widthMaxMm: 2000, amountMinor: 589_680 }] });
const withTable = (t: SystemPriceTable) => ({ ...real, families: real.families.map((f) => (f.slug === "marbella" ? { ...f, systemPrices: t } : f)) });
const cfg = (over: Partial<SystemInput> = {}): SystemInput => ({ ...defaultSystemInput("marbella", rules("marbella")), mounting: "freestanding", widthMm: 2000, depthMm: 1930, finishCode: "RAL_7016_MAT", options: [], sides: {}, installation: "self", ...over });

describe("moteur : arrondi du total final de la configuration", () => {
  it("structure seule : TTC 7 099 €, HT final 5 915,83 €, ligne d'arrondi = écart HT ; avant arrondi conservé ; commandable", () => {
    const r = evaluate(withTable(table()), cfg());
    const b = r.priceBreakdown!;
    expect(b).toMatchObject({ computedMinor: 589_680, computedTtcMinor: 707_616, totalTtcMinor: 709_900, totalMinor: 591_583, roundingTtcMinor: 2_284, roundingMinor: 1_903, vatMinor: 118_317, ventilationMinor: 0, rounding: "nearest_99_ttc" });
    expect(b.lines.map((l) => l.code)).toEqual(["structure", ROUNDING_LINE]);
    expect(b.lines.reduce((a, l) => a + l.amountMinor, 0)).toBe(b.totalMinor);
    // la ligne d'arrondi n'est pas un supplément : structure seule commandable, au TTC affiché
    expect(r.onlineOrder!.reasons.join(" ")).not.toMatch(/suppléments/);
    if (r.onlineOrder!.ok) expect(r.lines[0]!.unitGrossCents).toBe(709_900);
  });
  it("option chiffrée : un seul arrondi sur le total (jamais par composant)", () => {
    const sup: PriceSupplement[] = [{ code: "led", label: "LED", mode: "fixed", amountMinor: 76_900, applies: ["option:led_perimeter"] }];
    const b = evaluate(withTable(table(sup)), cfg({ options: [{ code: "led_perimeter" }] })).priceBreakdown!;
    // 5 896,80 + 769 = 6 665,80 HT → 7 998,96 TTC → 7 999 TTC
    expect(b).toMatchObject({ computedMinor: 666_580, computedTtcMinor: 799_896, totalTtcMinor: 799_900 });
    expect(b.lines.filter((l) => l.code === ROUNDING_LINE)).toHaveLength(1);
    expect(b.lines.find((l) => l.code === "led")!.amountMinor).toBe(76_900);
  });
  it("sous-total partiel : aucun arrondi, éléments à chiffrer conservés", () => {
    const sup: PriceSupplement[] = [{ code: "led", label: "LED", mode: "pending", applies: ["option:led_perimeter"] }];
    const b = evaluate(withTable(table(sup)), cfg({ options: [{ code: "led_perimeter" }] })).priceBreakdown!;
    expect(b.partial).toBe(true);
    expect(b.totalMinor).toBe(589_680);
    expect(b.totalTtcMinor).toBe(707_616);
    expect(b.lines.some((l) => l.code === ROUNDING_LINE)).toBe(false);
  });
  it("grille sans arrondi : prix calculé inchangé", () => {
    const t = table();
    t.variants!.autoportante!.saleRounding = "none";
    const b = evaluate(withTable(t), cfg()).priceBreakdown!;
    expect(b).toMatchObject({ totalMinor: 589_680, totalTtcMinor: 707_616, roundingTtcMinor: 0 });
  });
});
