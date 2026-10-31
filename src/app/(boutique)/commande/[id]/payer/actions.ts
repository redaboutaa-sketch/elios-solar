"use server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { orderForPayer } from "@/server/order/quote-order";
import { PaymentError, startPayment } from "@/server/payment";

/** Paiement d'une commande issue d'un devis : montant de la commande (serveur), moyen choisi par le client. */
export async function payOrderAction(formData: FormData) {
  const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
  const orderId = String(formData.get("orderId") ?? "");
  const order = await orderForPayer(orderId, { userId: session?.user.id, email: session?.user.email, guestKey });
  if (!order) redirect(`/compte/connexion?next=${encodeURIComponent(`/commande/${orderId}/payer`)}`);
  const m = String(formData.get("method") ?? "card");
  const method = m === "bank_transfer" ? "bank_transfer" : "card";
  let url: string;
  try {
    url = (await startPayment(order.id, { method })).checkoutUrl;
  } catch (e) {
    if (e instanceof PaymentError) redirect(`/commande/${order.id}/payer?erreur=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect(url);
}
