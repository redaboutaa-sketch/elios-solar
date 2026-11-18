import { describe, expect, it } from "vitest";
import { cellForTotal, contributionOf, evaluateObservation, floorPrice, marginOf, marketStats, netCostOf, recommend, roundPrice, type DirectCostInput, type Observation, type StudyContext } from "@/domain/market";
import type { PriceBreakdown, PriceSupplement } from "@/domain/system-pricing";

/**
 * Comparatif marché : montants FICTIFS (aucun prix réel dans le dépôt). Chaque attendu est calculé à la main.
 */
const bd = (lines: PriceBreakdown["lines"], pending: PriceBreakdown["pending"] = []): PriceBreakdown => ({ currency: "EUR", taxBasis: "HT", vatRateBps: 2000, lines, pending, totalMinor: lines.reduce((a, l) => a + l.amountMinor, 0), totalTtcMinor: null, partial: pending.length > 0, listVersion: 1 });
const policy = { discountBps: 3700, eligibility: {} };

describe("coût d'achat net", () => {
  it("contrôle indépendant : catalogue 4 000 € HT, remise 37 % → achat 2 520 € ; vente 4 000 € → marge 1 480 €", () => {
    const c = netCostOf(bd([{ code: "structure", label: "Structure", amountMinor: 400_000 }]), [], policy);
    expect(c.knownNetMinor).toBe(252_000);
    expect(c.partial).toBe(false);
    const m = marginOf(400_000, c.knownNetMinor);
    expect(m.grossMinor).toBe(148_000);
    expect(m.onPriceBps).toBe(3700); // 1 480 / 4 000
    expect(m.onCostBps).toBe(5873); // 1 480 / 2 520 = 58,73 %
  });

  it("pourcentage : appliqué à la structure APRÈS remise, jamais remisé deux fois", () => {
    const sup: PriceSupplement[] = [{ code: "decor", label: "Décor bois", mode: "percent", percentBps: 2000, applies: ["finition:bois"] }];
    const c = netCostOf(bd([{ code: "structure", label: "S", amountMinor: 400_000 }, { code: "decor", label: "Décor bois", amountMinor: 80_000, detail: "20 % du prix de la structure" }]), sup, policy);
    // 20 % de 2 520 € = 504 € (et non 20 % × 4 000 × 0,63 × 0,63)
    expect(c.lines.find((l) => l.code === "decor")!.netMinor).toBe(50_400);
    expect(c.knownNetMinor).toBe(252_000 + 50_400);
  });

  it("éligibilité inconnue : remise non appliquée, coût non établi, hypothèse prudente au prix catalogue", () => {
    const sup: PriceSupplement[] = [{ code: "moteur-io", label: "Moteur io", mode: "fixed", amountMinor: 30_000, applies: ["commande:radio_io"] }];
    const c = netCostOf(bd([{ code: "structure", label: "S", amountMinor: 400_000 }, { code: "moteur-io", label: "Moteur io", amountMinor: 30_000 }]), sup, policy);
    const motor = c.lines.find((l) => l.code === "moteur-io")!;
    expect(motor.netMinor).toBeNull();
    expect(motor.basis).toBe("unknown");
    expect(c.knownNetMinor).toBe(252_000);
    expect(c.prudentNetMinor).toBe(282_000);
    expect(c.partial).toBe(true);
    // déclaré éligible : 300 × 0,63 = 189 €
    const e = netCostOf(bd([{ code: "structure", label: "S", amountMinor: 400_000 }, { code: "moteur-io", label: "Moteur io", amountMinor: 30_000 }]), sup, { discountBps: 3700, eligibility: { "supplement:moteur-io": "ELIGIBLE" } });
    expect(e.knownNetMinor).toBe(252_000 + 18_900);
    expect(e.partial).toBe(false);
  });

  it("élément à chiffrer : coût manquant", () => {
    const c = netCostOf(bd([{ code: "structure", label: "S", amountMinor: 100_000 }], [{ code: "moteur", label: "Moteur", reason: "plusieurs moteurs" }]), [], policy);
    expect(c.missing).toHaveLength(1);
    expect(c.partial).toBe(true);
  });
});

describe("contribution et plancher", () => {
  const costs: DirectCostInput[] = [
    { key: "transport", status: "known", mode: "fixed", amountMinor: 20_000, billedToClient: true },
    { key: "pose", status: "na", mode: "fixed" },
    { key: "paiement", status: "known", mode: "percent", percentBps: 150, base: "sale_ttc" },
    { key: "acquisition", status: "known", mode: "fixed", amountMinor: 10_000 },
    { key: "sav", status: "unknown", mode: "percent" },
    { key: "commission", status: "known", mode: "percent", percentBps: 300, base: "sale_ht" },
  ];

  it("coûts à notre charge déduits ; refacturé exclu ; inconnu → contribution partielle", () => {
    const c = contributionOf(400_000, 480_000, { netMinor: 252_000, partial: false }, costs);
    // paiement 1,5 % de 4 800 = 72 ; acquisition 100 ; commission 3 % de 4 000 = 120 ; transport refacturé
    expect(c.chargedMinor).toBe(7_200 + 10_000 + 12_000);
    expect(c.contributionMinor).toBe(148_000 - 29_200);
    expect(c.partial).toBe(true);
    expect(c.missing).toContain("Provision SAV");
  });

  it("plancher de marge : coût / (1 − t)", () => {
    const f = floorPrice({ costMinor: 252_000, costPartial: false, costMissing: [], vatRateBps: 2000, costs, marginTargetBps: 3000, contributionTargetBps: null });
    expect(f.floorHtMinor).toBe(360_000); // 2 520 / 0,7
  });

  it("plancher de contribution : (coût + fixes) / (1 − t − %HT − %TTC×1,2)", () => {
    const f = floorPrice({ costMinor: 252_000, costPartial: false, costMissing: [], vatRateBps: 2000, costs, marginTargetBps: null, contributionTargetBps: 2000 });
    // den = 1 − 0,20 − 0,03 − 0,015×1,2 = 0,752 ; num = 2 520 + 100 = 2 620 → 3 484,04 €
    expect(f.floorHtMinor).toBe(Math.ceil(262_000 / 0.752));
    expect(f.missing).toContain("Provision SAV");
  });

  it("objectif non défini : aucun plancher inventé", () => {
    const f = floorPrice({ costMinor: 252_000, costPartial: false, costMissing: [], vatRateBps: 2000, costs, marginTargetBps: null, contributionTargetBps: null });
    expect(f.floorHtMinor).toBeNull();
  });
});

const ctx: StudyContext = { familySlug: "marbella", widthMm: 4000, depthMm: 4000, mounting: "freestanding", country: "FR", vatRateBps: 2000, ours: { delivery: "extra", installation: "extra", motor: "included", remote: "included", led: "absent", screen: "absent", glazing: "absent" }, now: new Date("2026-11-04"), staleDays: 120, dimToleranceBps: 1000 };
const equalScope = { delivery: { status: "extra" as const }, installation: { status: "extra" as const }, motor: { status: "included" as const }, remote: { status: "included" as const }, led: { status: "absent" as const }, screen: { status: "absent" as const }, glazing: { status: "absent" as const } };
const obs = (o: Partial<Observation>): Observation => ({ id: "x", retailer: "R", manufacturer: "", model: "M", url: "https://ex.test", observedAt: new Date("2026-11-01"), country: "FR", currency: "EUR", familySlug: "marbella", widthMm: 4000, depthMm: 4000, mounting: "freestanding", priceMinor: 600_000, taxBasis: "TTC", priceKind: "configured", regularPriceMinor: null, promoPriceMinor: null, promoEnd: null, scope: equalScope, comparability: "STRONG", status: "ACTIVE", ...o });

describe("comparables", () => {
  it("offre équivalente retenue, TTC converti avec la TVA validée", () => {
    const e = evaluateObservation(obs({}), ctx);
    expect(e.retained).toBe(true);
    expect(e.comparableHtMinor).toBe(500_000);
  });

  it("livraison comprise chez le concurrent, montant non vérifiable : présentée séparément", () => {
    const e = evaluateObservation(obs({ scope: { ...equalScope, delivery: { status: "included" } } }), ctx);
    expect(e.retained).toBe(false);
    expect(e.gaps[0]!.key).toBe("delivery");
  });

  it("supplément vérifiable : normalisé (télécommande en option chez le concurrent)", () => {
    const e = evaluateObservation(obs({ scope: { ...equalScope, remote: { status: "extra", extraAmountMinor: 12_000 } } }), ctx);
    expect(e.retained).toBe(true);
    expect(e.comparableHtMinor).toBe(500_000 + 10_000);
  });

  it("« à partir de », promotion seule, relevé ancien, dimensions éloignées : écartés", () => {
    expect(evaluateObservation(obs({ priceKind: "from" }), ctx).retained).toBe(false);
    expect(evaluateObservation(obs({ promoPriceMinor: 600_000 }), ctx).retained).toBe(false);
    expect(evaluateObservation(obs({ observedAt: new Date("2026-01-01") }), ctx).retained).toBe(false);
    expect(evaluateObservation(obs({ widthMm: 3000 }), ctx).retained).toBe(false);
    // promotion avec prix normal vérifiable : le prix normal est retenu
    expect(evaluateObservation(obs({ priceMinor: 540_000, promoPriceMinor: 540_000, regularPriceMinor: 600_000 }), ctx).comparableHtMinor).toBe(500_000);
  });

  it("statistiques et indépendance (un fabricant compte une fois)", () => {
    const evals = [obs({ priceMinor: 480_000, retailer: "A" }), obs({ priceMinor: 600_000, retailer: "B" }), obs({ priceMinor: 720_000, retailer: "C", manufacturer: "A" })].map((o) => evaluateObservation(o, ctx));
    const s = marketStats(evals);
    expect(s.n).toBe(3);
    expect(s.independent).toBe(2);
    expect(s.medianMinor).toBe(500_000);
    expect(s.minMinor).toBe(400_000);
  });
});

describe("recommandation", () => {
  const stats = (prices: number[], independent = prices.length) => ({ n: prices.length, independent, minMinor: Math.min(...prices), maxMinor: Math.max(...prices), medianMinor: prices[Math.floor(prices.length / 2)]!, q1Minor: prices[0]!, q3Minor: prices.at(-1)!, dates: { from: null, to: null } });
  const floor = (ht: number | null) => ({ floorHtMinor: ht, objective: ht == null ? null : ("margin" as const), targetBps: 3000, reason: "", counted: [], missing: [] });

  it("jamais sous le plancher : marché sous le seuil → aucun prix conseillé, écart affiché", () => {
    const r = recommend({ stats: stats([300_000, 320_000, 340_000]), floor: floor(360_000), vatRateBps: 2000, rounding: { stepMinor: 1000, basis: "TTC" } });
    expect(r.recommended).toBeNull();
    expect(r.gapToFloorMinor).toBe(40_000);
    expect(r.scenarios.every((s) => s.belowFloor)).toBe(true);
  });

  it("moins de trois offres indépendantes : indicative ; premium non étayé sans justification", () => {
    const r = recommend({ stats: stats([500_000, 520_000], 2), floor: floor(360_000), vatRateBps: 2000, rounding: { stepMinor: 1000, basis: "TTC" } });
    expect(r.confidence).toBe("indicative");
    expect(r.scenarios.find((s) => s.key === "premium")!.supported).toBe(false);
    expect(r.recommended!.ttcMinor % 1000).toBe(0);
  });

  it("aucun comparable : simulation interne, pas de prix de marché", () => {
    const r = recommend({ stats: { n: 0, independent: 0, minMinor: null, maxMinor: null, medianMinor: null, q1Minor: null, q3Minor: null, dates: { from: null, to: null } }, floor: floor(360_000), vatRateBps: 2000, rounding: { stepMinor: 1000, basis: "TTC" } });
    expect(r.confidence).toBe("simulation_interne");
    expect(r.recommended).toBeNull();
  });

  it("arrondi au pas TTC sans descendre sous le plancher", () => {
    const r = roundPrice(360_100, 2000, { stepMinor: 1000, basis: "TTC" }, 360_100);
    expect(r.ttcMinor % 1000).toBe(0);
    expect(r.htMinor).toBeGreaterThanOrEqual(360_100);
    expect(r.ttcMinor).toBe(433_000); // 4 321,20 → 4 330 (relevé au-dessus du plancher)
  });

  it("cellule pour un total visé avec un supplément de 20 % et un fixe", () => {
    // total = c + 20 %·c + 100 € = 5 000 € → c = 4 083,33 €
    const c = cellForTotal(500_000, 10_000, [2000]);
    expect(c + Math.floor((c * 2000 + 5000) / 10000) + 10_000).toBeLessThanOrEqual(500_000);
    expect(c).toBe(408_333);
  });
});
