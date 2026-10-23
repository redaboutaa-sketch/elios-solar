import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Pagination, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { advisorsOnline, unreadForAdvisorsWhere } from "@/server/chat/service";
import { CONVERSATION_STATUS_FR } from "./labels";

export const metadata: Metadata = { title: "Conversations" };
const PER_PAGE = 50;

export default async function ConversationsPage(props: PageProps<"/admin/conversations">) {
  const { session } = await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const statut = typeof sp.statut === "string" && ["OPEN", "WAITING_CUSTOMER", "CLOSED", "ALL"].includes(sp.statut) ? sp.statut : "ACTIVE";
  const filtre = typeof sp.filtre === "string" ? sp.filtre : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const and: Prisma.ConversationWhereInput[] = [];
  if (statut === "ACTIVE") and.push({ status: { not: "CLOSED" } });
  else if (statut !== "ALL") and.push({ status: statut as "OPEN" | "WAITING_CUSTOMER" | "CLOSED" });
  if (filtre === "non-lues") and.push(unreadForAdvisorsWhere());
  if (filtre === "moi") and.push({ assignedUserId: session.user.id });
  if (filtre === "non-assignees") and.push({ assignedUserId: null });
  const where: Prisma.ConversationWhereInput = and.length ? { AND: and } : {};
  const [total, items, online, unread] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({ where, orderBy: { lastMessageAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { author: true, body: true } } } }),
    advisorsOnline(),
    prisma.conversation.count({ where: unreadForAdvisorsWhere() }),
  ]);
  const assignees = await prisma.user.findMany({ where: { id: { in: items.map((i) => i.assignedUserId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const nameOf = new Map(assignees.map((u) => [u.id, u.name]));
  const href = (over: Record<string, string>) => `/admin/conversations?${new URLSearchParams({ ...(statut !== "ACTIVE" ? { statut } : {}), ...(filtre ? { filtre } : {}), ...over })}`;
  const chips: Array<[string, string, Record<string, string>]> = [
    ["Actives", statut === "ACTIVE" && !filtre ? "1" : "", { statut: "ACTIVE", filtre: "" }],
    [`Non lues (${unread})`, filtre === "non-lues" ? "1" : "", { filtre: "non-lues" }],
    ["Assignées à moi", filtre === "moi" ? "1" : "", { filtre: "moi" }],
    ["Non assignées", filtre === "non-assignees" ? "1" : "", { filtre: "non-assignees" }],
    ["En attente client", statut === "WAITING_CUSTOMER" ? "1" : "", { statut: "WAITING_CUSTOMER", filtre: "" }],
    ["Fermées", statut === "CLOSED" ? "1" : "", { statut: "CLOSED", filtre: "" }],
    ["Toutes", statut === "ALL" ? "1" : "", { statut: "ALL", filtre: "" }],
  ];
  return (
    <div>
      <PageTitle title="Conversations">
        <p className="text-sm text-stone-700">{online ? "Présence affichée aux visiteurs : un conseiller est disponible." : "Présence affichée aux visiteurs : hors ligne (messages différés par e-mail)."}</p>
      </PageTitle>
      <Flash searchParams={props.searchParams} />
      <nav aria-label="Filtres" className="mb-4 flex flex-wrap gap-2 text-sm">
        {chips.map(([label, active, over]) => {
          const params = new URLSearchParams(Object.entries(over).filter(([, v]) => v && v !== "ACTIVE"));
          return <Link key={label} href={`/admin/conversations${params.size ? `?${params}` : ""}`} aria-current={active ? "page" : undefined} className={`rounded-full px-3 py-1.5 ${active ? "bg-anthracite text-sand-50" : "border border-sand-300 bg-white"}`}>{label}</Link>;
        })}
      </nav>
      <p className="mb-2 text-sm text-stone-700">{total} conversation(s)</p>
      <Table caption="Conversations">
        <thead><tr><th>Dernier message</th><th>Client</th><th>Aperçu</th><th>Statut</th><th>Assignée</th><th>Liens</th></tr></thead>
        <tbody>
          {items.map((c) => {
            const isUnread = c.status !== "CLOSED" && (!c.lastAdvisorReadAt || c.lastAdvisorReadAt < c.lastMessageAt);
            const last = c.messages[0];
            return (
              <tr key={c.id} className={isUnread ? "bg-brand-100/40" : undefined}>
                <td className="whitespace-nowrap">{fmtDate(c.lastMessageAt)}{isUnread && <span className="ml-1 badge-warn">non lue</span>}</td>
                <td><Link className="underline" href={`/admin/conversations/${c.id}`}>{c.name ?? (c.userId ? "Client connecté" : "Visiteur")}</Link>{c.email && <span className="block text-xs break-all">{c.email}</span>}{c.offline && <span className="block text-xs text-warning">hors ligne · réponse par e-mail</span>}</td>
                <td className="max-w-sm"><span className="line-clamp-2">{last ? `${last.author === "CUSTOMER" ? "" : `[${last.author === "ADVISOR" ? "Conseiller" : last.author === "ASSISTANT" ? "Assistant" : "Système"}] `}${last.body}` : "—"}</span></td>
                <td><StatusBadge tone={c.status === "OPEN" ? "warn" : c.status === "CLOSED" ? "neutral" : "ok"}>{CONVERSATION_STATUS_FR[c.status]}</StatusBadge></td>
                <td>{c.assignedUserId ? nameOf.get(c.assignedUserId) ?? "—" : "—"}</td>
                <td className="space-x-2 text-xs">
                  {c.configurationId && <Link className="underline" href={`/admin/conversations/${c.id}#liens`}>configuration</Link>}
                  {c.quoteId && <Link className="underline" href={`/admin/devis/${c.quoteId}`}>devis</Link>}
                  {c.orderId && <Link className="underline" href={`/admin/commandes/${c.orderId}`}>commande</Link>}
                </td>
              </tr>
            );
          })}
          {items.length === 0 && <tr><td colSpan={6} className="text-stone-700">Aucune conversation.</td></tr>}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(p) => href({ page: String(p) })} />
    </div>
  );
}
