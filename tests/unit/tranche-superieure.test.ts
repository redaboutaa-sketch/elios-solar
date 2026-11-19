import { describe, expect, it } from "vitest";
import { evaluate } from "@/domain/engine";
import { entryPrice } from "@/domain/entry-price";
import { defaultSystemInput, type SystemInput } from "@/domain/system";
import { lookupSystemPrice, type PriceSupplement, type SystemPriceCell, type SystemPriceTable } from "@/domain/system-pricing";
import { tariffNote } from "@/server/pdf/configuration-pdf";
import { buildHeliostoresCatalog } from "@/server/catalog/heliostores-data";

/**
 * Règle commerciale HELIOSTORES du 2026-11-18 : plus petite tranche tarifaire supérieure ou égale aux dimensions réelles,
 * y compris sous la première tranche quand la cote reste dans le domaine technique documenté (première tranche =
 * minimum de facturation). Grilles FICTIVES de même structure que les grilles réelles (aucun montant réel dans le dépôt) ;
 * chaque résultat attendu est calculé dans le test à partir des axes, jamais avec la fonction testée.
 */
const real = buildHeliostoresCatalog();
const rules = (slug: string) => real.families.find((f) => f.slug === slug)!.systemRules!;
const withTable = (slug: string, table: SystemPriceTable) => ({ ...real, families: real.families.map((f) => (f.slug === slug ? { ...f, systemPrices: table } : f)) });
const cfg = (slug: string, over: Partial<SystemInput>): SystemInput => ({ ...defaultSystemInput(slug, rules(slug)), fabricCode: rules(slug).fabrics?.[0]?.code, options: [], sides: {}, installation: "self", ...over });
const meta = (supplements: PriceSupplement[] = [], rounding = false) => ({ currency: "EUR", taxBasis: "HT" as const, dimRule: "round_up" as const, vatRateBps: 2000, listVersion: 4, supplements, ...(rounding ? { saleRounding: "nearest_99_ttc" as const } : {}) });

/* HelioLux (SOLID) : avancées 3 000 → 7 000 par 500, largeurs 1 500 → 4 000 par 500, deux poses ; minimum technique
   1 500 × 2 000 mm. Montant fictif : base de pose + 1 000 € par tranche d'avancée + 100 € par tranche de largeur. */
const LUX_DIMS = [3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000];
const LUX_WIDTHS = [1500, 2000, 2500, 3000, 3500, 4000];
const luxAmount = (variant: string, dimMm: number, widthMm: number) => (variant === "murale" ? 100_000 : 150_000) + LUX_DIMS.indexOf(dimMm) * 1_000_00 + LUX_WIDTHS.indexOf(widthMm) * 100_00;
const luxSupplements = (variant: string): PriceSupplement[] => [
  { code: "hauteur-hors-norme", label: "Hauteur hors norme", mode: "fixed", amountMinor: variant === "murale" ? 150_00 : 250_00, applies: ["cote:hauteur>2500"] },
  { code: "led-barre-sur-deux", label: "LED une barre sur deux", mode: "table", applies: ["option:led_alt"], table: { axis: "avancee", cells: LUX_DIMS.flatMap((d, i) => LUX_WIDTHS.map((w, j) => ({ dimMin: d, dimMax: d, widthMin: w, widthMax: w, amountMinor: 50_00 + i * 10_00 + j * 1_00 }))) } },
];
const luxCells = (skip: (v: string, d: number, w: number) => boolean = () => false): SystemPriceCell[] =>
  ["murale", "autoportante"].flatMap((variantKey) => LUX_DIMS.flatMap((dimAmm) => LUX_WIDTHS.filter((w) => !skip(variantKey, dimAmm, w)).map((w) => ({ variantKey, dimAmm, widthMinMm: w, widthMaxMm: w, amountMinor: luxAmount(variantKey, dimAmm, w) }))));
const lux = (rounding = false, cells = luxCells()): SystemPriceTable => ({ currency: "EUR", taxBasis: "HT", dimAKey: "projection", listVersion: 4, variants: { murale: meta(luxSupplements("murale"), rounding), autoportante: meta(luxSupplements("autoportante"), rounding) }, cells });

/** Valeur attendue calculée à la main : plus petite valeur de l'axe ≥ cote, ou première valeur si la cote est sous l'axe. */
const up = (axis: number[], v: number) => axis.find((x) => x >= v) ?? null;

describe("HelioLux (SOLID) : tranche supérieure, première tranche comme minimum de facturation", () => {
  const r = rules("sevilla");
  const at = (mounting: "wall" | "freestanding", widthMm: number, depthMm: number) => lookupSystemPrice(lux(), r, cfg("sevilla", { mounting, widthMm, depthMm }));

  it("cas de référence : murale et autoportante 1 500 × 2 000 mm → cellule 1 500 × 3 000 mm, cotes réelles conservées", () => {
    for (const [mounting, variant] of [["wall", "murale"], ["freestanding", "autoportante"]] as const) {
      expect(at(mounting, 1500, 2000)).toMatchObject({ ok: true, price: { amountMinor: luxAmount(variant, 3000, 1500), variantKey: variant, selection: "first_tranche", roundedUp: true, grid: { widthMm: 1500, dimMm: 3000 }, requested: { widthMm: 1500, dimMm: 2000 }, cellWidth: { minMm: 1500, maxMm: 1500 } } });
    }
    // la configuration évaluée garde les cotes réelles (champs, dessin, 3D, récapitulatif, devis)
    const res = evaluate(withTable("sevilla", lux()), cfg("sevilla", { mounting: "wall", widthMm: 1500, depthMm: 2000, heightMm: 2500 }));
    expect(res.priceStatus).toBe("priced");
    expect(res.recap?.find((x) => x.label === "Avancée")?.value).toBe("2 m");
    expect(res.recap?.find((x) => x.label === "Largeur")?.value).toBe("1,5 m");
  });

  it("dimension minimale technique, sous la première tranche, exactement sur une tranche, entre deux tranches, maximum", () => {
    const cases: Array<[number, number, "exact" | "round_up" | "first_tranche"]> = [[1500, 2000, "first_tranche"], [2000, 2750, "first_tranche"], [2500, 3500, "exact"], [2600, 3200, "round_up"], [4000, 7000, "exact"]];
    for (const [w, d, selection] of cases) {
      const dim = up(LUX_DIMS, d) ?? LUX_DIMS[0]!;
      expect(at("wall", w, d)).toMatchObject({ ok: true, price: { amountMinor: luxAmount("murale", dim, up(LUX_WIDTHS, w)!), selection, grid: { dimMm: dim, widthMm: up(LUX_WIDTHS, w) } } });
    }
  });

  it("au-dessus du maximum et sous le minimum technique : jamais de prix (aucune extrapolation, dernière tranche jamais utilisée)", () => {
    expect(at("wall", 1500, 7001)).toEqual({ ok: false, reason: "out_of_grid", detail: { code: "above_max", axis: "dimension" } });
    expect(at("wall", 4001, 3000)).toEqual({ ok: false, reason: "out_of_grid", detail: { code: "above_max", axis: "largeur" } });
    expect(at("wall", 1500, 1999)).toEqual({ ok: false, reason: "out_of_grid", detail: { code: "below_technical_min", axis: "dimension" } });
    expect(at("wall", 1499, 3000)).toEqual({ ok: false, reason: "out_of_grid", detail: { code: "below_technical_min", axis: "largeur" } });
    // la configuration est aussi bloquée par ses règles techniques
    const res = evaluate(withTable("sevilla", lux()), cfg("sevilla", { mounting: "wall", widthMm: 1500, depthMm: 1999 }));
    expect([res.priceStatus, res.systemPrice]).toEqual(["blocked", null]);
  });

  it("cellule supérieure vide ou interdite : jamais comblée par une cellule voisine", () => {
    const t = lux(false, luxCells((v, d, w) => v === "murale" && d === 3500 && w === 2000));
    expect(lookupSystemPrice(t, r, cfg("sevilla", { mounting: "wall", widthMm: 1800, depthMm: 3200 }))).toEqual({ ok: false, reason: "out_of_grid", detail: { code: "cell_forbidden", axis: "largeur" } });
    // la cellule de la tranche voisine n'est pas utilisée ; l'autre pose n'est pas utilisée non plus
    expect(lookupSystemPrice(t, r, cfg("sevilla", { mounting: "freestanding", widthMm: 1800, depthMm: 3200 }))).toMatchObject({ ok: true, price: { variantKey: "autoportante", amountMinor: luxAmount("autoportante", 3500, 2000) } });
    // première colonne absente de la ligne : la largeur sous la grille n'est pas reportée sur la colonne suivante
    const t2 = lux(false, luxCells((v, d, w) => v === "murale" && d === 3000 && w === 1500));
    expect(lookupSystemPrice(t2, r, cfg("sevilla", { mounting: "wall", widthMm: 1500, depthMm: 2000 }))).toEqual({ ok: false, reason: "out_of_grid", detail: { code: "cell_forbidden", axis: "largeur" } });
  });

  it("équipements : moteur, radio et télécommande compris (jamais facturés), supplément de hauteur, LED lue à la tranche facturée", () => {
    const cat = withTable("sevilla", lux());
    const base = evaluate(cat, cfg("sevilla", { mounting: "wall", widthMm: 1500, depthMm: 2000, heightMm: 2500 }));
    expect(base.priceBreakdown?.lines.map((l) => l.code)).toEqual(["structure"]);
    expect((base.recap ?? []).filter((x) => x.status === "included").length).toBeGreaterThan(0);
    const high = evaluate(cat, cfg("sevilla", { mounting: "wall", widthMm: 1500, depthMm: 2000, heightMm: 2800 }));
    expect(high.priceBreakdown?.lines.find((l) => l.code === "hauteur-hors-norme")?.amountMinor).toBe(150_00);
    const led = evaluate(cat, cfg("sevilla", { mounting: "wall", widthMm: 1500, depthMm: 2000, heightMm: 2500, options: [{ code: "led_alt" }] }));
    // tableau LED : avancée réelle 2 000 sous le tableau → valeur immédiatement supérieure (3 000), largeur 1 500
    expect(led.priceBreakdown?.lines.find((l) => l.code === "led-barre-sur-deux")?.amountMinor).toBe(50_00);
    expect(led.priceBreakdown?.partial).toBe(false);
  });

  it("arrondi commercial : une seule fois sur le TTC total, jamais par composant", () => {
    const res = evaluate(withTable("sevilla", lux(true)), cfg("sevilla", { mounting: "wall", widthMm: 1500, depthMm: 2000, heightMm: 2800 }));
    const ht = luxAmount("murale", 3000, 1500) + 150_00;
    const ttc = ht + Math.floor((ht * 2000 + 5000) / 10_000);
    const lower = Math.floor((ttc - 9900) / 10_000) * 10_000 + 9900;
    const expected = lower + 10_000 - ttc <= ttc - lower ? lower + 10_000 : lower;
    expect(res.priceBreakdown?.totalTtcMinor).toBe(expected);
    expect(res.priceBreakdown?.lines.filter((l) => l.code === "arrondi")).toHaveLength(expected === ttc ? 0 : 1);
  });

  it("prix d'appel : la plus petite configuration valide (1,5 × 2 m) au prix de la première tranche, retrouvée par le calcul", () => {
    const cat = withTable("sevilla", lux());
    const e = entryPrice(cat, "sevilla")!;
    expect(e.complete).toBe(true);
    expect(e.entry.input).toMatchObject({ mounting: "wall", widthMm: 1500, depthMm: 2000 });
    expect(e.entry.htMinor).toBe(luxAmount("murale", 3000, 1500));
    expect(e.summary.dims).toBe("1,50 m × 2 m");
    expect(evaluate(cat, e.entry.input).priceBreakdown?.totalMinor).toBe(e.entry.htMinor);
  });

  it("ancien projet (avant la révision du 2026-11-03) : toile obsolète bloquante, calcul possible après revalidation complète", () => {
    const cat = withTable("sevilla", lux());
    const old = cfg("sevilla", { mounting: "wall", widthMm: 1500, depthMm: 2000, heightMm: 2500, fabricCode: "ANCIENNE-TOILE" });
    const before = evaluate(cat, old);
    expect(before.issues.some((i) => i.code === "fabric_unavailable" && i.severity === "blocking")).toBe(true);
    expect(before.systemPrice).toBeNull();
    const after = evaluate(cat, { ...old, fabricCode: rules("sevilla").fabrics![0]!.code });
    expect(after.systemPrice).toMatchObject({ selection: "first_tranche", grid: { dimMm: 3000 } });
  });
});

describe("HelioLux : cas signalé 3 700 × 3 990 mm (murale), panne du calcul", () => {
  const r = rules("sevilla");
  it("3 700 × 3 990 → cellule murale premier module 4 000 × 4 000 ; jamais l'autoportante ; cotes réelles conservées", () => {
    const res = evaluate(withTable("sevilla", lux(true)), cfg("sevilla", { mounting: "wall", widthMm: 3700, depthMm: 3990, heightMm: 2450, finishCode: "RAL_9010_MAT" }));
    expect(res.priceStatus).toBe("priced");
    expect(res.issues.filter((i) => i.severity === "blocking")).toEqual([]);
    expect(res.systemPrice).toMatchObject({ variantKey: "murale", amountMinor: luxAmount("murale", 4000, 4000), selection: "round_up", grid: { widthMm: 4000, dimMm: 4000 }, requested: { widthMm: 3700, dimMm: 3990 } });
    // moteur, radio et télécommande compris : aucune ligne ni élément à chiffrer
    expect(res.priceBreakdown?.pending).toEqual([]);
    expect(res.priceBreakdown?.lines.filter((l) => l.code !== "arrondi").map((l) => l.code)).toEqual(["structure"]);
    const ht = luxAmount("murale", 4000, 4000);
    const ttc = ht + Math.floor((ht * 2000 + 5000) / 10_000);
    const lower = Math.floor((ttc - 9900) / 10_000) * 10_000 + 9900;
    expect(res.priceBreakdown?.totalTtcMinor).toBe(lower + 10_000 - ttc <= ttc - lower ? lower + 10_000 : lower);
    expect(res.recap?.find((x) => x.label === "Largeur")?.value).toBe("3,7 m");
    expect(res.recap?.find((x) => x.label === "Avancée")?.value).toBe("3,99 m");
    expect(lookupSystemPrice(lux(), r, cfg("sevilla", { mounting: "wall", widthMm: 4000, depthMm: 4000 }))).toMatchObject({ ok: true, price: { selection: "exact", amountMinor: luxAmount("murale", 4000, 4000) } });
  });
  it("ancien brouillon (toile de l'ancien système) : blocage nommé sur le champ « toile », jamais une panne", () => {
    const res = evaluate(withTable("sevilla", lux()), cfg("sevilla", { mounting: "wall", widthMm: 3700, depthMm: 3990, fabricCode: "serge_600" }));
    expect(res.priceStatus).toBe("blocked");
    expect(res.issues.filter((i) => i.severity === "blocking").map((i) => [i.code, i.path])).toEqual([["fabric_unavailable", "fabricCode"]]);
  });
  it("panne du calcul : statut « error » et point bloquant explicite, jamais une demande de devis ordinaire", () => {
    const broken = { currency: "EUR", taxBasis: "HT", dimAKey: "projection", listVersion: 1, cells: null } as unknown as SystemPriceTable;
    const res = evaluate(withTable("sevilla", broken), cfg("sevilla", { mounting: "wall", widthMm: 3700, depthMm: 3990 }));
    expect(res.priceStatus).toBe("error");
    expect(res.issues.map((i) => i.code)).toContain("calculation_error");
    expect(res.systemPrice).toBeNull();
  });
});

describe("HelioMax (SB 450) : minimums documentés 1 000 × 1 318 mm, grille 1 500 × 1 930 mm", () => {
  const dims = [1930, 2134, 2338];
  const widths = [1500, 2000];
  const t: SystemPriceTable = { currency: "EUR", taxBasis: "HT", dimAKey: "projection", listVersion: 4, variants: { autoportante: meta([{ code: "centrale-radio", label: "Centrale radio", mode: "fixed", amountMinor: 700_00, applies: ["toujours"] }]) }, cells: dims.flatMap((d, i) => widths.map((w, j) => ({ variantKey: "autoportante", dimAmm: d, widthMinMm: w, widthMaxMm: w, amountMinor: 400_000 + i * 20_000 + j * 5_000 }))) };
  it("1 000 × 1 318 mm → cellule 1 500 × 1 930 mm ; composant obligatoire chiffré (« toujours ») ajouté", () => {
    const res = evaluate(withTable("marbella", t), cfg("marbella", { mounting: "freestanding", widthMm: 1000, depthMm: 1318, options: [{ code: "remote_io", value: "io_1ch" }] }));
    expect(res.systemPrice).toMatchObject({ selection: "first_tranche", amountMinor: 400_000, grid: { widthMm: 1500, dimMm: 1930 }, requested: { widthMm: 1000, dimMm: 1318 } });
    expect(res.priceBreakdown?.lines.find((l) => l.code === "centrale-radio")?.amountMinor).toBe(700_00);
  });
  it("tableau d'équipement à deux axes : première valeur sur l'axe principal seulement (spots sous la première largeur : à chiffrer)", () => {
    const spots: PriceSupplement = { code: "led-spots", label: "Spots LED", mode: "table", applies: ["option:led_spots"], table: { axis: "avancee", cells: dims.flatMap((d, i) => widths.map((w, j) => ({ dimMin: d, dimMax: d, widthMin: w, widthMax: w, amountMinor: 900_00 + i * 10_00 + j * 1_00 }))) } };
    const t2 = { ...t, variants: { autoportante: meta([spots]) } };
    const at = (widthMm: number, depthMm: number) => evaluate(withTable("marbella", t2), cfg("marbella", { mounting: "freestanding", widthMm, depthMm, options: [{ code: "led_spots" }] })).priceBreakdown!;
    expect(at(1500, 1318).lines.find((l) => l.code === "led-spots")?.amountMinor).toBe(900_00);
    expect(at(1200, 1930).pending.map((p) => p.code)).toContain("led-spots");
  });
  it("entre deux tranches sur les deux axes, puis pose sans grille publiée (jamais la grille d'une autre pose)", () => {
    expect(lookupSystemPrice(t, rules("marbella"), cfg("marbella", { mounting: "freestanding", widthMm: 1501, depthMm: 1931 }))).toMatchObject({ ok: true, price: { selection: "round_up", amountMinor: 400_000 + 20_000 + 5_000 } });
    expect(lookupSystemPrice(t, rules("marbella"), cfg("marbella", { mounting: "wall", widthMm: 1500, depthMm: 1930 }))).toEqual({ ok: false, reason: "incomplete" });
  });
});

describe("HelioScreen (R 120 ZiiiP) : unités cm → mm, largeur minimale selon le moteur, hauteur minimale non documentée", () => {
  const H = [1000, 1250];
  const W = [1000, 1250, 1500];
  const t: SystemPriceTable = { currency: "EUR", taxBasis: "HT", dimAKey: "hauteur", listVersion: 4, variants: { "": meta([{ code: "moteur-io", label: "Moteur radio io", mode: "fixed", amountMinor: 250_00, applies: ["commande:radio_io"] }, { code: "telecommande-radio_io", label: "Télécommande à choisir", mode: "pending", applies: ["commande:radio_io&!option:remote_io"], rangeMinor: [60_00, 90_00] }, { code: "telecommande-io-1", label: "Télécommande io 1 canal", mode: "fixed", amountMinor: 60_00, applies: ["option:remote_io=io_1"] }]) }, cells: H.flatMap((h, i) => W.map((w, j) => ({ variantKey: "", dimAmm: h, widthMinMm: w, widthMaxMm: w, amountMinor: 30_000 + i * 3_000 + j * 1_000 }))) };
  const s = (over: Partial<SystemInput>) => evaluate(withTable("helioscreen", t), cfg("helioscreen", { controlCode: "radio_io", options: [{ code: "remote_io", value: "io_1" }], ...over }));
  it("largeur 0,70 m (en-tête « cm » du tableau : 70 cm = 700 mm) → première colonne 1 000 mm", () => {
    expect(s({ widthMm: 700, heightMm: 1000 }).systemPrice).toMatchObject({ selection: "first_tranche", amountMinor: 30_000, grid: { widthMm: 1000, dimMm: 1000 } });
    expect(s({ widthMm: 1100, heightMm: 1100 }).systemPrice).toMatchObject({ selection: "round_up", amountMinor: 30_000 + 3_000 + 1_000 });
  });
  it("largeur sous le minimum du moteur : blocage (jamais un autre moteur choisi pour obtenir un prix)", () => {
    const res = s({ widthMm: 650, heightMm: 1000 });
    expect(res.issues.some((i) => i.code === "control_min_width" && i.severity === "blocking")).toBe(true);
    expect(res.systemPrice).toBeNull();
    // filaire à fins de course mécaniques : 64 cm admis
    expect(s({ widthMm: 650, heightMm: 1000, controlCode: "wired_mech", options: [] }).systemPrice).toMatchObject({ selection: "first_tranche" });
  });
  it("hauteur sous la première tranche, minimum non documenté : devis avec motif précis ; valeur saisie en cm refusée", () => {
    const res = s({ widthMm: 1000, heightMm: 900 });
    expect([res.priceStatus, res.priceDetail]).toEqual(["out_of_grid", { code: "below_min_undocumented", axis: "dimension" }]);
    expect(s({ widthMm: 100, heightMm: 1000 }).systemPrice).toBeNull();
  });
  it("télécommande obligatoire non choisie : sous-total partiel explicite, sans arrondi ; choisie : prix complet", () => {
    const partial = s({ widthMm: 1000, heightMm: 1000, options: [] }).priceBreakdown!;
    expect(partial.partial).toBe(true);
    expect(partial.pending.map((p) => p.code)).toEqual(["telecommande-radio_io"]);
    expect(partial.lines.some((l) => l.code === "arrondi")).toBe(false);
    expect(s({ widthMm: 1000, heightMm: 1000 }).priceBreakdown).toMatchObject({ partial: false, totalMinor: 30_000 + 250_00 + 60_00 });
  });
});

describe("stores bannes : avancées fixes, plages de largeur, moteur obligatoire", () => {
  const t: SystemPriceTable = { currency: "EUR", taxBasis: "HT", dimAKey: "projection", listVersion: 4, variants: { "": meta([{ code: "moteur-wired", label: "Moteur filaire", mode: "fixed", amountMinor: 200_00, applies: ["commande:wired"], mandatory: true }, { code: "moteur-radio_io", label: "Moteur radio io", mode: "pending", applies: ["commande:radio_io"], mandatory: true, rangeMinor: [400_00, 450_00], rule: "plusieurs moteurs conviennent selon le couple" }]) }, cells: [
    { variantKey: "", dimAmm: 1600, widthMinMm: 2050, widthMaxMm: 2900, amountMinor: 100_000 },
    { variantKey: "", dimAmm: 1600, widthMinMm: 2910, widthMaxMm: 3500, amountMinor: 110_000 },
    { variantKey: "", dimAmm: 2100, widthMinMm: 2550, widthMaxMm: 2900, amountMinor: 120_000 },
  ] };
  const a = (over: Partial<SystemInput>) => evaluate(withTable("corsica", t), cfg("corsica", { controlCode: "wired", ...over }));
  it("largeur dans l'écart entre deux plages → plage supérieure ; au-delà de la dernière plage de la ligne → devis", () => {
    expect(a({ widthMm: 2905, depthMm: 1600 }).systemPrice).toMatchObject({ amountMinor: 110_000, selection: "round_up", cellWidth: { minMm: 2910, maxMm: 3500 } });
    expect(a({ widthMm: 3200, depthMm: 2100 })).toMatchObject({ priceStatus: "out_of_grid", priceDetail: { code: "above_max", axis: "largeur" } });
  });
  it("combinaison interdite (largeur minimale de l'avancée) : bloquée par les règles techniques, sans prix", () => {
    const res = a({ widthMm: 2100, depthMm: 2100 });
    expect(res.issues.some((i) => i.code === "depth_width_combination")).toBe(true);
    expect(res.systemPrice).toBeNull();
  });
  it("moteur obligatoire : filaire chiffré (prix complet) ; radio, plusieurs moteurs possibles → sous-total partiel avec fourchette, jamais un moteur choisi arbitrairement", () => {
    expect(a({ widthMm: 2500, depthMm: 1600 }).priceBreakdown).toMatchObject({ partial: false, totalMinor: 100_000 + 200_00 });
    const radio = a({ widthMm: 2500, depthMm: 1600, controlCode: "radio_io" }).priceBreakdown!;
    expect(radio.partial).toBe(true);
    expect(radio.totalMinor).toBe(100_000);
    expect(radio.pending[0]?.reason).toContain("400 €");
  });
});

describe("composants obligatoires de pose et configuration par défaut", () => {
  const t: SystemPriceTable = { currency: "EUR", taxBasis: "HT", dimAKey: "projection", listVersion: 4, variants: { "": meta() }, cells: [{ variantKey: "", dimAmm: 1600, widthMinMm: 2000, widthMaxMm: 2900, amountMinor: 100_000 }] };
  it("store banne au plafond ou sur chevrons : supports supplémentaires obligatoires → sous-total partiel, jamais le prix de la pose murale présenté complet", () => {
    const at = (mounting: "wall" | "ceiling" | "rafter") => evaluate(withTable("casablanca", t), cfg("casablanca", { mounting, widthMm: 2500, depthMm: 1600, controlCode: "crank_1500" })).priceBreakdown!;
    expect(at("wall")).toMatchObject({ partial: false, totalMinor: 100_000 });
    expect(at("ceiling")).toMatchObject({ partial: true, totalMinor: 100_000, pending: [{ code: "pose:ceiling" }] });
    expect(at("rafter").pending.map((p) => p.code)).toEqual(["pose:rafter"]);
  });
  it("configuration par défaut : première teinte standard sans supplément (HelioRoof : RAL 9016 hors standard écarté)", () => {
    for (const f of real.families.filter((x) => x.systemRules && !x.systemRules.studyOnly)) {
      const r = f.systemRules!;
      const d = defaultSystemInput(f.slug, r);
      const fin = r.finishes.find((x) => x.code === d.finishCode)!;
      if (r.finishes.some((x) => (x.tier ?? "standard") === "standard" && x.status === "established")) expect([f.slug, fin.tier ?? "standard", fin.status]).toEqual([f.slug, "standard", "established"]);
    }
  });
});

describe("devis historiques : présentation figée", () => {
  const sp = { amountMinor: 1, currency: "EUR", taxBasis: "HT" as const, variantKey: "murale", grid: { widthMm: 1500, dimMm: 3000, dimLabel: "Avancée" }, roundedUp: true, listVersion: 3 };
  it("instantané antérieur (sans traçabilité) : mention d'origine inchangée ; nouveau devis : mention simple, tranche réservée à l'administration", () => {
    expect(tariffNote(sp, true)).toBe("Grille tarifaire HELIOSTORES v3 : 1.5 m de largeur x 3 m (avancée), dimension de grille immediatement superieure.");
    expect(tariffNote({ ...sp, selection: "first_tranche", requested: { widthMm: 1500, dimMm: 2000 } }, true)).toBe("Grille tarifaire HELIOSTORES v3. Tarif calcule selon la tranche de dimensions superieure.");
    expect(tariffNote({ ...sp, roundedUp: false, selection: "exact" }, false)).toBe("Grille tarifaire HELIOSTORES.");
  });
});

describe("HelioLux : toile — ancien choix, nouveau projet, fermeture à étudier", () => {
  const r = rules("sevilla");
  const at = (over: Partial<SystemInput>) => evaluate(withTable("sevilla", lux(true)), cfg("sevilla", { mounting: "wall", widthMm: 3700, depthMm: 3990, heightMm: 2450, finishCode: "RAL_7016_MAT", ...over }));

  it("nouveau projet : aucune toile documentée par défaut → aucune présélection ; le prix (indépendant de la toile) reste affiché, le devis attend le choix", () => {
    expect(r.defaultFabricCode).toBeUndefined();
    expect(defaultSystemInput("sevilla", r).fabricCode).toBeUndefined();
    const res = at({ fabricCode: undefined });
    expect(res.issues.filter((i) => i.severity === "blocking").map((i) => i.code)).toEqual(["fabric_missing"]);
    expect(res.priceStatus).toBe("priced");
    expect(res.systemPrice?.grid).toMatchObject({ widthMm: 4000, dimMm: 4000 });
    expect(res.onlineOrder?.ok).toBe(false);
  });

  it("ancienne toile serge_100 : nommée par son ancien libellé, jamais de montant pour une toile fictive", () => {
    const res = at({ fabricCode: "serge_100" });
    const i = res.issues.find((x) => x.code === "fabric_unavailable")!;
    expect(i.severity).toBe("blocking");
    expect(i.message).toContain("Toile Serge 100");
    expect(res.systemPrice).toBeNull();
    expect(res.priceStatus).toBe("blocked");
  });

  it("toile SOLID valide : prix de la cellule murale 4 000 × 4 000, aucun blocage", () => {
    for (const f of r.fabrics!) {
      const res = at({ fabricCode: f.code });
      expect(res.issues.filter((x) => x.severity === "blocking"), f.code).toEqual([]);
      expect(res.systemPrice).toMatchObject({ variantKey: "murale", amountMinor: luxAmount("murale", 4000, 4000), grid: { widthMm: 4000, dimMm: 4000 }, requested: { widthMm: 3700, dimMm: 3990 } });
      expect(res.priceBreakdown?.partial).toBe(false);
    }
  });

  it("fermeture vitrée à l'avant : même montant connu, présenté comme sous-total (fermeture à chiffrer, compatibilité à confirmer)", () => {
    const without = at({ fabricCode: "solid_white" });
    const withClosure = at({ fabricCode: "solid_white", sides: { front: "sliding_glass" } });
    expect(withClosure.priceStatus).toBe("priced");
    expect(withClosure.priceBreakdown?.partial).toBe(true);
    // même cellule et mêmes suppléments ; un sous-total partiel n'est jamais arrondi (décision du 2026-11-13)
    expect(withClosure.systemPrice?.amountMinor).toBe(without.systemPrice?.amountMinor);
    expect(withClosure.priceBreakdown?.totalTtcMinor).toBe(without.priceBreakdown?.computedTtcMinor);
    expect(withClosure.priceBreakdown?.roundingTtcMinor).toBe(0);
    expect(withClosure.priceBreakdown?.pending).toEqual([expect.objectContaining({ code: "cote:front", reason: "à chiffrer, compatibilité à confirmer" })]);
    expect(withClosure.priceBreakdown?.pending[0]!.label).toMatch(/fermeture vitrée.*côté avant/);
  });

  it("fermeture enregistrée inconnue : nommée, bloquante, jamais remplacée", () => {
    const res = at({ fabricCode: "solid_white", sides: { left: "veranda_fts" } });
    expect(res.issues.find((i) => i.code === "closure_unavailable")?.message).toMatch(/enregistrée côté gauche \(veranda_fts\)/);
  });
});
