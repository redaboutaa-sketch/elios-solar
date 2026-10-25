import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { Flash, Options, PageTitle, Section, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { CATEGORIES } from "@/domain/categories";
import { CLIENTELE_LABEL, EFFECTIVE_LABEL } from "@/domain/tariffs";
import { dashboard, familiesInfo, listLineages } from "@/server/tariffs/queries";
import { createGridAction } from "@/server/actions/admin/tariffs";
import { ConfidentialNote, ContextBadges, StateBadge, columnLabel, variantLabel } from "./labels";

export const metadata: Metadata = { title: "Tarifs" };

const ACTION_FR: Record<string, string> = { "tariffs.publish": "Publication", "tariffs.deactivate": "Désactivation", "tariffs.fromImport": "Grilles créées depuis un import", "tariffs.uploadImport": "Import téléversé" };

export default async function TariffsPage(props: PageProps<"/admin/tarifs">) {
  await requireRole(["ADMIN"]);
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const at = str("date") ? new Date(`${str("date")}T12:00:00`) : null;
  const filters = { category: str("famille"), family: str("produit"), clientele: str("clientele"), state: str("statut"), nature: str("nature"), at: at && !Number.isNaN(at.getTime()) ? at : null };
  const [d, lineages, fams] = await Promise.all([dashboard(), listLineages(filters), familiesInfo()]);
  const famName = new Map(fams.map((f) => [f.slug, f]));
  return (
    <div className="space-y-6">
      <PageTitle title="Tarifs">
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" href="/admin/tarifs/import">Importer un classeur</Link>
          <Link className="btn-secondary" href="/admin/tarifs/simulateur">Simulateur</Link>
          <Link className="btn-ghost" href="/admin/catalogue/tarifs-fournisseur">Fichiers importés</Link>
        </div>
      </PageTitle>
      <Flash searchParams={props.searchParams} />
      <ConfidentialNote />

      <Section title="Base du prix de vente">
        <p className="text-sm text-stone-800" data-testid="sale-price-basis">Le prix affiché au client est lu tel quel dans une grille de <strong>vente</strong> publiée et en vigueur, pour le modèle exact, la variante et la cote saisie (lecture exacte des cotes, sauf règle de grille contraire). Aucune marge, conversion de devise, coefficient ou supplément n'est ajouté par le site ; un coût d'achat n'est jamais affiché. Un modèle sans grille publiée (Malaga, Marbella, Sevilla, HelioRoof Screen, Corsica, Jamaica, Madera, moustiquaires) reste sur devis. Les grilles d'un modèle retiré (SB 400, SB 500) ne s'appliquent pas aux modèles SB 350 / SB 450. Un devis ou une commande déjà émis conserve son instantané : modifier une grille ne le change pas.</p>
      </Section>

      <Section title="Tableau de bord">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5" data-testid="tariff-counts">
          {[["En vigueur", d.counts.inForce], ["Programmées", d.counts.scheduled], ["Vérifiées", d.counts.verified], ["Brouillons", d.counts.draft], ["Grilles", d.counts.lineages]].map(([k, v]) => (
            <div key={k} className="rounded-md border border-sand-200 p-3"><dt className="text-stone-700">{k}</dt><dd className="font-display text-2xl">{v}</dd></div>
          ))}
        </dl>
        <h3 className="mt-5 font-medium">Produits</h3>
        <Table caption="Produits et tarif de vente en vigueur">
          <thead><tr><th>Produit</th><th>Correspondance fournisseur (interne)</th><th>Statut produit</th><th>Tarif de vente en vigueur</th><th>Programmé</th></tr></thead>
          <tbody>
            {d.products.map((p) => {
              const sale = p.inForce.filter((v) => v.nature === "SALE");
              return (
                <tr key={p.slug}>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.supplierRef ?? "—"}</td>
                  <td>{p.status === "DRAFT" ? <StatusBadge tone="warn">Brouillon, hors catalogue</StatusBadge> : p.status === "QUOTE_ONLY" || p.status === "PUBLISHED" ? <StatusBadge tone="ok">Publié</StatusBadge> : p.status === "ARCHIVED" ? <StatusBadge tone="neutral">Retiré (historique)</StatusBadge> : p.status}</td>
                  <td>{p.status === "ARCHIVED" && sale.length ? <span className="text-xs text-stone-700">modèle retiré : grille conservée pour l'historique, jamais appliquée à un autre modèle. </span> : null}{sale.length ? sale.map((v) => <div key={v.id}><Link className="underline" href={`/admin/tarifs/grilles/${v.id}`}>{variantLabel(v.variantKey)} v{v.version}</Link> <span className="text-xs text-stone-700">depuis {fmtDate(v.validFrom ?? v.publishedAt, false)}{v.validTo ? ` jusqu'au ${fmtDate(v.validTo, false)}` : ""}</span></div>) : <StatusBadge tone="warn">aucun — prix sur devis</StatusBadge>}</td>
                  <td className="text-xs">{p.scheduled.map((v) => <div key={v.id}><Link className="underline" href={`/admin/tarifs/grilles/${v.id}`}>v{v.version}</Link> le {fmtDate(v.validFrom)}</div>)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <h3 className="mt-5 font-medium">Informations manquantes et anomalies ({d.anomalies.length} brouillon(s) non publiable(s))</h3>
        {d.anomalies.length ? (
          <ul className="mt-2 space-y-1 text-sm" data-testid="tariff-anomalies">
            {d.anomalies.map((a) => <li key={a.id}><Link className="underline" href={`/admin/tarifs/grilles/${a.id}`}>{a.sourceKey} v{a.version}</Link> : {a.blocking.join(" ")}</li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-stone-700">Aucun brouillon bloqué.</p>}
        <h3 className="mt-5 font-medium">Dernières opérations</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {d.recent.length ? d.recent.map((r) => <li key={r.id}>{fmtDate(r.createdAt)} · {ACTION_FR[r.action] ?? r.action} · {r.actorEmail ?? "—"} {(r.after as { sourceKey?: string; version?: number } | null)?.sourceKey ? <span className="text-stone-700">({(r.after as { sourceKey: string }).sourceKey} v{(r.after as { version?: number }).version})</span> : null}</li>) : <li className="text-stone-700">Aucune.</li>}
        </ul>
        <p className="mt-2 text-xs text-stone-700">Historique complet : <Link className="underline" href="/admin/journal">Journal</Link> (sans montant).</p>
      </Section>

      <Section title="Liste des tarifs">
        <form className="mb-4 flex flex-wrap items-end gap-3 text-sm" method="get">
          <label className="flex flex-col">Famille<select name="famille" className="input min-h-0 py-1" defaultValue={filters.category}><option value="">Toutes</option>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
          <label className="flex flex-col">Produit<select name="produit" className="input min-h-0 py-1" defaultValue={filters.family}><option value="">Tous</option>{fams.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}</select></label>
          <label className="flex flex-col">Clientèle<select name="clientele" className="input min-h-0 py-1" defaultValue={filters.clientele}><Options includeEmpty="Toutes" values={Object.keys(CLIENTELE_LABEL)} labels={CLIENTELE_LABEL} /></select></label>
          <label className="flex flex-col">Statut<select name="statut" className="input min-h-0 py-1" defaultValue={filters.state}><Options includeEmpty="Tous" values={Object.keys(EFFECTIVE_LABEL)} labels={EFFECTIVE_LABEL} /></select></label>
          <label className="flex flex-col">Nature<select name="nature" className="input min-h-0 py-1" defaultValue={filters.nature}><option value="">Toutes</option><option value="SALE">Vente</option><option value="PURCHASE">Achat fournisseur</option><option value="UNKNOWN">Non établie</option></select></label>
          <label className="flex flex-col">En vigueur le<input type="date" name="date" className="input min-h-0 py-1" defaultValue={str("date")} /></label>
          <button className="btn-secondary min-h-0 py-1.5" type="submit">Filtrer</button>
          <Link className="btn-ghost min-h-0 py-1.5" href="/admin/tarifs">Réinitialiser</Link>
        </form>
        <Table caption="Grilles tarifaires">
          <thead><tr><th>Produit</th><th>Variante</th><th>Colonne d'origine</th><th>Contexte (dernière version)</th><th>En vigueur</th><th>Dernière version</th><th>Cellules</th><th>Validité</th></tr></thead>
          <tbody data-testid="tariff-list">
            {lineages.map((l) => {
              const last = l.versions[0]!;
              const live = l.versions.find((v) => v.id === l.inForce?.id);
              const fam = famName.get(l.familySlug);
              return (
                <tr key={l.sourceKey}>
                  <td><span className="font-medium">{fam?.name ?? l.familySlug}</span><div className="text-xs text-stone-700">{fam?.supplierRef ?? ""}</div></td>
                  <td>{variantLabel(l.variantKey)}</td>
                  <td>{columnLabel(l.amountRole)}</td>
                  <td><ContextBadges nature={last.nature} currency={last.currency} taxBasis={last.taxBasis} clientele={last.clientele} /></td>
                  <td>{live ? <Link className="underline" href={`/admin/tarifs/grilles/${live.id}`}>v{live.version}</Link> : "—"}</td>
                  <td><Link className="underline" href={`/admin/tarifs/grilles/${last.id}`}>v{last.version}</Link> <StateBadge state={last.state} /></td>
                  <td>{last.cells}</td>
                  <td className="text-xs">{live ? `${fmtDate(live.validFrom ?? live.publishedAt, false)} → ${live.validTo ? fmtDate(live.validTo, false) : "sans fin"}` : "—"}</td>
                </tr>
              );
            })}
            {!lineages.length && <tr><td colSpan={8} className="text-stone-700">Aucune grille ne répond à ces filtres.</td></tr>}
          </tbody>
        </Table>
      </Section>

      <Section title="Nouvelle grille (saisie manuelle)">
        <form action={createGridAction} className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col">Produit<select name="familySlug" className="input min-h-0 py-1" required>{fams.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}</select></label>
          <label className="flex flex-col">Variante (ex. murale, vide = unique)<input name="variantKey" className="input min-h-0 py-1" pattern="[a-z0-9\-]*" /></label>
          <label className="flex flex-col">Libellé<input name="label" className="input min-h-0 py-1" required minLength={2} defaultValue="Grille saisie" /></label>
          <label className="flex flex-col">Nature<select name="nature" className="input min-h-0 py-1"><option value="UNKNOWN">Non établie</option><option value="SALE">Vente</option><option value="PURCHASE">Achat fournisseur</option></select></label>
          <label className="flex flex-col">Axe principal<select name="dimAKey" className="input min-h-0 py-1"><option value="projection">Projection / avancée</option><option value="hauteur">Hauteur</option></select></label>
          <button className="btn-secondary min-h-0 py-1.5" type="submit">Créer le brouillon</button>
        </form>
        <p className="mt-2 text-xs text-stone-700">Une grille ne publie jamais un produit : un produit en brouillon reste hors catalogue, et une cote non tarifée reste au devis.</p>
      </Section>
    </div>
  );
}
