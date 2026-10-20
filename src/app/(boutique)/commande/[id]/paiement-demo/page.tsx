import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Price } from "@/components/ui/price";
import { Notice } from "@/components/ui/alert";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { getOrderForOwner } from "@/server/order/service";
import { demoPaymentAction } from "@/server/actions/demo-payment";

export const metadata: Metadata = { title: "Paiement simulé", robots: { index: false } };

export default async function DemoPaymentPage(props: PageProps<"/commande/[id]/paiement-demo">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
  const order = await getOrderForOwner(id, { userId: session?.user.id, guestKey });
  if (!order) notFound();
  if (order.status === "PAID") redirect(`/commande/${order.id}/confirmation`);
  const ref = typeof sp.ref === "string" ? sp.ref : order.payments[0]?.providerRef ?? "";
  if (process.env.PAYMENT_PROVIDER === "stripe") redirect(`/commande/${order.id}/confirmation`);
  return (
    <div className="container-x py-12 max-w-xl">
      <div className="card p-8 border-warning">
        <p className="badge-demo mb-3">PAIEMENT SIMULÉ — MODE TEST</p>
        <h1 className="font-display text-3xl">Commande {order.number}</h1>
        <p className="mt-2 text-stone-700">Aucune transaction réelle n'est effectuée. Cette page remplace le prestataire de paiement en préproduction et déclenche les mêmes événements signés (webhook) que la production.</p>
        <p className="mt-4 text-2xl font-semibold">Montant : <Price cents={order.totalCents} /></p>
        <p className="text-xs text-stone-700">Référence de paiement : {ref || "—"} · expire {order.expiresAt?.toLocaleTimeString("fr-FR")}</p>
        {order.status !== "PENDING_PAYMENT" && <div className="mt-4"><Notice tone="warn">Cette commande n'est plus en attente de paiement (statut : {order.status}).</Notice></div>}
        <form action={demoPaymentAction} className="mt-6 grid gap-2 sm:grid-cols-3">
          <input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="ref" value={ref} />
          <button name="outcome" value="succeeded" className="btn-accent" disabled={order.status !== "PENDING_PAYMENT"}>Simuler un paiement accepté</button>
          <button name="outcome" value="failed" className="btn-secondary" disabled={order.status !== "PENDING_PAYMENT"}>Simuler un refus</button>
          <button name="outcome" value="cancelled" className="btn-ghost" disabled={order.status !== "PENDING_PAYMENT"}>Abandonner</button>
        </form>
      </div>
    </div>
  );
}
