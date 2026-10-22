/**
 * Anciens identifiants des produits HELIOSTORES (avant la nomenclature commerciale du 2026-10-22), pour les
 * redirections permanentes des anciennes URL et la lecture des liens enregistrés. Les identifiants internes
 * (clés primaires, SKU) n'ont pas changé ; seul le slug public a été renommé (migration
 * `20261022090000_heliostores_nomenclature`).
 *
 * Module sans dépendance : lu par `next.config.ts` et par le serveur, jamais importé par un composant client.
 */
export const LEGACY_FAMILY_SLUGS: Readonly<Record<string, string>> = {
  "pergola-sb400": "helio-horizon",
  "pergola-sb500": "helio-panorama",
  "screen-refleksol-120-ziiip": "helio-ombra",
  "store-banne-casablanca": "helio-riviera",
  "veranda-fts": "helio-verriere",
};

/** Slug actuel d'un produit, à partir d'un slug actuel ou ancien. */
export function canonicalFamilySlug(slug: string): string {
  return LEGACY_FAMILY_SLUGS[slug] ?? slug;
}

/** Segment d'URL public des produits publiés (le produit en brouillon n'a pas de page). */
const PUBLIC_PATHS: Readonly<Record<string, string>> = {
  "helio-horizon": "/pergolas",
  "helio-panorama": "/pergolas",
  "helio-ombra": "/screens",
  "helio-riviera": "/stores-bannes",
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
