/**
 * Anciens identifiants des produits HELIOSTORES, pour les redirections permanentes des anciennes URL et la lecture des
 * liens enregistrés. Une redirection n'existe que lorsque la correspondance est établie (MÊME produit) :
 * - 2026-10-22 : références fournisseur → noms HELIO (migration `20261022090000_heliostores_nomenclature`) ;
 * - 2026-10-25 : HELIO Ombra → HelioScreen (R 120 ZiiiP, ex-REFLEKSOL 120 ZiiiP), HELIO Riviera → Casablanca,
 *   HELIO Azur → Corsica (migration `20261025090000_quatre_familles`).
 * Les modèles retirés (HELIO Horizon / SB 400, HELIO Panorama / SB 500, HELIO Verrière / VERANDA FTS) gardent leur
 * slug : leurs anciennes URL affichent une page explicative avec un choix de gamme (pas de redirection vers un autre
 * produit, pas de conversion de configuration).
 *
 * Module sans dépendance : lu par `next.config.ts` et par le serveur, jamais importé par un composant client.
 */
export const LEGACY_FAMILY_SLUGS: Readonly<Record<string, string>> = {
  "pergola-sb400": "helio-horizon",
  "pergola-sb500": "helio-panorama",
  "screen-refleksol-120-ziiip": "helioscreen",
  "store-banne-casablanca": "casablanca",
  "veranda-fts": "helio-verriere",
  "helio-ombra": "helioscreen",
  "helio-riviera": "casablanca",
  "helio-azur": "corsica",
};

/** Slugs renommés le 2026-10-25 (même produit) : ancien → nouveau. */
export const RENAMED_2026_10_25: Readonly<Record<string, string>> = {
  "helio-ombra": "helioscreen",
  "helio-riviera": "casablanca",
  "helio-azur": "corsica",
};

/** Slug actuel d'un produit, à partir d'un slug actuel ou ancien. */
export function canonicalFamilySlug(slug: string): string {
  return LEGACY_FAMILY_SLUGS[slug] ?? slug;
}

/** Segment d'URL public des produits (modèles retirés compris : leur page explicative est sous la famille d'origine). */
const PUBLIC_PATHS: Readonly<Record<string, string>> = {
  "helio-horizon": "/pergolas",
  "helio-panorama": "/pergolas",
  helioscreen: "/screens",
  casablanca: "/stores-bannes",
  corsica: "/stores-bannes",
};

/** Redirections permanentes des anciennes fiches et des anciens configurateurs (la requête est conservée). */
export function legacyProductRedirects() {
  return Object.entries(LEGACY_FAMILY_SLUGS).flatMap(([from, to]) => {
    const base = PUBLIC_PATHS[to];
    if (!base) return [];
    return [
      { source: `${base}/${from}`, destination: `${base}/${to}`, permanent: true },
      { source: `/configurateur/${from}`, destination: `/configurateur/${to}`, permanent: true },
    ];
  });
}
