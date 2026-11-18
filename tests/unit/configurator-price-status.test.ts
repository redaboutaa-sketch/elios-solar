import { describe, expect, it } from "vitest";
import { evaluate } from "@/domain/engine";
import { CUSTOM_SIZE, defaultSystemInput, type SystemInput } from "@/domain/system";
import type { SystemPriceTable } from "@/domain/system-pricing";
import { buildHeliostoresCatalog } from "@/server/catalog/heliostores-data";

// grille FICTIVE isolée (montants de test, sans rapport avec un tarif réel) : HelioMax (marbella), pose murale
const table: SystemPriceTable = {
  currency: "EUR", taxBasis: "HT", dimAKey: "projection", listVersion: 3,
  cells: [3000, 4000].flatMap((dimAmm, d) => [3000, 4000].map((w, k) => ({ variantKey: "murale", dimAmm, widthMinMm: w, widthMaxMm: w, amountMinor: 1_000_00 + d * 100_00 + k * 10_00 }))),
};
const real = buildHeliostoresCatalog();
const priced = { ...real, families: real.families.map((f) => (f.slug === "marbella" ? { ...f, systemPrices: table } : f)) };
const rules = real.families.find((f) => f.slug === "marbella")!.systemRules!;
const cfg = (over: Partial<SystemInput>): SystemInput => ({ ...defaultSystemInput("marbella", rules), mounting: "wall", widthMm: 3000, depthMm: 3000, options: [], sides: {}, installation: "self", ...over });

describe("prix pendant la configuration : états explicites, jamais d'ancien montant", () => {
  it("sans grille de vente publiée (production actuelle) : « no_table », aucun montant", () => {
    const r = evaluate(real, cfg({}));
    expect(r.priceStatus).toBe("no_table");
    expect(r.systemPrice).toBeNull();
  });

  it("grille fictive : cote exacte chiffrée, puis chaque changement non chiffrable retire le montant", () => {
    const a = evaluate(priced, cfg({}));
    expect(a.priceStatus).toBe("priced");
    expect(a.systemPrice).toMatchObject({ amountMinor: 1_000_00, currency: "EUR", taxBasis: "HT", listVersion: 3 });
    // changement de dimension couvert : nouveau montant
    expect(evaluate(priced, cfg({ widthMm: 4000, depthMm: 4000 })).systemPrice?.amountMinor).toBe(1_110_00);
    // cote hors grille : plus de montant
    const b = evaluate(priced, cfg({ widthMm: 3500 }));
    expect([b.priceStatus, b.systemPrice]).toEqual(["out_of_grid", null]);
    // pose sans grille publiée (autoportante) : plus de montant
    const c = evaluate(priced, cfg({ mounting: "freestanding" }));
    expect([c.priceStatus, c.systemPrice]).toEqual(["incomplete", null]);
    // demande hors gamme : plus de montant
    const d = evaluate(priced, cfg({ sizeCode: CUSTOM_SIZE }));
    expect([d.priceStatus, d.systemPrice]).toEqual(["custom", null]);
    // teinte retirée de la gamme (configuration ancienne) : blocage, plus de montant
    const e = evaluate(priced, cfg({ finishCode: "RAL-INEXISTANT" }));
    expect([e.priceStatus, e.systemPrice]).toEqual(["blocked", null]);
    // retour à la cote chiffrée : le montant revient, recalculé
    expect(evaluate(priced, cfg({})).systemPrice?.amountMinor).toBe(1_000_00);
  });
});
