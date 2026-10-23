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
  return [
    {
      code: "card", label: "Carte bancaire", state: provider === "STRIPE" ? "active" : "simulated",
      text: provider === "STRIPE" ? "Paiement par carte de la structure seule, pour une configuration entièrement tarifée." : "Pour une configuration entièrement tarifée (structure seule), le paiement en ligne est simulé dans cette préproduction : aucune carte n'est débitée.",
      adminNote: `Prestataire actif : ${provider}. Intégration carte présente, à activer avec un compte marchand validé (PAYMENT_PROVIDER, clés).`,
    },
    {
      code: "quote_deposit", label: "Acompte et solde sur devis", state: "planned",
      text: "Pour un projet chiffré sur devis (options, pose, livraison), les modalités de règlement sont indiquées dans le devis par un conseiller.",
      adminNote: "Aucun paiement d'acompte n'est implémenté ; pourcentage et échéances à décider.",
    },
    {
      code: "transfer", label: "Virement bancaire", state: "planned",
      text: "Envisagé pour les projets sur devis ; non disponible en ligne.",
      adminNote: "Non implémenté (coordonnées bancaires, rapprochement).",
    },
    {
      code: "installments", label: "Paiement en plusieurs fois", state: inst.operational ? (inst.provider.key === "simulator" ? "simulated" : "active") : "planned",
      text: inst.operational ? "Selon les conditions du prestataire affichées au moment du paiement." : "Envisagé, selon le prestataire et les conditions qui seront validés ; non disponible à ce jour.",
      adminNote: inst.operational ? `Prestataire : ${inst.provider.label ?? inst.provider.key}.` : `Inactif : ${inst.blockers.join(" ; ")}.`,
    },
  ];
}
