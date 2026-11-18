import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export class OutOfStockError extends Error {
  constructor(readonly sku: string, readonly requested: number) {
    super(`Stock insuffisant pour ${sku}`);
    this.name = "OutOfStockError";
  }
}

type Tx = Prisma.TransactionClient;

/**
 * Réservation atomique : la mise à jour conditionnelle garantit qu'aucune double vente
 * n'est possible même avec des requêtes concurrentes (une seule UPDATE réussit sur le dernier article).
 * Les références fabriquées à la commande (MADE_TO_ORDER) ne sont pas limitées.
 */
export async function reserveStock(tx: Tx, orderId: string, items: Array<{ sku: string; qty: number }>, ttlMinutes = 30) {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  const merged = new Map<string, number>();
  for (const it of items) merged.set(it.sku, (merged.get(it.sku) ?? 0) + it.qty);
  for (const [sku, qty] of merged) {
    const variant = await tx.variant.findUnique({ where: { sku }, select: { id: true, stockMode: true, stockQty: true } });
    if (!variant) throw new Error(`Référence inconnue : ${sku}`);
    if (variant.stockMode !== "STOCK" || variant.stockQty === null) continue;
    const updated = await tx.$executeRaw`UPDATE "Variant" SET "reservedQty" = "reservedQty" + ${qty} WHERE "id" = ${variant.id} AND ("stockQty" - "reservedQty") >= ${qty}`;
    if (updated === 0) throw new OutOfStockError(sku, qty);
    await tx.stockReservation.create({ data: { variantId: variant.id, orderId, qty, expiresAt } });
  }
}

async function finalize(tx: Tx, orderId: string, mode: "release" | "consume") {
  const reservations = await tx.stockReservation.findMany({ where: { orderId, status: "ACTIVE" } });
  for (const r of reservations) {
    if (mode === "consume") {
      await tx.variant.update({ where: { id: r.variantId }, data: { reservedQty: { decrement: r.qty }, stockQty: { decrement: r.qty } } });
    } else {
      await tx.variant.update({ where: { id: r.variantId }, data: { reservedQty: { decrement: r.qty } } });
    }
    await tx.stockReservation.update({ where: { id: r.id }, data: { status: mode === "consume" ? "CONSUMED" : "RELEASED" } });
  }
}

export const releaseReservations = (tx: Tx, orderId: string) => finalize(tx, orderId, "release");
export const consumeReservations = (tx: Tx, orderId: string) => finalize(tx, orderId, "consume");

/** Libère les réservations expirées (appelé par le worker et avant chaque checkout). */
export async function expireReservations() {
  const expired = await prisma.stockReservation.findMany({ where: { status: "ACTIVE", expiresAt: { lt: new Date() } } });
  let n = 0;
  for (const r of expired) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.stockReservation.updateMany({ where: { id: r.id, status: "ACTIVE" }, data: { status: "EXPIRED" } });
      if (claimed.count === 1) {
        await tx.variant.update({ where: { id: r.variantId }, data: { reservedQty: { decrement: r.qty } } });
        n += 1;
      }
    });
  }
  return n;
}

export async function availableQty(sku: string): Promise<number | null> {
  const v = await prisma.variant.findUnique({ where: { sku }, select: { stockMode: true, stockQty: true, reservedQty: true } });
  if (!v || v.stockMode !== "STOCK" || v.stockQty === null) return null;
  return v.stockQty - v.reservedQty;
}
