import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { launchBlockers } from "@/server/admin/launch";
import { Price } from "@/components/ui/price";
import { ORDER_STATUS_FR } from "@/components/account/order-detail";
import { PageTitle, QUOTE_STATUS_FR, Section, Table, fmtDate } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function AdminDashboard() {
  await requireRole(["ADMIN", "MANAGER"]);
  const [paid, pending, newQuotes, newContacts, failedEmails, orders, quotes, blockers] = await Promise.all([
    prisma.order.count({ where: { status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } } }),
    prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.quote.count({ where: { status: "NEW" } }),
    prisma.contactRequest.count({ where: { status: "NEW" } }),
    prisma.emailOutbox.count({ where: { status: { in: ["FAILED", "DEAD"] } } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, number: true, status: true, totalCents: true, createdAt: true, isDemo: true } }),
    prisma.quote.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, number: true, status: true, kind: true, createdAt: true } }),
    launchBlockers(),
  ]);
  const counters = [
    { label: "Commandes payées", value: paid, href: "/admin/commandes?statut=PAID" },
    { label: "Commandes en attente de paiement", value: pending, href: "/admin/commandes?statut=PENDING_PAYMENT" },
    { label: "Devis nouveaux", value: newQuotes, href: "/admin/devis?statut=NEW" },
    { label: "Contacts non traités", value: newContacts, href: "/admin/contacts" },
    { label: "E-mails en échec", value: failedEmails, href: "/admin/emails?statut=FAILED" },
  ];
  return (
    <div className="space-y-6">
      <PageTitle title="Tableau de bord" />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {counters.map((c) => (
          <li key={c.label}>
            <Link href={c.href} className="block rounded-lg border border-sand-200 bg-white px-4 py-3 hover:border-stone-700">
              <span className="block text-2xl font-semibold tabular-nums">{c.value}</span>
              <span className="text-sm text-stone-700">{c.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Section title={`Blocages de lancement (${blockers.length})`}>
        {blockers.length === 0 ? <p className="text-sm text-success">Aucun blocage détecté.</p> : (
          <ul className="divide-y divide-sand-200 text-sm">
            {blockers.map((b, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><span className="mr-2 inline-block w-24 text-xs uppercase tracking-wide text-stone-700">{b.area}</span>{b.message}</span>
                <Link href={b.href} className="underline">Corriger</Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Dernières commandes">
          {orders.length === 0 ? <p className="text-sm text-stone-700">Aucune commande.</p> : (
            <Table caption="Dernières commandes"><thead><tr><th>Numéro</th><th>Date</th><th>Statut</th><th className="text-right">Total</th></tr></thead><tbody>
              {orders.map((o) => <tr key={o.id}><td><Link className="underline font-mono" href={`/admin/commandes/${o.id}`}>{o.number}</Link>{o.isDemo && <span className="ml-1 text-xs text-warning">démo</span>}</td><td>{fmtDate(o.createdAt)}</td><td>{ORDER_STATUS_FR[o.status] ?? o.status}</td><td className="text-right"><Price cents={o.totalCents} /></td></tr>)}
            </tbody></Table>
          )}
          <Link href="/admin/commandes" className="mt-3 inline-block text-sm underline">Toutes les commandes</Link>
        </Section>
        <Section title="Derniers devis">
          {quotes.length === 0 ? <p className="text-sm text-stone-700">Aucun devis.</p> : (
            <Table caption="Derniers devis"><thead><tr><th>Numéro</th><th>Date</th><th>Type</th><th>Statut</th></tr></thead><tbody>
              {quotes.map((q) => <tr key={q.id}><td><Link className="underline font-mono" href={`/admin/devis/${q.id}`}>{q.number}</Link></td><td>{fmtDate(q.createdAt)}</td><td>{q.kind}</td><td>{QUOTE_STATUS_FR[q.status] ?? q.status}</td></tr>)}
            </tbody></Table>
          )}
          <Link href="/admin/devis" className="mt-3 inline-block text-sm underline">Tous les devis</Link>
        </Section>
      </div>
    </div>
  );
}
