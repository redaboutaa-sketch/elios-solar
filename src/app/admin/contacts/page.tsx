import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Pagination, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { setContactStatusAction } from "@/server/actions/admin/contacts";

export const metadata: Metadata = { title: "Contacts" };
const PER_PAGE = 50;

export default async function ContactsPage(props: PageProps<"/admin/contacts">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const tous = sp.tous === "1";
  const page = Math.max(1, Number(sp.page) || 1);
  const where = tous ? {} : { status: "NEW" };
  const [total, items] = await Promise.all([
    prisma.contactRequest.count({ where }),
    prisma.contactRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
  ]);
  return (
    <div>
      <PageTitle title="Demandes de contact">
        <Link className="text-sm underline" href={tous ? "/admin/contacts" : "/admin/contacts?tous=1"}>{tous ? "Afficher les non traitées" : "Afficher toutes les demandes"}</Link>
      </PageTitle>
      <Flash searchParams={props.searchParams} />
      <p className="mb-2 text-sm text-stone-700">{total} demande(s){tous ? "" : " non traitée(s)"}</p>
      <Table caption="Demandes de contact">
        <thead><tr><th>Date</th><th>Type</th><th>Contact</th><th>Message</th><th>Statut</th><th><span className="sr-only">Action</span></th></tr></thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td className="whitespace-nowrap">{fmtDate(c.createdAt)}</td>
              <td>{c.kind}</td>
              <td>{c.name}<span className="block text-xs break-all">{c.email}</span>{c.phone && <span className="block text-xs">{c.phone}</span>}</td>
              <td className="max-w-md whitespace-pre-wrap">{c.message ?? "—"}{c.preferredSlot && <span className="block text-xs text-stone-700">Créneau : {c.preferredSlot}</span>}</td>
              <td>{c.status === "HANDLED" ? <StatusBadge tone="ok">Traitée</StatusBadge> : <StatusBadge tone="warn">Nouvelle</StatusBadge>}</td>
              <td>
                <form action={setContactStatusAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="status" value={c.status === "HANDLED" ? "NEW" : "HANDLED"} />
                  <button className="btn-secondary py-1.5 min-h-0" type="submit">{c.status === "HANDLED" ? "Rouvrir" : "Traité"}</button>
                </form>
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={6} className="text-stone-700">Aucune demande.</td></tr>}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/admin/contacts?${new URLSearchParams({ ...(tous ? { tous: "1" } : {}), page: String(p) })}`} />
    </div>
  );
}
