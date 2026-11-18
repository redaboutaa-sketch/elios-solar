import { NextResponse } from "next/server";
import { ingestPaymentEvent } from "@/server/payment";
import { normalizeSimEvent, simVerify } from "@/server/payment/installments-sim";
import { salesMode } from "@/server/payment/mode";

/**
 * Webhook du SIMULATEUR de paiement fractionné : même contrat que le webhook de démonstration
 * (corps brut signé HMAC-SHA256, identifiant d'événement unique, ingestion idempotente).
 * Désactivé dès que Stripe est le prestataire actif.
 */
export async function POST(req: Request) {
  if (salesMode() !== "demo") return NextResponse.json({ error: "simulateur désactivé" }, { status: 404 });
  const raw = await req.text();
  if (!simVerify(raw, req.headers.get("x-instsim-signature"))) return NextResponse.json({ error: "signature invalide" }, { status: 400 });
  let body: { id?: string; type?: string; data?: { providerRef?: string; orderId?: string; amountCents?: number; installments?: number; reason?: string; refundRef?: string } };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!body.id || !body.type) return NextResponse.json({ error: "événement incomplet" }, { status: 400 });
  const r = await ingestPaymentEvent({
    provider: "INSTALLMENTS_SIM",
    eventId: body.id,
    type: body.type,
    normalized: normalizeSimEvent(body.type),
    providerRef: body.data?.providerRef ?? null,
    orderId: body.data?.orderId ?? null,
    amountCents: body.data?.amountCents ?? null,
    refundRef: body.data?.refundRef ?? null,
    detail: body.data?.reason ?? null,
    payload: body,
  });
  return NextResponse.json({ received: true, ...r });
}
