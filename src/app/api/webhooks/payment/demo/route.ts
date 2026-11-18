import { NextResponse } from "next/server";
import { demoVerify, ingestPaymentEvent } from "@/server/payment";
import { salesMode } from "@/server/payment/mode";

export async function POST(req: Request) {
  if (salesMode() !== "demo") return NextResponse.json({ error: "demo désactivé" }, { status: 404 });
  const raw = await req.text();
  if (!demoVerify(raw, req.headers.get("x-demo-signature"))) return NextResponse.json({ error: "signature invalide" }, { status: 400 });
  let body: { id?: string; type?: string; data?: { providerRef?: string; orderId?: string; amountCents?: number } };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!body.id || !body.type) return NextResponse.json({ error: "événement incomplet" }, { status: 400 });
  const normalized = body.type === "demo.payment.succeeded" ? "payment_succeeded" : body.type === "demo.payment.failed" ? "payment_failed" : body.type === "demo.payment.cancelled" ? "payment_cancelled" : body.type === "demo.refund.succeeded" ? "refund_succeeded" : "ignored";
  const r = await ingestPaymentEvent({ provider: "DEMO", eventId: body.id, type: body.type, normalized, providerRef: body.data?.providerRef ?? null, orderId: body.data?.orderId ?? null, amountCents: body.data?.amountCents ?? null, payload: body });
  return NextResponse.json({ received: true, ...r });
}
