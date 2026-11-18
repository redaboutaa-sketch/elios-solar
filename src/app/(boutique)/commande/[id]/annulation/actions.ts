"use server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { getOrderForOwner } from "@/server/order/service";
import { PaymentError, startPayment } from "@/server/payment";

/**
 * Repli « payer par carte » après un refus / abandon du paiement fractionné :
 * même commande si elle est encore en attente de paiement, sinon nouvelle commande depuis le panier conservé.
 */
export async function retryCardPaymentAction(formData: FormData) {
  const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
  const orderId = String(formData.get("orderId") ?? "");
  const order = await getOrderForOwner(orderId, { userId: session?.user.id, guestKey });
  if (!order) redirect("/panier");
  if (order.status !== "PENDING_PAYMENT" || (order.expiresAt && order.expiresAt < new Date())) redirect("/commande?repli=carte");
  let url: string;
  try {
    url = (await startPayment(order.id, { method: "card" })).checkoutUrl;
  } catch (e) {
    if (e instanceof PaymentError) redirect("/commande?repli=carte");
    throw e;
  }
  redirect(url);
}
