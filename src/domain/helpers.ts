import { resolveClosureRule, resolveOptionRule, variantsOf } from "./engine";
import type { CatalogSnapshot, CompatStatus, Family, PergolaStandardInput, Segment, Variant } from "./types";

export interface ClosureChoice {
  family: Family;
  status: CompatStatus | "no_variant";
  reason?: string;
  variants: Array<{ option?: string; sku: string; priceCents: number; label: string; purchasable: boolean }>;
}

/** Fermetures proposables pour un segment donné, avec leur statut expliqué. */
export function closureChoicesFor(catalog: CatalogSnapshot, input: PergolaStandardInput, segment: Segment): ClosureChoice[] {
  const fin = catalog.finishes.find((f) => f.code === input.finishCode);
  return catalog.families.filter((f) => f.kind === "side_closure" && f.status !== "archived").map((family) => {
    const rule = resolveClosureRule(catalog, { closureFamilySlug: family.slug, pergolaFamilySlug: input.familySlug, segmentLengthMm: segment.lengthMm, finishCode: input.finishCode, mounting: input.mounting });
    const variants = variantsOf(catalog, family.slug).filter((v) => v.attributes.kind === "side_closure" && v.attributes.sideLengthMm === segment.lengthMm && v.attributes.colorCode === fin?.structureColor && (!v.attributes.mounting || v.attributes.mounting === input.mounting)).map((v) => ({ option: v.attributes.kind === "side_closure" ? v.attributes.option : undefined, sku: v.sku, priceCents: v.priceCents, label: v.label, purchasable: v.purchasable }));
    const status: ClosureChoice["status"] = rule?.status === "forbidden" ? "forbidden" : variants.length === 0 ? "no_variant" : (rule?.status ?? "unknown");
    const reason = rule?.status === "forbidden" ? rule.reason : variants.length === 0 ? `aucune référence de ${segment.lengthMm / 1000} m en ${fin?.label.toLowerCase() ?? "cette finition"}` : rule?.status === "unknown" ? (rule.reason ?? "compatibilité non confirmée : validation sur devis") : undefined;
    return { family, status, reason, variants };
  });
}

export interface OptionChoiceInfo {
  family: Family;
  status: CompatStatus;
  includedInBase: boolean;
  maxQty: number;
  reason?: string;
  variants: Variant[];
}

export function optionChoicesFor(catalog: CatalogSnapshot, input: PergolaStandardInput): OptionChoiceInfo[] {
  const fin = catalog.finishes.find((f) => f.code === input.finishCode);
  return catalog.families.filter((f) => f.kind === "option").map((family) => {
    const rule = resolveOptionRule(catalog, { optionFamilySlug: family.slug, pergolaFamilySlug: input.familySlug });
    const variants = variantsOf(catalog, family.slug).filter((v) => v.attributes.kind === "option" && (!v.attributes.dimensionCode || v.attributes.dimensionCode === input.dimensionCode) && (!v.attributes.mounting || v.attributes.mounting === input.mounting) && (!v.attributes.colorCode || v.attributes.colorCode === fin?.structureColor));
    return { family, status: rule?.status ?? "unknown", includedInBase: !!rule?.includedInBase, maxQty: rule?.maxQty ?? 1, reason: rule?.reason, variants };
  }).filter((o) => o.status !== "forbidden");
}

export function summarizeStandard(catalog: CatalogSnapshot, input: PergolaStandardInput): string {
  const fam = catalog.families.find((f) => f.slug === input.familySlug)?.name ?? input.familySlug;
  const dim = catalog.dimensions.find((d) => d.code === input.dimensionCode)?.label ?? input.dimensionCode;
  const fin = catalog.finishes.find((f) => f.code === input.finishCode)?.label ?? input.finishCode;
  return `${fam} ${dim} · ${fin} · ${input.mounting === "wall" ? "adossée" : "autoportée"}`;
}
