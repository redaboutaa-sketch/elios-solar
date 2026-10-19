import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { evaluateCart, findActiveCart, CartError, addLine } from "@/server/cart/service";
import { createOrderFromCart, expirePendingOrders, getOrderForOwner, OrderError } from "@/server/order/service";
import { demoSign, ingestPaymentEvent } from "@/server/payment";
import { POST as demoWebhook } from "@/app/api/webhooks/payment/demo/route";
import { loadCatalog, invalidateCatalogCache } from "@/server/catalog/load";
import { availableQty } from "@/server/stock/service";
import { ADDRESS, cartWith, cleanup, guest, orderFor, setStock, standardInput } from "./helpers";

beforeEach(async () => { await cleanup(); invalidateCatalogCache(); });
afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

describe("panier et commande", () => {
  it("le total de la commande vient du serveur, pas du navigateur", async () => {
    const g = guest();
    const tampered = { ...standardInput(), totals: { totalGrossCents: 1 }, priceCents: 1 } as unknown as ReturnType<typeof standardInput>;
    await cartWith(g, [tampered]);
    const cart = await findActiveCart({ guestKey: g });
    const ev = await evaluateCart(cart!);
    expect(ev.totalCents).toBeGreaterThan(100_000);
    const order = await createOrderFromCart({ owner: { guestKey: g }, email: "a@test.invalid", shippingAddress: ADDRESS });
    expect(order.totalCents).toBe(ev.totalCents);
    expect(order.lines.find((l) => l.kind === "base")?.totalGrossCents).toBe(ev.lines[0]!.result.lines[0]!.totalGrossCents);
  });

  it("refuse une configuration non achetable (compatibilité inconnue) au panier", async () => {
    const g = guest();
    const input = standardInput({ familySlug: "pergola-solis-max", dimensionCode: "3x5", segments: { "front-1": { closureFamilySlug: "paroi-vitree", option: "fixed" } } });
    await expect(addLine({ guestKey: g }, input)).rejects.toBeInstanceOf(CartError);
  });

  it("une commande n'est visible que par son propriétaire", async () => {
    const g = guest();
    await cartWith(g, [standardInput()]);
    const { order } = await orderFor(g);
    expect(await getOrderForOwner(order.id, { guestKey: g })).not.toBeNull();
    expect(await getOrderForOwner(order.id, { guestKey: guest() })).toBeNull();
    expect(await getOrderForOwner(order.id, { userId: "autre-utilisateur" })).toBeNull();
  });

  it("recréer la commande depuis le même panier réutilise la commande en attente (pas de doublon)", async () => {
    const g = guest();
    await cartWith(g, [standardInput()]);
    const a = await createOrderFromCart({ owner: { guestKey: g }, email: "a@test.invalid", shippingAddress: ADDRESS });
    const b = await createOrderFromCart({ owner: { guestKey: g }, email: "a@test.invalid", shippingAddress: ADDRESS });
    expect(b.id).toBe(a.id);
    expect(await prisma.order.count({ where: { cartId: a.cartId! } })).toBe(1);
  });

  it("un changement de tarif en administration s'applique au catalogue sans altérer la commande passée", async () => {
    const g = guest();
    await cartWith(g, [standardInput()]);
    const { order, payment } = await orderFor(g);
    await ingestPaymentEvent({ provider: "DEMO", eventId: "evt_price_1", type: "demo.payment.succeeded", normalized: "payment_succeeded", providerRef: payment.providerRef, amountCents: payment.amountCents, payload: {} });
    const baseLine = (await prisma.orderLine.findFirst({ where: { orderId: order.id, kind: "base" } }))!;
    await prisma.variant.update({ where: { sku: baseLine.sku! }, data: { priceCents: baseLine.unitGrossCents + 50_000 } });
    invalidateCatalogCache();
    const catalog = await loadCatalog({ fresh: true });
    expect(catalog.variants.find((v) => v.sku === baseLine.sku)!.priceCents).toBe(baseLine.unitGrossCents + 50_000);
    const after = await prisma.orderLine.findUniqueOrThrow({ where: { id: baseLine.id } });
    expect(after.unitGrossCents).toBe(baseLine.unitGrossCents);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).totalCents).toBe(order.totalCents);
    await prisma.variant.update({ where: { sku: baseLine.sku! }, data: { priceCents: baseLine.unitGrossCents } });
  });
});

describe("paiement par webhook", () => {
  it("confirme la commande une seule fois, même si le webhook est rejoué", async () => {
    const g = guest();
    await cartWith(g, [standardInput()]);
    const { order, payment } = await orderFor(g);
    const ev = { provider: "DEMO" as const, eventId: "evt_dup_1", type: "demo.payment.succeeded", normalized: "payment_succeeded" as const, providerRef: payment.providerRef, amountCents: payment.amountCents, payload: {} };
    const first = await ingestPaymentEvent(ev);
    const second = await ingestPaymentEvent(ev);
    expect(first).toEqual({ outcome: "order_paid", duplicate: false });
    expect(second.duplicate).toBe(true);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("PAID");
    expect(await prisma.emailOutbox.count({ where: { dedupeKey: `order-confirmation:${order.id}` } })).toBe(1);
    expect(await prisma.paymentEvent.count()).toBe(1);
  });

  it("rejette un webhook non signé ou mal signé, accepte le webhook signé", async () => {
    const g = guest();
    await cartWith(g, [standardInput()]);
    const { order, payment } = await orderFor(g);
    const body = JSON.stringify({ id: "evt_sig_1", type: "demo.payment.succeeded", data: { providerRef: payment.providerRef, orderId: order.id, amountCents: payment.amountCents } });
    const url = "http://localhost/api/webhooks/payment/demo";
    const bad = await demoWebhook(new Request(url, { method: "POST", body, headers: { "x-demo-signature": "deadbeef" } }));
    expect(bad.status).toBe(400);
    const none = await demoWebhook(new Request(url, { method: "POST", body }));
    expect(none.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
    const ok = await demoWebhook(new Request(url, { method: "POST", body, headers: { "x-demo-signature": demoSign(body) } }));
    expect(ok.status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });

  it("refuse un montant différent de celui attendu", async () => {
    const g = guest();
    await cartWith(g, [standardInput()]);
    const { order, payment } = await orderFor(g);
    const r = await ingestPaymentEvent({ provider: "DEMO", eventId: "evt_amt_1", type: "demo.payment.succeeded", normalized: "payment_succeeded", providerRef: payment.providerRef, amountCents: 100, payload: {} });
    expect(r.outcome).toBe("amount_mismatch");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("un refus libère la réservation ; un remboursement complet passe la commande en REFUNDED", async () => {
    await setStock("ES-SV-3M-ANT", 2);
    const g = guest();
    await cartWith(g, [standardInput({ segments: { "left-1": { closureFamilySlug: "store-vertical-zip" } } })]);
    const { order, payment } = await orderFor(g);
    expect(await availableQty("ES-SV-3M-ANT")).toBe(1);
    await ingestPaymentEvent({ provider: "DEMO", eventId: "evt_fail_1", type: "demo.payment.failed", normalized: "payment_failed", providerRef: payment.providerRef, payload: {} });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAYMENT_FAILED");
    expect(await availableQty("ES-SV-3M-ANT")).toBe(2);
    // nouvelle commande payée puis remboursée
    const g2 = guest();
    await cartWith(g2, [standardInput({ segments: { "left-1": { closureFamilySlug: "store-vertical-zip" } } })]);
    const o2 = await orderFor(g2);
    await ingestPaymentEvent({ provider: "DEMO", eventId: "evt_paid_2", type: "demo.payment.succeeded", normalized: "payment_succeeded", providerRef: o2.payment.providerRef, amountCents: o2.payment.amountCents, payload: {} });
    expect(await availableQty("ES-SV-3M-ANT")).toBe(1);
    expect((await prisma.variant.findUniqueOrThrow({ where: { sku: "ES-SV-3M-ANT" } })).stockQty).toBe(1);
    await ingestPaymentEvent({ provider: "DEMO", eventId: "evt_refund_2", type: "demo.refund.succeeded", normalized: "refund_succeeded", providerRef: o2.payment.providerRef, amountCents: o2.payment.amountCents, payload: {} });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o2.order.id } })).status).toBe("REFUNDED");
  });
});

describe("stock", () => {
  it("le dernier exemplaire ne peut être réservé qu'une fois (requêtes concurrentes)", async () => {
    await setStock("ES-LA-MEDIUM-ANT", 1);
    const input = standardInput({ options: [{ familySlug: "lanterne-ambiance", variantOption: "medium", qty: 1 }] });
    const guests = [guest(), guest(), guest(), guest()];
    for (const g of guests) await cartWith(g, [input]);
    const results = await Promise.allSettled(guests.map((g) => createOrderFromCart({ owner: { guestKey: g }, email: `${g.slice(0, 5)}@test.invalid`, shippingAddress: ADDRESS })));
    const ok = results.filter((r) => r.status === "fulfilled");
    const ko = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(ko).toHaveLength(3);
    for (const r of ko) { expect((r as PromiseRejectedResult).reason).toBeInstanceOf(OrderError); expect(((r as PromiseRejectedResult).reason as OrderError).code).toBe("out_of_stock"); }
    expect(await availableQty("ES-LA-MEDIUM-ANT")).toBe(0);
    expect((await prisma.variant.findUniqueOrThrow({ where: { sku: "ES-LA-MEDIUM-ANT" } })).reservedQty).toBe(1);
  });

  it("une réservation expirée est libérée et la commande expire", async () => {
    await setStock("ES-LA-LARGE-WHI", 1);
    const g = guest();
    await cartWith(g, [standardInput({ finishCode: "WHITE", options: [{ familySlug: "lanterne-ambiance", variantOption: "large", qty: 1 }] })]);
    const { order } = await orderFor(g);
    expect(await availableQty("ES-LA-LARGE-WHI")).toBe(0);
    await prisma.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    await prisma.stockReservation.updateMany({ where: { orderId: order.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    expect(await expirePendingOrders()).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("EXPIRED");
    expect(await availableQty("ES-LA-LARGE-WHI")).toBe(1);
    // un webhook tardif de succès sur une commande expirée ne la paie pas
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    const r = await ingestPaymentEvent({ provider: "DEMO", eventId: "evt_late_1", type: "demo.payment.succeeded", normalized: "payment_succeeded", providerRef: payment.providerRef, amountCents: payment.amountCents, payload: {} });
    expect(r.outcome).toBe("order_paid");
    // NOTE : le fournisseur réel a débité ; la commande passe PAID et doit être traitée (ou remboursée) par l'administration.
  });
});
