import { describe, expect, it } from "vitest";
import { adaptStandardInput, evaluate, revalidate } from "@/domain/engine";
import { allSegments, buildLayout } from "@/domain/layout";
import type { CatalogSnapshot, PergolaStandardInput } from "@/domain/types";
import { buildDemoCatalog } from "@/server/catalog/demo-data";

const catalog = buildDemoCatalog();

function standard(over: Partial<PergolaStandardInput> = {}): PergolaStandardInput {
  return {
    kind: "pergola_standard",
    familySlug: "pergola-solis",
    mounting: "freestanding",
    dimensionCode: "3x4",
    finishCode: "ANTHRACITE",
    segments: {},
    options: [],
    installation: "self",
    delivery: { countryCode: "FR", postalCode: "69000" },
    ...over,
  };
}

describe("géométrie des côtés", () => {
  it("4 côtés monoblocs en autoportée 3x4", () => {
    const l = buildLayout({ widthMm: 3000, lengthMm: 4000, mounting: "freestanding", dividerThresholdMm: 6000 });
    expect(allSegments(l).map((s) => [s.id, s.lengthMm])).toEqual([["back-1", 4000], ["right-1", 3000], ["front-1", 4000], ["left-1", 3000]]);
    expect(l.postCount).toBe(4);
  });
  it("le côté de 6 m est divisé en deux segments de 3 m avec poteau intermédiaire", () => {
    const l = buildLayout({ widthMm: 4000, lengthMm: 6000, mounting: "freestanding", dividerThresholdMm: 6000 });
    const ids = allSegments(l).map((s) => s.id);
    expect(ids).toEqual(["back-1", "back-2", "right-1", "front-1", "front-2", "left-1"]);
    expect(allSegments(l).filter((s) => s.hasDividerPost)).toHaveLength(2);
    expect(l.postCount).toBe(6);
  });
  it("en adossée, le mur occupe le côté arrière (longueur) et il reste 3 côtés", () => {
    const l = buildLayout({ widthMm: 3000, lengthMm: 5000, mounting: "wall", dividerThresholdMm: 6000 });
    expect(l.sides.find((s) => s.key === "back")?.isWall).toBe(true);
    expect(allSegments(l).map((s) => s.id)).toEqual(["right-1", "front-1", "left-1"]);
    expect(l.postCount).toBe(2);
  });
  it("adossée 3x6 : 2 côtés de 3 m + 2 segments de 3 m", () => {
    const l = buildLayout({ widthMm: 3000, lengthMm: 6000, mounting: "wall", dividerThresholdMm: 6000 });
    expect(allSegments(l).map((s) => s.lengthMm)).toEqual([3000, 3000, 3000, 3000]);
  });
});

describe("pergola standard", () => {
  it("calcule un prix de base cohérent et marque les données démo", () => {
    const r = evaluate(catalog, standard());
    expect(r.purchasable).toBe(true);
    expect(r.lines.find((l) => l.kind === "base")?.unitGrossCents).toBeGreaterThan(0);
    expect(r.totals.totalGrossCents).toBe(r.lines.reduce((s, l) => s + l.totalGrossCents, 0));
    expect(r.totals.isFinal).toBe(true);
    expect(r.containsDemoData).toBe(true);
    expect(r.totals.taxCents).toBeGreaterThan(0);
  });
  it("sans code postal le total n'est pas définitif", () => {
    const r = evaluate(catalog, standard({ delivery: { countryCode: "FR" } }));
    expect(r.totals.isFinal).toBe(false);
    expect(r.totals.shippingGrossCents).toBeNull();
    expect(r.purchasable).toBe(true);
  });
  it("refuse une finition non proposée par la gamme (Noir sur Solis Max)", () => {
    const r = evaluate(catalog, standard({ familySlug: "pergola-solis-max", finishCode: "BLACK" }));
    expect(r.purchasable).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("finish_unavailable");
  });
  it("refuse une dimension hors catalogue et propose le sur-mesure", () => {
    const r = evaluate(catalog, standard({ dimensionCode: "5x5" }));
    expect(r.issues[0]?.code).toBe("dimension_unavailable");
    expect(r.quoteRecommended).toBe(true);
  });
  it("équipe un côté avec une paroi vitrée de la bonne longueur et couleur", () => {
    const r = evaluate(catalog, standard({ segments: { "front-1": { closureFamilySlug: "paroi-vitree", option: "fixed" } } }));
    const closure = r.lines.find((l) => l.kind === "closure");
    expect(closure?.sku).toBe("ES-PV-4M-ANT-FIXED");
    expect(r.purchasable).toBe(true);
  });
  it("structure anthracite / lames blanches : fermetures anthracite", () => {
    const r = evaluate(catalog, standard({ finishCode: "ANTHRACITE_WHITE_BLADES", segments: { "left-1": { closureFamilySlug: "store-vertical-zip" } } }));
    expect(r.lines.find((l) => l.kind === "closure")?.sku).toBe("ES-SV-3M-ANT");
  });
  it("explique l'incompatibilité : paroi vitrée sur pergola noire", () => {
    const r = evaluate(catalog, standard({ finishCode: "BLACK", segments: { "left-1": { closureFamilySlug: "paroi-vitree", option: "fixed" } } }));
    expect(r.purchasable).toBe(false);
    const issue = r.issues.find((i) => i.code === "closure_incompatible");
    expect(issue?.message).toMatch(/finition noire/);
    expect(issue?.path).toBe("segments.left-1");
  });
  it("le store vertical noir reste possible sur pergola noire", () => {
    const r = evaluate(catalog, standard({ finishCode: "BLACK", segments: { "left-1": { closureFamilySlug: "store-vertical-zip" } } }));
    expect(r.purchasable).toBe(true);
    expect(r.lines.find((l) => l.kind === "closure")?.sku).toBe("ES-SV-3M-BLA");
  });
  it("une compatibilité inconnue bloque l'achat et propose un devis", () => {
    const r = evaluate(catalog, standard({ familySlug: "pergola-solis-max", dimensionCode: "3x5", segments: { "front-1": { closureFamilySlug: "paroi-vitree", option: "fixed" } } }));
    expect(r.purchasable).toBe(false);
    expect(r.quoteRecommended).toBe(true);
    expect(r.issues.find((i) => i.code === "closure_compat_unknown")?.severity).toBe("review");
    // la ligne est tout de même chiffrée pour le devis
    expect(r.lines.some((l) => l.kind === "closure")).toBe(true);
  });
  it("sur un 4x6, chaque segment de 3 m reçoit une fermeture de 3 m", () => {
    const r = evaluate(catalog, standard({ dimensionCode: "4x6", segments: { "back-1": { closureFamilySlug: "persienne-aluminium" }, "back-2": { closureFamilySlug: "store-vertical-zip" } } }));
    expect(r.purchasable).toBe(true);
    expect(r.lines.filter((l) => l.kind === "closure").map((l) => l.sku)).toEqual(["ES-PA-3M-ANT-AUT", "ES-SV-3M-ANT"]);
  });
  it("un segment inexistant après changement de dimension est signalé, pas supprimé", () => {
    const r = evaluate(catalog, standard({ dimensionCode: "3x3", segments: { "back-2": { closureFamilySlug: "paroi-vitree", option: "fixed" } } }));
    expect(r.purchasable).toBe(false);
    expect(r.issues.find((i) => i.code === "segment_not_in_layout")?.severity).toBe("review");
  });
  it("adaptStandardInput conserve les choix à confirmer", () => {
    const prev = standard({ dimensionCode: "4x6", segments: { "back-2": { closureFamilySlug: "paroi-vitree", option: "fixed" }, "left-1": { closureFamilySlug: "store-vertical-zip" } } });
    const { next, pending } = adaptStandardInput(catalog, prev, { dimensionCode: "3x4" });
    expect(Object.keys(next.segments)).toEqual(["left-1"]);
    expect(pending.map((p) => p.segmentId)).toEqual(["back-2"]);
  });
  it("ne refacture pas l'éclairage déjà inclus (Solis Pro + bandes LED)", () => {
    const r = evaluate(catalog, standard({ familySlug: "pergola-solis-pro", options: [{ familySlug: "bandes-led", variantOption: "warm_white", qty: 1 }] }));
    const led = r.lines.find((l) => l.code.startsWith("option:bandes-led"));
    expect(led?.included).toBe(true);
    expect(led?.totalGrossCents).toBe(0);
    expect(r.issues.some((i) => i.code === "option_already_included")).toBe(true);
    expect(r.purchasable).toBe(true);
  });
  it("facture les bandes LED sur la Solis (manuelle) avec la bonne dimension", () => {
    const r = evaluate(catalog, standard({ dimensionCode: "4x5", mounting: "wall", options: [{ familySlug: "bandes-led", variantOption: "rgb", qty: 1 }] }));
    expect(r.lines.find((l) => l.kind === "option" && !l.included)?.sku).toBe("ES-LED-4X5-ADO-RGB");
  });
  it("lampe chauffante 2000 W indisponible en blanc", () => {
    const r = evaluate(catalog, standard({ finishCode: "WHITE", options: [{ familySlug: "lampe-chauffante", variantOption: "2000w", qty: 1 }] }));
    expect(r.issues.find((i) => i.code === "option_variant_missing")?.message).toMatch(/blanc/);
  });
  it("refuse une quantité supérieure au maximum", () => {
    const r = evaluate(catalog, standard({ options: [{ familySlug: "lampe-chauffante", variantOption: "1500w", qty: 9 }] }));
    expect(r.issues.some((i) => i.code === "option_qty_exceeded")).toBe(true);
  });
  it("montage professionnel : base + fermetures, montants distincts", () => {
    const r = evaluate(catalog, standard({ installation: "professional", segments: { "left-1": { closureFamilySlug: "store-vertical-zip" } } }));
    const inst = r.lines.filter((l) => l.kind === "installation");
    expect(inst).toHaveLength(2);
    expect(r.totals.installationGrossCents).toBe(inst.reduce((s, l) => s + l.totalGrossCents, 0));
  });
  it("Corse : livraison sur devis", () => {
    const r = evaluate(catalog, standard({ delivery: { countryCode: "FR", postalCode: "20000" } }));
    expect(r.purchasable).toBe(false);
    expect(r.issues.some((i) => i.code === "shipping_quote_required")).toBe(true);
  });
  it("applique un code promotionnel sur les pergolas seulement", () => {
    const r = evaluate(catalog, standard({ promotionCode: "bienvenue5", segments: { "left-1": { closureFamilySlug: "store-vertical-zip" } } }));
    const base = r.lines.find((l) => l.kind === "base")!.totalGrossCents;
    expect(r.totals.discountGrossCents).toBe(Math.round(base * 0.05));
    const bad = evaluate(catalog, standard({ promotionCode: "NOPE" }));
    expect(bad.issues.some((i) => i.code === "promotion_invalid")).toBe(true);
    expect(bad.totals.discountGrossCents).toBe(0);
  });
  it("revalide une configuration après changement de prix", () => {
    const first = evaluate(catalog, standard());
    const dearer: CatalogSnapshot = { ...catalog, version: "v2", variants: catalog.variants.map((v) => (v.familySlug === "pergola-solis" ? { ...v, priceCents: v.priceCents + 10_000 } : v)) };
    const { result, diff } = revalidate(dearer, first);
    expect(diff.priceChanged).toBe(true);
    expect(diff.catalogChanged).toBe(true);
    expect(result.totals.totalGrossCents - first.totals.totalGrossCents).toBe(10_000);
  });
  it("revalidation : une règle devenue inconnue crée un nouveau point à confirmer", () => {
    const first = evaluate(catalog, standard({ segments: { "left-1": { closureFamilySlug: "paroi-vitree", option: "fixed" } } }));
    const stricter: CatalogSnapshot = { ...catalog, version: "v3", closureCompat: catalog.closureCompat.map((r) => (r.closureFamilySlug === "paroi-vitree" && r.pergolaFamilySlug === "*" && r.segmentLengthMm === "*" ? { ...r, status: "unknown" as const } : r)) };
    const { result, diff } = revalidate(stricter, first);
    expect(result.purchasable).toBe(false);
    expect(diff.newIssues.map((i) => i.code)).toContain("closure_compat_unknown");
  });
});

describe("sur mesure", () => {
  it("reste en devis, sans prix, avec contrôle des bornes", () => {
    const ok = evaluate(catalog, { kind: "pergola_custom", widthMm: 3500, lengthMm: 4500, heightMm: 2500, mounting: "wall", finishCode: "WHITE", sides: {}, options: [], installation: "self", delivery: { countryCode: "FR" } });
    expect(ok.purchasable).toBe(false);
    expect(ok.quoteRecommended).toBe(true);
    expect(ok.totals.totalGrossCents).toBe(0);
    expect(ok.layout?.sides.find((s) => s.key === "back")?.isWall).toBe(true);
    const ko = evaluate(catalog, { kind: "pergola_custom", widthMm: 4500, lengthMm: 4505, heightMm: 1000, mounting: "wall", finishCode: "WHITE", sides: {}, options: [], installation: "self", delivery: { countryCode: "FR" } });
    expect(ko.issues.filter((i) => i.code === "custom_out_of_bounds")).toHaveLength(2);
    expect(ko.issues.some((i) => i.code === "custom_step")).toBe(true);
  });
});

describe("store banne", () => {
  it("vend seulement les variantes réellement disponibles", () => {
    const ok = evaluate(catalog, { kind: "awning", familySlug: "store-banne-ombra", widthMm: 4000, projectionMm: 3000, cabinetColor: "ANTHRACITE", fabricCode: "GREY", bracketMount: "ceiling", options: [{ familySlug: "anemometre", qty: 1 }], installation: "self", delivery: { countryCode: "FR", postalCode: "33000" } });
    expect(ok.purchasable).toBe(true);
    expect(ok.lines.find((l) => l.kind === "base")?.sku).toBe("ES-SB-4030-ANT-GREY");
    expect(ok.lines.filter((l) => l.included)).toHaveLength(2);
    expect(ok.lines.find((l) => l.code.startsWith("option:anemometre"))?.sku).toBe("ES-AN-ANT");
    const ko = evaluate(catalog, { kind: "awning", familySlug: "store-banne-ombra", widthMm: 6000, projectionMm: 3500, cabinetColor: "ANTHRACITE", fabricCode: "GREY", bracketMount: "wall", options: [], installation: "self", delivery: { countryCode: "FR" } });
    expect(ko.purchasable).toBe(false);
    expect(ko.issues[0]?.code).toBe("awning_variant_missing");
  });
  it("3 supports inclus à partir de 5 m", () => {
    const r = evaluate(catalog, { kind: "awning", familySlug: "store-banne-ombra", widthMm: 5000, projectionMm: 3000, cabinetColor: "WHITE", fabricCode: "BEIGE", bracketMount: "wall", options: [], installation: "professional", delivery: { countryCode: "FR", postalCode: "75011" } });
    expect(r.lines.find((l) => l.code.endsWith(":brackets"))?.qty).toBe(3);
    expect(r.totals.installationGrossCents).toBe(29_900);
  });
});

describe("accessoire seul", () => {
  it("achat possible après vérification de compatibilité", () => {
    const r = evaluate(catalog, { kind: "accessory", familySlug: "store-vertical-zip", sku: "ES-SV-4M-WHI", qty: 2, target: { pergolaFamilySlug: "pergola-solis-pro", dimensionCode: "4x4", mounting: "freestanding", finishCode: "WHITE", segmentLengthMm: 4000 }, delivery: { countryCode: "FR", postalCode: "44000" } });
    expect(r.purchasable).toBe(true);
    expect(r.totals.goodsGrossCents).toBe(2 * catalog.variants.find((v) => v.sku === "ES-SV-4M-WHI")!.priceCents);
  });
  it("refuse une longueur ou une couleur qui ne correspondent pas", () => {
    const r = evaluate(catalog, { kind: "accessory", familySlug: "store-vertical-zip", sku: "ES-SV-4M-WHI", qty: 1, target: { pergolaFamilySlug: "pergola-solis", finishCode: "ANTHRACITE", segmentLengthMm: 3000 }, delivery: { countryCode: "FR" } });
    expect(r.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["closure_length_mismatch", "closure_color_mismatch"]));
    expect(r.purchasable).toBe(false);
  });
  it("anémomètre sur une pergola : interdit avec explication", () => {
    const r = evaluate(catalog, { kind: "accessory", familySlug: "anemometre", sku: "ES-AN-ANT", qty: 1, target: { pergolaFamilySlug: "pergola-solis" }, delivery: { countryCode: "FR" } });
    expect(r.issues[0]?.code).toBe("option_incompatible");
  });
});

describe("prix falsifié", () => {
  it("le résultat ne dépend que du catalogue et de l'entrée, jamais d'un total fourni", () => {
    const input = { ...standard(), totals: { totalGrossCents: 1 } } as unknown as PergolaStandardInput;
    const r = evaluate(catalog, input);
    expect(r.totals.totalGrossCents).toBeGreaterThan(100_000);
  });
});

describe("éclairage inclus avec choix de couleur", () => {
  it("Solis Pro : la ligne incluse porte la couleur choisie, sans facturation ni doublon", () => {
    const r = evaluate(catalog, standard({ familySlug: "pergola-solis-pro", options: [{ familySlug: "bandes-led", variantOption: "rgb", qty: 1 }] }));
    const included = r.lines.filter((l) => l.included);
    expect(included).toHaveLength(1);
    expect(included[0]!.label).toMatch(/Éclairage LED de gouttière \(inclus\) – .*RGB/);
    expect(included[0]!.totalGrossCents).toBe(0);
    expect(r.purchasable).toBe(true);
    const none = evaluate(catalog, standard({ familySlug: "pergola-solis-pro" }));
    expect(none.lines.filter((l) => l.included).map((l) => l.label)).toEqual(["Éclairage LED de gouttière (inclus)"]);
  });
});
