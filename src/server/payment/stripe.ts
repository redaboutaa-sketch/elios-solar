import Stripe from "stripe";
import type { IncomingEvent, PaymentProvider } from "./index";

function client(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant");
  return new Stripe(key);
}

/**
 * Garde-fous du compte : clé « live » refusée tant que la bascule réelle n'est pas autorisée (PAYMENT_LIVE_ENABLED=true),
 * et compte vérifié s'il est attendu (STRIPE_ACCOUNT_ID = acct_…), pour ne jamais encaisser sur un autre compte du
 * même administrateur. Le résultat est mis en cache pour la durée du processus.
 */
let accountCheck: Promise<{ id: string; livemode: boolean }> | null = null;
export function assertStripeAccount(stripe: Stripe = client()): Promise<{ id: string; livemode: boolean }> {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (/^(sk|rk)_live_/.test(key) && process.env.PAYMENT_LIVE_ENABLED !== "true") return Promise.reject(new Error("Clé Stripe de production refusée : la bascule en paiement réel n'est pas autorisée (PAYMENT_LIVE_ENABLED)."));
  accountCheck ??= stripe.accounts.retrieveCurrent().then((acct) => {
    const expected = process.env.STRIPE_ACCOUNT_ID;
    if (expected && acct.id !== expected) throw new Error(`Compte Stripe inattendu (${acct.id}) : attendu ${expected}.`);
    return { id: acct.id, livemode: /^(sk|rk)_live_/.test(key) };
  });
  accountCheck.catch(() => { accountCheck = null; });
  return accountCheck;
}

/** Pays du marchand (virement SEPA : IBAN présenté au client). */
const MERCHANT_COUNTRY = () => (process.env.MERCHANT_COUNTRY ?? "FR").toUpperCase();

/**
 * Paiement hébergé Stripe Checkout (aucune donnée de carte ne transite par le site).
 * - « card » (paiement en ligne) : moyens de paiement DYNAMIQUES activés dans le Dashboard et éligibles pour ce client
 *   (carte, Apple Pay, Google Pay, PayPal, Bancontact…) ; le paiement fractionné et le virement en sont exclus, car
 *   ils ont leurs propres contrôles d'éligibilité (montant, pays, particulier).
 * - « bank_transfer » : virement bancaire (solde client Stripe, IBAN virtuel), paiement à notification différée.
 * - « installments » : Klarna ou Alma imposé via `allowed_payment_method_types` après contrôle d'éligibilité serveur.
 */
export const stripeProvider: PaymentProvider = {
  name: "STRIPE",
  async createCheckout(order, payment, options) {
    const stripe = client();
    const account = await assertStripeAccount(stripe);
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const method = options?.method ?? "card";
    const installments = method === "installments" && options?.stripePaymentMethod ? options : null;
    const metadata = { orderId: order.id, paymentId: payment.id, method, installments: installments ? String(installments.installments ?? "") : "", planProvider: installments ? installments.stripePaymentMethod ?? "" : "", account: account.id };
    let byMethod: Partial<Stripe.Checkout.SessionCreateParams> = {};
    if (installments) {
      byMethod = { allowed_payment_method_types: [installments.stripePaymentMethod!], ...(installments.stripePaymentMethod === "klarna" ? { payment_method_options: { klarna: {} } } : {}) } as never;
    } else if (method === "bank_transfer") {
      const customer = await stripe.customers.create({ email: order.email, metadata: { orderId: order.id } });
      byMethod = {
        customer: customer.id,
        allowed_payment_method_types: ["customer_balance"],
        payment_method_options: { customer_balance: { funding_type: "bank_transfer", bank_transfer: { type: "eu_bank_transfer", eu_bank_transfer: { country: MERCHANT_COUNTRY() } } } },
      } as never;
    } else {
      byMethod = { customer_email: order.email, excluded_payment_method_types: ["customer_balance", "alma", "klarna"] } as never;
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      client_reference_id: order.id,
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: order.totalCents, product_data: { name: `Commande ${order.number}` } } }],
      metadata,
      // Les métadonnées du PaymentIntent sont reprises sur la Charge : utile pour charge.refunded / payment_intent.*
      payment_intent_data: { metadata },
      ...byMethod,
      success_url: `${base}/commande/${order.id}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/commande/${order.id}/annulation`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    } as Stripe.Checkout.SessionCreateParams);
    if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement");
    return { checkoutUrl: session.url, providerRef: session.id, providerAccount: account.id, livemode: account.livemode };
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
      // session validée sans fonds (virement, moyen différé) : en attente, jamais « payée » sur un simple retour navigateur
      const pending = !paid && event.type === "checkout.session.completed" && s.payment_status === "unpaid";
      return { ...base, normalized: paid ? "payment_succeeded" : pending ? "payment_pending" : "ignored", providerRef: s.id, orderId: s.client_reference_id, amountCents: s.amount_total ?? null, paymentIntentId: idOf(s.payment_intent) };
    }
    case "payment_intent.requires_action":
    case "payment_intent.partially_funded": {
      // virement bancaire : instructions hébergées, montant restant dû (fonds partiels)
      const pi = event.data.object;
      const instr = pi.next_action?.display_bank_transfer_instructions;
      const remaining = instr?.amount_remaining ?? null;
      return { ...base, normalized: event.type === "payment_intent.partially_funded" ? "payment_partially_funded" : instr ? "payment_pending" : "ignored", orderId: (pi.metadata?.orderId as string | undefined) ?? null, paymentIntentId: pi.id, amountCents: remaining != null ? pi.amount - remaining : null, instructionsUrl: instr?.hosted_instructions_url ?? null, detail: remaining != null ? `reste dû : ${remaining} c` : null };
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
