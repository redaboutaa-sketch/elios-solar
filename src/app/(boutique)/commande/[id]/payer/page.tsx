import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Notice } from "@/components/ui/alert";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { orderForPayer } from "@/server/order/quote-order";
import { activeProviderName } from "@/server/payment";
import { payOrderAction } from "./actions";

export const metadata: Metadata = { title: "Régler ma commande", robots: { index: false } };

const eur = (c: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(c / 100);
const PAYMENT_FR: Record<string, string> = { CREATED: "créé", PENDING: "en attente", SUCCEEDED: "reçu", FAILED: "refusé", CANCELLED: "annulé", EXPIRED: "expiré", REFUNDED: "remboursé", PARTIALLY_REFUNDED: "partiellement remboursé" };

/** Règlement d'une commande (devis approuvé) : récapitulatif, statut et choix du moyen de paiement. */
export default async function PayPage(props: PageProps<"/commande/[id]/payer">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
  const order = await orderForPayer(id, { userId: session?.user.id, email: session?.user.email, guestKey });
  if (!order) redirect(`/compte/connexion?next=${encodeURIComponent(`/commande/${id}/payer`)}`);
  const stripe = activeProviderName() === "STRIPE";
  const last = order.payments[0];
  const payable = order.status === "PENDING_PAYMENT" && (!order.expiresAt || order.expiresAt > new Date());
  return (
    <div className="container-x max-w-3xl py-8" data-testid="pay-order">
      <Breadcrumbs items={[{ href: "/compte/commandes", label: "Mes commandes" }, { label: order.number }]} />
      <h1 className="mt-4 font-display text-4xl">Régler la commande {order.number}</h1>
      <ul className="mt-6 divide-y divide-sand-200 rounded-2xl border border-sand-200 bg-white">{order.lines.map((l) => <li key={l.id} className="flex justify-between gap-4 p-4 text-sm"><span>{l.label}</span><span className="tabular-nums">{eur(l.totalGrossCents)}</span></li>)}<li className="flex justify-between p-4 font-semibold"><span>Total TTC</span><span className="tabular-nums" data-testid="pay-total">{eur(order.totalCents)}</span></li></ul>
      {last && <p className="mt-3 text-sm text-stone-700" data-testid="pay-status">Dernier paiement : {PAYMENT_FR[last.status] ?? last.status}{last.awaitingFundsSince ? " — virement annoncé, en attente de réception des fonds" : ""}{last.instructionsUrl ? <> · <a className="underline" href={last.instructionsUrl} target="_blank" rel="noopener noreferrer">coordonnées du virement</a></> : null}.</p>}
      {typeof sp.erreur === "string" && <div className="mt-4"><Notice tone="error">{sp.erreur}</Notice></div>}
      {order.status === "PAID" ? <div className="mt-6"><Notice tone="success">Paiement reçu : merci. Un conseiller vous contacte pour la suite.</Notice></div> : payable ? (
        <form action={payOrderAction} className="mt-6 space-y-3 rounded-2xl border border-sand-200 bg-white p-5">
          <input type="hidden" name="orderId" value={order.id} />
          <fieldset className="space-y-2 text-sm"><legend className="label">Moyen de paiement</legend>
            <label className="flex items-start gap-2"><input type="radio" name="method" value="card" defaultChecked className="mt-1" /> <span><strong>Paiement en ligne</strong>{stripe ? " — carte bancaire et moyens disponibles pour vous sur la page de paiement" : " — simulé dans cette préproduction, aucun débit"}</span></label>
            {stripe && <label className="flex items-start gap-2"><input type="radio" name="method" value="bank_transfer" className="mt-1" /> <span><strong>Virement bancaire</strong> — la commande est confirmée à réception des fonds</span></label>}
          </fieldset>
          <button className="btn-accent w-full" type="submit">Continuer vers le paiement sécurisé</button>
        </form>
      ) : <div className="mt-6"><Notice tone="warn">Cette demande de paiement n'est plus active. <Link href="/contact" className="underline">Contactez votre conseiller</Link>.</Notice></div>}
    </div>
  );
}
