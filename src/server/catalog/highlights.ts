import type { CatalogSnapshot } from "@/domain/types";
import { findFamily, resolveClosureRule, resolveOptionRule } from "@/domain/engine";

export interface RangeHighlights {
  sizes: number;
  finishes: number;
  lighting: string;
  roof: string;
  rails: number | null;
  closures: string[]; // familles de fermetures proposées (au moins une règle allowed/unknown)
  options: string[];
  leadTimeDays: number | null;
}

/** Synthèse d'une gamme calculée depuis le catalogue et les règles (jamais saisie à la main). */
export function rangeHighlights(catalog: CatalogSnapshot, familySlug: string): RangeHighlights | null {
  const f = findFamily(catalog, familySlug);
  if (!f) return null;
  const closures = catalog.families.filter((c) => c.kind === "side_closure").filter((c) => (f.dimensionCodes ?? ["3x3"]).some((dc) => {
    const d = catalog.dimensions.find((x) => x.code === dc);
    return (f.finishCodes ?? ["ANTHRACITE"]).some((fc) => resolveClosureRule(catalog, { closureFamilySlug: c.slug, pergolaFamilySlug: f.slug, segmentLengthMm: d?.widthMm ?? 3000, finishCode: fc, mounting: "freestanding" })?.status === "allowed");
  })).map((c) => c.name);
  const options = catalog.families.filter((o) => o.kind === "option").filter((o) => { const r = resolveOptionRule(catalog, { optionFamilySlug: o.slug, pergolaFamilySlug: f.slug }); return r && r.status !== "forbidden" && !r.includedInBase; }).map((o) => o.name);
  const lead = catalog.variants.filter((v) => v.familySlug === f.slug).map((v) => v.leadTimeDays ?? null).find((x) => x !== null) ?? null;
  return {
    sizes: f.dimensionCodes?.length ?? 0,
    finishes: f.finishCodes?.length ?? 0,
    lighting: f.lightingIncluded === "gutter_led" ? "LED de gouttière incluse" : f.lightingIncluded === "blade_led" ? "LED intégrée aux lames" : "éclairage en option",
    roof: f.roof === "motorized" ? "toit motorisé" : "toit manuel",
    rails: f.accessoryRails ?? null,
    closures,
    options,
    leadTimeDays: lead,
  };
}
