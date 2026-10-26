import { NextResponse } from "next/server";
import { ingestPaymentEvent } from "@/server/payment";
import { logger } from "@/lib/logger";
import { salesMode } from "@/server/payment/mode";

export async function POST(req: Request) {
  if (salesMode() !== "stripe") return NextResponse.json({ error: "stripe désactivé" }, { status: 404 });
  const raw = await req.text();
  try {
    const { parseStripeWebhook } = await import("@/server/payment/stripe");
    const ev = parseStripeWebhook(raw, req.headers.get("stripe-signature"));
    const r = await ingestPaymentEvent(ev);
    return NextResponse.json({ received: true, ...r });
  } catch (err) {
    logger.warn({ err: String(err) }, "webhook stripe rejeté");
    return NextResponse.json({ error: "signature invalide" }, { status: 400 });
  }
}
