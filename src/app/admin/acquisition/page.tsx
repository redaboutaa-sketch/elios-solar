import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { PageTitle, Section, Table } from "@/components/admin/ui";
import { rate, type AcquisitionRow } from "@/domain/acquisition";
import { acquisitionReport, periodFrom } from "@/server/admin/acquisition";

export const metadata: Metadata = { title: "Suivi par origine" };

const eur = (c: number | null) => (c == null ? "non renseigné" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(c / 100));
const pct = (v: number | null) => (v == null ? "non calculable" : `${v.toLocaleString("fr-FR")} %`);

function Rows({ caption, head, rows }: { caption: string; head: string; rows: AcquisitionRow[] }) {
  return (
    <Table caption={caption}>
      <thead><tr><th>{head}</th><th className="text-right">Demandes</th><th className="text-right">Qualifiées</th><th className="text-right">Gagnées</th><th className="text-right">Perdues</th><th className="text-right">Gagnées / décidées</th><th className="text-right">CA HT encaissé</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td className="break-all">{r.key}</td>
            <td className="text-right tabular-nums">{r.requests}</td>
            <td className="text-right tabular-nums">{r.qualified}</td>
            <td className="text-right tabular-nums">{r.won}</td>
            <td className="text-right tabular-nums">{r.lost}</td>
            <td className="text-right tabular-nums">{pct(rate(r.won, r.won + r.lost))}</td>
            <td className="text-right tabular-nums">{eur(r.cashedNetCents)}{r.won > r.cashedKnown ? <span className="block text-xs text-stone-700">{r.won - r.cashedKnown} vente(s) sans montant</span> : null}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={7} className="text-stone-700">Aucune demande sur la période.</td></tr>}
      </tbody>
    </Table>
  );
}

export default async function AcquisitionPage(props: PageProps<"/admin/acquisition">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const p = periodFrom(await props.searchParams);
  const r = await acquisitionReport(p);
  const t = r.total;
  const qs = new URLSearchParams({ ...(p.fromInput ? { du: p.fromInput } : {}), ...(p.toInput ? { au: p.toInput } : {}) }).toString();
  return (
    <div className="space-y-6">
      <PageTitle title="Suivi par origine" />
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div><label className="label" htmlFor="du">Du</label><input id="du" name="du" type="date" className="input" defaultValue={p.fromInput} /></div>
        <div><label className="label" htmlFor="au">Au</label><input id="au" name="au" type="date" className="input" defaultValue={p.toInput} /></div>
        <button className="btn-secondary" type="submit">Filtrer</button>
        <a className="btn-secondary" href={`/admin/acquisition/export${qs ? `?${qs}` : ""}`} data-testid="acquisition-export">Exporter (CSV)</a>
      </form>
      <Section title="Indicateurs de la période">
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[18rem_1fr]" data-testid="acquisition-kpis">
          <dt className="text-stone-700">Demandes de devis enregistrées</dt><dd>{t?.requests ?? 0}</dd>
          <dt className="text-stone-700">Demandes de contact enregistrées</dt><dd>{r.contacts}</dd>
          <dt className="text-stone-700">Prospects qualifiés</dt><dd>{t?.qualified ?? 0} (non qualifiés : {t?.notQualified ?? 0})</dd>
          <dt className="text-stone-700">Ventes gagnées / perdues</dt><dd>{t?.won ?? 0} / {t?.lost ?? 0}</dd>
          <dt className="text-stone-700">Taux de qualification</dt><dd>{pct(rate(t?.qualified ?? 0, t?.requests ?? 0))} (qualifiées / demandes de devis)</dd>
          <dt className="text-stone-700">Taux de transformation</dt><dd>{pct(rate(t?.won ?? 0, (t?.won ?? 0) + (t?.lost ?? 0)))} (gagnées / gagnées + perdues) · {pct(rate(t?.won ?? 0, t?.requests ?? 0))} (gagnées / demandes de devis)</dd>
          <dt className="text-stone-700">CA HT encaissé attribué</dt><dd>{eur(t?.cashedNetCents ?? null)}{t && t.won > t.cashedKnown ? ` · ${t.won - t.cashedKnown} vente(s) gagnée(s) sans montant saisi` : ""}</dd>
          <dt className="text-stone-700">Coût par prospect, par vente</dt><dd>non renseigné (aucune dépense d&apos;acquisition saisie)</dd>
          <dt className="text-stone-700">Marge</dt><dd>non calculée (aucun coût de revient fiable)</dd>
        </dl>
        <p className="mt-3 text-xs text-stone-700">Une demande est comptée lorsqu&apos;elle est enregistrée par le serveur (numéro attribué), jamais au simple clic. L&apos;origine est celle transmise avec la demande (paramètres utm, référent, page d&apos;entrée de la session) ; sans elle : « direct ou non renseigné ». Gagnée = devis « Accepté » ; perdue = « Refusé » ou « Expiré ». Le montant encaissé se saisit sur chaque devis (Issue commerciale).</p>
      </Section>
      <Section title="Par origine (source / support)"><Rows caption="Demandes de devis par origine" head="Origine" rows={r.bySource} /></Section>
      <Section title="Par campagne (utm_campaign)"><Rows caption="Demandes de devis par campagne" head="Campagne" rows={r.byCampaign} /></Section>
      <Section title="Par page d'entrée"><Rows caption="Demandes de devis par page d'entrée" head="Page d'entrée" rows={r.byLanding} /></Section>
      <Section title="Demandes de contact par origine">
        <Table caption="Demandes de contact par origine">
          <thead><tr><th>Origine</th><th className="text-right">Demandes</th></tr></thead>
          <tbody>{r.contactsBySource.map(([k, n]) => <tr key={k}><td className="break-all">{k}</td><td className="text-right tabular-nums">{n}</td></tr>)}{r.contactsBySource.length === 0 && <tr><td colSpan={2} className="text-stone-700">Aucune demande sur la période.</td></tr>}</tbody>
        </Table>
      </Section>
    </div>
  );
}
