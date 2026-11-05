import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Section, Table, fmtDate } from "@/components/admin/ui";
import { familiesInfo } from "@/server/tariffs/queries";
import { listObservations } from "@/server/market/observations";
import { createObservationAction, importObservationsAction } from "@/server/actions/admin/market";
import { fmtMm } from "../../labels";
import { ComparabilityBadge, MarketNote, MOUNTING_OBS_FR, PRICE_KIND_FR, SubNav, eur } from "../labels";
import { ObservationFields } from "../observation-fields";

export const metadata: Metadata = { title: "Relevés concurrents" };

export default async function ObservationsPage(props: PageProps<"/admin/tarifs/comparatif-marche/releves">) {
  await requireRole(["ADMIN"]);
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const date = (k: string) => { const d = str(k) ? new Date(`${str(k)}T00:00:00`) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
  const filters = { familySlug: str("produit"), country: str("pays"), comparability: str("comparabilite"), retailer: str("revendeur"), from: date("du"), to: date("au"), status: (str("statut") || "ACTIVE") as "ACTIVE" | "ARCHIVED" | "ALL" };
  const [fams, rows] = await Promise.all([familiesInfo(), listObservations(filters)]);
  const famName = new Map(fams.map((f) => [f.slug, f.name]));
  const qs = new URLSearchParams(Object.entries({ produit: filters.familySlug, pays: filters.country, comparabilite: filters.comparability, revendeur: filters.retailer, du: str("du"), au: str("au"), statut: filters.status }).filter(([, v]) => v)).toString();
  return (
    <div className="space-y-6">
      <PageTitle title="Relevés concurrents" backHref="/admin/tarifs/comparatif-marche" backLabel="Comparatif marché">
        <a className="btn-secondary" href={`/admin/tarifs/comparatif-marche/export?type=releves&${qs}`} data-testid="export-observations">Exporter (CSV)</a>
      </PageTitle>
      <SubNav current="releves" />
      <Flash searchParams={props.searchParams} />
      <MarketNote />
      <Section title="Filtrer">
        <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col">Produit<select name="produit" className="input min-h-0 py-1" defaultValue={filters.familySlug}><option value="">Tous</option>{fams.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}</select></label>
          <label className="flex flex-col">Pays<input name="pays" className="input min-h-0 py-1 w-20" defaultValue={filters.country} /></label>
          <label className="flex flex-col">Comparabilité<select name="comparabilite" className="input min-h-0 py-1" defaultValue={filters.comparability}><option value="">Toutes</option><option value="STRONG">forte</option><option value="PARTIAL">partielle</option><option value="INSUFFICIENT">insuffisante</option></select></label>
          <label className="flex flex-col">Revendeur<input name="revendeur" className="input min-h-0 py-1" defaultValue={filters.retailer} /></label>
          <label className="flex flex-col">Du<input type="date" name="du" className="input min-h-0 py-1" defaultValue={str("du")} /></label>
          <label className="flex flex-col">Au<input type="date" name="au" className="input min-h-0 py-1" defaultValue={str("au")} /></label>
          <label className="flex flex-col">Statut<select name="statut" className="input min-h-0 py-1" defaultValue={filters.status}><option value="ACTIVE">actifs</option><option value="ARCHIVED">archivés</option><option value="ALL">tous</option></select></label>
          <button className="btn-secondary min-h-0 py-1.5" type="submit">Filtrer</button>
        </form>
      </Section>
      <Section title={`Relevés (${rows.length})`}>
        <Table caption="Relevés">
          <thead><tr><th>Produit comparé</th><th>Revendeur / modèle</th><th>Date · pays</th><th>Configuration</th><th>Prix</th><th>Comparabilité</th><th>Accès</th></tr></thead>
          <tbody data-testid="observations">
            {rows.map((o) => (
              <tr key={o.id} className={o.status === "ARCHIVED" ? "opacity-60" : ""}>
                <td>{famName.get(o.familySlug) ?? o.familySlug}</td>
                <td><Link className="underline" href={`/admin/tarifs/comparatif-marche/releves/${o.id}`}>{o.retailer}</Link><div className="text-xs">{o.model}</div><a className="text-xs underline" href={o.url} target="_blank" rel="noopener noreferrer nofollow">source</a></td>
                <td className="text-xs">{fmtDate(o.observedAt, false)} · {o.country} · {o.currency}</td>
                <td className="text-xs">{o.widthMm && o.depthMm ? `${fmtMm(o.widthMm)} × ${fmtMm(o.depthMm)}` : "—"} · {MOUNTING_OBS_FR[o.mounting] ?? o.mounting}<div>{o.roofType}</div></td>
                <td className="text-xs">{eur(o.priceMinor)} {o.taxBasis === "UNKNOWN" ? "HT/TTC ?" : o.taxBasis}<div>{PRICE_KIND_FR[o.priceKind] ?? o.priceKind}</div></td>
                <td><ComparabilityBadge value={o.comparability} /></td>
                <td className="text-xs">{o.access}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7}>Aucun relevé.</td></tr>}
          </tbody>
        </Table>
      </Section>
      <Section title="Ajouter un relevé (saisie manuelle)">
        <p className="mb-2 text-xs text-stone-700">Offre publique consultée sans commande ni demande de devis. Ne saisissez que des valeurs vues sur la source ; un prix obtenu seulement après contact ou une page inaccessible se signalent dans « Accès ».</p>
        <form action={createObservationAction} className="space-y-3" data-testid="observation-form">
          <ObservationFields fams={fams} />
          <button className="btn-primary" type="submit">Ajouter le relevé</button>
        </form>
      </Section>
      <Section title="Importer des relevés (CSV)">
        <form action={importObservationsAction} className="flex flex-wrap items-end gap-3 text-sm">
          <input type="file" name="file" accept=".csv,text/csv" required />
          <label className="flex items-center gap-1"><input type="checkbox" name="dryRun" value="1" defaultChecked /> aperçu seulement</label>
          <button className="btn-secondary min-h-0 py-1.5" type="submit">Importer</button>
        </form>
        <p className="mt-2 text-xs text-stone-700">Format : celui de l'export (séparateur « ; », montants en euros, dates AAAA-MM-JJ). Un relevé identique (revendeur, URL, modèle, cotes, implantation, date, prix) n'est pas dupliqué. L'import ne modifie aucune grille ni aucun prix public.</p>
      </Section>
    </div>
  );
}
