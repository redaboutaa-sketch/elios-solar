/**
 * Les trois familles publiques du catalogue HELIOSTORES (instruction client) — pur, partagé client/serveur.
 * Aucune quatrième famille : un système qui n'en relève pas reste en brouillon (`category: null`).
 */
export type CategoryKey = "PERGOLAS" | "SCREENS" | "STORES_BANNES";

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  /** libellé au singulier, pour les titres (« Pergola HELIO Horizon ») */
  singular: string;
  href: string;
  intro: string;
}

export const CATEGORIES: readonly CategoryDef[] = [
  { key: "PERGOLAS", label: "Pergolas", singular: "Pergola", href: "/pergolas", intro: "Pergolas à lames orientables motorisées, adossées ou autoportantes, configurées à vos cotes." },
  { key: "SCREENS", label: "Screens", singular: "Screen", href: "/screens", intro: "Screens à toile tendue pour la protection solaire verticale des baies et façades." },
  { key: "STORES_BANNES", label: "Stores bannes", singular: "Store banne", href: "/stores-bannes", intro: "Stores bannes à coffre pour ombrager votre terrasse." },
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
