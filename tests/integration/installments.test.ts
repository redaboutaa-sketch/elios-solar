import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { createOrderFromCart } from "@/server/order/service";
import { ingestPaymentEvent, PaymentError, startPayment } from "@/server/payment";
import { simSign } from "@/server/payment/installments-sim";
import { normalizeStripeEvent } from "@/server/payment/stripe";
import { POST as simWebhook } from "@/app/api/webhooks/payment/installments-sim/route";
import { invalidateCatalogCache } from "@/server/catalog/load";
import { availableQty } from "@/server/stock/service";
import { ADDRESS, cartWith, cleanup, guest, setStock, standardInput } from "./helpers";

const URL_ = "http://localhost/api/webhooks/payment/installments-sim";
const SIM = { provider: "simulator", enabledTest: true, enabledProd: false, merchantEligible: false, minCents: 5_000, maxCents: 5_000_000, countries: ["FR"], currency: "EUR", installmentCounts: [2, 3, 4], feesBps: 0, feesFixedCents: 0, feesLabel: "", noFeesConfirmed: false, termsUrl: null };

async function setSettings(over: Partial<typeof SIM> = {}) {
  const data = { ...SIM, ...over };
  await prisma.installmentSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
}

async function simOrder(n = 3, inputs = [standardInput()]) {
  const g = guest();
  await cartWith(g, inputs);
  const order = await createOrderFromCart({ owner: { guestKey: g }, email: `${g.slice(0, 6)}@test.invalid`, shippingAddress: ADDRESS });
  const { payment, checkoutUrl } = await startPayment(order.id, { method: "installments", installments: n });
  return { order, payment, checkoutUrl };
}

function send(type: string, data: Record<string, unknown>, id = `evt_${Math.random().toString(36).slice(2)}`, signature?: string) {
  const body = JSON.stringify({ id, type, data });
  return simWebhook(new Request(URL_, { method: "POST", body, headers: { "content-type": "application/json", "x-instsim-signature": signature ?? simSign(body) } }));
}

beforeAll(async () => { await setSettings(); });
beforeEach(async () => { await cleanup(); invalidateCatalogCache(); await setSettings(); });
afterAll(async () => {
  await cleanup();
  await prisma.installmentSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: { provider: "none", enabledTest: false, enabledProd: false, merchantEligible: false, minCents: 5_000, maxCents: 300_000, installmentCounts: [3] } });
  await prisma.$disconnect();
});

describe("paiement fractionné — simulateur", () => {
  it("crée un paiement INSTALLMENTS_SIM avec méthode, échéances et prestataire du plan", async () => {
    const { payment, checkoutUrl, order } = await simOrder(3);
    expect(payment.provider).toBe("INSTALLMENTS_SIM");
    expect(payment.method).toBe("installments");
    expect(payment.installments).toBe(3);
    expect(payment.planProvider).toBe("simulator");
    expect(payment.feesCents).toBe(0);
    expect(payment.amountCents).toBe(order.totalCents);
    expect(checkoutUrl).toContain(`/commande/${order.id}/paiement-fractionne-simule?ref=instsim_`);
  });

  it("revalide côté serveur : nombre d'échéances non proposé ou montant hors bornes ⇒ refus", async () => {
    const g = guest();
    await cartWith(g, [standardInput()]);
    const order = await createOrderFromCart({ owner: { guestKey: g }, email: "x@test.invalid", shippingAddress: ADDRESS });
    await expect(startPayment(order.id, { method: "installments", installments: 7 })).rejects.toBeInstanceOf(PaymentError);
    await setSettings({ maxCents: 10_000 });
    await expect(startPayment(order.id, { method: "installments", installments: 3 })).rejects.toThrow(/supérieur au maximum/);
    await setSettings({ enabledTest: false });
    await expect(startPayment(order.id, { method: "installments", installments: 3 })).rejects.toThrow(/désactivé/);
    // le paiement carte reste possible sur la même commande
    const card = await startPayment(order.id, { method: "card" });
    expect(card.payment.provider).toBe("DEMO");
    expect(card.payment.method).toBe("card");
  });

  it("accepter ⇒ PAID et réservation consommée", async () => {
    await setStock("ES-SV-3M-ANT", 2);
    const { order, payment } = await simOrder(3, [standardInput({ segments: { "left-1": { closureFamilySlug: "store-vertical-zip" } } })]);
    expect(await availableQty("ES-SV-3M-ANT")).toBe(1);
    const res = await send("instsim.payment.succeeded", { providerRef: payment.providerRef, orderId: order.id, amountCents: payment.amountCents });
    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe("order_paid");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("SUCCEEDED");
    expect((await prisma.stockReservation.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("CONSUMED");
    expect((await prisma.variant.findUniqueOrThrow({ where: { sku: "ES-SV-3M-ANT" } })).stockQty).toBe(1);
  });

  it("refuser ⇒ PAYMENT_FAILED et réservations libérées", async () => {
    await setStock("ES-SV-3M-ANT", 2);
    const { order, payment } = await simOrder(4, [standardInput({ segments: { "left-1": { closureFamilySlug: "store-vertical-zip" } } })]);
    expect(await availableQty("ES-SV-3M-ANT")).toBe(1);
    const res = await send("instsim.payment.failed", { providerRef: payment.providerRef, orderId: order.id, reason: "refus simulé" });
    expect((await res.json()).outcome).toBe("order_failed");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAYMENT_FAILED");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).failureReason).toBe("refus simulé");
    expect(await availableQty("ES-SV-3M-ANT")).toBe(2);
  });

  it("abandon ⇒ CANCELLED", async () => {
    const { order, payment } = await simOrder(2);
    await send("instsim.payment.cancelled", { providerRef: payment.providerRef, orderId: order.id });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("CANCELLED");
  });

  it("webhook dupliqué : aucun double effet", async () => {
    const { order, payment } = await simOrder(3);
    const data = { providerRef: payment.providerRef, orderId: order.id, amountCents: payment.amountCents };
    const a = await (await send("instsim.payment.succeeded", data, "evt_sim_dup")).json();
    const b = await (await send("instsim.payment.succeeded", data, "evt_sim_dup")).json();
    expect(a).toMatchObject({ outcome: "order_paid", duplicate: false });
    expect(b).toMatchObject({ duplicate: true });
    expect(await prisma.paymentEvent.count({ where: { provider: "INSTALLMENTS_SIM" } })).toBe(1);
    expect(await prisma.emailOutbox.count({ where: { dedupeKey: `order-confirmation:${order.id}` } })).toBe(1);
  });

  it("signature invalide ou absente ⇒ 400, sans effet", async () => {
    const { order, payment } = await simOrder(3);
    const bad = await send("instsim.payment.succeeded", { providerRef: payment.providerRef, amountCents: payment.amountCents }, "evt_sig_bad", "deadbeef");
    expect(bad.status).toBe(400);
    const none = await simWebhook(new Request(URL_, { method: "POST", body: JSON.stringify({ id: "evt_none", type: "instsim.payment.succeeded", data: { providerRef: payment.providerRef } }) }));
    expect(none.status).toBe(400);
    // une signature démo (autre en-tête) n'est pas acceptée
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
    expect(await prisma.paymentEvent.count()).toBe(0);
  });

  it("montant altéré ⇒ amount_mismatch, commande non payée", async () => {
    const { order, payment } = await simOrder(3);
    const r = await (await send("instsim.payment.succeeded", { providerRef: payment.providerRef, amountCents: payment.amountCents - 1 })).json();
    expect(r.outcome).toBe("amount_mismatch");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("FAILED");
  });

  it("remboursement partiel puis total ⇒ PARTIALLY_REFUNDED puis REFUNDED (commande REFUNDED)", async () => {
    const { order, payment } = await simOrder(3);
    await send("instsim.payment.succeeded", { providerRef: payment.providerRef, amountCents: payment.amountCents });
    const part = await (await send("instsim.refund.succeeded", { providerRef: payment.providerRef, amountCents: 10_000, refundRef: "re_1" })).json();
    expect(part.outcome).toBe("partially_refunded");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PARTIALLY_REFUNDED");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
    // même remboursement rejoué sous un autre identifiant d'événement : pas de double ligne
    const again = await (await send("instsim.refund.succeeded", { providerRef: payment.providerRef, amountCents: 10_000, refundRef: "re_1" })).json();
    expect(again.outcome).toBe("refund_already_recorded");
    const full = await (await send("instsim.refund.succeeded", { providerRef: payment.providerRef, amountCents: payment.amountCents - 10_000, refundRef: "re_2" })).json();
    expect(full.outcome).toBe("refunded");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("REFUNDED");
    expect(await prisma.refund.count({ where: { paymentId: payment.id, status: "SUCCEEDED" } })).toBe(2);
  });

  it("le changement de moyen de paiement clôt la tentative précédente", async () => {
    const { order, payment } = await simOrder(3);
    const card = await startPayment(order.id, { method: "card" });
    expect(card.payment.id).not.toBe(payment.id);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("CANCELLED");
    // reprise du même choix : réutilisation de la session ouverte
    expect((await startPayment(order.id, { method: "card" })).payment.id).toBe(card.payment.id);
  });
});

describe("paiement fractionné — normalisation des webhooks Stripe", () => {
  const ev = (type: string, object: Record<string, unknown>, id = `evt_${type}`) => ({ id, type, data: { object } }) as unknown as Stripe.Event;

  it("async_payment_failed, payment_intent.payment_failed / canceled", () => {
    expect(normalizeStripeEvent(ev("checkout.session.async_payment_failed", { id: "cs_1", client_reference_id: "o1", payment_intent: "pi_1" }))).toMatchObject({ normalized: "payment_failed", providerRef: "cs_1", paymentIntentId: "pi_1" });
    expect(normalizeStripeEvent(ev("payment_intent.payment_failed", { id: "pi_1", metadata: { orderId: "o1" }, last_payment_error: { message: "refusé par Alma" } }))).toMatchObject({ normalized: "payment_failed", paymentIntentId: "pi_1", orderId: "o1", detail: "refusé par Alma" });
    expect(normalizeStripeEvent(ev("payment_intent.canceled", { id: "pi_1", metadata: {}, cancellation_reason: "abandoned" }))).toMatchObject({ normalized: "payment_cancelled" });
  });

  it("charge.refunded partiel (cumulatif), refund.updated succeeded / failed", () => {
    expect(normalizeStripeEvent(ev("charge.refunded", { id: "ch_1", amount_refunded: 5_000, payment_intent: "pi_1", metadata: {}, refunds: { data: [{ id: "re_1", status: "pending" }] } }))).toMatchObject({ normalized: "refund_pending", amountCents: 5_000, cumulativeRefund: true, refundRef: "re_1" });
    expect(normalizeStripeEvent(ev("refund.updated", { id: "re_1", status: "succeeded", amount: 5_000, payment_intent: "pi_1", metadata: {} }))).toMatchObject({ normalized: "refund_succeeded", refundRef: "re_1" });
    expect(normalizeStripeEvent(ev("refund.updated", { id: "re_1", status: "failed", amount: 5_000, payment_intent: "pi_1", metadata: {}, failure_reason: "declined" }))).toMatchObject({ normalized: "refund_failed", detail: "declined" });
  });

  it("chaîne Stripe (simulée en base) : PaymentIntent rattaché à la session, remboursement Alma asynchrone puis échec signalé", async () => {
    const g = guest();
    await cartWith(g, [standardInput()]);
    const order = await createOrderFromCart({ owner: { guestKey: g }, email: "stripe@test.invalid", shippingAddress: ADDRESS });
    const payment = await prisma.payment.create({ data: { orderId: order.id, provider: "STRIPE", providerRef: "cs_test_alma", amountCents: order.totalCents, status: "PENDING", method: "installments", installments: 3, planProvider: "stripe_alma" } });
    const completed = normalizeStripeEvent(ev("checkout.session.completed", { id: "cs_test_alma", client_reference_id: order.id, payment_status: "paid", amount_total: order.totalCents, payment_intent: "pi_alma" }, "evt_cs_1"));
    expect((await ingestPaymentEvent(completed)).outcome).toBe("order_paid");
    // charge.refunded (pending, partiel) puis refund.failed : signalé, statut rétabli
    const refunded = normalizeStripeEvent(ev("charge.refunded", { id: "ch_1", amount_refunded: 20_000, payment_intent: "pi_alma", metadata: {}, refunds: { data: [{ id: "re_alma", status: "pending" }] } }, "evt_ch_1"));
    expect((await ingestPaymentEvent(refunded)).outcome).toBe("refund_pending");
    const failed = normalizeStripeEvent(ev("refund.updated", { id: "re_alma", status: "failed", amount: 20_000, payment_intent: "pi_alma", metadata: {}, failure_reason: "declined" }, "evt_re_1"));
    expect((await ingestPaymentEvent(failed)).outcome).toBe("refund_failed");
    expect((await prisma.refund.findFirstOrThrow({ where: { paymentId: payment.id } })).status).toBe("FAILED");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("SUCCEEDED");
    // un payment_intent.payment_failed tardif n'annule pas un paiement réussi
    const late = normalizeStripeEvent(ev("payment_intent.payment_failed", { id: "pi_alma", metadata: {}, last_payment_error: null }, "evt_pi_late"));
    expect((await ingestPaymentEvent(late)).outcome).toBe("ignored_after_success");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });
});
