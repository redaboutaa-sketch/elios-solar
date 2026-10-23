import { Price } from "@/components/ui/price";
import { DemoBadge } from "@/components/ui/demo-badge";
import type { Order, OrderLine, Payment } from "@/generated/prisma/client";

export const ORDER_STATUS_FR: Record<string, string> = { PENDING_PAYMENT: "En attente de paiement", PAID: "Payée", PROCESSING: "En préparation", SHIPPED: "Expédiée", DELIVERED: "Livrée", CANCELLED: "Annulée", PAYMENT_FAILED: "Paiement refusé", EXPIRED: "Expirée", REFUNDED: "Remboursée" };
export const FULFILLMENT_FR: Record<string, string> = { UNFULFILLED: "Non préparée", PREPARING: "En préparation", SHIPPED: "Expédiée", DELIVERED: "Livrée", CANCELLED: "Annulée" };

export function OrderDetail({ order }: { order: Order & { lines: OrderLine[]; payments?: Payment[] } }) {
  const addr = order.shippingAddress as { firstName: string; lastName: string; line1: string; line2?: string; postalCode: string; city: string };
  return (
    <div className="card p-5">
      <div className="flex flex-wrap justify-between gap-2 text-sm"><span>Commande <strong>{order.number}</strong> du {order.createdAt.toLocaleDateString("fr-FR")}</span><span className="badge bg-sand-100 border border-sand-300">{ORDER_STATUS_FR[order.status] ?? order.status} · {FULFILLMENT_FR[order.fulfillmentStatus]}</span></div>
      {(order.isDemo || order.containsDemoData) && <DemoBadge label="Commande de démonstration" className="mt-2" />}
      <table className="mt-4 w-full text-sm"><tbody>
        {order.lines.map((l) => <tr key={l.id} className="border-b border-sand-200"><td className="py-2 pr-2">{l.label}{l.qty > 1 && ` × ${l.qty}`}{l.sku && <span className="block text-xs text-stone-700 font-mono">{l.sku}</span>}</td><td className="py-2 text-right whitespace-nowrap">{l.included ? "inclus" : <Price cents={l.totalGrossCents} />}</td></tr>)}
        <tr className="font-semibold"><td className="pt-3">Total TTC</td><td className="pt-3 text-right"><Price cents={order.totalCents} /></td></tr>
        <tr className="text-xs text-stone-700"><td>dont TVA</td><td className="text-right"><Price cents={order.taxCents} showCents /></td></tr>
      </tbody></table>
      {(order.delivery as { shippingIncluded?: boolean } | null)?.shippingIncluded === false && <p className="mt-4 text-sm" data-testid="order-delivery-not-included">{(order.delivery as { shippingLabel?: string }).shippingLabel ?? "Livraison et pose non comprises"}.</p>}
      <p className="mt-4 text-sm"><strong>Adresse de livraison :</strong> {addr.firstName} {addr.lastName}, {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}, {addr.postalCode} {addr.city}</p>
      <p className="mt-1 text-xs text-stone-700">Les libellés, références et prix sont figés à la commande : une mise à jour du catalogue ne les modifie pas.</p>
    </div>
  );
}
