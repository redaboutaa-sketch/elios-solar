/**
 * Nomenclature commerciale HELIOSTORES — décision client du 2026-10-25 (remplace celle du 2026-10-22).
 *
 * Le nom commercial est le seul nom public d'un produit ou d'un équipement. La référence fournisseur, le fabricant et
 * les sources restent des données internes (`supplierRef`, `manufacturer`, `sources`) consultables dans
 * l'administration ; ils ne partent jamais vers le navigateur. Exceptions voulues par le client : Casablanca, Corsica,
 * Jamaica et Madera gardent le nom du modèle du fabricant. Les anciens identifiants sont dans
 * `src/server/catalog/legacy-slugs.ts` (serveur et redirections seulement).
 */

/** Produits du catalogue : identifiant (slug, aussi segment d'URL) et nom commercial, par famille. */
export const PRODUCT_NAMES = {
  // Pergolas
  malaga: "Malaga",
  marbella: "Marbella",
  sevilla: "Sevilla",
  // Screens
  helioscreen: "HelioScreen",
  "helioroof-screen": "HelioRoof Screen",
  // Stores bannes (noms du fabricant conservés par le client)
  casablanca: "Casablanca",
  corsica: "Corsica",
  jamaica: "Jamaica",
  madera: "Madera",
  // Moustiquaires
  moskifold: "MoskiFold",
  "moskifold-2": "MoskiFold 2",
  moskiup: "MoskiUp",
  moskislide: "MoskiSlide",
  moskifix: "MoskiFix",
} as const;

export type ProductSlug = keyof typeof PRODUCT_NAMES;

/**
 * Libellés publics des équipements : descriptifs (plus de noms commerciaux d'accessoires). Un libellé ne crée ni
 * accessoire, ni compatibilité, ni équipement inclus : il ne s'applique qu'à un équipement réellement documenté.
 */
export const ACCESSORY_LABELS = {
  remote: "Télécommande radio",
  connect: "Box domotique — commande par smartphone",
  wind: "Capteur de vent",
  light: "Éclairage LED",
  sideClosure: "Fermetures latérales coulissantes (vitrage)",
} as const;
