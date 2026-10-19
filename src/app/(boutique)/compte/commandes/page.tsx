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
  const orders = await prisma.order.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="container-x py-8"><h1 className="font-display text-4xl">Mes commandes</h1><div className="mt-4"><AccountNav current="/compte/commandes" /></div>
      {orders.length === 0 ? <p className="mt-8 card p-8 text-center">Aucune commande pour le moment.</p> : <ul className="mt-8 space-y-3">{orders.map((o) => <li key={o.id}><Link href={`/compte/commandes/${o.id}`} className="card p-4 flex flex-wrap justify-between gap-2 hover:border-ink"><span><strong>{o.number}</strong> · {o.createdAt.toLocaleDateString("fr-FR")}</span><span>{ORDER_STATUS_FR[o.status]} · <Price cents={o.totalCents} /></span></Link></li>)}</ul>}
    </div>
  );
}
