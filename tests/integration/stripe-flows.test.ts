import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { createOrderFromCart } from "@/server/order/service";
import { createOrderFromQuote, orderForPayer } from "@/server/order/quote-order";
import { ingestPaymentEvent } from "@/server/payment";
import { normalizeStripeEvent } from "@/server/payment/stripe";
import { invalidateCatalogCache } from "@/server/catalog/load";
import { ADDRESS, cartWith, cleanup, guest, standardInput } from "./helpers";

/** Parcours Stripe « différés » et tardifs, simulés en base (aucun appel réseau, aucun débit). */
const ev = (type: string, object: Record<string, unknown>, id = `evt_${Math.random().toString(36).slice(2)}`) => ({ id, type, data: { object } }) as unknown as Stripe.Event;

async function stripeOrder(method = "bank_transfer") {
  const g = guest();
  await cartWith(g, [standardInput()]);
  const order = await createOrderFromCart({ owner: { guestKey: g }, email: `${g.slice(0, 6)}@test.invalid`, shippingAddress: ADDRESS });
  const ref = `cs_test_${Math.random().toString(36).slice(2)}`;
  const payment = await prisma.payment.create({ data: { orderId: order.id, provider: "STRIPE", providerRef: ref, amountCents: order.totalCents, status: "PENDING", method } });
  return { order, payment, ref };
}

beforeEach(async () => { await cleanup(); invalidateCatalogCache(); });
afterAll(async () => { await cleanup(); await prisma.quote.deleteMany({ where: { email: { endsWith: "@quote.invalid" } } }); await prisma.$disconnect(); });

describe("Stripe — virement bancaire en attente puis rapproché", () => {
  it("session validée sans fonds ⇒ en attente (jamais payée), expiration reportée ; fonds partiels suivis ; fonds reçus ⇒ payée", async () => {
    const { order, payment, ref } = await stripeOrder();
    const before = (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).expiresAt!;
    const pending = normalizeStripeEvent(ev("checkout.session.completed", { id: ref, client_reference_id: order.id, payment_status: "unpaid", amount_total: order.totalCents, payment_intent: "pi_bt" }));
    expect(pending.normalized).toBe("payment_pending");
    expect((await ingestPaymentEvent(pending)).outcome).toBe("awaiting_funds");
    const o1 = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
    expect(o1.status).toBe("PENDING_PAYMENT");
    expect(o1.expiresAt!.getTime()).toBeGreaterThan(before.getTime() + 86_400_000);
    expect(o1.payments[0]!.awaitingFundsSince).not.toBeNull();
    // fonds partiels (montant restant dû dans les instructions de virement)
    const partial = normalizeStripeEvent(ev("payment_intent.partially_funded", { id: "pi_bt", amount: order.totalCents, metadata: { orderId: order.id }, next_action: { display_bank_transfer_instructions: { amount_remaining: 1_000, hosted_instructions_url: "https://payments.stripe.com/x" } } }));
    expect((await ingestPaymentEvent(partial)).outcome).toBe("awaiting_remaining_funds");
    const p2 = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(p2.amountReceivedCents).toBe(order.totalCents - 1_000);
    expect(p2.instructionsUrl).toBe("https://payments.stripe.com/x");
    // fonds reçus : seul l'événement du prestataire confirme le paiement
    const paid = normalizeStripeEvent(ev("checkout.session.async_payment_succeeded", { id: ref, client_reference_id: order.id, payment_status: "paid", amount_total: order.totalCents, payment_intent: "pi_bt" }));
    expect((await ingestPaymentEvent(paid)).outcome).toBe("order_paid");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).awaitingFundsSince).toBeNull();
    // rejeu du même événement : aucun double traitement
    expect((await ingestPaymentEvent(paid)).duplicate).toBe(true);
  });

  it("paiement reçu après expiration de la commande ⇒ jamais réactivé automatiquement, signalé pour examen", async () => {
    const { order, ref } = await stripeOrder("card");
    await prisma.order.update({ where: { id: order.id }, data: { status: "EXPIRED" } });
    const late = normalizeStripeEvent(ev("checkout.session.completed", { id: ref, client_reference_id: order.id, payment_status: "paid", amount_total: order.totalCents, payment_intent: "pi_late" }));
    expect((await ingestPaymentEvent(late)).outcome).toBe("late_payment_review");
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
    expect(o.status).toBe("EXPIRED");
    expect(o.paymentReview).toMatch(/confirmer la commande ou rembourser/);
    expect(o.payments[0]!.status).toBe("SUCCEEDED");
  });

  it("montant reçu différent du montant attendu ⇒ refusé ; refus et abandon ⇒ commande non payée", async () => {
    const { order, ref } = await stripeOrder("card");
    const wrong = normalizeStripeEvent(ev("checkout.session.completed", { id: ref, client_reference_id: order.id, payment_status: "paid", amount_total: order.totalCents - 1 }));
    expect((await ingestPaymentEvent(wrong)).outcome).toBe("amount_mismatch");
    const b = await stripeOrder("card");
    const expired = normalizeStripeEvent(ev("checkout.session.expired", { id: b.ref, client_reference_id: b.order.id }));
    expect((await ingestPaymentEvent(expired)).outcome).toBe("order_expired");
  });
});

describe("paiement d'un devis approuvé", () => {
  async function quote(over: Record<string, unknown> = {}) {
    return prisma.quote.create({ data: { number: `DEV-T-${Math.random().toString(36).slice(2, 8)}`, email: `c${Math.random().toString(36).slice(2, 6)}@quote.invalid`, firstName: "Cli", lastName: "Ent", kind: "system", status: "ACCEPTED", proposedTotalCents: 123_456, snapshot: {}, ...over } as never });
  }
  it("seul un devis accepté et chiffré ouvre un paiement, au montant du devis ; une seule commande par devis", async () => {
    await expect(createOrderFromQuote((await quote({ status: "SENT" })).id, { vatRateBps: 2000 })).rejects.toThrow(/accepté/);
    await expect(createOrderFromQuote((await quote({ proposedTotalCents: null })).id, { vatRateBps: 2000 })).rejects.toThrow(/montant/);
    const q = await quote();
    const a = await createOrderFromQuote(q.id, { vatRateBps: 2000 });
    expect(a.created).toBe(true);
    expect(a.order).toMatchObject({ totalCents: 123_456, taxCents: 123_456 - 102_880, quoteId: q.id, status: "PENDING_PAYMENT" });
    const again = await createOrderFromQuote(q.id, { vatRateBps: 2000 });
    expect(again.created).toBe(false);
    expect(again.order.id).toBe(a.order.id);
    // accès au paiement : compte avec l'e-mail du devis, jamais un tiers
    expect(await orderForPayer(a.order.id, { email: q.email })).not.toBeNull();
    expect(await orderForPayer(a.order.id, { email: "autre@quote.invalid" })).toBeNull();
    await prisma.order.delete({ where: { id: a.order.id } });
  });
});
