import type { CatalogSnapshot } from "@/domain/types";
import { resolveClosureRule, resolveOptionRule } from "@/domain/engine";

export interface AccessoryCompatSummary {
  /** gammes où au moins une combinaison est autorisée */
  allowed: string[];
  /** gammes où certaines combinaisons sont à confirmer (devis) */
  partial: string[];
  /** gammes exclues */
  forbidden: string[];
  colors: string[];
  lengthsMm: number[];
  label: string;
}

const COLOR_LABEL: Record<string, string> = { ANTHRACITE: "anthracite", WHITE: "blanc", BLACK: "noir" };

/** Résumé de compatibilité d'une famille d'accessoire, dérivé uniquement des règles et variantes. */
export function accessoryCompat(catalog: CatalogSnapshot, familySlug: string): AccessoryCompatSummary {
  const fam = catalog.families.find((f) => f.slug === familySlug);
  const pergolas = catalog.families.filter((f) => f.kind === "pergola_standard" || f.kind === "awning");
  const variants = catalog.variants.filter((v) => v.familySlug === familySlug);
  const colors = [...new Set(variants.map((v) => (v.attributes.kind === "side_closure" || v.attributes.kind === "option" ? v.attributes.colorCode : undefined)).filter((c): c is string => !!c))];
  const lengthsMm = [...new Set(variants.map((v) => (v.attributes.kind === "side_closure" ? v.attributes.sideLengthMm : undefined)).filter((l): l is number => !!l))].sort((a, b) => a - b);
  const allowed: string[] = [], partial: string[] = [], forbidden: string[] = [];
  for (const p of pergolas) {
    let statuses: Array<"allowed" | "forbidden" | "unknown"> = [];
    if (fam?.kind === "side_closure") {
      if (p.kind !== "pergola_standard") continue;
      for (const fc of p.finishCodes ?? []) for (const len of lengthsMm.length ? lengthsMm : [3000]) for (const m of ["freestanding", "wall"] as const) {
        const fin = catalog.finishes.find((f) => f.code === fc);
        const hasVariant = variants.some((v) => v.attributes.kind === "side_closure" && v.attributes.sideLengthMm === len && v.attributes.colorCode === fin?.structureColor);
        const r = resolveClosureRule(catalog, { closureFamilySlug: familySlug, pergolaFamilySlug: p.slug, segmentLengthMm: len, finishCode: fc, mounting: m });
        statuses.push(!hasVariant ? "forbidden" : (r?.status ?? "unknown"));
      }
    } else {
      const r = resolveOptionRule(catalog, { optionFamilySlug: familySlug, pergolaFamilySlug: p.slug });
      statuses = [r?.status ?? "unknown"];
    }
    if (statuses.every((s) => s === "forbidden")) forbidden.push(p.name);
    else if (statuses.every((s) => s === "allowed")) allowed.push(p.name);
    else partial.push(p.name);
  }
  const names = [...allowed, ...partial];
  const all = pergolas.filter((p) => fam?.kind === "side_closure" ? p.kind === "pergola_standard" : true).length;
  const label = names.length === 0 ? "Compatibilité à confirmer" : names.length === all && partial.length === 0 ? "Compatible avec toutes les pergolas" : `Compatible avec ${names.join(", ")}${partial.length ? " (certaines combinaisons sur devis)" : ""}`;
  return { allowed, partial, forbidden, colors: colors.map((c) => COLOR_LABEL[c] ?? c), lengthsMm, label };
}
