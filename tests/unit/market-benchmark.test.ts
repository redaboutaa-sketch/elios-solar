import { describe, expect, it } from "vitest";
import { advise, classify, dedupe, perSeller, position, splitOutliers, ttcOf, type BenchConfig, type BenchObservation } from "@/domain/market-benchmark";

/**
 * Benchmark par niveaux : relevés FICTIFS (aucun vendeur ni montant réel). Attendus calculés à la main :
 * TTC FR 20 % → HT = TTC ÷ 1,2 ; TTC DE 19 % → HT = TTC ÷ 1,19.
 */
const NOW = new Date("2026-11-19T12:00:00Z");
const ctx = { now: NOW, staleDays: 120, dimToleranceBps: 1000, vatBps: 2000 };

const cfg = (over: Partial<BenchConfig> = {}): BenchConfig => ({
  familySlug: "produit-test", key: "4x3", widthMm: 4000, dimMm: 3000, dimAxis: "depth", mounting: "wall", mountingMatters: false, controlKind: "radio",
  ours: { delivery: "extra", installation: "extra", motor: "included", remote: "included", led: "absent", sensors: "absent", screen: "absent", glazing: "absent" },
  supplierSystems: ["SYSTEME-X"], allowSwap: false, ...over,
});

let n = 0;
const obs = (over: Partial<BenchObservation> = {}): BenchObservation => ({
  id: `o${++n}`, familySlug: "produit-test", retailer: `Vendeur ${n}`, sellerGroup: "", manufacturer: "", model: `Modèle ${n}`, url: `https://example.invalid/${n}`, country: "FR", currency: "EUR",
  observedAt: new Date("2026-11-10T00:00:00Z"), lastCheckedAt: null, widthMm: 4000, depthMm: 3000, heightMm: null, mounting: "wall", controlKind: "radio",
  priceMinor: 240_000, taxBasis: "TTC", priceKind: "fixed_size", regularPriceMinor: null, promoPriceMinor: null, promoEnd: null, promoConditions: "",
  scope: { delivery: { status: "extra" }, installation: { status: "extra" }, motor: { status: "included" }, remote: { status: "included" }, led: { status: "absent" }, sensors: { status: "absent" } },
  matchLevel: "B", matchReason: "", supplierSystem: "", differences: [], unknownFields: [], deliversTo: {}, fx: null, evidence: "« 2 400 € TTC » « 4 x 3 m » « télécommande incluse »", capture: "", validation: "TO_VALIDATE", status: "ACTIVE",
  ...over,
});

describe("niveaux de comparabilité", () => {
  it("offre exacte du même système fournisseur : niveau A, comparaison directe, HT = TTC ÷ 1,2", () => {
    const e = classify(obs({ matchLevel: "A", supplierSystem: "Systeme-X 2026" }), cfg(), ctx);
    expect(e.level).toBe("A");
    expect(e.usage).toBe("direct");
    expect(e.dims).toBe("exact");
    expect(e.comparableHtMinor).toBe(200_000);
  });

  it("niveau A demandé sans système fournisseur cité par la page : plafonné à B", () => {
    const e = classify(obs({ matchLevel: "A" }), cfg(), ctx);
    expect(e.level).toBe("B");
    expect(e.levelWhy.join(" ")).toMatch(/système fournisseur non cité/);
  });

  it("équivalent technique : niveau B, usage indicatif", () => {
    const e = classify(obs(), cfg(), ctx);
    expect(e.level).toBe("B");
    expect(e.usage).toBe("indicative");
  });

  it("une alternative (C) n'influence pas une comparaison directe", () => {
    const a = [1, 2, 3].map((i) => classify(obs({ matchLevel: "A", supplierSystem: "SYSTEME-X", sellerGroup: `a${i}`, priceMinor: 240_000 + i * 1_200 }), cfg(), ctx));
    const c = classify(obs({ matchLevel: "C", sellerGroup: "kit", priceMinor: 60_000 }), cfg(), ctx);
    expect(c.usage).toBe("context");
    const p = position([...a, c]);
    expect(p.range?.basis).toBe("direct");
    expect(p.range?.minHt).toBe(201_000); // 241 200 ÷ 1,2
    expect(p.points.map((x) => x.seller)).not.toContain("kit");
    expect(p.sellers.context).toBe(1);
  });

  it("dimensions hors tolérance, implantation différente ou manuel face à motorisé : C au plus", () => {
    expect(classify(obs({ widthMm: 5000 }), cfg(), ctx).level).toBe("C");
    expect(classify(obs({ mounting: "freestanding" }), cfg({ mountingMatters: true }), ctx).level).toBe("C");
    expect(classify(obs({ controlKind: "manual" }), cfg(), ctx).level).toBe("C");
  });

  it("cotes inversées : acceptées si la largeur du vendeur est notre avancée, jamais pour un relevé presque carré", () => {
    const c = cfg({ widthMm: 3500, dimMm: 3400, allowSwap: true });
    expect(classify(obs({ widthMm: 3500, depthMm: 3850 }), c, ctx).dims).toBe("near");
    expect(classify(obs({ widthMm: 4000, depthMm: 3000 }), cfg({ widthMm: 3000, dimMm: 4000, allowSwap: true }), ctx).dims).toBe("swapped");
  });

  it("prix « à partir de » ou cotes absentes : D, exclu", () => {
    expect(classify(obs({ priceKind: "from" }), cfg(), ctx)).toMatchObject({ level: "D", usage: "excluded" });
    expect(classify(obs({ depthMm: null }), cfg(), ctx)).toMatchObject({ level: "D", usage: "excluded" });
  });

  it("screen : la hauteur est l'axe comparé (et non l'avancée)", () => {
    const e = classify(obs({ depthMm: null, heightMm: 2400, widthMm: 2700 }), cfg({ dimAxis: "height", widthMm: 2700, dimMm: 2400 }), ctx);
    expect(e.dims).toBe("exact");
    expect(e.level).toBe("B");
  });
});

describe("périmètre, TVA, promotion, fraîcheur", () => {
  it("livraison inconnue : le prix produit reste comparé, sans conclusion sur le coût livré", () => {
    const e = classify(obs({ scope: { ...obs().scope, delivery: { status: "unknown" } } }), cfg(), ctx);
    expect(e.comparableHtMinor).toBe(200_000);
    expect(e.priceScope).toBe("product_unknown_delivery");
    expect(e.usage).toBe("indicative");
    expect(e.usageWhy.join(" ")).toMatch(/aucune conclusion sur le coût livré/);
    expect(position([e]).status).toBe("product_only");
  });

  it("livraison comprise sans montant : prix observé conservé, périmètre signalé, aucune déduction inventée", () => {
    const e = classify(obs({ matchLevel: "A", supplierSystem: "SYSTEME-X", scope: { ...obs().scope, delivery: { status: "included" } } }), cfg(), ctx);
    expect(e.priceScope).toBe("delivered");
    expect(e.comparableHtMinor).toBe(200_000);
    expect(e.usage).toBe("indicative");
  });

  it("pose comprise sans montant : comparée à part (contexte)", () => {
    expect(classify(obs({ scope: { ...obs().scope, installation: { status: "included" } } }), cfg(), ctx).usage).toBe("context");
  });

  it("TVA inconnue : jamais convertie en TTC, montant observé conservé", () => {
    const e = classify(obs({ taxBasis: "UNKNOWN" }), cfg(), ctx);
    expect(e.comparableHtMinor).toBeNull();
    expect(e.observedMinor).toBe(240_000);
    expect(e.usage).toBe("context");
    expect(e.unknown).toContain("HT ou TTC");
  });

  it("promotion réelle : identifiable, prix normal utilisé pour la comparaison", () => {
    const e = classify(obs({ priceMinor: 216_000, promoPriceMinor: 216_000, regularPriceMinor: 240_000, promoEnd: new Date("2026-11-30T00:00:00Z") }), cfg(), ctx);
    expect(e.promoMinor).toBe(216_000);
    expect(e.regularMinor).toBe(240_000);
    expect(e.comparableHtMinor).toBe(200_000);
    // sans date de fin : le prix payé est comparé (216 000 TTC → 180 000 HT), le prix barré reste affiché
    const nd = classify(obs({ priceMinor: 216_000, promoPriceMinor: 216_000, regularPriceMinor: 240_000 }), cfg(), ctx);
    expect(nd.comparableHtMinor).toBe(180_000);
    expect(nd.regularMinor).toBe(240_000);
  });

  it("promotion sans prix normal : prix payé gardé, usage indicatif au mieux", () => {
    const e = classify(obs({ matchLevel: "A", supplierSystem: "SYSTEME-X", promoPriceMinor: 240_000 }), cfg(), ctx);
    expect(e.usage).toBe("indicative");
    expect(e.usageWhy.join(" ")).toMatch(/prix normal inconnu/);
  });

  it("relevé périmé : signalé et sorti du calcul ; statut « données à actualiser »", () => {
    const e = classify(obs({ observedAt: new Date("2026-05-01T00:00:00Z") }), cfg(), ctx);
    expect(e.freshness).toBe("stale");
    expect(e.usage).toBe("context");
    expect(position([e]).status).toBe("to_refresh");
    expect(classify(obs({ observedAt: new Date("2026-08-15T00:00:00Z") }), cfg(), ctx).freshness).toBe("recheck");
  });

  it("équipement inconnu : ni inclus ni absent, listé, plafond B", () => {
    const e = classify(obs({ matchLevel: "A", supplierSystem: "SYSTEME-X", scope: { ...obs().scope, remote: { status: "unknown" } } }), cfg(), ctx);
    expect(e.unknown).toContain("télécommande");
    expect(e.level).toBe("B");
  });

  it("supplément documenté chez le concurrent : ajouté au prix comparable (aucune estimation)", () => {
    const e = classify(obs({ scope: { ...obs().scope, remote: { status: "extra", extraAmountMinor: 12_000 } } }), cfg(), ctx);
    expect(e.comparableHtMinor).toBe(210_000); // (240 000 + 12 000) ÷ 1,2
  });

  it("prix allemand TTC : ramené au HT par le taux allemand ; accès FR/BE inconnu → indicatif ; Royaume-Uni à part", () => {
    const de = classify(obs({ matchLevel: "A", supplierSystem: "SYSTEME-X", country: "DE", priceMinor: 238_000 }), cfg(), ctx);
    expect(de.comparableHtMinor).toBe(200_000);
    expect(de.market).toBe("local_unknown");
    expect(de.usage).toBe("indicative");
    const ok = classify(obs({ matchLevel: "A", supplierSystem: "SYSTEME-X", country: "DE", priceMinor: 238_000, deliversTo: { FR: "yes" } }), cfg(), ctx);
    expect(ok.usage).toBe("direct");
    expect(classify(obs({ country: "GB", currency: "GBP", fx: { originalCurrency: "GBP", originalPriceMinor: 200_000, rate: 0.85, date: "2026-11-19", source: "BCE" } }), cfg(), ctx).usage).toBe("context");
    expect(classify(obs({ currency: "PLN" }), cfg(), ctx).level).toBe("D");
    // conversion BCE : 1 € = 4 PLN ; 9 840 PLN TTC (TVA polonaise 23 %) → 2 460 € TTC → 2 000 € HT
    const pl = classify(obs({ country: "PL", currency: "PLN", priceMinor: 984_000, matchLevel: "A", supplierSystem: "SYSTEME-X", deliversTo: { FR: "yes" }, fx: { originalCurrency: "PLN", originalPriceMinor: 984_000, rate: 4, date: "2026-11-18", source: "BCE" } }), cfg(), ctx);
    expect(pl.comparableHtMinor).toBe(200_000);
    expect(pl.usage).toBe("direct");
  });
});

describe("indépendance, doublons, atypiques", () => {
  it("un doublon ne gonfle pas l'échantillon ; plusieurs annonces d'un vendeur = un vendeur", () => {
    const a = obs({ sellerGroup: "societe-x", model: "M", observedAt: new Date("2026-11-01T00:00:00Z") });
    const b = obs({ sellerGroup: "societe-x", model: "M", observedAt: new Date("2026-11-12T00:00:00Z") });
    const c = obs({ sellerGroup: "societe-x", model: "Autre modèle" });
    const evals = [a, b, c].map((o) => classify(o, cfg(), ctx));
    const d = dedupe(evals);
    expect(d.kept).toHaveLength(2);
    expect(d.duplicates[0]!.obs.id).toBe(a.id);
    expect(perSeller(d.kept)).toHaveLength(1);
    expect(position(evals).sellers.indicative).toBe(1);
  });

  it("une offre atypique (hors ½ à 2 × la médiane) est signalée et sortie du calcul", () => {
    const pts = [{ seller: "a", htMinor: 100_000, offers: 1, evalIds: [] }, { seller: "b", htMinor: 110_000, offers: 1, evalIds: [] }, { seller: "c", htMinor: 120_000, offers: 1, evalIds: [] }, { seller: "d", htMinor: 400_000, offers: 1, evalIds: [] }];
    const r = splitOutliers(pts);
    expect(r.outliers.map((p) => p.seller)).toEqual(["d"]);
    expect(r.kept).toHaveLength(3);
  });
});

describe("recommandation", () => {
  const direct = (prices: number[]) => position(prices.map((p, i) => classify(obs({ matchLevel: "A", supplierSystem: "SYSTEME-X", sellerGroup: `s${i}`, priceMinor: p }), cfg(), ctx)));

  it("au moins trois vendeurs directs : médiane, arrondi commercial TTC 99 € sur le total", () => {
    const p = direct([360_000, 372_000, 384_000]); // HT 300 000 / 310 000 / 320 000
    const a = advise({ position: p, targetHtMinor: 250_000, floorHtMinor: 250_000, vatBps: 2000, round99: true, complete: true });
    expect(a.kind).toBe("market");
    // médiane 3 100 € HT → 3 720 € TTC → terminaison « 99 € » la plus proche : 3 699 € TTC (et non 3 799 €)
    expect(a.ttcMinor).toBe(369_900);
    expect(a.conflict).toBeNull();
  });

  it("jamais sous le plancher ; conflit affiché quand le marché est sous la marge cible", () => {
    const p = direct([240_000, 252_000, 264_000]); // médiane 210 000 HT
    const a = advise({ position: p, targetHtMinor: 300_000, floorHtMinor: 300_000, vatBps: 2000, round99: false, complete: true });
    expect(a.htMinor).toBe(300_000);
    expect(a.conflict).toMatch(/sous le prix à la marge cible/);
  });

  it("moins de trois vendeurs directs : prix à la marge cible, fourchette en repère (pas de faux alignement)", () => {
    const p = direct([360_000]);
    const a = advise({ position: p, targetHtMinor: 250_000, floorHtMinor: 250_000, vatBps: 2000, round99: false, complete: true });
    expect(a.kind).toBe("range");
    expect(a.htMinor).toBe(250_000);
    expect(a.rangeTtc).toEqual({ min: 360_000, max: 360_000 });
  });

  it("aucune offre utilisable : données insuffisantes, champs manquants nommés, prix à la marge cible", () => {
    const p = position([classify(obs({ taxBasis: "UNKNOWN" }), cfg(), ctx), classify(obs({ priceKind: "from" }), cfg(), ctx)]);
    expect(p.status).toBe("insufficient");
    expect(p.missing.map((m) => m.reason).join(" ")).toMatch(/HT\/TTC|à partir de/);
    const a = advise({ position: p, targetHtMinor: 250_000, floorHtMinor: 250_000, vatBps: 2000, round99: false, complete: true });
    expect(a).toMatchObject({ kind: "target", htMinor: 250_000, ttcMinor: ttcOf(250_000, 2000) });
  });

  it("sous-total partiel : aucun arrondi", () => {
    const a = advise({ position: position([]), targetHtMinor: 250_050, floorHtMinor: null, vatBps: 2000, round99: true, complete: false });
    expect(a.ttcMinor).toBe(300_060);
  });
});
