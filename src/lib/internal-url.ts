/**
 * URL pour les appels serveur → serveur (webhooks simulés). Dans un conteneur, l'URL publique
 * (`NEXT_PUBLIC_SITE_URL`, port publié côté hôte) n'est pas joignable : on vise le port d'écoute local.
 */
export function internalBaseUrl(): string {
  return process.env.INTERNAL_APP_URL ?? `http://127.0.0.1:${process.env.PORT ?? "3400"}`;
}
