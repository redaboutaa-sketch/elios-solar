import { prisma } from "@/lib/prisma";
import { estimateDelivery, variantToShipmentItem, type DeliveryEstimate } from "@/domain/lead-time";
import type { CatalogSnapshot } from "@/domain/types";
import type { CartEvaluation } from "@/server/cart/service";

/**
 * Estimation de livraison d'un panier évalué : quantités disponibles relues en base
 * (stock − réservé), délais et disponibilité du catalogue courant, politique d'expédition
 * des réglages. Les lignes incluses (0 €) ne comptent pas comme références à expédier.
 */
export async function estimateCartDelivery(ev: CartEvaluation, catalog: CatalogSnapshot, now = new Date()): Promise<DeliveryEstimate> {
  const qtyBySku = new Map<string, { qty: number; label: string }>();
  for (const l of ev.lines) for (const pl of l.result.lines) {
    if (!pl.sku || pl.included || !["base", "closure", "option"].includes(pl.kind)) continue;
    const prev = qtyBySku.get(pl.sku);
    qtyBySku.set(pl.sku, { qty: (prev?.qty ?? 0) + pl.qty * l.line.qty, label: pl.label });
  }
  const skus = [...qtyBySku.keys()];
  const rows = skus.length ? await prisma.variant.findMany({ where: { sku: { in: skus } }, select: { sku: true, stockMode: true, stockQty: true, reservedQty: true } }) : [];
  const avail = new Map(rows.map((r) => [r.sku, r.stockMode === "STOCK" && r.stockQty !== null ? r.stockQty - r.reservedQty : null]));
  const items = skus.flatMap((sku) => {
    const v = catalog.variants.find((x) => x.sku === sku);
    const q = qtyBySku.get(sku)!;
    return v ? [variantToShipmentItem(v, q.qty, avail.get(sku) ?? null, q.label)] : [];
  });
  return estimateDelivery(items, catalog.shipmentPolicy ?? "GROUPED", now);
}
