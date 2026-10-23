/**
 * Nomenclature commerciale HELIOSTORES (décision client du 2026-10-22).
 *
 * Le nom commercial est le seul nom public d'un produit ou d'un équipement. La référence fournisseur, le
 * fabricant et les sources restent des données internes (`supplierRef`, `manufacturer`, `sources`) consultables
 * dans l'administration ; ils ne partent jamais vers le navigateur. Ce module ne contient que des noms publics :
 * les anciens identifiants sont dans `src/server/catalog/legacy-slugs.ts` (serveur et redirections seulement).
 */

/** Produits du catalogue : identifiant (slug, aussi segment d'URL) et nom commercial. */
export const PRODUCT_NAMES = {
  "helio-horizon": "HELIO Horizon",
  "helio-panorama": "HELIO Panorama",
  "helio-ombra": "HELIO Ombra",
  "helio-riviera": "HELIO Riviera",
  /** appellation réservée : produit en brouillon, hors catalogue public */
  "helio-verriere": "HELIO Verrière",
  /** proposition (2026-10-23) : niveau Premium des stores bannes, en brouillon */
  "helio-azur": "HELIO Azur",
} as const;

export type ProductSlug = keyof typeof PRODUCT_NAMES;

/**
 * Noms commerciaux des équipements. Un nom ne s'applique qu'à un équipement réellement documenté pour un
 * produit : la nomenclature ne crée ni accessoire, ni compatibilité, ni équipement inclus.
 */
export const ACCESSORY_NAMES = {
  remote: "HELIO Pilot",
  connect: "HELIO Connect",
  wind: "HELIO Vent",
  sun: "HELIO Soleil",
  light: "HELIO Lumière",
  heating: "HELIO Confort",
} as const;
