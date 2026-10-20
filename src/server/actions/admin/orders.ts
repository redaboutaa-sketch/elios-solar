"use server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { ingestPaymentEvent } from "@/server/payment";
import { actorOf, back, fields, firstError, zOpt, zOptEuros, zReq } from "@/server/admin/form";
import type { FulfillmentStatus, OrderStatus } from "@/generated/prisma/enums";

const FLOW: FulfillmentStatus[] = ["UNFULFILLED", "PREPARING", "SHIPPED", "DELIVERED"];
const PAID_STATES: OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"];

/** Transitions autorisées : progression d'une étape, ou annulation tant que non livrée. */
function canTransition(from: FulfillmentStatus, to: FulfillmentStatus): boolean {
  if (to === "CANCELLED") return from !== "DELIVERED" && from !== "CANCELLED";
  const i = FLOW.indexOf(from), j = FLOW.indexOf(to);
  return i >= 0 && j === i + 1;
}

export async function updateFulfillmentAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const f = fields(formData);
  const parsed = z.object({ orderId: zReq(64), to: z.enum(["UNFULFILLED", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED"]) }).safeParse(f);
  if (!parsed.success) back("/admin/commandes", firstError(parsed.error), "err");
  const { orderId, to } = parsed.data;
  const path = `/admin/commandes/${orderId}`;
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, fulfillmentStatus: true } });
  if (!order) back("/admin/commandes", "Commande introuvable", "err");
  if (!canTransition(order.fulfillmentStatus, to)) back(path, `Transition impossible : ${order.fulfillmentStatus} → ${to}`, "err");
  if (to !== "CANCELLED" && !PAID_STATES.includes(order.status)) back(path, "La commande doit être payée avant préparation / expédition.", "err");
  // Le statut de commande suit la logistique tant que la commande est payée.
  const status: OrderStatus | undefined = PAID_STATES.includes(order.status) ? ({ PREPARING: "PROCESSING", SHIPPED: "SHIPPED", DELIVERED: "DELIVERED" } as Partial<Record<FulfillmentStatus, OrderStatus>>)[to] : undefined;
  await prisma.order.update({ where: { id: orderId }, data: { fulfillmentStatus: to, ...(status ? { status } : {}) } });
  await audit({ ...actorOf(session), action: "order.fulfillment", entity: "Order", entityId: orderId, before: { fulfillmentStatus: order.fulfillmentStatus, status: order.status }, after: { fulfillmentStatus: to, status: status ?? order.status } });
  back(path, "Statut logistique mis à jour.");
}

export async function updateOrderNotesAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const parsed = z.object({ orderId: zReq(64), adminNotes: zOpt(5000) }).safeParse(fields(formData));
  if (!parsed.success) back("/admin/commandes", firstError(parsed.error), "err");
  const { orderId, adminNotes } = parsed.data;
  const before = await prisma.order.findUnique({ where: { id: orderId }, select: { adminNotes: true } });
  if (!before) back("/admin/commandes", "Commande introuvable", "err");
  await prisma.order.update({ where: { id: orderId }, data: { adminNotes } });
  await audit({ ...actorOf(session), action: "order.notes", entity: "Order", entityId: orderId, before: { adminNotesLength: before.adminNotes?.length ?? 0 }, after: { adminNotesLength: adminNotes?.length ?? 0 } });
  back(`/admin/commandes/${orderId}`, "Notes enregistrées.");
}

/** Remboursement simulé : uniquement pour un paiement du fournisseur de démonstration. */
export async function demoRefundAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const parsed = z.object({ paymentId: zReq(64), amount: zOptEuros }).safeParse(fields(formData));
  if (!parsed.success) back("/admin/commandes", firstError(parsed.error), "err");
  const payment = await prisma.payment.findUnique({ where: { id: parsed.data.paymentId }, include: { refunds: { where: { status: "SUCCEEDED" } } } });
  if (!payment) back("/admin/commandes", "Paiement introuvable", "err");
  const path = `/admin/commandes/${payment.orderId}`;
  if (payment.provider !== "DEMO") back(path, "Le remboursement simulé n'est possible que pour un paiement de démonstration. Remboursez via le tableau de bord du prestataire.", "err");
  if (payment.status !== "SUCCEEDED" && payment.status !== "PARTIALLY_REFUNDED") back(path, "Ce paiement n'est pas remboursable (statut " + payment.status + ").", "err");
  const already = payment.refunds.reduce((s, r) => s + r.amountCents, 0);
  const remaining = payment.amountCents - already;
  const amountCents = parsed.data.amount ?? remaining;
  if (amountCents <= 0 || amountCents > remaining) back(path, `Montant invalide (reste remboursable : ${(remaining / 100).toFixed(2)} €).`, "err");
  const eventId = `refund_${randomBytes(12).toString("hex")}`;
  const res = await ingestPaymentEvent({ provider: "DEMO", eventId, type: "demo.refund.succeeded", normalized: "refund_succeeded", providerRef: payment.providerRef, orderId: payment.orderId, amountCents, payload: { demo: true, paymentId: payment.id, amountCents, initiatedBy: "admin" } });
  await audit({ ...actorOf(session), action: "order.refund.demo", entity: "Order", entityId: payment.orderId, before: { paymentStatus: payment.status, refundedCents: already }, after: { amountCents, outcome: res.outcome, eventId } });
  back(path, `Remboursement de démonstration enregistré (${res.outcome}).`);
}
