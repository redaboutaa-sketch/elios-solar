import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Order, Payment } from "@/generated/prisma/client";
import type { PaymentProvider as ProviderName } from "@/generated/prisma/enums";
import { markOrderFailed, markOrderPaid } from "@/server/order/service";
import { logger } from "@/lib/logger";
import type { InstallmentPlan } from "./installments-rules";
import { ONLINE_SALES_CLOSED, salesMode } from "./mode";

export interface CheckoutResult { checkoutUrl: string; providerRef: string; providerAccount?: string; livemode?: boolean }
export type PaymentMethod = "card" | "installments" | "bank_transfer";
export interface CheckoutOptions {
  method: PaymentMethod;
  /** Nombre d'échéances (paiement fractionné). */
  installments?: number;
  /** Type de client (paiement fractionné réservé aux particuliers : Alma n'accepte pas le B2B). */
  customerType?: "B2C" | "B2B";
  /** Moyen Stripe à imposer (`klarna` | `alma`) pour le paiement fractionné. */
  stripePaymentMethod?: "klarna" | "alma" | null;
  plan?: InstallmentPlan;
}
export interface PaymentProvider {
  readonly name: ProviderName;
  createCheckout(order: Order, payment: Payment, options?: CheckoutOptions): Promise<CheckoutResult>;
}

export class PaymentError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "PaymentError";
  }
}

export function activeProviderName(): ProviderName {
  return salesMode() === "stripe" ? "STRIPE" : "DEMO";
}

export async function getProvider(): Promise<PaymentProvider> {
  if (salesMode() === "disabled") throw new PaymentError(ONLINE_SALES_CLOSED, "sales_disabled");
  if (activeProviderName() === "STRIPE") return (await import("./stripe")).stripeProvider;
  return (await import("./demo")).demoProvider;
}

export interface StartPaymentOptions { method?: PaymentMethod; installments?: number; customerType?: "B2C" | "B2B" | null }

/**
 * Crée le paiement et la session de paiement hébergée pour une commande en attente.
 * Paiement fractionné : l'éligibilité est revalidée ici à partir du montant de la commande
 * (recalculé côté serveur), jamais à partir d'une valeur envoyée par le navigateur.
 */
export async function startPayment(orderId: string, opts: StartPaymentOptions = {}): Promise<{ payment: Payment; checkoutUrl: string }> {
  if (salesMode() === "disabled") throw new PaymentError(ONLINE_SALES_CLOSED, "sales_disabled");
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
  if (order.status !== "PENDING_PAYMENT") throw new PaymentError("Commande non payable", "not_payable");
  if (order.expiresAt && order.expiresAt < new Date()) throw new PaymentError("Commande expirée", "expired");
  const method: PaymentMethod = opts.method === "installments" ? "installments" : opts.method === "bank_transfer" ? "bank_transfer" : "card";

  let provider: PaymentProvider;
  let options: CheckoutOptions = { method: "card" };
  let planProvider: string | null = null;
  if (method === "installments") {
    const { getInstallmentSettings, installmentsOfferFor } = await import("./installments");
    const settings = await getInstallmentSettings();
    const country = ((order.shippingAddress as { countryCode?: string } | null)?.countryCode ?? "FR").toUpperCase();
    const customerType = opts.customerType ?? ((order.billingAddress as { company?: string } | null)?.company ? "B2B" : null);
    const offer = await installmentsOfferFor(order.totalCents, country, settings, customerType);
    if (!offer.eligible) throw new PaymentError(`Paiement fractionné indisponible pour cette commande : ${offer.reasons.join(" ; ")}.`, "installments_ineligible");
    const plan = offer.plans.find((p) => p.count === opts.installments);
    if (!plan) throw new PaymentError(`Nombre d'échéances non proposé (${offer.plans.map((p) => p.count).join(", ")} fois).`, "installments_count");
    planProvider = settings.provider;
    options = { method, installments: plan.count, stripePaymentMethod: offer.provider.stripePaymentMethod, plan };
    if (offer.provider.stripePaymentMethod) {
      if (activeProviderName() !== "STRIPE") throw new PaymentError("Le prestataire Stripe n'est pas actif : paiement fractionné impossible.", "stripe_inactive");
      provider = (await import("./stripe")).stripeProvider;
    } else {
      provider = (await import("./installments-sim")).installmentsSimProvider;
    }
  } else if (method === "bank_transfer") {
    // virement : moyen différé du prestataire réel uniquement (jamais simulé comme « payé »)
    if (activeProviderName() !== "STRIPE") throw new PaymentError("Le virement bancaire en ligne nécessite le prestataire Stripe actif.", "stripe_inactive");
    provider = (await import("./stripe")).stripeProvider;
    options = { method };
  } else {
    provider = await getProvider();
  }

  const reusable = order.payments.find((p) => p.provider === provider.name && p.method === method && (p.installments ?? null) === (options.installments ?? null) && (p.status === "CREATED" || p.status === "PENDING") && p.checkoutUrl);
  if (reusable) return { payment: reusable, checkoutUrl: reusable.checkoutUrl! };
  // Changement de moyen de paiement : les tentatives précédentes non abouties sont closes.
  await prisma.payment.updateMany({ where: { orderId, status: { in: ["CREATED", "PENDING"] } }, data: { status: "CANCELLED", failureReason: "remplacé par une nouvelle tentative de paiement" } });
  const payment = await prisma.payment.create({ data: { orderId, provider: provider.name, amountCents: order.totalCents, status: "CREATED", method, installments: options.installments ?? null, planProvider, feesCents: options.plan?.feesCents ?? 0 } });
  const { checkoutUrl, providerRef, providerAccount, livemode } = await provider.createCheckout(order, payment, options);
  const updated = await prisma.payment.update({ where: { id: payment.id }, data: { checkoutUrl, providerRef, status: "PENDING", providerAccount: providerAccount ?? null, livemode: livemode ?? null } });
  return { payment: updated, checkoutUrl };
}

export type NormalizedEventType = "payment_succeeded" | "payment_pending" | "payment_partially_funded" | "payment_failed" | "payment_cancelled" | "payment_expired" | "refund_succeeded" | "refund_pending" | "refund_failed" | "ignored";

export interface IncomingEvent {
  provider: ProviderName;
  eventId: string;
  type: string;
  normalized: NormalizedEventType;
  providerRef?: string | null;
  orderId?: string | null;
  amountCents?: number | null;
  payload: unknown;
  /** Identifiant du PaymentIntent Stripe : permet de retrouver le paiement via la session Checkout déjà reçue. */
  paymentIntentId?: string | null;
  /** Identifiant du remboursement chez le prestataire (idempotence des remboursements). */
  refundRef?: string | null;
  /** `charge.refunded` : `amountCents` est le cumul remboursé, pas le montant de ce remboursement. */
  cumulativeRefund?: boolean;
  /** Détail libre (motif d'échec…) conservé pour l'administration. */
  detail?: string | null;
  /** Virement : page d'instructions hébergée par le prestataire. */
  instructionsUrl?: string | null;
}

/** Délai accordé à un virement annoncé avant expiration de la commande (jours ; paramètre d'exploitation). */
const BANK_TRANSFER_HOLD_DAYS = () => Math.max(1, Number(process.env.BANK_TRANSFER_HOLD_DAYS ?? 7));

/** Recalcule le statut du paiement (et de la commande) d'après les remboursements enregistrés. */
async function recomputeRefundStatus(paymentId: string): Promise<"refunded" | "partially_refunded" | "none"> {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { refunds: true } });
  const succeeded = payment.refunds.filter((r) => r.status === "SUCCEEDED").reduce((s, r) => s + r.amountCents, 0);
  if (succeeded >= payment.amountCents) {
    await prisma.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED" } });
    await prisma.order.update({ where: { id: payment.orderId }, data: { status: "REFUNDED" } });
    return "refunded";
  }
  if (succeeded > 0) {
    await prisma.payment.update({ where: { id: paymentId }, data: { status: "PARTIALLY_REFUNDED" } });
    await prisma.order.updateMany({ where: { id: payment.orderId, status: "REFUNDED" }, data: { status: "PAID" } });
    return "partially_refunded";
  }
  if (payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED") {
    await prisma.payment.update({ where: { id: paymentId }, data: { status: "SUCCEEDED" } });
    await prisma.order.updateMany({ where: { id: payment.orderId, status: "REFUNDED" }, data: { status: "PAID" } });
  }
  return "none";
}

async function findPaymentFor(ev: IncomingEvent): Promise<Payment | null> {
  if (ev.providerRef) {
    const p = await prisma.payment.findUnique({ where: { providerRef: ev.providerRef } });
    if (p) return p;
  }
  if (ev.paymentIntentId) {
    // La session Checkout (checkout.session.completed) déjà ingérée porte le PaymentIntent.
    const known = await prisma.paymentEvent.findFirst({ where: { provider: ev.provider, paymentId: { not: null }, payload: { path: ["data", "object", "payment_intent"], equals: ev.paymentIntentId } }, orderBy: { receivedAt: "desc" } });
    if (known?.paymentId) return prisma.payment.findUnique({ where: { id: known.paymentId } });
  }
  if (ev.orderId) return prisma.payment.findFirst({ where: { orderId: ev.orderId, provider: ev.provider }, orderBy: { createdAt: "desc" } });
  return null;
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
    const payment = ev.normalized === "ignored" ? null : await findPaymentFor(ev);
    if (ev.normalized === "ignored") {
      outcome = "ignored";
    } else if (!payment) {
      outcome = "payment_not_found";
    } else if (ev.normalized === "payment_succeeded") {
      if (ev.amountCents != null && ev.amountCents !== payment.amountCents) {
        outcome = "amount_mismatch";
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: `montant reçu ${ev.amountCents} ≠ attendu ${payment.amountCents}` } });
      } else {
        const order = await prisma.order.findUnique({ where: { id: payment.orderId }, select: { status: true } });
        if (order && (order.status === "EXPIRED" || order.status === "CANCELLED" || order.status === "PAYMENT_FAILED")) {
          // événement tardif : les fonds sont reçus mais la commande n'est plus active → examen humain (confirmer ou rembourser)
          await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", awaitingFundsSince: null } });
          await prisma.order.update({ where: { id: payment.orderId }, data: { paymentReview: `Paiement reçu le ${new Date().toISOString().slice(0, 10)} alors que la commande était « ${order.status} » : vérifier, puis confirmer la commande ou rembourser.` } });
          logger.warn({ paymentId: payment.id, orderStatus: order.status }, "paiement reçu après expiration ou annulation : à examiner");
          outcome = "late_payment_review";
        } else {
          const r = await markOrderPaid(payment.orderId, payment.id);
          if (r.changed) await prisma.payment.update({ where: { id: payment.id }, data: { awaitingFundsSince: null, amountReceivedCents: payment.amountCents } });
          outcome = r.changed ? "order_paid" : "already_paid";
        }
      }
    } else if (ev.normalized === "payment_pending" || ev.normalized === "payment_partially_funded") {
      if (payment.status === "SUCCEEDED" || payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED") outcome = "ignored_after_success";
      else {
        // fonds attendus : la commande reste à payer, son expiration est reportée le temps du virement
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "PENDING", awaitingFundsSince: payment.awaitingFundsSince ?? new Date(), instructionsUrl: ev.instructionsUrl ?? undefined, amountReceivedCents: ev.normalized === "payment_partially_funded" ? ev.amountCents ?? undefined : undefined } });
        await prisma.order.updateMany({ where: { id: payment.orderId, status: "PENDING_PAYMENT" }, data: { expiresAt: new Date(Date.now() + BANK_TRANSFER_HOLD_DAYS() * 86_400_000) } });
        outcome = ev.normalized === "payment_partially_funded" ? "awaiting_remaining_funds" : "awaiting_funds";
      }
    } else if (ev.normalized === "payment_failed" || ev.normalized === "payment_cancelled" || ev.normalized === "payment_expired") {
      const status = ev.normalized === "payment_failed" ? "FAILED" : ev.normalized === "payment_cancelled" ? "CANCELLED" : "EXPIRED";
      if (payment.status === "SUCCEEDED" || payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED") {
        outcome = "ignored_after_success";
      } else {
        await prisma.payment.update({ where: { id: payment.id }, data: { status, failureReason: ev.detail ?? undefined } });
        await markOrderFailed(payment.orderId, status === "FAILED" ? "PAYMENT_FAILED" : status === "CANCELLED" ? "CANCELLED" : "EXPIRED");
        outcome = `order_${status.toLowerCase()}`;
      }
    } else if (ev.normalized === "refund_succeeded" || ev.normalized === "refund_pending") {
      const refundRef = ev.refundRef ?? ev.eventId;
      const known = await prisma.refund.findFirst({ where: { paymentId: payment.id, providerRef: refundRef } });
      const targetStatus = ev.normalized === "refund_pending" ? "PENDING" : "SUCCEEDED";
      if (known) {
        if (known.status === "SUCCEEDED" || known.status === targetStatus) outcome = "refund_already_recorded";
        else { await prisma.refund.update({ where: { id: known.id }, data: { status: targetStatus } }); outcome = targetStatus === "PENDING" ? "refund_pending" : await recomputeRefundStatus(payment.id); }
      } else {
        let amount = ev.amountCents ?? payment.amountCents;
        if (ev.cumulativeRefund) {
          const recorded = (await prisma.refund.aggregate({ where: { paymentId: payment.id, status: { in: ["SUCCEEDED", "PENDING"] } }, _sum: { amountCents: true } }))._sum.amountCents ?? 0;
          amount = (ev.amountCents ?? 0) - recorded;
        }
        if (amount <= 0) outcome = "refund_already_recorded";
        else {
          await prisma.refund.create({ data: { paymentId: payment.id, amountCents: amount, status: targetStatus, providerRef: refundRef, reason: ev.detail ?? "webhook" } });
          outcome = targetStatus === "PENDING" ? "refund_pending" : await recomputeRefundStatus(payment.id);
        }
      }
    } else if (ev.normalized === "refund_failed") {
      const refundRef = ev.refundRef ?? ev.eventId;
      const known = await prisma.refund.findFirst({ where: { paymentId: payment.id, providerRef: refundRef } });
      if (known) await prisma.refund.update({ where: { id: known.id }, data: { status: "FAILED", reason: ev.detail ?? known.reason } });
      else await prisma.refund.create({ data: { paymentId: payment.id, amountCents: ev.amountCents ?? 0, status: "FAILED", providerRef: refundRef, reason: ev.detail ?? "échec signalé par le prestataire" } });
      await recomputeRefundStatus(payment.id);
      outcome = "refund_failed";
      logger.warn({ paymentId: payment.id, refundRef, detail: ev.detail }, "remboursement échoué signalé par le prestataire");
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
