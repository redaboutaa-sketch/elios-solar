import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { Owner } from "@/server/cart/service";
import { CartError, evaluateCart, findActiveCart } from "@/server/cart/service";
import { businessNumber } from "@/server/ids";
import { enqueueEmail } from "@/server/mail/outbox";
import { consumeReservations, expireReservations, releaseReservations, reserveStock, OutOfStockError } from "@/server/stock/service";
import { logger } from "@/lib/logger";
import { loadCatalog } from "@/server/catalog/load";
import { estimateCartDelivery } from "@/server/stock/delivery";
import { ONLINE_SALES_CLOSED, onlineSalesEnabled } from "@/server/payment/mode";

export const ORDER_TTL_MINUTES = 30;

export interface AddressInput {
  firstName: string;
  lastName: string;
  company?: string;
  line1: string;
  line2?: string;
  postalCode: string;
  city: string;
  countryCode: string;
  phone?: string;
}

export class OrderError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "OrderError";
  }
}

/**
 * Crée (ou réutilise) la commande en attente de paiement à partir du panier.
 * Le total est recalculé côté serveur ; rien n'est pris du navigateur.
 */
export async function createOrderFromCart(opts: { owner: Owner; email: string; shippingAddress: AddressInput; billingAddress?: AddressInput; customerNotes?: string }) {
  if (!onlineSalesEnabled()) throw new OrderError(ONLINE_SALES_CLOSED, "sales_disabled");
  await expireReservations();
  await expirePendingOrders();
  const cart = await findActiveCart(opts.owner);
  if (!cart || cart.lines.length === 0) throw new OrderError("Votre panier est vide.", "cart_empty");
  const delivery = { countryCode: opts.shippingAddress.countryCode, postalCode: opts.shippingAddress.postalCode };
  if (JSON.stringify(cart.delivery) !== JSON.stringify(delivery)) {
    cart.delivery = delivery as never;
  }
  const evaluation = await evaluateCart(cart);
  if (!evaluation.purchasable) throw new CartError("Une ligne du panier n'est plus valide : vérifiez votre panier.", evaluation.lines.flatMap((l) => l.result.issues.filter((i) => i.severity !== "info")));
  if ((evaluation.shippingStatus !== "ok" && evaluation.shippingStatus !== "not_included") || evaluation.shippingCents === null) throw new OrderError("La livraison vers cette adresse nécessite un devis.", "shipping_quote");
  // Revalidation disponibilité et délai au moment du checkout (stock relu en base)
  const leadEstimate = await estimateCartDelivery(evaluation, await loadCatalog());
  if (leadEstimate.status === "blocked") throw new OrderError(`Disponibilité modifiée : ${leadEstimate.blocked.map((b) => `${b.label} (${b.reason})`).join(" ; ")}. Votre panier est conservé.`, "unavailable");

  const existing = await prisma.order.findFirst({ where: { cartId: cart.id, status: "PENDING_PAYMENT", expiresAt: { gt: new Date() }, totalCents: evaluation.totalCents }, include: { lines: true, payments: true } });
  if (existing) return existing;

  const isDemo = (process.env.PAYMENT_PROVIDER ?? "demo") !== "stripe";
  const billing = opts.billingAddress ?? opts.shippingAddress;
  try {
    const order = await prisma.$transaction(async (tx) => {
      // invalider les anciennes commandes en attente du même panier
      const stale = await tx.order.findMany({ where: { cartId: cart.id, status: "PENDING_PAYMENT" } });
      for (const s of stale) {
        await releaseReservations(tx, s.id);
        await tx.order.update({ where: { id: s.id }, data: { status: "EXPIRED" } });
      }
      const number = businessNumber("CMD");
      const created = await tx.order.create({
        data: {
          number,
          userId: opts.owner.userId ?? null,
          guestKey: opts.owner.userId ? null : (opts.owner.guestKey ?? null),
          email: opts.email.trim().toLowerCase(),
          goodsCents: evaluation.goodsCents,
          installationCents: evaluation.installationCents,
          shippingCents: evaluation.shippingCents ?? 0,
          discountCents: evaluation.discountCents,
          taxCents: evaluation.taxCents,
          totalCents: evaluation.totalCents,
          shippingAddress: opts.shippingAddress as never,
          billingAddress: billing as never,
          delivery: { ...delivery, shippingLabel: evaluation.shippingLabel, shippingIncluded: evaluation.shippingStatus !== "not_included", estimate: { status: leadEstimate.status, policy: leadEstimate.policy, explanation: leadEstimate.explanation, shipments: leadEstimate.shipments, unknown: leadEstimate.unknown, computedAt: new Date().toISOString() } } as never,
          isDemo,
          containsDemoData: evaluation.containsDemoData,
          customerNotes: opts.customerNotes?.slice(0, 2000) ?? null,
          cartId: cart.id,
          expiresAt: new Date(Date.now() + ORDER_TTL_MINUTES * 60_000),
        },
      });
      const stockItems: Array<{ sku: string; qty: number }> = [];
      let sort = 0;
      for (const l of evaluation.lines) {
        for (const [i, pl] of l.result.lines.entries()) {
          await tx.orderLine.create({
            data: {
              orderId: created.id,
              kind: pl.kind,
              sku: pl.sku ?? null,
              label: pl.label,
              qty: pl.qty * l.line.qty,
              unitGrossCents: pl.unitGrossCents,
              totalGrossCents: pl.totalGrossCents * l.line.qty,
              taxRateBps: pl.taxRateBps,
              included: pl.included ?? false,
              configurationSnapshot: i === 0 ? ({ input: l.input, result: l.result } as never) : undefined,
              sortOrder: sort++,
            },
          });
          if (pl.sku && !pl.included && (pl.kind === "base" || pl.kind === "closure" || pl.kind === "option")) stockItems.push({ sku: pl.sku, qty: pl.qty * l.line.qty });
        }
      }
      if (evaluation.shippingCents !== null && evaluation.shippingStatus === "ok") {
        await tx.orderLine.create({ data: { orderId: created.id, kind: "shipping", label: evaluation.shippingLabel ?? "Livraison", qty: 1, unitGrossCents: evaluation.shippingCents, totalGrossCents: evaluation.shippingCents, taxRateBps: 2000, sortOrder: sort++ } });
      }
      await reserveStock(tx, created.id, stockItems, ORDER_TTL_MINUTES);
      return created;
    });
    return prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { lines: true, payments: true } });
  } catch (err) {
    if (err instanceof OutOfStockError) throw new OrderError(`Le dernier exemplaire de la référence ${err.sku} vient d'être réservé par un autre client.`, "out_of_stock");
    throw err;
  }
}

export async function markOrderPaid(orderId: string, paymentId: string | null, tx?: Prisma.TransactionClient) {
  const run = async (t: Prisma.TransactionClient) => {
    const order = await t.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderError("Commande introuvable", "not_found");
    if (order.status === "PAID" || order.status === "PROCESSING" || order.status === "SHIPPED" || order.status === "DELIVERED") return { order, changed: false };
    await consumeReservations(t, orderId);
    const updated = await t.order.update({ where: { id: orderId }, data: { status: "PAID", paidAt: new Date(), expiresAt: null } });
    if (order.cartId) await t.cart.update({ where: { id: order.cartId }, data: { status: "CONVERTED" } });
    if (paymentId) await t.payment.update({ where: { id: paymentId }, data: { status: "SUCCEEDED" } });
    return { order: updated, changed: true };
  };
  const res = tx ? await run(tx) : await prisma.$transaction(run);
  if (res.changed) await notifyOrderPaid(res.order.id);
  return res;
}

async function notifyOrderPaid(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
  if (!order) return;
  const addr = order.shippingAddress as unknown as AddressInput;
  const lines = order.lines.filter((l) => l.kind !== "discount" || l.totalGrossCents !== 0).map((l) => ({ label: l.label, qty: l.qty, totalGrossCents: l.totalGrossCents, included: l.included }));
  await enqueueEmail({ to: order.email, subject: `Commande ${order.number} confirmée`, template: "order-confirmation", payload: { number: order.number, orderId: order.id, firstName: addr.firstName, totalCents: order.totalCents, lines, demo: order.isDemo || order.containsDemoData, deliveryNote: (order.delivery as { shippingIncluded?: boolean; shippingLabel?: string } | null)?.shippingIncluded === false ? (order.delivery as { shippingLabel?: string }).shippingLabel : undefined }, dedupeKey: `order-confirmation:${order.id}` });
  const admin = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (admin) await enqueueEmail({ to: admin, subject: `Nouvelle commande ${order.number}`, template: "order-admin-notification", payload: { number: order.number, orderId: order.id, email: order.email, totalCents: order.totalCents, demo: order.isDemo }, dedupeKey: `order-admin:${order.id}` });
}

export async function markOrderFailed(orderId: string, status: "PAYMENT_FAILED" | "CANCELLED" | "EXPIRED", tx?: Prisma.TransactionClient) {
  const run = async (t: Prisma.TransactionClient) => {
    const order = await t.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "PENDING_PAYMENT") return order;
    await releaseReservations(t, orderId);
    return t.order.update({ where: { id: orderId }, data: { status } });
  };
  return tx ? run(tx) : prisma.$transaction(run);
}

export async function expirePendingOrders() {
  const stale = await prisma.order.findMany({ where: { status: "PENDING_PAYMENT", expiresAt: { lt: new Date() } }, select: { id: true } });
  for (const o of stale) {
    await markOrderFailed(o.id, "EXPIRED");
    await prisma.payment.updateMany({ where: { orderId: o.id, status: { in: ["CREATED", "PENDING"] } }, data: { status: "EXPIRED" } });
  }
  if (stale.length) logger.info({ count: stale.length }, "commandes expirées");
  return stale.length;
}

/** Accès client : une commande n'est visible que par son propriétaire (compte ou clé invité). */
export async function getOrderForOwner(orderId: string, owner: Owner) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { lines: { orderBy: { sortOrder: "asc" } }, payments: { orderBy: { createdAt: "desc" } } } });
  if (!order) return null;
  if (owner.userId && order.userId === owner.userId) return order;
  if (!order.userId && owner.guestKey && order.guestKey === owner.guestKey) return order;
  return null;
}

export async function claimGuestOrders(userId: string, guestKey: string) {
  await prisma.order.updateMany({ where: { guestKey, userId: null }, data: { userId } });
}
