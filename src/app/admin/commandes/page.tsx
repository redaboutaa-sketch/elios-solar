import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";
import { Price } from "@/components/ui/price";
import { FULFILLMENT_FR, ORDER_STATUS_FR } from "@/components/account/order-detail";
import { Flash, Options, PageTitle, Pagination, Table, fmtDate } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Commandes" };
const PER_PAGE = 50;

export default async function OrdersPage(props: PageProps<"/admin/commandes">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const statut = typeof sp.statut === "string" && sp.statut in OrderStatus ? (sp.statut as OrderStatus) : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.OrderWhereInput = {
    ...(statut ? { status: statut } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, select: { id: true, number: true, email: true, status: true, fulfillmentStatus: true, totalCents: true, createdAt: true, isDemo: true } }),
  ]);
  const qs = (p: number) => `/admin/commandes?${new URLSearchParams({ ...(statut ? { statut } : {}), ...(q ? { q } : {}), page: String(p) })}`;
  return (
    <div>
      <PageTitle title="Commandes" />
      <Flash searchParams={props.searchParams} />
      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <div><label className="label" htmlFor="statut">Statut</label><select id="statut" name="statut" className="input" defaultValue={statut ?? ""}><Options values={Object.values(OrderStatus)} labels={ORDER_STATUS_FR} includeEmpty="Tous" /></select></div>
        <div className="grow sm:grow-0 sm:w-72"><label className="label" htmlFor="q">Numéro ou e-mail</label><input id="q" name="q" className="input" defaultValue={q} /></div>
        <button className="btn-secondary" type="submit">Filtrer</button>
      </form>
      <p className="mb-2 text-sm text-stone-700">{total} commande(s)</p>
      <Table caption="Liste des commandes">
        <thead><tr><th>Numéro</th><th>Date</th><th>Client</th><th>Paiement</th><th>Logistique</th><th className="text-right">Total</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td><Link href={`/admin/commandes/${o.id}`} className="font-mono underline">{o.number}</Link>{o.isDemo && <span className="ml-1 text-xs text-warning">démo</span>}</td>
              <td>{fmtDate(o.createdAt)}</td>
              <td className="break-all">{o.email}</td>
              <td>{ORDER_STATUS_FR[o.status] ?? o.status}</td>
              <td>{FULFILLMENT_FR[o.fulfillmentStatus] ?? o.fulfillmentStatus}</td>
              <td className="text-right"><Price cents={o.totalCents} /></td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={6} className="text-stone-700">Aucune commande.</td></tr>}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={qs} />
    </div>
  );
}
