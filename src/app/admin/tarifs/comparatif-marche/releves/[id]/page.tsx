import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Section, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { familiesInfo } from "@/server/tariffs/queries";
import { observationDetail } from "@/server/market/observations";
import { setObservationStatusAction, updateObservationAction } from "@/server/actions/admin/market";
import { MarketNote, SubNav, eur } from "../../labels";
import { ObservationFields } from "../../observation-fields";

export const metadata: Metadata = { title: "Relevé concurrent" };

const ACTION_FR: Record<string, string> = { create: "Création", update: "Correction", archive: "Archivage", restore: "Rétablissement" };

export default async function ObservationPage(props: PageProps<"/admin/tarifs/comparatif-marche/releves/[id]">) {
  await requireRole(["ADMIN"]);
  const { id } = await props.params;
  const [o, fams] = await Promise.all([observationDetail(id), familiesInfo()]);
  return (
    <div className="space-y-6">
      <PageTitle title={`${o.retailer} — ${o.model}`} backHref="/admin/tarifs/comparatif-marche/releves" backLabel="Relevés" />
      <SubNav current="releves" />
      <Flash searchParams={props.searchParams} />
      <MarketNote />
      <p className="text-sm">Statut : {o.status === "ACTIVE" ? <StatusBadge tone="ok">actif</StatusBadge> : <StatusBadge tone="neutral">archivé le {fmtDate(o.archivedAt)} par {o.archivedBy ?? "—"}</StatusBadge>} · révision {o.revision} · origine {o.source} · <a className="underline" href={o.url} target="_blank" rel="noopener noreferrer nofollow">ouvrir la source</a></p>
      <Section title="Corriger">
        <form action={updateObservationAction} className="space-y-3" data-testid="observation-edit">
          <input type="hidden" name="id" value={o.id} />
          <input type="hidden" name="revision" value={o.revision} />
          <ObservationFields o={o} fams={fams} />
          <label className="flex max-w-xl flex-col text-sm">Motif de la correction *<input name="reason" className="input" required minLength={3} /></label>
          <button className="btn-primary" type="submit">Enregistrer la correction</button>
        </form>
      </Section>
      <Section title={o.status === "ACTIVE" ? "Archiver" : "Rétablir"}>
        <form action={setObservationStatusAction} className="flex flex-wrap items-end gap-3 text-sm">
          <input type="hidden" name="id" value={o.id} />
          <input type="hidden" name="revision" value={o.revision} />
          <input type="hidden" name="status" value={o.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE"} />
          <label className="flex flex-col">Motif<input name="reason" className="input min-h-0 py-1" /></label>
          <button className="btn-secondary min-h-0 py-1.5" type="submit">{o.status === "ACTIVE" ? "Archiver (écarté des calculs)" : "Rétablir"}</button>
        </form>
      </Section>
      <Section title="Historique">
        <Table caption="Historique du relevé">
          <thead><tr><th>Révision</th><th>Date</th><th>Opération</th><th>Auteur</th><th>Motif</th><th>Prix</th></tr></thead>
          <tbody data-testid="observation-history">{o.revisions.map((h) => { const d = h.data as { priceMinor?: number; taxBasis?: string; comparability?: string }; return <tr key={h.id}><td>{h.revision}</td><td>{fmtDate(h.createdAt)}</td><td>{ACTION_FR[h.action] ?? h.action}</td><td>{h.actorEmail ?? "—"}</td><td>{h.reason}</td><td className="text-xs">{eur(d.priceMinor ?? null)} {d.taxBasis} · {d.comparability}</td></tr>; })}</tbody>
        </Table>
      </Section>
    </div>
  );
}
