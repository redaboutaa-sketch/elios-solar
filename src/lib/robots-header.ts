/** Préfixes jamais indexés, même en production : espace client, panier, commande, projets partagés, administration, API. */
export const PRIVATE_PREFIXES = ["/admin", "/compte", "/panier", "/commande", "/projets", "/api"] as const;

/** Valeur de l'en-tête X-Robots-Tag pour un chemin, ou null (indexation laissée aux balises de la page). */
export function robotsHeaderFor(pathname: string, indexable: boolean): string | null {
  if (!indexable) return "noindex, nofollow, noarchive";
  if (PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "noindex, nofollow";
  return null;
}
