"use server";
import { internalBaseUrl } from "@/lib/internal-url";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { getOrderForOwner } from "@/server/order/service";
import { demoSign } from "@/server/payment";
import { randomCode } from "@/server/ids";

/**
 * Le bouton de la page de paiement simulé envoie un événement SIGNÉ au webhook de
 * démonstration (même chemin que la production : signature, idempotence) via HTTP.
 */
export async function demoPaymentAction(formData: FormData) {
  if (process.env.PAYMENT_PROVIDER === "stripe") redirect("/");
  const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
  const orderId = String(formData.get("orderId") ?? "");
  const order = await getOrderForOwner(orderId, { userId: session?.user.id, guestKey });
  if (!order) redirect("/panier");
  const outcome = String(formData.get("outcome") ?? "");
  const payment = await prisma.payment.findFirst({ where: { orderId, provider: "DEMO" }, orderBy: { createdAt: "desc" } });
  if (!payment?.providerRef) redirect(`/commande/${orderId}/confirmation`);
  const type = outcome === "succeeded" ? "demo.payment.succeeded" : outcome === "failed" ? "demo.payment.failed" : "demo.payment.cancelled";
  const body = JSON.stringify({ id: `evt_${randomCode(12)}`, type, data: { providerRef: payment.providerRef, orderId, amountCents: payment.amountCents } });
  const base = internalBaseUrl();
  const res = await fetch(`${base}/api/webhooks/payment/demo`, { method: "POST", headers: { "content-type": "application/json", "x-demo-signature": demoSign(body) }, body, cache: "no-store" });
  if (!res.ok) redirect(`/commande/${orderId}/paiement-demo?ref=${payment.providerRef}&erreur=webhook`);
  redirect(outcome === "succeeded" ? `/commande/${orderId}/confirmation` : `/commande/${orderId}/annulation?motif=${outcome}`);
}
