import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import type { ImportIssue, ImportSummary } from "@/server/catalog/import";
import { IMPORT_COLUMNS } from "@/server/catalog/import";
import { Price } from "@/components/ui/price";
import { Flash, PageTitle, Section, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { applyImportAction, previewImportAction } from "@/server/actions/admin/import";

export const metadata: Metadata = { title: "Import catalogue" };
const ACTION_FR = { create: "Création", update: "Mise à jour", unchanged: "Inchangée" } as const;

export default async function ImportPage(props: PageProps<"/admin/import">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const id = typeof sp.id === "string" ? sp.id : null;
  const [current, history] = await Promise.all([
    id ? prisma.catalogImport.findUnique({ where: { id } }) : null,
    prisma.catalogImport.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { id: true, filename: true, status: true, createdAt: true } }),
  ]);
  const summary = current?.summary as unknown as ImportSummary | undefined;
  const errors = (current?.errors as unknown as ImportIssue[] | undefined) ?? [];
  const changes = summary?.rows.filter((r) => r.action !== "unchanged") ?? [];
  return (
    <div className="space-y-6">
      <PageTitle title="Import du catalogue (variantes)" />
      <Flash searchParams={props.searchParams} />
      <Section title="1. Téléverser un fichier">
        <p className="mb-3 text-sm text-stone-700">CSV (séparateur « , » ou « ; ») ou JSON (tableau d'objets). Colonnes : <code className="text-xs break-all">{IMPORT_COLUMNS.join(",")}</code>. Les prix sont en <strong>centimes TTC</strong> ; <code>attributes</code> est un objet JSON (ex. <code className="text-xs break-all">{`{"kind":"pergola_standard","finishCode":"ANTHRACITE","dimensionCode":"3x4","mounting":"wall"}`}</code>). Exemple : <code className="text-xs break-all">docs/import/variants.example.csv</code>.</p>
        <form action={previewImportAction} className="flex flex-wrap items-end gap-3">
          <div><label className="label" htmlFor="file">Fichier (.csv ou .json, 2 Mo max.)</label><input id="file" name="file" type="file" required accept=".csv,.json,text/csv,application/json" className="input" /></div>
          <button className="btn-primary" type="submit">Analyser (aperçu)</button>
        </form>
      </Section>

      {current && summary && (
        <Section title={`2. Aperçu — ${current.filename}`}>
          <p className="text-sm">Statut : {current.status === "APPLIED" ? <StatusBadge tone="ok">Appliqué</StatusBadge> : <StatusBadge tone="warn">{current.status}</StatusBadge>} · créé le {fmtDate(current.createdAt)}{summary.appliedAt && ` · appliqué le ${fmtDate(new Date(summary.appliedAt))}`}</p>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
            {[["Lignes", summary.total], ["Valides", summary.valid], ["En erreur", summary.invalid], ["Créations", summary.create], ["Mises à jour", summary.update], ["Prix modifiés", summary.priceChanged]].map(([l, v]) => <li key={String(l)} className="rounded border border-sand-200 px-3 py-2"><span className="block text-lg font-semibold tabular-nums">{v}</span>{l}</li>)}
          </ul>
          {errors.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-medium text-danger">Erreurs ({errors.length}) — ces lignes seront ignorées</h3>
              <Table caption="Erreurs d'import"><thead><tr><th>Ligne</th><th>SKU</th><th>Erreur</th></tr></thead><tbody>
                {errors.slice(0, 500).map((e, i) => <tr key={i}><td>{e.line || "—"}</td><td className="font-mono text-xs">{e.sku ?? "—"}</td><td>{e.message}</td></tr>)}
              </tbody></Table>
            </>
          )}
          <h3 className="mt-5 text-sm font-medium">Changements ({changes.length}{summary.unchanged ? `, ${summary.unchanged} ligne(s) inchangée(s)` : ""})</h3>
          {changes.length === 0 ? <p className="text-sm text-stone-700">Aucun changement à appliquer.</p> : (
            <Table caption="Changements prévus"><thead><tr><th>Ligne</th><th>SKU</th><th>Famille</th><th>Libellé</th><th>Action</th><th className="text-right">Prix actuel</th><th className="text-right">Nouveau prix</th></tr></thead><tbody>
              {changes.slice(0, 1000).map((r) => <tr key={r.sku}><td>{r.line}</td><td className="font-mono text-xs">{r.sku}</td><td className="text-xs">{r.familySlug}</td><td>{r.label}</td><td>{ACTION_FR[r.action]}</td><td className="text-right">{r.oldPriceCents != null ? <Price cents={r.oldPriceCents} showCents /> : "—"}</td><td className={`text-right ${r.priceChanged ? "font-semibold text-warning" : ""}`}><Price cents={r.priceCents} showCents /></td></tr>)}
            </tbody></Table>
          )}
          {current.status === "PREVIEW" && changes.length > 0 && (
            <form action={applyImportAction} className="mt-5">
              <input type="hidden" name="id" value={current.id} />
              <button className="btn-accent" type="submit">Appliquer les {changes.length} ligne(s) valide(s)</button>
              <p className="mt-2 text-xs text-stone-700">Les commandes déjà passées ne sont pas affectées (lignes de commande figées).</p>
            </form>
          )}
        </Section>
      )}

      <Section title="Historique">
        <Table caption="Imports récents"><thead><tr><th>Date</th><th>Fichier</th><th>Statut</th></tr></thead><tbody>
          {history.map((h) => <tr key={h.id}><td>{fmtDate(h.createdAt)}</td><td><Link className="underline" href={`/admin/import?id=${h.id}`}>{h.filename}</Link></td><td>{h.status}</td></tr>)}
          {history.length === 0 && <tr><td colSpan={3} className="text-stone-700">Aucun import.</td></tr>}
        </tbody></Table>
      </Section>
    </div>
  );
}
