import Stripe from "stripe";
import type { IncomingEvent, PaymentProvider } from "./index";

function client(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant");
  return new Stripe(key);
}

/**
 * Paiement hébergé Stripe Checkout (aucune donnée de carte ne transite par le site).
 * Paiement fractionné : le moyen Klarna ou Alma est imposé via `allowed_payment_method_types`
 * (le SDK stripe@23 / API 2026-09-30 a retiré `payment_method_types` sur Checkout Session :
 * le moyen doit être activé dans le Dashboard Stripe, sinon la session est refusée).
 */
export const stripeProvider: PaymentProvider = {
  name: "STRIPE",
  async createCheckout(order, payment, options) {
    const stripe = client();
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const installments = options?.method === "installments" && options.stripePaymentMethod ? options : null;
    const metadata = { orderId: order.id, paymentId: payment.id, method: options?.method ?? "card", installments: installments ? String(installments.installments ?? "") : "", planProvider: installments ? installments.stripePaymentMethod ?? "" : "" };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      client_reference_id: order.id,
      customer_email: order.email,
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: order.totalCents, product_data: { name: `Commande ${order.number}` } } }],
      metadata,
      // Les métadonnées du PaymentIntent sont reprises sur la Charge : utile pour charge.refunded / payment_intent.*
      payment_intent_data: { metadata },
      ...(installments ? { allowed_payment_method_types: [installments.stripePaymentMethod!], ...(installments.stripePaymentMethod === "klarna" ? { payment_method_options: { klarna: {} } } : {}) } : {}),
      success_url: `${base}/commande/${order.id}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/commande/${order.id}/annulation`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });
    if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement");
    return { checkoutUrl: session.url, providerRef: session.id };
  },
};

const idOf = (v: string | { id: string } | null | undefined): string | null => (typeof v === "string" ? v : v?.id ?? null);

export function parseStripeWebhook(rawBody: string, signature: string | null): IncomingEvent {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) throw new Error("signature manquante");
  const event = client().webhooks.constructEvent(rawBody, signature, secret);
  return normalizeStripeEvent(event);
}

/** Normalisation d'un événement Stripe déjà vérifié (séparée pour les tests). */
export function normalizeStripeEvent(event: Stripe.Event): IncomingEvent {
  const base = { provider: "STRIPE" as const, eventId: event.id, type: event.type, payload: event };
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      const paid = s.payment_status === "paid";
      return { ...base, normalized: paid ? "payment_succeeded" : "ignored", providerRef: s.id, orderId: s.client_reference_id, amountCents: s.amount_total ?? null, paymentIntentId: idOf(s.payment_intent) };
    }
    case "checkout.session.async_payment_failed": {
      // Klarna / Alma : refus asynchrone du prestataire après redirection.
      const s = event.data.object;
      return { ...base, normalized: "payment_failed", providerRef: s.id, orderId: s.client_reference_id, paymentIntentId: idOf(s.payment_intent), detail: "paiement refusé par le prestataire (async_payment_failed)" };
    }
    case "checkout.session.expired": {
      const s = event.data.object;
      return { ...base, normalized: "payment_expired", providerRef: s.id, orderId: s.client_reference_id };
    }
    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      // Rattaché à une session connue via le PaymentIntent ou les métadonnées ; sinon « payment_not_found » (ignoré).
      const pi = event.data.object;
      const failed = event.type === "payment_intent.payment_failed";
      return { ...base, normalized: failed ? "payment_failed" : "payment_cancelled", orderId: (pi.metadata?.orderId as string | undefined) ?? null, paymentIntentId: pi.id, detail: failed ? pi.last_payment_error?.message ?? pi.last_payment_error?.code ?? "payment_intent.payment_failed" : pi.cancellation_reason ?? "payment_intent.canceled" };
    }
    case "charge.refunded": {
      // `amount_refunded` est cumulatif ; le dernier remboursement de la liste donne la référence et l'état (pending pour Alma).
      const c = event.data.object;
      const last = c.refunds?.data?.[0];
      const pending = last?.status === "pending";
      return { ...base, normalized: pending ? "refund_pending" : "refund_succeeded", orderId: (c.metadata?.orderId as string | undefined) ?? null, paymentIntentId: idOf(c.payment_intent), amountCents: c.amount_refunded, cumulativeRefund: true, refundRef: last?.id ?? null };
    }
    case "refund.updated":
    case "refund.failed": {
      // Alma : remboursement asynchrone. `failed` ⇒ signalé en administration ; `succeeded` ⇒ confirme un remboursement en attente.
      const r = event.data.object;
      const normalized = r.status === "failed" || event.type === "refund.failed" ? "refund_failed" : r.status === "succeeded" ? "refund_succeeded" : r.status === "pending" ? "refund_pending" : "ignored";
      return { ...base, normalized, orderId: (r.metadata?.orderId as string | undefined) ?? null, paymentIntentId: idOf(r.payment_intent), amountCents: r.amount, refundRef: r.id, detail: r.failure_reason ?? null };
    }
    default:
      return { ...base, normalized: "ignored" };
  }
}
