import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Section, StatusBadge, fmtDate } from "@/components/admin/ui";
import { assignConversationAction, replyConversationAction, setConversationStatusAction } from "@/server/actions/admin/conversations";
import { MESSAGE_MAX_LENGTH, markAdvisorRead, type ChatMessageMeta } from "@/server/chat/service";
import { AUTHOR_FR, CONVERSATION_STATUS_FR } from "../labels";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage(props: PageProps<"/admin/conversations/[id]">) {
  const { session } = await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await props.params;
  const c = await prisma.conversation.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!c) notFound();
  await markAdvisorRead(c.id);
  const userIds = [...new Set([c.assignedUserId, ...c.messages.map((m) => m.authorUserId)].filter((x): x is string => !!x))];
  const [users, configuration, quote, order] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
    c.configurationId ? prisma.configuration.findUnique({ where: { id: c.configurationId }, select: { id: true, title: true, shareToken: true, shareRevoked: true, version: true } }) : null,
    c.quoteId ? prisma.quote.findUnique({ where: { id: c.quoteId }, select: { id: true, number: true } }) : null,
    c.orderId ? prisma.order.findUnique({ where: { id: c.orderId }, select: { id: true, number: true } }) : null,
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const mine = c.assignedUserId === session.user.id;
  return (
    <div className="space-y-6">
      <PageTitle title={c.subject || "Conversation"} backHref="/admin/conversations" backLabel="Conversations">
        <StatusBadge tone={c.status === "OPEN" ? "warn" : c.status === "CLOSED" ? "neutral" : "ok"}>{CONVERSATION_STATUS_FR[c.status]}</StatusBadge>
      </PageTitle>
      <Flash searchParams={props.searchParams} />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Section title="Fil de discussion">
          <ol className="space-y-3 text-sm" aria-label="Messages">
            {c.messages.map((m) => {
              const meta = (m.meta as ChatMessageMeta | null) ?? {};
              const internal = Boolean(meta.internal);
              const tone = internal ? "border-warning/40 bg-warning/5" : m.author === "CUSTOMER" ? "border-sand-300 bg-white" : m.author === "SYSTEM" ? "border-dashed border-sand-300 bg-sand-50" : "border-sand-200 bg-sand-100";
              return (
                <li key={m.id} className={`rounded-lg border p-3 ${tone}`}>
                  <p className="text-xs text-stone-700">
                    {internal ? "Note interne" : AUTHOR_FR[m.author]}{m.authorUserId && m.author !== "CUSTOMER" ? ` · ${nameOf.get(m.authorUserId) ?? "—"}` : ""} · {fmtDate(m.createdAt)}
                    {meta.kind === "handover" && <span className="ml-2 badge-warn">transmission demandée</span>}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
                  {m.author === "ASSISTANT" && <p className="mt-1 text-xs italic text-stone-700">Réponse automatique indicative{meta.model ? ` (${meta.model})` : ""}.</p>}
                </li>
              );
            })}
            {c.messages.length === 0 && <li className="text-stone-700">Aucun message.</li>}
          </ol>
          <form action={replyConversationAction} className="mt-5 space-y-3">
            <input type="hidden" name="id" value={c.id} />
            <div>
              <label className="label" htmlFor="body">Réponse</label>
              <textarea id="body" name="body" className="input" rows={4} maxLength={MESSAGE_MAX_LENGTH} required />
              <p className="mt-1 text-xs text-stone-700">{c.offline || c.email ? (c.offline ? "Message hors ligne : la réponse est envoyée par e-mail au client." : "Le client est averti par e-mail s'il n'est plus actif depuis 10 minutes.") : "Aucun e-mail connu : la réponse n'est visible que dans le widget."}</p>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="internal" className="h-4 w-4" /> Note interne (invisible pour le client, aucun e-mail)</label>
            <button className="btn-primary" type="submit">Envoyer</button>
          </form>
        </Section>
        <div className="space-y-6 self-start">
          <Section title="Client">
            <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-stone-700">Nom</dt><dd>{c.name ?? "—"}</dd>
              <dt className="text-stone-700">E-mail</dt><dd className="break-all">{c.email ?? "—"}</dd>
              <dt className="text-stone-700">Compte</dt><dd>{c.userId ? "Client connecté" : "Visiteur invité"}</dd>
              <dt className="text-stone-700">Mode</dt><dd>{c.offline ? "Hors ligne (réponse par e-mail)" : "Direct"}</dd>
              <dt className="text-stone-700">Consentement</dt><dd>{c.consentPrivacy ? "Accepté" : "—"}</dd>
              <dt className="text-stone-700">Ouverte le</dt><dd>{fmtDate(c.createdAt)}</dd>
              <dt className="text-stone-700">Lu par le client</dt><dd>{fmtDate(c.lastCustomerReadAt)}</dd>
            </dl>
          </Section>
          <Section title="Liens" className="scroll-mt-4">
            <ul id="liens" className="space-y-1 text-sm">
              <li>Configuration : {configuration ? (configuration.shareRevoked ? `${configuration.title ?? "Projet"} (lien révoqué)` : <a className="underline" href={`/projets/${configuration.shareToken}`} target="_blank" rel="noreferrer">{configuration.title ?? "Projet"} v{configuration.version}</a>) : "—"}</li>
              <li>Devis : {quote ? <Link className="underline" href={`/admin/devis/${quote.id}`}>{quote.number}</Link> : "—"}</li>
              <li>Commande : {order ? <Link className="underline" href={`/admin/commandes/${order.id}`}>{order.number}</Link> : "—"}</li>
            </ul>
          </Section>
          <Section title="Traitement">
            <p className="mb-3 text-sm">Assignée à : {c.assignedUserId ? nameOf.get(c.assignedUserId) ?? "—" : "personne"}</p>
            <form action={assignConversationAction} className="mb-4">
              <input type="hidden" name="id" value={c.id} />
              {mine ? <><input type="hidden" name="unassign" value="on" /><button className="btn-secondary" type="submit">Me désassigner</button></> : <button className="btn-secondary" type="submit">M'assigner</button>}
            </form>
            <form action={setConversationStatusAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={c.id} />
              <div>
                <label className="label" htmlFor="status">Statut</label>
                <select id="status" name="status" className="input" defaultValue={c.status}>
                  {Object.entries(CONVERSATION_STATUS_FR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <button className="btn-secondary" type="submit">Changer</button>
            </form>
          </Section>
        </div>
      </div>
    </div>
  );
}
