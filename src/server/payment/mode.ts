/**
 * Mode d'encaissement de l'environnement, décidé côté serveur uniquement.
 * - « stripe » : PAYMENT_PROVIDER=stripe avec clé secrète et secret de webhook ;
 * - « demo » : simulateur, seulement sur un environnement non public (SITE_INDEXABLE ≠ true) ;
 * - « disabled » : aucun encaissement en ligne (panier, commande et paiement de devis refusés ; tout passe au devis).
 * Une configuration Stripe incomplète ou un simulateur sur un site public donnent « disabled », jamais un paiement simulé.
 */
export type SalesMode = "stripe" | "demo" | "disabled";

export function salesModeFrom(env: { PAYMENT_PROVIDER?: string; STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string; SITE_INDEXABLE?: string }): SalesMode {
  const p = env.PAYMENT_PROVIDER ?? "demo";
  if (p === "stripe") return env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET ? "stripe" : "disabled";
  if (p === "demo") return env.SITE_INDEXABLE === "true" ? "disabled" : "demo";
  return "disabled";
}

export function salesMode(): SalesMode {
  const { PAYMENT_PROVIDER, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SITE_INDEXABLE } = process.env;
  return salesModeFrom({ PAYMENT_PROVIDER, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SITE_INDEXABLE });
}

export const onlineSalesEnabled = () => salesMode() !== "disabled";

export const ONLINE_SALES_CLOSED = "La commande en ligne n'est pas ouverte : demandez un devis, un conseiller vous répond.";
