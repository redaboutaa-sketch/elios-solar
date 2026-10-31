import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Price } from "@/components/ui/price";
import { Notice } from "@/components/ui/alert";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { getOrderForOwner } from "@/server/order/service";
import { OrderDetail } from "@/components/account/order-detail";
import { PaymentMethodLine } from "@/components/checkout/payment-method-line";
import { mailDeliveryReal } from "@/server/mail/transport";

export const metadata: Metadata = { title: "Confirmation de commande", robots: { index: false } };

export default async function ConfirmationPage(props: PageProps<"/commande/[id]/confirmation">) {
  const { id } = await props.params;
  const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
  const order = await getOrderForOwner(id, { userId: session?.user.id, guestKey });
  if (!order) notFound();
  const usedPayment = order.payments.find((p) => p.status === "SUCCEEDED" || p.status === "REFUNDED" || p.status === "PARTIALLY_REFUNDED") ?? order.payments[0];
  const paid = order.status === "PAID" || order.status === "PROCESSING" || order.status === "SHIPPED" || order.status === "DELIVERED";
  return (
    <div className="container-x py-10 max-w-3xl">
      {paid ? (
        <><h1 className="font-display text-4xl">Merci, votre commande est confirmée.</h1><p className="mt-2 text-stone-700">Commande <strong>{order.number}</strong> · <Price cents={order.totalCents} />{mailDeliveryReal() ? " · un e-mail de confirmation vous est envoyé." : ""}</p>{order.isDemo && <div className="mt-3"><Notice tone="warn">Commande de test : paiement simulé, aucune transaction réelle.</Notice></div>}</>
      ) : (
        <><h1 className="font-display text-4xl">Paiement en attente de confirmation</h1><p className="mt-2 text-stone-700">Le retour du navigateur ne prouve pas le paiement : la commande {order.number} sera confirmée dès réception de la notification du prestataire. Statut actuel : {order.status}.</p>{order.status === "PENDING_PAYMENT" && <Link href={order.payments[0]?.checkoutUrl ?? "/panier"} className="btn-accent mt-4">Reprendre le paiement</Link>}</>
      )}
      {usedPayment && <p className="mt-3 text-sm"><PaymentMethodLine payment={usedPayment} /></p>}
      <div className="mt-8"><OrderDetail order={order} /></div>
      <div className="mt-6 flex gap-2"><Link href={session ? "/compte/commandes" : "/compte/inscription"} className="btn-secondary">{session ? "Mes commandes" : "Créer un compte pour suivre ma commande"}</Link><Link href="/" className="btn-ghost">Retour à l'accueil</Link></div>
    </div>
  );
}
