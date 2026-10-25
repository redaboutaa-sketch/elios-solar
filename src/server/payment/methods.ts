/**
 * État des moyens de paiement, déduit de la configuration réelle (jamais d'un souhait) : actif, simulé (préproduction)
 * ou envisagé. Aucun pourcentage d'acompte, aucune mensualité ni gratuité n'est annoncé tant qu'il n'est pas validé.
 */
import { activeProviderName } from "./index";
import { getInstallmentSettings, installmentsRuntimeStatus } from "./installments";

export type MethodState = "active" | "simulated" | "planned";
export const METHOD_STATE_FR: Record<MethodState, string> = { active: "Disponible", simulated: "Simulé (préproduction, aucun débit)", planned: "Envisagé — non disponible" };

export interface PaymentMethodInfo { code: string; label: string; state: MethodState; text: string; adminNote: string }

export async function paymentMethods(): Promise<PaymentMethodInfo[]> {
  const provider = activeProviderName();
  const inst = installmentsRuntimeStatus(await getInstallmentSettings());
  const stripe = provider === "STRIPE";
  return [
    {
      code: "card", label: "Carte bancaire, Apple Pay, Google Pay", state: stripe ? "active" : "simulated",
      text: stripe ? "Paiement en ligne sur la page sécurisée du prestataire, pour une configuration entièrement tarifée ou un devis accepté. Apple Pay et Google Pay apparaissent sur les appareils compatibles." : "Pour une configuration entièrement tarifée (structure seule) ou un devis accepté, le paiement en ligne est simulé dans cette préproduction : aucune carte n'est débitée.",
      adminNote: `Prestataire actif : ${provider}. Moyens dynamiques de Stripe Checkout (activés dans le Dashboard du compte, éligibilité calculée par Stripe).`,
    },
    {
      code: "paypal_bancontact", label: "PayPal, Bancontact", state: stripe ? "active" : "planned",
      text: stripe ? "Proposés sur la page de paiement lorsqu'ils sont activés sur notre compte et disponibles pour votre pays (Bancontact : clients en Belgique)." : "Selon l'activation sur le compte du prestataire ; non disponibles dans cette préproduction.",
      adminNote: "À activer dans le Dashboard Stripe (Paramètres → Moyens de paiement) ; affichés seulement si éligibles. Aucun bouton n'est ajouté par le site.",
    },
    {
      code: "transfer", label: "Virement bancaire", state: stripe ? "active" : "planned",
      text: stripe ? "Coordonnées remises sur la page de paiement ; la commande est confirmée à réception des fonds (une capture de virement ne vaut pas paiement)." : "Prévu via le prestataire de paiement (coordonnées et rapprochement automatiques) ; non disponible dans cette préproduction.",
      adminNote: "Stripe « customer_balance » (IBAN virtuel, rapprochement automatique) ; commande en attente puis payée par webhook. Délai : BANK_TRANSFER_HOLD_DAYS.",
    },
    {
      code: "quote_payment", label: "Paiement d'un devis accepté", state: stripe ? "active" : "simulated",
      text: "Pour un projet sur devis : après acceptation, votre conseiller ouvre le paiement du montant du devis, réglable en ligne.",
      adminNote: "Administration → Devis → « Ouvrir le paiement » (montant TTC et taux de TVA saisis par le conseiller). Acompte : non implémenté (pourcentage à décider).",
    },
    {
      code: "installments", label: "Paiement en plusieurs fois", state: inst.operational ? (inst.provider.key === "simulator" ? "simulated" : "active") : "planned",
      text: inst.operational ? "Selon l'éligibilité affichée au moment du paiement (particuliers, montant et pays couverts par le prestataire)." : "Envisagé, selon le prestataire et l'éligibilité réelle (particuliers, montant, pays) ; non disponible à ce jour.",
      adminNote: inst.operational ? `Prestataire : ${inst.provider.label ?? inst.provider.key}.` : `Inactif : ${inst.blockers.join(" ; ")}. Alma : particuliers uniquement, paiement domestique, 50 € à 5 000 €.`,
    },
  ];
}
