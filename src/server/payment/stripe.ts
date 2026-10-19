import Stripe from "stripe";
import type { IncomingEvent, PaymentProvider } from "./index";

function client(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant");
  return new Stripe(key);
}

/** Paiement hébergé Stripe Checkout (aucune donnée de carte ne transite par le site). */
export const stripeProvider: PaymentProvider = {
  name: "STRIPE",
  async createCheckout(order, payment) {
    const stripe = client();
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: order.id,
      customer_email: order.email,
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: order.totalCents, product_data: { name: `Commande ${order.number}` } } }],
      metadata: { orderId: order.id, paymentId: payment.id },
      success_url: `${base}/commande/${order.id}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/commande/${order.id}/annulation`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });
    if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement");
    return { checkoutUrl: session.url, providerRef: session.id };
  },
};

export function parseStripeWebhook(rawBody: string, signature: string | null): IncomingEvent {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) throw new Error("signature manquante");
  const event = client().webhooks.constructEvent(rawBody, signature, secret);
  const base = { provider: "STRIPE" as const, eventId: event.id, type: event.type, payload: event };
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      const paid = s.payment_status === "paid";
      return { ...base, normalized: paid ? "payment_succeeded" : "ignored", providerRef: s.id, orderId: s.client_reference_id, amountCents: s.amount_total ?? null };
    }
    case "checkout.session.async_payment_failed": {
      const s = event.data.object;
      return { ...base, normalized: "payment_failed", providerRef: s.id, orderId: s.client_reference_id };
    }
    case "checkout.session.expired": {
      const s = event.data.object;
      return { ...base, normalized: "payment_expired", providerRef: s.id, orderId: s.client_reference_id };
    }
    case "charge.refunded": {
      const c = event.data.object;
      return { ...base, normalized: "refund_succeeded", orderId: (c.metadata?.orderId as string | undefined) ?? null, amountCents: c.amount_refunded };
    }
    default:
      return { ...base, normalized: "ignored" };
  }
}
