import { describe, expect, it } from "vitest";
import { evaluate } from "@/domain/engine";
import { estimateDelivery, formatLeadRange, leadRangeOf, variantToShipmentItem } from "@/domain/lead-time";
import { formatEur } from "@/domain/money";
import type { CatalogSnapshot, PergolaStandardInput } from "@/domain/types";
import { buildDemoCatalog } from "@/server/catalog/demo-data";

const catalog = buildDemoCatalog();
const std = (over: Partial<PergolaStandardInput> = {}): PergolaStandardInput => ({ kind: "pergola_standard", familySlug: "pergola-solis", mounting: "freestanding", dimensionCode: "3x5", finishCode: "ANTHRACITE", segments: {}, options: [], installation: "self", delivery: { countryCode: "FR", postalCode: "69000" }, ...over });
const v = (sku: string) => catalog.variants.find((x) => x.sku === sku)!;

describe("euros / centimes : non-régression du facteur 100", () => {
  it("prix démo des fermetures et LED dans des ordres de grandeur plausibles", () => {
    expect(v("ES-PV-3M-ANT-FIXED").priceCents).toBe(144_000);
    expect(formatEur(v("ES-PV-3M-ANT-FIXED").priceCents)).toMatch(/1\s?440/);
    for (const x of catalog.variants.filter((y) => y.attributes.kind === "side_closure")) {
      expect(x.priceCents).toBeGreaterThan(50_000);
      expect(x.priceCents).toBeLessThan(500_000);
    }
    for (const x of catalog.variants.filter((y) => y.familySlug === "bandes-led")) expect(x.priceCents).toBeLessThan(100_000);
    for (const x of catalog.variants.filter((y) => y.attributes.kind === "pergola_standard")) {
      expect(Number.isInteger(x.priceCents)).toBe(true);
      expect(x.priceCents).toBeGreaterThan(200_000);
      expect(x.priceCents).toBeLessThan(2_000_000);
    }
  });
});

describe("persiennes 5/6 m : assemblage modulaire à confirmer", () => {
  it("3/4 m monobloc achetable ; 5 m assemblage de modules → devis, poteau intermédiaire et cote utile affichés", () => {
    const ok = evaluate(catalog, std({ dimensionCode: "3x4", segments: { "left-1": { closureFamilySlug: "persienne-aluminium" } } }));
    expect(ok.purchasable).toBe(true);
    const five = evaluate(catalog, std({ segments: { "front-1": { closureFamilySlug: "persienne-aluminium" } } }));
    expect(five.purchasable).toBe(false);
    const issue = five.issues.find((i) => i.code === "closure_assembly_to_confirm");
    expect(issue?.quoteSuggested).toBe(true);
    expect(issue?.message).toMatch(/2 modules/);
    expect(issue?.message).toMatch(/poteau intermédiaire/);
    const a = v("ES-PA-5M-ANT-AUT").attributes;
    expect(a.kind === "side_closure" && a.assembly === "modular" && a.validation === "to_confirm" && (a.usableWidthMm ?? 0) < 5000).toBe(true);
  });
  it("la faisabilité n'est pas déduite de la largeur nominale : un côté de 6 m reste divisé en 2 × 3 m", () => {
    const r = evaluate(catalog, std({ dimensionCode: "4x6", segments: { "front-1": { closureFamilySlug: "persienne-aluminium" }, "front-2": { closureFamilySlug: "persienne-aluminium" } } }));
    expect(r.lines.filter((l) => l.kind === "closure")).toHaveLength(2);
    expect(r.lines.filter((l) => l.kind === "closure").every((l) => l.sku?.startsWith("ES-PA-3M"))).toBe(true);
  });
});

describe("câble de store banne", () => {
  const awning = { kind: "awning" as const, familySlug: "store-banne-ombra", widthMm: 4000, projectionMm: 3000, cabinetColor: "ANTHRACITE", fabricCode: "GREY", bracketMount: "wall" as const, installation: "self" as const, delivery: { countryCode: "FR", postalCode: "69000" } };
  it("câble fourni inclus à 0 €, distinct de la rallonge 6 m non confirmée (devis)", () => {
    const base = evaluate(catalog, { ...awning, options: [] });
    const cableLine = base.lines.find((l) => l.code.endsWith(":cable"))!;
    // démo 3 m et observation 7,5 m en conflit, aucune confirmation : aucune longueur affichée comme certaine
    expect(cableLine.label).toBe("Câble d'alimentation fourni, longueur à confirmer (inclus)");
    expect(cableLine.label).not.toMatch(/\d+([,.]\d+)? m/);
    expect(cableLine.totalGrossCents).toBe(0);
    const ext = evaluate(catalog, { ...awning, options: [{ familySlug: "cable-alimentation", variantOption: "6m", qty: 1 }] });
    expect(ext.purchasable).toBe(false);
    expect(ext.issues.some((i) => i.code === "cable_extension_prerequisites" && /électricien/.test(i.message))).toBe(true);
    expect(ext.issues.some((i) => i.code === "option_compat_unknown")).toBe(true);
  });
  it("une longueur n'est affichée qu'une fois confirmée par le fournisseur", () => {
    const fam = catalog.families.find((f) => f.slug === "store-banne-ombra")!;
    const confirmed: CatalogSnapshot = { ...catalog, families: catalog.families.map((f) => (f === fam ? { ...f, technicalSpecs: [...(f.technicalSpecs ?? []), { key: "included_cable_length", label: "Longueur", valueNum: 7500, unit: "mm", source: "supplier_confirmed" as const, sourceRef: "fiche fournisseur v2" }] } : f)) };
    const r = evaluate(confirmed, { ...awning, options: [] });
    expect(r.lines.find((l) => l.code.endsWith(":cable"))?.label).toBe("Câble d'alimentation fourni, 7,5 m (inclus)");
  });
  it("rallonge interdite sur une pergola", () => {
    const r = evaluate(catalog, std({ options: [{ familySlug: "cable-alimentation", qty: 1 }] }));
    expect(r.issues.some((i) => i.code === "option_incompatible")).toBe(true);
  });
});

describe("disponibilité et délais", () => {
  it("rupture sans précommande bloque l'achat ; avec précommande l'achat reste possible", () => {
    const out: CatalogSnapshot = { ...catalog, variants: catalog.variants.map((x) => (x.sku === "ES-PS1-3X5-ANT-AUT" ? { ...x, availability: "out_of_stock" as const, preorderAllowed: false } : x)) };
    const r = evaluate(out, std());
    expect(r.purchasable).toBe(false);
    expect(r.issues.some((i) => i.code === "variant_out_of_stock" && i.quoteSuggested)).toBe(true);
    const pre: CatalogSnapshot = { ...catalog, variants: catalog.variants.map((x) => (x.sku === "ES-PS1-3X5-ANT-AUT" ? { ...x, availability: "out_of_stock" as const, preorderAllowed: true } : x)) };
    expect(evaluate(pre, std()).purchasable).toBe(true);
  });
  it("fourchette depuis la décomposition fournisseur/préparation/fabrication/transport", () => {
    const r = leadRangeOf(v("ES-PS1-3X5-ANT-AUT"))!;
    expect(r.fromComponents).toBe(true);
    expect(r.minRaw).toBe(22);
    expect(formatLeadRange(r)).toBe("22 à 30 jours ouvrés");
    expect(formatLeadRange(leadRangeOf({ ...v("ES-CAB-6M"), leadTimeDays: null }))).toBe("délai à confirmer");
  });
  it("expédition groupée au délai le plus long ; séparée si autorisée ; inconnue si une référence est à confirmer", () => {
    const now = new Date("2026-10-19T00:00:00Z");
    const items = [variantToShipmentItem(v("ES-PS1-3X5-ANT-AUT"), 1, null), variantToShipmentItem(v("ES-CH-1500W-ANT"), 2, 30)];
    const g = estimateDelivery(items, "GROUPED", now);
    expect(g.status).toBe("estimated");
    expect(g.shipments).toHaveLength(1);
    expect(g.shipments[0]!.reason).toMatch(/groupée/);
    // la pergola n'autorise pas la livraison partielle : groupée même si la politique est séparée
    expect(estimateDelivery(items, "SEPARATE", now).shipments).toHaveLength(1);
    const sep = estimateDelivery([variantToShipmentItem(v("ES-PV-3M-ANT-FIXED"), 1, null), variantToShipmentItem(v("ES-CH-1500W-ANT"), 1, 30)], "SEPARATE", now);
    expect(sep.shipments).toHaveLength(2);
    expect(sep.explanation).toMatch(/séparée/);
    const unk = estimateDelivery([...items, variantToShipmentItem(v("ES-PA-5M-ANT-AUT"), 1, null)], "GROUPED", now);
    expect(unk.status).toBe("unknown");
    expect(unk.shipments).toHaveLength(0);
    const short = estimateDelivery([variantToShipmentItem({ ...v("ES-LA-MEDIUM-ANT"), preorderAllowed: false }, 5, 3)], "GROUPED", now);
    expect(short.status).toBe("blocked");
  });
});
