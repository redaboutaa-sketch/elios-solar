import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui/alert";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { getOrderForOwner } from "@/server/order/service";
import { PaymentMethodLine } from "@/components/checkout/payment-method-line";
import { retryCardPaymentAction } from "./actions";

export const metadata: Metadata = { title: "Paiement non abouti", robots: { index: false } };

export default async function CancelPage(props: PageProps<"/commande/[id]/annulation">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
  const order = await getOrderForOwner(id, { userId: session?.user.id, guestKey });
  if (!order) notFound();
  const last = order.payments[0];
  const installmentsRefused = last?.method === "installments" && (sp.motif === "installments_refused" || last.status === "FAILED");
  const wasInstallments = last?.method === "installments";
  return (
    <div className="container-x py-12 max-w-xl">
      <h1 className="font-display text-3xl">Le paiement n'a pas abouti</h1>
      <p className="mt-2 text-stone-700">Commande {order.number} — statut : {order.status}. Votre panier est conservé ; aucune somme n'a été prélevée.</p>
      {last && <p className="mt-2 text-sm"><PaymentMethodLine payment={last} /></p>}
      {installmentsRefused && <div className="mt-4"><Notice tone="warn">Le prestataire n'a pas accepté le paiement fractionné : vous pouvez régler par carte.</Notice></div>}
      <div className="mt-6 flex flex-wrap gap-2">
        {wasInstallments && (
          <form action={retryCardPaymentAction}><input type="hidden" name="orderId" value={order.id} /><button type="submit" className="btn-accent">Payer par carte en une fois</button></form>
        )}
        <Link href="/panier" className={wasInstallments ? "btn-secondary" : "btn-accent"}>Revenir au panier</Link><Link href="/contact" className="btn-secondary">Nous contacter</Link>
      </div>
    </div>
  );
}
