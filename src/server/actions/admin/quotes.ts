"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { enqueueEmail } from "@/server/mail/outbox";
import { QuoteStatus } from "@/generated/prisma/enums";
import { actorOf, back, fields, firstError, zOpt, zOptDateEnd, zOptEuros, zReq } from "@/server/admin/form";
import type { EvaluationResult } from "@/domain/types";

const schema = z.object({
  quoteId: zReq(64),
  status: z.enum(QuoteStatus),
  proposedTotal: zOptEuros,
  validUntil: zOptDateEnd,
  adminNotes: zOpt(5000),
  qualification: z.enum(["TO_QUALIFY", "QUALIFIED", "NOT_QUALIFIED"]).optional(),
});

export async function updateQuoteAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const parsed = schema.safeParse(fields(formData));
  const id = String(formData.get("quoteId") ?? "");
  if (!parsed.success) back(`/admin/devis/${encodeURIComponent(id)}`, firstError(parsed.error), "err");
  const d = parsed.data;
  const quote = await prisma.quote.findUnique({ where: { id: d.quoteId } });
  if (!quote) back("/admin/devis", "Devis introuvable", "err");
  const updated = await prisma.quote.update({ where: { id: quote.id }, data: { status: d.status, proposedTotalCents: d.proposedTotal, validUntil: d.validUntil, adminNotes: d.adminNotes, ...(d.qualification ? { qualification: d.qualification } : {}) } });
  let mailed = false;
  if (d.status === "SENT" && quote.status !== "SENT") {
    const snapshot = quote.snapshot as { result?: EvaluationResult | null } | null;
    const lines = snapshot?.result?.lines?.map((l) => ({ label: l.label, qty: l.qty, totalGrossCents: l.totalGrossCents, included: l.included }));
    await enqueueEmail({ to: quote.email, subject: `Votre devis ${quote.number}`, template: "quote-received", payload: { number: quote.number, firstName: quote.firstName, lines, demo: quote.containsDemoData }, dedupeKey: `quote-sent:${quote.id}:${Date.now()}` });
    mailed = true;
  }
  await audit({
    ...actorOf(session), action: "quote.update", entity: "Quote", entityId: quote.id,
    before: { status: quote.status, proposedTotalCents: quote.proposedTotalCents, validUntil: quote.validUntil, qualification: quote.qualification },
    after: { status: updated.status, proposedTotalCents: updated.proposedTotalCents, validUntil: updated.validUntil, qualification: updated.qualification, emailQueued: mailed },
  });
  back(`/admin/devis/${quote.id}`, mailed ? "Devis mis à jour, e-mail envoyé au client (file d'attente)." : "Devis mis à jour.");
}

/** Ouvre le paiement en ligne d'un devis accepté (commande au montant TTC du devis). */
export async function openQuotePaymentAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const quoteId = String(formData.get("quoteId") ?? "");
  const vat = Number(String(formData.get("vatRate") ?? "").replace(",", "."));
  const path = `/admin/devis/${encodeURIComponent(quoteId)}`;
  if (!Number.isFinite(vat)) back(path, "Indiquez le taux de TVA du devis.", "err");
  const { createOrderFromQuote } = await import("@/server/order/quote-order");
  const { OrderError } = await import("@/server/order/service");
  let r: Awaited<ReturnType<typeof createOrderFromQuote>>;
  try {
    r = await createOrderFromQuote(quoteId, { vatRateBps: Math.round(vat * 100), label: String(formData.get("label") ?? "").slice(0, 120) || undefined });
  } catch (e) {
    if (e instanceof OrderError) back(path, e.message, "err");
    throw e;
  }
  await audit({ ...actorOf(session), action: "quote.payment_opened", entity: "Quote", entityId: quoteId, after: { orderId: r.order.id, totalCents: r.order.totalCents, created: r.created } });
  back(path, r.created ? `Paiement ouvert : commande ${r.order.number}. Lien à transmettre au client : /commande/${r.order.id}/payer` : `Paiement déjà ouvert : commande ${r.order.number} (/commande/${r.order.id}/payer).`);
}
