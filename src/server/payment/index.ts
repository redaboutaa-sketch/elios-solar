import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Order, Payment } from "@/generated/prisma/client";
import type { PaymentProvider as ProviderName } from "@/generated/prisma/enums";
import { markOrderFailed, markOrderPaid } from "@/server/order/service";
import { logger } from "@/lib/logger";

export interface CheckoutResult { checkoutUrl: string; providerRef: string }
export interface PaymentProvider {
  readonly name: ProviderName;
  createCheckout(order: Order, payment: Payment): Promise<CheckoutResult>;
}

export function activeProviderName(): ProviderName {
  return process.env.PAYMENT_PROVIDER === "stripe" && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET ? "STRIPE" : "DEMO";
}

export async function getProvider(): Promise<PaymentProvider> {
  if (activeProviderName() === "STRIPE") return (await import("./stripe")).stripeProvider;
  return (await import("./demo")).demoProvider;
}

/** Crée le paiement et la session de paiement hébergée pour une commande en attente. */
export async function startPayment(orderId: string): Promise<{ payment: Payment; checkoutUrl: string }> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
  if (order.status !== "PENDING_PAYMENT") throw new Error("Commande non payable");
  if (order.expiresAt && order.expiresAt < new Date()) throw new Error("Commande expirée");
  const provider = await getProvider();
  const reusable = order.payments.find((p) => p.provider === provider.name && (p.status === "CREATED" || p.status === "PENDING") && p.checkoutUrl);
  if (reusable) return { payment: reusable, checkoutUrl: reusable.checkoutUrl! };
  const payment = await prisma.payment.create({ data: { orderId, provider: provider.name, amountCents: order.totalCents, status: "CREATED" } });
  const { checkoutUrl, providerRef } = await provider.createCheckout(order, payment);
  const updated = await prisma.payment.update({ where: { id: payment.id }, data: { checkoutUrl, providerRef, status: "PENDING" } });
  return { payment: updated, checkoutUrl };
}

export type NormalizedEventType = "payment_succeeded" | "payment_failed" | "payment_cancelled" | "payment_expired" | "refund_succeeded" | "ignored";

export interface IncomingEvent {
  provider: ProviderName;
  eventId: string;
  type: string;
  normalized: NormalizedEventType;
  providerRef?: string | null;
  orderId?: string | null;
  amountCents?: number | null;
  payload: unknown;
}

/**
 * Ingestion idempotente d'un événement de paiement (webhook). Un événement déjà traité
 * (même fournisseur + identifiant) ne produit aucun effet supplémentaire.
 */
export async function ingestPaymentEvent(ev: IncomingEvent): Promise<{ outcome: string; duplicate: boolean }> {
  const existing = await prisma.paymentEvent.findUnique({ where: { provider_eventId: { provider: ev.provider, eventId: ev.eventId } } });
  if (existing?.processedAt) return { outcome: existing.outcome ?? "processed", duplicate: true };
  const record = existing ?? (await prisma.paymentEvent.create({ data: { provider: ev.provider, eventId: ev.eventId, type: ev.type, payload: ev.payload as never } }));
  // Verrou optimiste : un seul traitement simultané
  const claimed = await prisma.paymentEvent.updateMany({ where: { id: record.id, processedAt: null, outcome: null }, data: { outcome: "processing" } });
  if (claimed.count === 0) return { outcome: "processing", duplicate: true };

  let outcome = "ignored";
  try {
    const payment = ev.providerRef ? await prisma.payment.findUnique({ where: { providerRef: ev.providerRef } }) : ev.orderId ? await prisma.payment.findFirst({ where: { orderId: ev.orderId, provider: ev.provider }, orderBy: { createdAt: "desc" } }) : null;
    if (!payment) {
      outcome = "payment_not_found";
    } else if (ev.normalized === "payment_succeeded") {
      if (ev.amountCents != null && ev.amountCents !== payment.amountCents) {
        outcome = "amount_mismatch";
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: `montant reçu ${ev.amountCents} ≠ attendu ${payment.amountCents}` } });
      } else {
        const r = await markOrderPaid(payment.orderId, payment.id);
        outcome = r.changed ? "order_paid" : "already_paid";
      }
    } else if (ev.normalized === "payment_failed" || ev.normalized === "payment_cancelled" || ev.normalized === "payment_expired") {
      const status = ev.normalized === "payment_failed" ? "FAILED" : ev.normalized === "payment_cancelled" ? "CANCELLED" : "EXPIRED";
      await prisma.payment.update({ where: { id: payment.id }, data: { status } });
      await markOrderFailed(payment.orderId, status === "FAILED" ? "PAYMENT_FAILED" : status === "CANCELLED" ? "CANCELLED" : "EXPIRED");
      outcome = `order_${status.toLowerCase()}`;
    } else if (ev.normalized === "refund_succeeded") {
      const amount = ev.amountCents ?? payment.amountCents;
      await prisma.refund.create({ data: { paymentId: payment.id, amountCents: amount, status: "SUCCEEDED", providerRef: ev.eventId, reason: "webhook" } });
      const total = (await prisma.refund.aggregate({ where: { paymentId: payment.id, status: "SUCCEEDED" }, _sum: { amountCents: true } }))._sum.amountCents ?? 0;
      const full = total >= payment.amountCents;
      await prisma.payment.update({ where: { id: payment.id }, data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
      if (full) await prisma.order.update({ where: { id: payment.orderId }, data: { status: "REFUNDED" } });
      outcome = full ? "refunded" : "partially_refunded";
    }
    await prisma.paymentEvent.update({ where: { id: record.id }, data: { paymentId: payment?.id ?? null, processedAt: new Date(), outcome } });
  } catch (err) {
    logger.error({ err: String(err), eventId: ev.eventId }, "échec de traitement d'événement de paiement");
    await prisma.paymentEvent.update({ where: { id: record.id }, data: { outcome: null } });
    throw err;
  }
  return { outcome, duplicate: false };
}

/* ---------- Signature HMAC du fournisseur de démonstration ---------- */

export function demoSign(rawBody: string, secret = process.env.DEMO_PAYMENT_WEBHOOK_SECRET ?? ""): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function demoVerify(rawBody: string, signature: string | null, secret = process.env.DEMO_PAYMENT_WEBHOOK_SECRET ?? ""): boolean {
  if (!signature || !secret) return false;
  const expected = Buffer.from(demoSign(rawBody, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
