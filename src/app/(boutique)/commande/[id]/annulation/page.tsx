import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { getOrderForOwner } from "@/server/order/service";

export const metadata: Metadata = { title: "Paiement non abouti", robots: { index: false } };

export default async function CancelPage(props: PageProps<"/commande/[id]/annulation">) {
  const { id } = await props.params;
  const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
  const order = await getOrderForOwner(id, { userId: session?.user.id, guestKey });
  if (!order) notFound();
  return (
    <div className="container-x py-12 max-w-xl">
      <h1 className="font-display text-3xl">Le paiement n'a pas abouti</h1>
      <p className="mt-2 text-stone-700">Commande {order.number} — statut : {order.status}. Votre panier est conservé ; aucune somme n'a été prélevée.</p>
      <div className="mt-6 flex gap-2"><Link href="/panier" className="btn-accent">Revenir au panier</Link><Link href="/contact" className="btn-secondary">Nous contacter</Link></div>
    </div>
  );
}
