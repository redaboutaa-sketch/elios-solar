import { formatSystemPrice } from "@/domain/system-pricing";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AccountNav } from "@/components/account/account-nav";
import { Price } from "@/components/ui/price";
import { QuoteVisualCard } from "@/components/quote/quote-visual-card";
export const metadata: Metadata = { title: "Mes devis", robots: { index: false } };
const KIND_FR: Record<string, string> = { configuration: "configuration", custom: "sur mesure (ancien catalogue)", accessory: "accessoire", general: "demande générale", system: "configuration" };
const STATUS: Record<string, string> = { NEW: "Reçue", IN_REVIEW: "En cours d'étude", SENT: "Devis envoyé", ACCEPTED: "Acceptée", DECLINED: "Refusée", EXPIRED: "Expirée" };
export default async function Page() {
  const session = await requireUser("/compte/devis");
  const quotes = await prisma.quote.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, include: { visuals: { orderBy: { createdAt: "asc" }, take: 1 } } });
  return (
    <div className="container-x py-8"><h1 className="font-display text-4xl">Mes demandes de devis</h1><div className="mt-4"><AccountNav current="/compte/devis" /></div>
      {quotes.length === 0 ? <p className="mt-8 card p-8 text-center">Aucune demande de devis.</p> : <ul className="mt-8 space-y-3">{quotes.map((q) => (
        <li key={q.id} data-testid="account-quote" className="card p-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-2"><span><strong>{q.number}</strong> · {q.createdAt.toLocaleDateString("fr-FR")} · {(() => { const r = (q.snapshot as { result?: { priceMode?: string; recap?: Array<{ label: string; value: string }>; systemPrice?: { amountMinor: number; currency: string; taxBasis?: "HT" | "TTC" | null } | null } } | null)?.result; return r?.priceMode === "quote" ? `${r.recap?.find((x) => x.label === "Produit")?.value ?? "Configuration"} · ${r.systemPrice ? `structure ${formatSystemPrice(r.systemPrice.amountMinor, r.systemPrice.currency, r.systemPrice.taxBasis)}` : "prix sur devis"}` : KIND_FR[q.kind] ?? q.kind; })()}</span><span>{STATUS[q.status]}{q.proposedTotalCents != null && <> · <Price cents={q.proposedTotalCents} /></>}{q.validUntil && ` · valable jusqu'au ${q.validUntil.toLocaleDateString("fr-FR")}`}</span></div>
          {(q.snapshot as { input?: unknown } | null)?.input ? (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,22rem)_1fr] items-start">
              <QuoteVisualCard quoteId={q.id} visual={q.visuals[0]} />
              <p><a className="underline" href={`/api/devis/${q.id}/pdf`} target="_blank" rel="noopener">Télécharger le PDF du devis</a></p>
            </div>
          ) : null}
        </li>
      ))}</ul>}
    </div>
  );
}
