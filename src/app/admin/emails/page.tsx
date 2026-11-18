import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { OutboxStatus } from "@/generated/prisma/enums";
import { maskEmail } from "@/server/admin/form";
import { Flash, OUTBOX_FR, Options, PageTitle, Pagination, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { processOutboxAction, retryEmailAction, abandonEmailAction } from "@/server/actions/admin/emails";
import { mailDeliveryReal, mailSendAfter } from "@/server/mail/transport";

export const metadata: Metadata = { title: "E-mails" };
const PER_PAGE = 50;

export default async function EmailsPage(props: PageProps<"/admin/emails">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const statut = typeof sp.statut === "string" && sp.statut in OutboxStatus ? (sp.statut as OutboxStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const sendAfter = mailSendAfter();
  const where = statut === "FAILED" ? { status: { in: ["FAILED", "DEAD"] as OutboxStatus[] } } : statut ? { status: statut } : {};
  const [total, items, counts] = await Promise.all([
    prisma.emailOutbox.count({ where }),
    prisma.emailOutbox.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, select: { id: true, toEmail: true, subject: true, template: true, status: true, attempts: true, lastError: true, nextAttemptAt: true, sentAt: true, createdAt: true } }),
    prisma.emailOutbox.groupBy({ by: ["status"], _count: true }),
  ]);
  return (
    <div>
      <PageTitle title="File d'envoi des e-mails">
        <form action={processOutboxAction}><button className="btn-primary" type="submit">Traiter la file maintenant</button></form>
      </PageTitle>
      <Flash searchParams={props.searchParams} />
      <p className="mb-3 text-sm text-stone-700">{counts.map((c) => `${OUTBOX_FR[c.status]} : ${c._count}`).join(" · ") || "File vide."} — Fournisseur : {process.env.MAIL_PROVIDER ?? "log"}.</p>
      {!mailDeliveryReal() && <p className="mb-3 text-sm text-stone-700" data-testid="mail-hold-note">Aucun SMTP raccordé : rien n'est envoyé. Les nouvelles demandes se suivent dans Devis, Contacts et Conversations ; répondez directement aux prospects.</p>}
      {sendAfter && <p className="mb-3 text-sm text-stone-700" data-testid="mail-send-after">Messages créés avant le {fmtDate(sendAfter)} : jamais envoyés automatiquement ; « Réessayer » en libère un, « Abandonner » l'écarte.</p>}
      <form method="get" className="mb-4 flex items-end gap-3">
        <div><label className="label" htmlFor="statut">Statut</label><select id="statut" name="statut" className="input" defaultValue={statut ?? ""}><Options values={Object.values(OutboxStatus)} labels={{ ...OUTBOX_FR, FAILED: "Échec ou abandonné" }} includeEmpty="Tous" /></select></div>
        <button className="btn-secondary" type="submit">Filtrer</button>
      </form>
      <Table caption="E-mails">
        <thead><tr><th>Créé</th><th>Destinataire</th><th>Objet / modèle</th><th>Statut</th><th className="text-right">Tentatives</th><th>Erreur</th><th><span className="sr-only">Action</span></th></tr></thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap">{fmtDate(m.createdAt)}</td>
              <td className="font-mono text-xs">{maskEmail(m.toEmail)}</td>
              <td>{m.subject}<span className="block font-mono text-xs text-stone-700">{m.template}</span></td>
              <td>
                <StatusBadge tone={m.status === "SENT" ? "ok" : m.status === "PENDING" ? "neutral" : "err"}>{OUTBOX_FR[m.status]}</StatusBadge>
                <span className="block text-xs text-stone-700">{m.status === "SENT" ? `le ${fmtDate(m.sentAt)}` : `prochain essai ${fmtDate(m.nextAttemptAt)}`}</span>
              </td>
              <td className="text-right">{m.attempts}</td>
              <td className="max-w-xs break-words text-xs text-danger">{m.lastError ?? ""}</td>
              <td>{m.status !== "SENT" && <div className="flex flex-col gap-1"><form action={retryEmailAction}><input type="hidden" name="id" value={m.id} /><button className="btn-secondary py-1 min-h-0" type="submit">Réessayer</button></form>{m.status !== "DEAD" && <form action={abandonEmailAction}><input type="hidden" name="id" value={m.id} /><button className="btn-ghost py-1 min-h-0 text-xs" type="submit">Abandonner</button></form>}</div>}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={7} className="text-stone-700">Aucun e-mail.</td></tr>}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/admin/emails?${new URLSearchParams({ ...(statut ? { statut } : {}), page: String(p) })}`} />
    </div>
  );
}
