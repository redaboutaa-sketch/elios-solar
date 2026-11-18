/**
 * Règles d'exploration (robots.txt), en fonction de l'environnement. Fonction pure, testée.
 * - Environnement non public (préproduction, SITE_INDEXABLE ≠ true) : tout est interdit, sans sitemap.
 * - Production : exploration autorisée, sauf les espaces privés, transactionnels ou sans contenu propre (compte, panier,
 *   commande et paiement, projets partagés, administration, API, comparateur à paramètres). Les ressources /_next ne
 *   sont jamais bloquées. Aucune règle propre aux robots d'entraînement d'IA (décision à prendre, voir
 *   docs/seo-geo-plan-90-days.md) : la règle générale s'applique à tous.
 * Exception : /api/media/ (visuels publiés des fiches, seuls servis par cette route) reste explorable, sinon les images
 * des produits ne peuvent pas être indexées ; la règle la plus spécifique l'emporte sur « Disallow: /api/ ».
 * robots.txt n'est pas une protection : ces pages restent protégées par l'autorisation côté serveur.
 */
export const PUBLIC_ALLOW = ["/", "/api/media/"] as const;
export const PRIVATE_PREFIXES = ["/admin", "/api/", "/compte", "/panier", "/commande", "/projets/", "/comparer"] as const;

export function robotsRules(indexable: boolean, siteUrl: string) {
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: [...PUBLIC_ALLOW], disallow: [...PRIVATE_PREFIXES] }, sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml` };
}
