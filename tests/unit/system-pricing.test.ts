import { describe, expect, it } from "vitest";
import { evaluate } from "@/domain/engine";
import { defaultSystemInput, type SystemInput } from "@/domain/system";
import { formatSystemPrice, lookupSystemPrice, minSystemPrice, type SystemPriceTable } from "@/domain/system-pricing";
import { PUBLIC_FORBIDDEN_NAMES, publicSystemRules } from "@/domain/public-sanitize";
import { buildHeliostoresCatalog } from "@/server/catalog/heliostores-data";

// grilles FICTIVES (montants de test, sans rapport avec le classeur privé)
const pergolaTable: SystemPriceTable = {
  currency: "EUR",
  taxBasis: "HT",
  dimAKey: "projection",
  listVersion: 1,
  cells: ["murale", "autoportante"].flatMap((variantKey, v) => [3400, 3600].flatMap((dimAmm, d) => [1500, 2000].map((w, k) => ({ variantKey, dimAmm, widthMinMm: w, widthMaxMm: w, amountMinor: 100_000 + v * 50_000 + d * 10_000 + k * 1_000 + 55 })))),
};
const awningTable: SystemPriceTable = { currency: "EUR", taxBasis: "HT", dimAKey: "projection", listVersion: 1, cells: [{ variantKey: "", dimAmm: 1600, widthMinMm: 2000, widthMaxMm: 2900, amountMinor: 700_000 }, { variantKey: "", dimAmm: 1600, widthMinMm: 2910, widthMaxMm: 3500, amountMinor: 800_000 }] };
const screenTable: SystemPriceTable = { currency: "EUR", taxBasis: null, dimAKey: "hauteur", listVersion: 1, cells: [{ variantKey: "", dimAmm: 1000, widthMinMm: 1000, widthMaxMm: 1000, amountMinor: 300_000 }, { variantKey: "", dimAmm: 1250, widthMinMm: 1000, widthMaxMm: 1000, amountMinor: 320_000 }] };

const base = buildHeliostoresCatalog();
const withPrices = (slug: string, table: SystemPriceTable) => ({ ...base, families: base.families.map((f) => (f.slug === slug ? { ...f, systemPrices: table } : f)) });
const rules = (slug: string) => base.families.find((f) => f.slug === slug)!.systemRules!;
const input = (slug: string, over: Partial<SystemInput>): SystemInput => ({ ...defaultSystemInput(slug, rules(slug)), ...over });

describe("prix publics des systèmes (grille « Prix final HELIOSTORES »)", () => {
  it("cote exacte de la grille : montant de la cellule, variante selon la pose", () => {
    const r = lookupSystemPrice(pergolaTable, rules("helio-horizon"), input("helio-horizon", { widthMm: 2000, depthMm: 3600, mounting: "wall" }));
    expect(r).toMatchObject({ ok: true, price: { amountMinor: 111_055, variantKey: "murale", roundedUp: false, grid: { widthMm: 2000, dimMm: 3600 } } });
    const f = lookupSystemPrice(pergolaTable, rules("helio-horizon"), input("helio-horizon", { widthMm: 2000, depthMm: 3600, mounting: "freestanding" }));
    expect(f.ok && f.price.variantKey).toBe("autoportante");
  });

  it("cote intermédiaire : dimension de grille immédiatement supérieure sur chaque axe", () => {
    const r = lookupSystemPrice(pergolaTable, rules("helio-horizon"), input("helio-horizon", { widthMm: 1600, depthMm: 3401, mounting: "wall" }));
    expect(r).toMatchObject({ ok: true, price: { amountMinor: 111_055, roundedUp: true, grid: { widthMm: 2000, dimMm: 3600 } } });
  });

  it("hors grille (en deçà de la première ou au-delà de la dernière dimension) : pas de prix", () => {
    expect(lookupSystemPrice(pergolaTable, rules("helio-horizon"), input("helio-horizon", { widthMm: 1400, depthMm: 3400, mounting: "wall" }))).toEqual({ ok: false, reason: "out_of_grid" });
    expect(lookupSystemPrice(pergolaTable, rules("helio-horizon"), input("helio-horizon", { widthMm: 1500, depthMm: 3200, mounting: "wall" }))).toEqual({ ok: false, reason: "out_of_grid" });
    expect(lookupSystemPrice(pergolaTable, rules("helio-horizon"), input("helio-horizon", { widthMm: 2100, depthMm: 3400, mounting: "wall" }))).toEqual({ ok: false, reason: "out_of_grid" });
    expect(lookupSystemPrice(null, rules("helio-horizon"), input("helio-horizon", {}))).toEqual({ ok: false, reason: "no_table" });
  });

  it("largeurs par plages (store banne) et axe hauteur (screen)", () => {
    const a = lookupSystemPrice(awningTable, rules("helio-riviera"), input("helio-riviera", { widthMm: 2905, depthMm: 1600 }));
    expect(a).toMatchObject({ ok: true, price: { amountMinor: 800_000, roundedUp: false } });
    const s = lookupSystemPrice(screenTable, rules("helio-ombra"), input("helio-ombra", { widthMm: 1000, heightMm: 1100 }));
    expect(s).toMatchObject({ ok: true, price: { amountMinor: 320_000, grid: { dimMm: 1250 } } });
  });

  it("le moteur joint le prix au résultat (parcours devis conservé) et l'omet en cas de blocage", () => {
    const cat = withPrices("helio-horizon", pergolaTable);
    const ok = evaluate(cat, input("helio-horizon", { widthMm: 2000, depthMm: 3400, mounting: "wall" }));
    expect(ok.priceMode).toBe("quote");
    expect(ok.systemPrice?.amountMinor).toBe(101_055);
    const blocked = evaluate(cat, input("helio-horizon", { widthMm: 9000, depthMm: 3400, mounting: "wall" }));
    expect(blocked.systemPrice).toBeNull();
    expect(evaluate(base, input("helio-horizon", { widthMm: 2000, depthMm: 3400 })).systemPrice).toBeNull();
  });

  it("configuration entièrement tarifée : ligne de structure TTC (TVA du catalogue ajoutée au prix HT), commandable en ligne", () => {
    const cat = withPrices("helio-horizon", pergolaTable);
    const r = evaluate(cat, input("helio-horizon", { widthMm: 2000, depthMm: 3400, mounting: "wall", options: [], installation: "self", sides: {} }));
    expect(r.onlineOrder).toEqual({ ok: true, reasons: [] });
    expect(r.purchasable).toBe(true);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ kind: "base", qty: 1, taxRateBps: cat.taxRateBps, unitGrossCents: 101_055 + Math.round((101_055 * cat.taxRateBps) / 10_000) });
    expect(r.lines[0]!.label).toContain("2 m × 3,4 m");
    expect(r.issues.some((i) => i.code === "system_quote_only")).toBe(false);
    expect(r.systemPrice?.amountMinor).toBe(101_055);
    expect(r.recap?.some((x) => x.label.startsWith("Prix"))).toBe(false);
  });

  it("option, pose professionnelle, choix à confirmer, cote hors grille ou base fiscale absente : devis seulement", () => {
    const cat = withPrices("helio-horizon", pergolaTable);
    const ok = input("helio-horizon", { widthMm: 2000, depthMm: 3400, mounting: "wall", options: [], installation: "self", sides: {} });
    const opt = rules("helio-horizon").options[0]!;
    const cases: Array<[Partial<SystemInput>, string]> = [
      [{ options: [{ code: opt.code, qty: opt.maxQty != null ? 1 : undefined, value: opt.values?.[0]?.code }] }, "options"],
      [{ installation: "professional" }, "pose professionnelle"],
      [{ multiModule: true }, "à confirmer"],
      [{ widthMm: 1400 }, "grille"],
    ];
    for (const [over, reason] of cases) {
      const r = evaluate(cat, { ...ok, ...over });
      expect(r.purchasable, reason).toBe(false);
      expect(r.lines, reason).toEqual([]);
      expect(r.onlineOrder?.reasons.join(" "), reason).toContain(reason);
    }
    const screen = evaluate(withPrices("helio-ombra", screenTable), input("helio-ombra", { widthMm: 1000, heightMm: 1000, options: [] }));
    expect(screen.purchasable).toBe(false);
    expect(screen.onlineOrder?.reasons.join(" ")).toContain("base fiscale");
  });

  it("« à partir de » et format (devise, HT/TTC) sans arrondi", () => {
    expect(minSystemPrice(pergolaTable)).toEqual({ amountMinor: 100_055, currency: "EUR", taxBasis: "HT" });
    expect(formatSystemPrice(100_055, "EUR", "HT").replace(/\s/g, " ")).toBe("1 000,55 € HT");
    expect(formatSystemPrice(800_000, "EUR").replace(/\s/g, " ")).toBe("8 000 €");
    expect(formatSystemPrice(800_000, "MAD", "TTC").replace(/\s/g, " ")).toBe("8 000 DH TTC");
  });
});

describe("site public sans référence au fabricant ni au fournisseur", () => {
  it("règles publiques : aucune source, aucun nom de fabricant ou fournisseur", () => {
    for (const f of base.families.filter((x) => x.systemRules)) {
      const pub = JSON.stringify({ rules: publicSystemRules(f.systemRules!), name: f.name, shortDescription: f.shortDescription });
      expect(pub, f.slug).not.toMatch(PUBLIC_FORBIDDEN_NAMES);
    }
  });

  it("messages du moteur sans citation de source", () => {
    const msgs = evaluate(base, input("helio-horizon", { widthMm: 9000, depthMm: 1500 })).issues.map((i) => i.message).join(" ");
    expect(msgs).not.toMatch(PUBLIC_FORBIDDEN_NAMES);
    expect(msgs).not.toMatch(/catalogue|fiche technique/i);
  });
});
