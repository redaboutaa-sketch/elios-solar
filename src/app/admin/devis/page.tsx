import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
import { QuoteStatus } from "@/generated/prisma/enums";
import { Price } from "@/components/ui/price";
import { Flash, Options, PageTitle, Pagination, QUOTE_STATUS_FR, Table, fmtDate } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Devis" };
const PER_PAGE = 50;

export default async function QuotesPage(props: PageProps<"/admin/devis">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const statut = typeof sp.statut === "string" && sp.statut in QuoteStatus ? (sp.statut as QuoteStatus) : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.QuoteWhereInput = {
    ...(statut ? { status: statut } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [total, quotes] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.quote.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, select: { id: true, number: true, email: true, firstName: true, lastName: true, kind: true, status: true, proposedTotalCents: true, createdAt: true, postalCode: true } }),
  ]);
  return (
    <div>
      <PageTitle title="Devis" />
      <Flash searchParams={props.searchParams} />
      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <div><label className="label" htmlFor="statut">Statut</label><select id="statut" name="statut" className="input" defaultValue={statut ?? ""}><Options values={Object.values(QuoteStatus)} labels={QUOTE_STATUS_FR} includeEmpty="Tous" /></select></div>
        <div className="sm:w-72"><label className="label" htmlFor="q">Numéro, nom ou e-mail</label><input id="q" name="q" className="input" defaultValue={q} /></div>
        <button className="btn-secondary" type="submit">Filtrer</button>
      </form>
      <p className="mb-2 text-sm text-stone-700">{total} devis</p>
      <Table caption="Liste des devis">
        <thead><tr><th>Numéro</th><th>Date</th><th>Client</th><th>Type</th><th>CP</th><th>Statut</th><th className="text-right">Proposé</th></tr></thead>
        <tbody>
          {quotes.map((x) => (
            <tr key={x.id}>
              <td><Link className="font-mono underline" href={`/admin/devis/${x.id}`}>{x.number}</Link></td>
              <td>{fmtDate(x.createdAt)}</td>
              <td>{x.firstName} {x.lastName}<span className="block text-xs text-stone-700 break-all">{x.email}</span></td>
              <td>{x.kind}</td><td>{x.postalCode ?? "—"}</td>
              <td>{QUOTE_STATUS_FR[x.status] ?? x.status}</td>
              <td className="text-right">{x.proposedTotalCents != null ? <Price cents={x.proposedTotalCents} /> : "—"}</td>
            </tr>
          ))}
          {quotes.length === 0 && <tr><td colSpan={7} className="text-stone-700">Aucun devis.</td></tr>}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/admin/devis?${new URLSearchParams({ ...(statut ? { statut } : {}), ...(q ? { q } : {}), page: String(p) })}`} />
    </div>
  );
}
