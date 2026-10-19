import "server-only";
import { prisma } from "@/lib/prisma";
import type { EvaluationResult } from "@/domain/types";
import { formatEur } from "@/domain/money";
import { buildConfigurationPdf, type PdfVisual } from "@/server/pdf/configuration-pdf";
import { PLAN_LEGEND, readQuoteVisual } from "@/server/quote/visual";

const STATUS_FR: Record<string, string> = { NEW: "demande recue", IN_REVIEW: "en cours d'etude", SENT: "devis envoye", ACCEPTED: "accepte", DECLINED: "refuse", EXPIRED: "expire" };

type QuoteWithVisuals = NonNullable<Awaited<ReturnType<typeof prisma.quote.findUnique<{ where: { id: string }; include: { visuals: true } }>>>>;

/** PDF d'un devis à partir de son instantané figé et de la visualisation jointe à l'émission. */
export async function buildQuotePdf(quote: QuoteWithVisuals): Promise<Uint8Array | null> {
  const snap = quote.snapshot as { result?: EvaluationResult | null } | null;
  const result = snap?.result;
  if (!result) return null;
  const v = quote.visuals[0];
  let visual: PdfVisual | null = null;
  if (v) {
    const bytes = await readQuoteVisual(v.storageKey);
    if (bytes) visual = { kind: v.kind, bytes, mime: v.mime === "image/jpeg" ? "image/jpeg" : "image/png", disclaimer: v.disclaimer, represented: (v.represented as string[]) ?? [], legend: v.kind === "PLAN_2D" ? PLAN_LEGEND : undefined };
  }
  const seller = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const info = [`Statut : ${STATUS_FR[quote.status] ?? quote.status}`];
  if (quote.proposedTotalCents != null) info.push(`Montant propose TTC : ${formatEur(quote.proposedTotalCents)}`);
  return buildConfigurationPdf({ title: result.lines[0]?.label ?? "Demande de devis", result, reference: quote.number, validUntil: quote.validUntil, kind: "devis", seller, visual, info });
}
