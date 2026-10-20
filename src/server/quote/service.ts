import { prisma } from "@/lib/prisma";
import type { ConfigurationInput, EvaluationResult } from "@/domain/types";
import { businessNumber } from "@/server/ids";
import { enqueueEmail } from "@/server/mail/outbox";
import type { Owner } from "@/server/cart/service";
import { loadCatalog } from "@/server/catalog/load";
import { attachQuoteVisual, type AttachedVisual } from "@/server/quote/visual";

export interface QuoteRequest {
  kind: "configuration" | "custom" | "accessory" | "general";
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  postalCode?: string;
  message?: string;
  input?: ConfigurationInput | null;
  result?: EvaluationResult | null;
  configurationId?: string | null;
  /** visualisation exportée par le navigateur (dataURL PNG/JPEG), vérifiée et ré-encodée côté serveur */
  visual?: unknown;
}

export async function createQuote(req: QuoteRequest, owner: Owner): Promise<Awaited<ReturnType<typeof prisma.quote.create>> & { visualKind: AttachedVisual }> {
  const number = businessNumber("DEV");
  const quote = await prisma.quote.create({
    data: {
      number,
      userId: owner.userId ?? null,
      email: req.email.trim().toLowerCase(),
      firstName: req.firstName.trim(),
      lastName: req.lastName.trim(),
      phone: req.phone?.trim() || null,
      postalCode: req.postalCode?.trim() || null,
      message: req.message?.trim().slice(0, 4000) || null,
      kind: req.kind,
      configurationId: req.configurationId ?? null,
      snapshot: { input: req.input ?? null, result: req.result ?? null } as never,
      containsDemoData: req.result?.containsDemoData ?? true,
      status: "NEW",
    },
  });
  // Visualisation figée à l'émission ; un échec n'empêche jamais l'enregistrement du devis.
  const visual = req.input ? await attachQuoteVisual({ quoteId: quote.id, dataUrl: req.visual, input: req.input, result: req.result ?? null, catalog: await loadCatalog(), configurationId: req.configurationId ?? null }) : { kind: "NONE" as const };
  const lines = req.result?.lines.map((l) => ({ label: l.label, qty: l.qty, totalGrossCents: l.totalGrossCents, included: l.included })) ?? undefined;
  await enqueueEmail({ to: quote.email, subject: `Votre demande de devis ${number}`, template: "quote-received", payload: { number, firstName: quote.firstName, lines, demo: quote.containsDemoData }, dedupeKey: `quote-ack:${quote.id}` });
  const admin = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (admin) await enqueueEmail({ to: admin, subject: `Nouvelle demande de devis ${number}`, template: "quote-admin-notification", payload: { number, quoteId: quote.id, email: quote.email, kind: quote.kind, message: quote.message, demo: quote.containsDemoData }, dedupeKey: `quote-admin:${quote.id}` });
  return { ...quote, visualKind: visual.kind };
}

export async function getQuoteForOwner(id: string, owner: Owner & { email?: string | null }) {
  const q = await prisma.quote.findUnique({ where: { id } });
  if (!q) return null;
  if (owner.userId && q.userId === owner.userId) return q;
  return null;
}
