import type { PaymentProvider } from "./index";
import { randomCode } from "@/server/ids";

/**
 * Fournisseur de DÉMONSTRATION : aucune transaction réelle. La page de paiement simulé
 * affiche clairement qu'il s'agit d'un test et émet des événements signés vers le webhook.
 */
export const demoProvider: PaymentProvider = {
  name: "DEMO",
  async createCheckout(order, payment) {
    const providerRef = `demo_${payment.id}_${randomCode(8)}`;
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    return { checkoutUrl: `${base}/commande/${order.id}/paiement-demo?ref=${providerRef}`, providerRef };
  },
};
