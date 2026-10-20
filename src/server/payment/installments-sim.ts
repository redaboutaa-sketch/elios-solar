import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "./index";
import { randomCode } from "@/server/ids";

/**
 * SIMULATEUR de paiement fractionné : aucune transaction, aucun prestataire contacté.
 * La page hébergée simulée affiche l'échéancier et émet des événements signés (HMAC) vers
 * `POST /api/webhooks/payment/installments-sim`, exactement comme un prestataire réel.
 * Jamais actif en production (voir `validateInstallmentRules`).
 */
export const installmentsSimProvider: PaymentProvider = {
  name: "INSTALLMENTS_SIM",
  async createCheckout(order, payment) {
    const providerRef = `instsim_${payment.id}_${randomCode(8)}`;
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    return { checkoutUrl: `${base}/commande/${order.id}/paiement-fractionne-simule?ref=${providerRef}`, providerRef };
  },
};

export const SIM_EVENT_TYPES = ["instsim.payment.succeeded", "instsim.payment.failed", "instsim.payment.cancelled", "instsim.refund.succeeded"] as const;
export type SimEventType = (typeof SIM_EVENT_TYPES)[number];

export function simSecret(): string {
  return process.env.INSTALLMENTS_SIM_WEBHOOK_SECRET || process.env.DEMO_PAYMENT_WEBHOOK_SECRET || "";
}

export function simSign(rawBody: string, secret = simSecret()): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function simVerify(rawBody: string, signature: string | null, secret = simSecret()): boolean {
  if (!signature || !secret) return false;
  const expected = Buffer.from(simSign(rawBody, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function normalizeSimEvent(type: string): "payment_succeeded" | "payment_failed" | "payment_cancelled" | "refund_succeeded" | "ignored" {
  switch (type) {
    case "instsim.payment.succeeded": return "payment_succeeded";
    case "instsim.payment.failed": return "payment_failed";
    case "instsim.payment.cancelled": return "payment_cancelled";
    case "instsim.refund.succeeded": return "refund_succeeded";
    default: return "ignored";
  }
}
