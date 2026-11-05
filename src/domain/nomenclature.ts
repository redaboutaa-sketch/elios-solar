/**
 * Nomenclature commerciale HELIOSTORES — transcodification HELIO validée par le client le 2026-10-31 (remplace les noms
 * du 2026-10-25 : Malaga, Marbella, Sevilla, HelioRoof Screen, Casablanca, Corsica, Jamaica, Madera).
 *
 * Le nom commercial est le seul nom public d'un produit ou d'un équipement. La référence fournisseur, le fabricant et
 * les sources restent des données internes (`supplierRef`, `manufacturer`, `sources`) consultables dans
 * l'administration ; ils ne partent jamais vers le navigateur. Les identifiants techniques (id, slug, donc les URL) ne
 * changent pas : un renommage ne crée ni doublon ni redirection, et ne modifie aucune configuration enregistrée. Les
 * anciens noms restent des alias internes (`ProductFamily.nameHistory`, `NAME_TRANSCO`). Les anciens identifiants sont
 * dans `src/server/catalog/legacy-slugs.ts` (serveur et redirections seulement).
 */

/** Produits du catalogue : identifiant (slug, aussi segment d'URL) et nom commercial, par famille. */
export const PRODUCT_NAMES = {
  // Pergolas
  malaga: "HelioSky",
  marbella: "HelioMax",
  sevilla: "HelioLux",
  // Screens
  helioscreen: "HelioScreen",
  "helioroof-screen": "HelioRoof",
  // Stores bannes
  casablanca: "HelioSun",
  corsica: "HelioShade",
  jamaica: "HelioPro",
  madera: "HelioSquare",
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
  sideClosure: "HelioSlide VERRE — fermeture vitrée coulissante",
  slidingPanels: "HelioSlide ALU — remplissage coulissant en aluminium",
} as const;

/**
 * Anciens noms commerciaux (alias internes) → nom public actuel, pour la recherche et le chat. Sans référence
 * fournisseur : la transcodification complète (références privées, statut technique) est côté serveur,
 * `src/server/catalog/name-transco.ts`.
 */
export const NAME_ALIASES: ReadonlyArray<{ alias: string; name: string; slug: string }> = [
  { alias: "Marbella", name: "HelioMax", slug: "marbella" },
  { alias: "Sevilla", name: "HelioLux", slug: "sevilla" },
  { alias: "Sevillia", name: "HelioLux", slug: "sevilla" },
  { alias: "Malaga", name: "HelioSky", slug: "malaga" },
  { alias: "HelioRoof Screen", name: "HelioRoof", slug: "helioroof-screen" },
  { alias: "Casablanca", name: "HelioSun", slug: "casablanca" },
  { alias: "Corsica", name: "HelioShade", slug: "corsica" },
  { alias: "Jamaica", name: "HelioPro", slug: "jamaica" },
  { alias: "Madera", name: "HelioSquare", slug: "madera" },
];

/**
 * Nom public actuel d'un produit à partir d'un nom enregistré (projet sauvegardé avant un renommage). Affichage
 * seulement : la configuration enregistrée n'est pas modifiée. Ne pas utiliser pour un devis, une commande ou un PDF
 * émis, qui gardent le nom de leur date d'émission.
 */
export function currentProductName(name: string): string {
  return NAME_ALIASES.find((a) => a.alias === name)?.name ?? name;
}
