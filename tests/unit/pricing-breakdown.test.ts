import { describe, expect, it } from "vitest";
import { evaluate } from "@/domain/engine";
import { defaultSystemInput, type SystemInput } from "@/domain/system";
import { applyBpsHalfUp, lookupSystemPrice, minSystemPrice, type PriceSupplement, type SystemPriceTable } from "@/domain/system-pricing";
import { buildHeliostoresCatalog } from "@/server/catalog/heliostores-data";

/**
 * Décomposition du prix (catalogue 09.2026, règles du 2026-11-02 : prix de vente = prix catalogue, TVA 20 %, dimension
 * supérieure). Grilles FICTIVES de même structure que les vraies (aucun montant réel dans le dépôt) ; chaque résultat
 * attendu est calculé à la main dans le test, jamais avec la fonction testée.
 */
const real = buildHeliostoresCatalog();
const rules = (slug: string) => real.families.find((f) => f.slug === slug)!.systemRules!;
const meta = (supplements: PriceSupplement[] = []) => ({ currency: "EUR", taxBasis: "HT" as const, dimRule: "round_up" as const, vatRateBps: 2000, listVersion: 4, supplements });
const withTable = (slug: string, table: SystemPriceTable) => ({ ...real, families: real.families.map((f) => (f.slug === slug ? { ...f, systemPrices: table } : f)) });
const cfg = (slug: string, over: Partial<SystemInput>): SystemInput => ({ ...defaultSystemInput(slug, rules(slug)), options: [], sides: {}, installation: "self", ...over });

// pergola (largeurs ponctuelles, projections au pas des lames) — HelioMax, deux poses
const pergola: SystemPriceTable = {
  currency: "EUR", taxBasis: "HT", dimAKey: "projection", listVersion: 4,
  variants: { autoportante: meta([{ code: "decor-bois", label: "Décor bois", mode: "percent", percentBps: 2000, applies: ["finition:WOOD_DECOR"] }]), murale: meta() },
  cells: [
    { variantKey: "autoportante", dimAmm: 1930, widthMinMm: 1500, widthMaxMm: 1500, amountMinor: 1_000_00 },
    { variantKey: "autoportante", dimAmm: 1930, widthMinMm: 2000, widthMaxMm: 2000, amountMinor: 1_100_00 },
    { variantKey: "autoportante", dimAmm: 2134, widthMinMm: 1500, widthMaxMm: 1500, amountMinor: 1_050_00 },
    { variantKey: "autoportante", dimAmm: 2134, widthMinMm: 2000, widthMaxMm: 2000, amountMinor: 1_166_67 },
    { variantKey: "murale", dimAmm: 1930, widthMinMm: 1500, widthMaxMm: 1500, amountMinor: 900_00 },
  ],
};

// store banne (avancées fixes, plages de largeur, largeur minimale par avancée, moteur obligatoire à chiffrer)
const awning = (mandatoryMotor: boolean): SystemPriceTable => ({
  currency: "EUR", taxBasis: "HT", dimAKey: "projection", listVersion: 2,
  variants: { "": meta([
    { code: "autre-teinte-palette", label: "Autre couleur de la palette", mode: "percent", percentBps: 2000, applies: ["finition:RAL_CUSTOM"] },
    mandatoryMotor
      ? { code: "moteur", label: "Moteur", mode: "pending", applies: ["toujours"], mandatory: true, rule: "à ajouter au prix indiqué" }
      : { code: "moteur", label: "Moteur", mode: "pending", applies: ["commande:electric"], rule: "manivelle incluse" },
  ]) },
  cells: [
    { variantKey: "", dimAmm: 1600, widthMinMm: 2050, widthMaxMm: 2900, amountMinor: 500_00 },
    { variantKey: "", dimAmm: 1600, widthMinMm: 2910, widthMaxMm: 3500, amountMinor: 600_00 },
    { variantKey: "", dimAmm: 2600, widthMinMm: 3050, widthMaxMm: 3500, amountMinor: 700_00 },
    { variantKey: "", dimAmm: 2600, widthMinMm: 3510, widthMaxMm: 4100, amountMinor: 800_00 },
  ],
});

// screen (axe hauteur, moteurs à plus-value, cellule exigeant un moteur 20 Nm)
const screen: SystemPriceTable = {
  currency: "EUR", taxBasis: "HT", dimAKey: "hauteur", listVersion: 1,
  variants: { "": meta([
    { code: "moteur-electric_3", label: "Moteur — modèle 3", mode: "fixed", amountMinor: 200_00, applies: ["commande:electric_3"], mandatory: true },
    { code: "moteur-autre", label: "Moteur", mode: "pending", applies: ["commande:electric_1"], mandatory: true },
    { code: "moteur-20nm", label: "Moteur 20 Nm minimum", mode: "pending", applies: ["exigence:moteur_20nm"], mandatory: true },
    { code: "ral-hors-palette", label: "Teinte RAL hors palette", mode: "fixed", amountMinor: 300_00, applies: ["finition:RAL_CUSTOM"] },
  ]) },
  cells: [
    { variantKey: "", dimAmm: 1500, widthMinMm: 2000, widthMaxMm: 2000, amountMinor: 400_00 },
    { variantKey: "", dimAmm: 1500, widthMinMm: 5250, widthMaxMm: 5250, amountMinor: 1_500_00, requirement: "moteur_20nm" },
  ],
};

describe("lecture de la grille : dimension supérieure (décision écrite), limites", () => {
  const r = rules("marbella");
  const at = (over: Partial<SystemInput>) => lookupSystemPrice(pergola, r, cfg("marbella", { mounting: "freestanding", ...over }));
  it("configuration de base : cote exacte de la grille", () => {
    expect(at({ widthMm: 2000, depthMm: 1930 })).toMatchObject({ ok: true, price: { amountMinor: 1_100_00, roundedUp: false } });
  });
  it("cote intermédiaire : valeurs immédiatement supérieures sur chaque axe, jamais d'interpolation", () => {
    expect(at({ widthMm: 1501, depthMm: 1931 })).toMatchObject({ ok: true, price: { amountMinor: 1_166_67, roundedUp: true, grid: { widthMm: 2000, dimMm: 2134 } } });
  });
  it("cote sous la première valeur : première valeur ; au-delà de la dernière : hors grille (devis)", () => {
    expect(at({ widthMm: 1000, depthMm: 1400 })).toMatchObject({ ok: true, price: { amountMinor: 1_000_00 } });
    expect(at({ widthMm: 2001, depthMm: 1930 })).toEqual({ ok: false, reason: "out_of_grid" });
    expect(at({ widthMm: 1500, depthMm: 2135 })).toEqual({ ok: false, reason: "out_of_grid" });
  });
  it("pose sans grille publiée : prix incomplet (jamais la grille d'une autre pose)", () => {
    const t = { ...pergola, variants: { autoportante: pergola.variants!.autoportante! }, cells: pergola.cells.filter((c) => c.variantKey === "autoportante") };
    expect(lookupSystemPrice(t, r, cfg("marbella", { mounting: "wall", widthMm: 1500, depthMm: 1930 }))).toEqual({ ok: false, reason: "incomplete" });
  });
  it("plages de largeur : largeur dans l'écart entre deux plages → plage supérieure ; sous la largeur minimale de l'avancée → hors grille", () => {
    const a = rules("corsica");
    expect(lookupSystemPrice(awning(true), a, cfg("corsica", { widthMm: 2905, depthMm: 1600 }))).toMatchObject({ ok: true, price: { amountMinor: 600_00 } });
    expect(lookupSystemPrice(awning(true), a, cfg("corsica", { widthMm: 3000, depthMm: 2600 }))).toEqual({ ok: false, reason: "out_of_grid" });
    expect(lookupSystemPrice(awning(true), a, cfg("corsica", { widthMm: 3050, depthMm: 2600 }))).toMatchObject({ ok: true, price: { amountMinor: 700_00 } });
  });
});

describe("décomposition : suppléments, éléments à chiffrer, arrondis, TVA", () => {
  it("HelioMax : structure seule → total HT et TTC (20 %, demi supérieur)", () => {
    const res = evaluate(withTable("marbella", pergola), cfg("marbella", { mounting: "freestanding", widthMm: 2000, depthMm: 2134, finishCode: "RAL_7016_MAT" }));
    // 1 166,67 € HT → TVA 233,334 → 233,33 € → 1 400,00 € TTC
    expect(res.priceBreakdown).toMatchObject({ totalMinor: 1_166_67, totalTtcMinor: 1_400_00, partial: false, pending: [] });
  });
  it("supplément en pourcentage calculé sur le prix de la structure (assiette documentée), arrondi au centime", () => {
    const res = evaluate(withTable("marbella", pergola), cfg("marbella", { mounting: "freestanding", widthMm: 2000, depthMm: 2134, finishCode: "WOOD_DECOR" }));
    // 20 % de 1 166,67 = 233,334 → 233,33 ; total 1 400,00 HT ; TTC 1 680,00
    expect(res.priceBreakdown!.lines.map((l) => l.amountMinor)).toEqual([1_166_67, 233_33]);
    expect(res.priceBreakdown).toMatchObject({ totalMinor: 1_400_00, totalTtcMinor: 1_680_00, partial: false });
    expect(applyBpsHalfUp(1_166_65, 2000)).toBe(233_33); // 233,330 → 233,33
    expect(applyBpsHalfUp(25, 2000)).toBe(5);
    expect(applyBpsHalfUp(1_25, 1000)).toBe(13); // 12,5 centimes → 13 (demi supérieur)
  });
  it("option choisie sans tarif : jamais retirée en silence, sous-total partiel", () => {
    const res = evaluate(withTable("marbella", pergola), cfg("marbella", { mounting: "freestanding", widthMm: 1500, depthMm: 1930, options: [{ code: "led_perimeter" }] }));
    expect(res.priceBreakdown).toMatchObject({ totalMinor: 1_000_00, partial: true });
    expect(res.priceBreakdown!.pending.map((p) => p.code)).toEqual(["option:led_perimeter"]);
    expect(res.onlineOrder?.ok).toBe(false);
  });
  it("store exclusivement motorisé : moteur obligatoire à chiffrer → partiel, aucun « à partir de »", () => {
    const res = evaluate(withTable("corsica", awning(true)), cfg("corsica", { widthMm: 2500, depthMm: 1600 }));
    expect(res.priceBreakdown).toMatchObject({ totalMinor: 500_00, partial: true });
    expect(res.priceBreakdown!.pending[0]).toMatchObject({ code: "moteur", reason: "à ajouter au prix indiqué" });
    expect(minSystemPrice(awning(true))).toBeNull();
  });
  it("store à manivelle incluse : complet en manuel, moteur à chiffrer seulement si la motorisation est choisie", () => {
    const manual = evaluate(withTable("jamaica", awning(false)), cfg("jamaica", { widthMm: 2500, depthMm: 1600, controlCode: "crank_1500" }));
    expect(manual.priceBreakdown).toMatchObject({ totalMinor: 500_00, partial: false });
    const motor = evaluate(withTable("jamaica", awning(false)), cfg("jamaica", { widthMm: 2500, depthMm: 1600, controlCode: "electric" }));
    expect(motor.priceBreakdown).toMatchObject({ partial: true });
    expect(minSystemPrice(awning(false))).toMatchObject({ amountMinor: 500_00 });
  });
  it("screen : plus-value du moteur choisi ajoutée ; moteur sans plus-value établie → à chiffrer ; cellule « 20 Nm » → le moteur standard est remplacé par un moteur à chiffrer", () => {
    const base = cfg("helioscreen", { widthMm: 2000, heightMm: 1500, finishCode: "RAL_9016" });
    expect(evaluate(withTable("helioscreen", screen), { ...base, controlCode: "electric_3" }).priceBreakdown).toMatchObject({ totalMinor: 600_00, partial: false });
    expect(evaluate(withTable("helioscreen", screen), { ...base, controlCode: "electric_1" }).priceBreakdown).toMatchObject({ totalMinor: 400_00, partial: true });
    const big = evaluate(withTable("helioscreen", screen), { ...base, widthMm: 5250, controlCode: "electric_3" }).priceBreakdown!;
    expect(big.lines.map((l) => l.code)).toEqual(["structure"]);
    expect(big.pending.map((p) => p.code)).toEqual(["moteur-20nm"]);
    expect(minSystemPrice(screen)).toBeNull();
  });
  it("teinte hors palette : forfait ajouté", () => {
    const res = evaluate(withTable("helioscreen", screen), cfg("helioscreen", { widthMm: 2000, heightMm: 1500, controlCode: "electric_3", finishCode: "RAL_CUSTOM" }));
    expect(res.priceBreakdown).toMatchObject({ totalMinor: 900_00, totalTtcMinor: 1_080_00 });
  });
  it("changement non chiffrable : aucun ancien montant conservé", () => {
    const t = withTable("marbella", pergola);
    expect(evaluate(t, cfg("marbella", { mounting: "freestanding", widthMm: 1500, depthMm: 1930 })).priceBreakdown?.totalMinor).toBe(1_000_00);
    const out = evaluate(t, cfg("marbella", { mounting: "freestanding", widthMm: 3000, depthMm: 1930 }));
    expect([out.priceBreakdown, out.systemPrice, out.priceStatus]).toEqual([null, null, "out_of_grid"]);
  });
});
