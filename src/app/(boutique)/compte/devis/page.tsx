import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AccountNav } from "@/components/account/account-nav";
import { Price } from "@/components/ui/price";
export const metadata: Metadata = { title: "Mes devis", robots: { index: false } };
const STATUS: Record<string, string> = { NEW: "Reçue", IN_REVIEW: "En cours d'étude", SENT: "Devis envoyé", ACCEPTED: "Acceptée", DECLINED: "Refusée", EXPIRED: "Expirée" };
export default async function Page() {
  const session = await requireUser("/compte/devis");
  const quotes = await prisma.quote.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="container-x py-8"><h1 className="font-display text-4xl">Mes demandes de devis</h1><div className="mt-4"><AccountNav current="/compte/devis" /></div>
      {quotes.length === 0 ? <p className="mt-8 card p-8 text-center">Aucune demande de devis.</p> : <ul className="mt-8 space-y-3">{quotes.map((q) => <li key={q.id} className="card p-4 flex flex-wrap justify-between gap-2"><span><strong>{q.number}</strong> · {q.createdAt.toLocaleDateString("fr-FR")} · {q.kind}</span><span>{STATUS[q.status]}{q.proposedTotalCents != null && <> · <Price cents={q.proposedTotalCents} /></>}{q.validUntil && ` · valable jusqu'au ${q.validUntil.toLocaleDateString("fr-FR")}`}</span></li>)}</ul>}
    </div>
  );
}
