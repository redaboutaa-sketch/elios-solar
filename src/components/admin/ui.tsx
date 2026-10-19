import Link from "next/link";
import { Notice } from "@/components/ui/alert";

/** Message de retour après une action (paramètres ?ok= / ?err=). */
export async function Flash({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const err = typeof sp.err === "string" ? sp.err : null;
  if (!ok && !err) return null;
  return <div className="mb-4">{err ? <Notice tone="error">{err}</Notice> : <Notice tone="success">{ok}</Notice>}</div>;
}

export function PageTitle({ title, children, backHref, backLabel }: { title: string; children?: React.ReactNode; backHref?: string; backLabel?: string }) {
  return (
    <div className="mb-6">
      {backHref && <Link href={backHref} className="text-sm text-stone-700 hover:underline">← {backLabel ?? "Retour"}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function Section({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card min-w-0 p-5 ${className}`}>
      {title && <h2 className="mb-3 font-display text-xl">{title}</h2>}
      {children}
    </section>
  );
}

export function Table({ children, caption }: { children: React.ReactNode; caption?: string }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm [&_th]:px-2 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-stone-700 [&_td]:px-2 [&_td]:py-2 [&_td]:align-top [&_tbody_tr]:border-t [&_tbody_tr]:border-sand-200">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function StatusBadge({ tone, children }: { tone: "ok" | "warn" | "err" | "neutral" | "demo"; children: React.ReactNode }) {
  const cls = { ok: "badge-ok", warn: "badge-warn", err: "badge-err", demo: "badge-demo", neutral: "badge bg-sand-100 text-stone-800 border border-sand-300" }[tone];
  return <span className={cls}>{children}</span>;
}

export function DataStatusBadge({ status }: { status: string }) {
  const tone = status === "SUPPLIER_VERIFIED" ? "ok" : status === "DEMO" ? "demo" : status === "OBSERVED" ? "neutral" : "warn";
  return <StatusBadge tone={tone}>{DATA_STATUS_FR[status] ?? status}</StatusBadge>;
}

export const DATA_STATUS_FR: Record<string, string> = { DEMO: "Démo", SUPPLIER_VERIFIED: "Vérifié fournisseur", OBSERVED: "Observé", UNKNOWN: "Inconnu" };
export const FAMILY_STATUS_FR: Record<string, string> = { DRAFT: "Brouillon", PUBLISHED: "Publiée", QUOTE_ONLY: "Sur devis", ARCHIVED: "Archivée" };
export const QUOTE_STATUS_FR: Record<string, string> = { NEW: "Nouveau", IN_REVIEW: "En étude", SENT: "Envoyé", ACCEPTED: "Accepté", DECLINED: "Refusé", EXPIRED: "Expiré" };
export const COMPAT_FR: Record<string, string> = { ALLOWED: "Autorisé", FORBIDDEN: "Interdit", UNKNOWN: "Inconnu" };
export const OUTBOX_FR: Record<string, string> = { PENDING: "En attente", SENT: "Envoyé", FAILED: "Échec (reprise)", DEAD: "Abandonné" };
export const ROLE_FR: Record<string, string> = { CUSTOMER: "Client", MANAGER: "Gestionnaire", ADMIN: "Administrateur" };

export function Options({ values, labels, includeEmpty }: { values: readonly string[]; labels?: Record<string, string>; includeEmpty?: string }) {
  return (
    <>
      {includeEmpty !== undefined && <option value="">{includeEmpty}</option>}
      {values.map((v) => <option key={v} value={v}>{labels?.[v] ?? v}</option>)}
    </>
  );
}

export function fmtDate(d: Date | null | undefined, withTime = true): string {
  if (!d) return "—";
  return withTime ? d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : d.toLocaleDateString("fr-FR");
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center gap-3 text-sm">
      {page > 1 ? <Link className="btn-secondary py-1.5 min-h-0" href={hrefFor(page - 1)}>Page précédente</Link> : null}
      <span>Page {page} / {pages}</span>
      {page < pages ? <Link className="btn-secondary py-1.5 min-h-0" href={hrefFor(page + 1)}>Page suivante</Link> : null}
    </nav>
  );
}
