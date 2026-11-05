import "server-only";
import { prisma } from "@/lib/prisma";
import { aggregate, campaignOf, landingOf, sourceOf, type AcquisitionQuote } from "@/domain/acquisition";

export interface Period { from: Date | null; to: Date | null }

/** Lit une période « du … au … » (dates incluses, heure de Paris du serveur) depuis les paramètres de l'URL. */
export function periodFrom(sp: Record<string, string | string[] | undefined>): Period & { fromInput: string; toInput: string } {
  const read = (k: string) => (typeof sp[k] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp[k] as string) ? (sp[k] as string) : "");
  const fromInput = read("du"), toInput = read("au");
  return { fromInput, toInput, from: fromInput ? new Date(`${fromInput}T00:00:00`) : null, to: toInput ? new Date(`${toInput}T23:59:59.999`) : null };
}

/** Demandes de devis et de contact enregistrées côté serveur sur la période, agrégées par origine. */
export async function acquisitionReport(p: Period) {
  const createdAt = { ...(p.from ? { gte: p.from } : {}), ...(p.to ? { lte: p.to } : {}) };
  const [quotes, contacts] = await Promise.all([
    prisma.quote.findMany({ where: { createdAt }, select: { attribution: true, qualification: true, status: true, cashedNetCents: true } }),
    prisma.contactRequest.findMany({ where: { createdAt }, select: { attribution: true } }),
  ]);
  const qs: AcquisitionQuote[] = quotes;
  const contactsBySource = new Map<string, number>();
  for (const c of contacts) contactsBySource.set(sourceOf(c.attribution), (contactsBySource.get(sourceOf(c.attribution)) ?? 0) + 1);
  return {
    total: aggregate(qs, () => "Total")[0] ?? null,
    bySource: aggregate(qs, (q) => sourceOf(q.attribution)),
    byCampaign: aggregate(qs, (q) => campaignOf(q.attribution)),
    byLanding: aggregate(qs, (q) => landingOf(q.attribution)),
    contacts: contacts.length,
    contactsBySource: [...contactsBySource.entries()].sort((a, b) => b[1] - a[1]),
  };
}
