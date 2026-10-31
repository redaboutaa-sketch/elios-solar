/**
 * Les quatre familles publiques du catalogue HELIOSTORES (nomenclature du 2026-10-25) — pur, partagé client/serveur.
 * Un système qui n'en relève pas reste en brouillon (`category: null`). Les accessoires (ex. fermetures latérales
 * coulissantes) ne sont jamais une famille.
 */
export type CategoryKey = "PERGOLAS" | "SCREENS" | "STORES_BANNES" | "MOUSTIQUAIRES";

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  /** libellé au singulier, pour les titres (« Pergola HELIO Horizon ») */
  singular: string;
  href: string;
  intro: string;
}

export const CATEGORIES: readonly CategoryDef[] = [
  { key: "PERGOLAS", label: "Pergolas", singular: "Pergola", href: "/pergolas", intro: "Pergolas à lames orientables ou à toiture en toile, adossées ou autoportantes." },
  { key: "SCREENS", label: "Screens", singular: "Screen", href: "/screens", intro: "Screens à toile tendue : protection solaire des baies et façades, et screen de toiture." },
  { key: "STORES_BANNES", label: "Stores bannes", singular: "Store banne", href: "/stores-bannes", intro: "Stores bannes à coffre, semi-coffre ou sans coffre pour ombrager votre terrasse." },
  { key: "MOUSTIQUAIRES", label: "Moustiquaires", singular: "Moustiquaire", href: "/moustiquaires", intro: "Moustiquaires plissées, enroulables, coulissantes ou fixes pour portes et fenêtres." },
] as const;

export function categoryByKey(key: string | null | undefined): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

export function categoryByHref(href: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.href === href);
}

/** URL publique d'une fiche produit. */
export function productHref(category: CategoryKey, slug: string): string {
  return `${categoryByKey(category)!.href}/${slug}`;
}

/** URL du configurateur d'un produit. */
export function configuratorHref(slug: string): string {
  return `/configurateur/${slug}`;
}
