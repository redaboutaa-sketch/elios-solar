import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AccountNav } from "@/components/account/account-nav";
import { Price } from "@/components/ui/price";
import { ORDER_STATUS_FR } from "@/components/account/order-detail";
export const metadata: Metadata = { title: "Mes commandes", robots: { index: false } };
export default async function Page() {
  const session = await requireUser("/compte/commandes");
  // commandes du compte, et paiements de devis adressés à son e-mail
  const orders = await prisma.order.findMany({ where: { OR: [{ userId: session.user.id }, { quoteId: { not: null }, email: session.user.email.toLowerCase() }] }, orderBy: { createdAt: "desc" }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  return (
    <div className="container-x py-8"><h1 className="font-display text-4xl">Mes commandes</h1><div className="mt-4"><AccountNav current="/compte/commandes" /></div>
      {orders.length === 0 ? <p className="mt-8 card p-8 text-center">Aucune commande pour le moment.</p> : <ul className="mt-8 space-y-3">{orders.map((o) => <li key={o.id}><Link href={`/compte/commandes/${o.id}`} className="card p-4 flex flex-wrap justify-between gap-2 hover:border-ink"><span><strong>{o.number}</strong> · {o.createdAt.toLocaleDateString("fr-FR")}</span><span>{ORDER_STATUS_FR[o.status]}{o.payments[0]?.awaitingFundsSince ? " · virement en attente" : ""}{o.payments[0]?.providerRef ? <span className="text-xs text-stone-700"> · réf. {o.payments[0].providerRef.slice(-10)}</span> : null} · <Price cents={o.totalCents} /></span></Link>{o.quoteId && o.status === "PENDING_PAYMENT" ? <Link href={`/commande/${o.id}/payer`} className="mt-1 inline-block text-sm link-brand">Régler ce devis</Link> : null}</li>)}</ul>}
    </div>
  );
}
