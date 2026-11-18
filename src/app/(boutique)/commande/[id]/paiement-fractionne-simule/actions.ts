"use server";
import { internalBaseUrl } from "@/lib/internal-url";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { getOrderForOwner } from "@/server/order/service";
import { simSign } from "@/server/payment/installments-sim";
import { randomCode } from "@/server/ids";
import { salesMode } from "@/server/payment/mode";

/**
 * Boutons de la page de paiement fractionné SIMULÉ : chaque choix envoie un événement SIGNÉ au
 * webhook du simulateur via HTTP (même chemin que la production : signature, idempotence).
 */
export async function installmentsSimAction(formData: FormData) {
  if (salesMode() !== "demo") redirect("/");
  const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
  const orderId = String(formData.get("orderId") ?? "");
  const order = await getOrderForOwner(orderId, { userId: session?.user.id, guestKey });
  if (!order) redirect("/panier");
  const outcome = String(formData.get("outcome") ?? "");
  const payment = await prisma.payment.findFirst({ where: { orderId, provider: "INSTALLMENTS_SIM" }, orderBy: { createdAt: "desc" } });
  if (!payment?.providerRef) redirect(`/commande/${orderId}/confirmation`);
  const type = outcome === "accepted" ? "instsim.payment.succeeded" : outcome === "refused" ? "instsim.payment.failed" : "instsim.payment.cancelled";
  const reason = outcome === "refused" ? "refus simulé du prestataire de paiement fractionné" : outcome === "abandoned" ? "abandon par le client" : undefined;
  const body = JSON.stringify({ id: `evt_${randomCode(12)}`, type, data: { providerRef: payment.providerRef, orderId, amountCents: payment.amountCents, installments: payment.installments, reason } });
  const base = internalBaseUrl();
  const res = await fetch(`${base}/api/webhooks/payment/installments-sim`, { method: "POST", headers: { "content-type": "application/json", "x-instsim-signature": simSign(body) }, body, cache: "no-store" });
  if (!res.ok) redirect(`/commande/${orderId}/paiement-fractionne-simule?ref=${payment.providerRef}&erreur=webhook`);
  redirect(outcome === "accepted" ? `/commande/${orderId}/confirmation` : `/commande/${orderId}/annulation?motif=${outcome === "refused" ? "installments_refused" : "cancelled"}`);
}
