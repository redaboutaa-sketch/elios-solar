import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Price } from "@/components/ui/price";
import { Notice } from "@/components/ui/alert";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { getOrderForOwner } from "@/server/order/service";
import { splitInstallments } from "@/server/payment/installments-rules";
import { installmentsSimAction } from "./actions";
import { salesMode } from "@/server/payment/mode";

export const metadata: Metadata = { title: "Simulateur de paiement fractionné", robots: { index: false } };

export default async function InstallmentsSimPage(props: PageProps<"/commande/[id]/paiement-fractionne-simule">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
  const order = await getOrderForOwner(id, { userId: session?.user.id, guestKey });
  if (!order) notFound();
  if (order.status === "PAID") redirect(`/commande/${order.id}/confirmation`);
  if (salesMode() !== "demo") redirect(`/commande/${order.id}/confirmation`);
  const payment = order.payments.find((p) => p.provider === "INSTALLMENTS_SIM" && (typeof sp.ref !== "string" || p.providerRef === sp.ref)) ?? order.payments.find((p) => p.provider === "INSTALLMENTS_SIM");
  const ref = payment?.providerRef ?? "";
  const count = payment?.installments ?? 3;
  const total = (payment?.amountCents ?? order.totalCents) + (payment?.feesCents ?? 0);
  const { firstCents, otherCents } = splitInstallments(total, count);
  const pending = order.status === "PENDING_PAYMENT" && !!payment;
  return (
    <div className="container-x py-12 max-w-xl">
      <div className="card p-8 border-warning">
        <p className="badge-demo mb-3">SIMULATEUR DE PAIEMENT FRACTIONNÉ — aucune transaction, aucun prestataire contacté</p>
        <h1 className="font-display text-3xl">Commande {order.number}</h1>
        <p className="mt-2 text-stone-700">Cette page remplace la page hébergée du prestataire (Klarna ou Alma via Stripe) en préproduction. Elle déclenche les mêmes événements signés (webhook) que la production, sans aucun mouvement d'argent.</p>
        {sp.erreur === "webhook" && <div className="mt-4"><Notice tone="error">Le webhook du simulateur n'a pas accepté l'événement. Réessayez.</Notice></div>}
        <h2 className="mt-6 font-display text-xl">Échéancier simulé — {count} fois</h2>
        <table className="mt-2 w-full text-sm" data-testid="sim-schedule">
          <tbody>
            <tr className="border-b border-sand-200"><td className="py-1">1re échéance (aujourd'hui)</td><td className="py-1 text-right"><Price cents={firstCents} showCents /></td></tr>
            {Array.from({ length: count - 1 }, (_, i) => <tr key={i} className="border-b border-sand-200"><td className="py-1">Échéance {i + 2} (dans {i + 1} mois)</td><td className="py-1 text-right"><Price cents={otherCents} showCents /></td></tr>)}
            <tr className="font-semibold"><td className="pt-2">Total{payment?.feesCents ? ` (dont frais ${(payment.feesCents / 100).toFixed(2)} €)` : ""}</td><td className="pt-2 text-right"><Price cents={total} showCents /></td></tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-stone-700">Référence : {ref || "—"} · expire {order.expiresAt?.toLocaleTimeString("fr-FR")}</p>
        {!pending && <div className="mt-4"><Notice tone="warn">Cette commande n'est plus en attente de paiement fractionné (statut : {order.status}).</Notice></div>}
        <form action={installmentsSimAction} className="mt-6 grid gap-2 sm:grid-cols-3">
          <input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="ref" value={ref} />
          <button name="outcome" value="accepted" className="btn-accent" disabled={!pending}>Accepter (simulation)</button>
          <button name="outcome" value="refused" className="btn-secondary" disabled={!pending}>Refuser (simulation)</button>
          <button name="outcome" value="abandoned" className="btn-ghost" disabled={!pending}>Abandonner</button>
        </form>
      </div>
    </div>
  );
}
