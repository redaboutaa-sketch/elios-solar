import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { DataStatusBadge, Flash, PageTitle, Section, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { ProposalFields, SourceFields, ValidationStatusBadge, fmtValue } from "@/components/admin/validation-fields";
import { transitionValidationAction, updateValidationAction } from "@/server/actions/admin/validations";
import { FIELD_FR, SOURCE_KIND_FR, TARGET_FR, VALIDATION_STATUS_FR, nextStatuses, resultingDataStatus, shortHash } from "@/server/validation/core";
import { getDossier } from "@/server/validation/service";
import { SPEC_SOURCE_FR, formatSpecValue } from "@/domain/technical-spec";

export const metadata: Metadata = { title: "Dossier de validation" };

const ACTION_FR: Record<string, string> = { DRAFT: "Remettre en brouillon", TO_REVIEW: "Soumettre (à vérifier)", VALIDATED: "Valider cette version", REJECTED: "Rejeter" };

export default async function ValidationDetailPage(props: PageProps<"/admin/catalogue/validations/[id]">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await props.params;
  const d = await getDossier(id.slice(0, 64));
  if (!d) notFound();
  const v = d.validation;
  const base = v.baseData as Record<string, unknown>;
  const proposed = v.proposed as Record<string, unknown>;
  const current = (d.target?.data ?? base) as Record<string, unknown>;
  const outcome = resultingDataStatus(v.sourceKind);
  const documents = v.status === "DRAFT" ? await prisma.document.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: [{ title: "asc" }, { version: "desc" }], select: { id: true, title: true, version: true, status: true }, take: 200 }) : [];
  const shownFields = Object.keys(current).filter((k) => k !== "specs");
  return (
    <div className="space-y-6">
      <PageTitle title={v.targetLabel} backHref="/admin/catalogue/validations" backLabel="Dossiers"><ValidationStatusBadge status={v.status} /></PageTitle>
      <Flash searchParams={props.searchParams} />

      <Section>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-stone-700">Type</dt><dd>{TARGET_FR[v.targetType]}</dd></div>
          <div><dt className="text-stone-700">Version proposée (empreinte)</dt><dd className="font-mono" data-testid="base-hash">{shortHash(v.baseHash)}</dd></div>
          <div><dt className="text-stone-700">Version actuelle</dt><dd className="font-mono">{shortHash(d.target?.hash)} {d.stale && v.status !== "VALIDATED" ? <StatusBadge tone="warn">différente</StatusBadge> : null}</dd></div>
          <div><dt className="text-stone-700">Auteur</dt><dd>{v.createdBy?.email ?? "jeu de démonstration"} — {fmtDate(v.createdAt)}</dd></div>
          <div><dt className="text-stone-700">Décision</dt><dd>{v.decidedAt ? `${v.decidedBy?.email ?? "—"} — ${fmtDate(v.decidedAt)}` : "—"}</dd></div>
          {v.appliedHash && <div><dt className="text-stone-700">Version après validation</dt><dd className="font-mono">{shortHash(v.appliedHash)}</dd></div>}
        </dl>
        {v.decisionNote && <p className="mt-3 text-sm"><strong>Motif :</strong> {v.decisionNote}</p>}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Divergences">
          {d.divergences.length ? <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="divergences">{d.divergences.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="text-sm text-stone-700">Aucune divergence détectée.</p>}
        </Section>
        <Section title="Informations manquantes">
          {d.missing.length ? <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="missing">{d.missing.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="text-sm text-stone-700">Rien de manquant pour ce dossier.</p>}
        </Section>
      </div>

      {d.specCandidates.length > 0 && (
        <Section title="Valeurs connues par source">
          <Table caption="Valeurs par provenance">
            <thead><tr><th>Valeur</th><th>Provenance</th><th>Référence de la source</th><th>Relevée le</th></tr></thead>
            <tbody data-testid="spec-candidates">
              {d.specCandidates.map((s, i) => (
                <tr key={i}><td>{formatSpecValue(s)}</td><td><StatusBadge tone={s.source === "supplier_confirmed" ? "ok" : s.source === "demo_seed" ? "demo" : "neutral"}>{SPEC_SOURCE_FR[s.source]}</StatusBadge></td><td className="text-xs">{s.sourceRef || "—"}</td><td>{s.observedAt ?? "—"}</td></tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-stone-700">Seule une spécification fournisseur confirmée est affichée sur le site ; sinon : « à confirmer ».</p>
        </Section>
      )}

      <Section title="Données actuelles et données proposées">
        <Table caption="Comparaison">
          <thead><tr><th>Champ</th><th>{v.status === "VALIDATED" ? "Avant validation" : "Actuel"}</th><th>Proposé</th></tr></thead>
          <tbody data-testid="diff">
            {d.diff.length === 0 && <tr><td colSpan={3} className="text-stone-700">Aucune valeur proposée : le dossier confirme (ou non) les données actuelles telles quelles.</td></tr>}
            {d.diff.map((r) => <tr key={r.field} className={r.changed ? "bg-amber-50" : ""}><td>{FIELD_FR[r.field] ?? r.field}</td><td>{fmtValue(r.field, r.current)}</td><td>{fmtValue(r.field, r.proposed)}{r.changed ? "" : " (identique)"}</td></tr>)}
          </tbody>
        </Table>
        {shownFields.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer">Toutes les données actuelles</summary>
            <dl className="mt-2 grid gap-1 sm:grid-cols-2">{shownFields.map((k) => <div key={k} className="min-w-0"><dt className="text-stone-700">{FIELD_FR[k] ?? k}</dt><dd className="break-all">{k === "dataStatus" || k === "leadSource" ? <DataStatusBadge status={String(current[k])} /> : fmtValue(k, current[k])}</dd></div>)}</dl>
          </details>
        )}
      </Section>

      <Section title="Source">
        <dl className="grid gap-2 text-sm">
          <div><dt className="text-stone-700">Nature</dt><dd>{v.sourceKind ? SOURCE_KIND_FR[v.sourceKind] : "Non renseignée"}{outcome ? ` → statut après validation : ${outcome === "SUPPLIER_VERIFIED" ? "Vérifié fournisseur" : "Observé"}` : ""}</dd></div>
          <div><dt className="text-stone-700">Document</dt><dd>{v.document ? <Link className="underline" href={`/admin/documents?groupe=${v.document.groupKey}`}>{v.document.title} v{v.document.version} ({v.document.status})</Link> : "—"}</dd></div>
          <div><dt className="text-stone-700">Lien</dt><dd className="break-all">{v.sourceUrl ? <a className="underline" href={v.sourceUrl} rel="noopener noreferrer" target="_blank">{v.sourceUrl}</a> : "—"}</dd></div>
          <div><dt className="text-stone-700">Contexte</dt><dd className="whitespace-pre-line">{v.sourceNote || "—"}</dd></div>
        </dl>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Conséquences sur l'existant">
          <ul className="space-y-1 text-sm" data-testid="impact">
            <li>Configurations enregistrées concernées : <strong>{d.impact.configurations}</strong></li>
            <li>Lignes de panier actives : <strong>{d.impact.activeCartLines}</strong></li>
            <li>Devis ouverts : <strong>{d.impact.openQuotes}</strong></li>
            <li>Commandes référençant {d.impact.scope === "sku" ? "la référence" : "la gamme"} : <strong>{d.impact.orders}</strong></li>
          </ul>
          <p className="mt-2 text-xs text-stone-700">Périmètre : {d.impact.scope === "sku" ? "cette SKU" : "la gamme concernée"}. Les devis et commandes déjà émis conservent leur instantané (prix, lignes, configuration) ; les configurations et paniers sont réévalués au prochain affichage.</p>
        </Section>
        {d.checklist && (
          <Section title="Commercialisable ?">
            <ul className="space-y-1 text-sm" data-testid="checklist">{d.checklist.items.map((i) => <li key={i.key}>{i.ok ? "✓" : "✗"} {i.label}{i.detail ? ` — ${i.detail}` : ""}</li>)}</ul>
            <p className="mt-2 text-xs text-stone-700">{d.checklist.ready ? "Tous les critères sont réunis." : "Non commercialisable en l'état."} Une validation ne modifie jamais « achetable ».</p>
          </Section>
        )}
      </div>

      {v.status === "DRAFT" && (
        <form action={updateValidationAction} className="space-y-6">
          <input type="hidden" name="id" value={v.id} /><input type="hidden" name="targetType" value={v.targetType} />
          <Section title="Modifier le brouillon"><ProposalFields type={v.targetType} current={current} proposed={proposed} /><div className="mt-4"><SourceFields documents={documents} value={v} /></div><p className="mt-3 text-xs text-stone-700">L'enregistrement réactualise la version de référence sur les données actuelles.</p><button className="btn-secondary mt-3" type="submit">Enregistrer le brouillon</button></Section>
        </form>
      )}

      {nextStatuses(v.status).length > 0 && (
        <Section title="Décision">
          {d.blockers.length > 0 && <div className="mb-3 text-sm"><p className="font-medium">Validation impossible en l'état :</p><ul className="list-disc pl-5" data-testid="blockers">{d.blockers.map((b) => <li key={b}>{b}</li>)}</ul></div>}
          <form action={transitionValidationAction} className="space-y-3">
            <input type="hidden" name="id" value={v.id} />
            <div><label className="label" htmlFor="note">Commentaire (obligatoire pour un rejet)</label><textarea id="note" name="note" rows={2} className="input" /></div>
            <div className="flex flex-wrap gap-2">{nextStatuses(v.status).map((to) => <button key={to} name="to" value={to} type="submit" className={to === "VALIDATED" ? "btn-primary" : to === "REJECTED" ? "btn-secondary text-danger" : "btn-secondary"} disabled={to === "VALIDATED" && d.blockers.length > 0}>{ACTION_FR[to]}</button>)}</div>
          </form>
        </Section>
      )}

      <Section title="Historique">
        <ol className="space-y-2 text-sm" data-testid="history">
          {v.events.map((e) => (
            <li key={e.id} className="border-l-2 border-sand-300 pl-3">
              <span className="font-medium">{e.fromStatus ? `${VALIDATION_STATUS_FR[e.fromStatus]} → ` : ""}{VALIDATION_STATUS_FR[e.toStatus]}</span> — {e.actorEmail ?? "—"}, {fmtDate(e.createdAt)} <span className="font-mono text-xs text-stone-700">[{shortHash(e.dataHash)}]</span>
              {e.note && <p className="text-stone-700">{e.note}</p>}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
