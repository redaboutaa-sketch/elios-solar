import type { Payment } from "@/generated/prisma/client";

const PLAN_FR: Record<string, string> = { stripe_klarna: "Klarna (via Stripe)", stripe_alma: "Alma (via Stripe)", simulator: "simulateur de paiement fractionné" };

/** Libellé du moyen de paiement d'une tentative (client et administration). */
export function paymentMethodLabel(p: Pick<Payment, "method" | "installments" | "planProvider" | "provider">): string {
  if (p.method === "installments") return `Paiement en ${p.installments ?? "?"} fois via ${PLAN_FR[p.planProvider ?? ""] ?? p.planProvider ?? "prestataire"}`;
  return p.provider === "DEMO" ? "Carte / paiement en une fois (simulé)" : "Carte / paiement en une fois";
}

export function PaymentMethodLine({ payment }: { payment: Pick<Payment, "method" | "installments" | "planProvider" | "provider" | "feesCents"> }) {
  return <span data-testid="payment-method">Moyen de paiement : <strong>{paymentMethodLabel(payment)}</strong>{payment.feesCents > 0 && ` · frais ${(payment.feesCents / 100).toFixed(2)} €`}</span>;
}
