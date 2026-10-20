import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Pagination, Section, Table, fmtDate } from "@/components/admin/ui";
import { Notice } from "@/components/ui/alert";
import { activateSupplierPriceListAction, rejectSupplierPriceListAction } from "@/server/actions/admin/supplier-prices";
import type { SupplierPriceReport } from "@/server/supplier-prices/analyse";
import { AMOUNT_ROLE_FR } from "@/server/supplier-prices/types";
import { DISCREPANCY_FR, InterpretationBadges, ListStatusBadge, RowStatusBadge, fmtMinor } from "../labels";

export const metadata: Metadata = { title: "Version de tarif fournisseur" };

const PAGE_SIZE = 200;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 120) : "");
const dims = (a: number | null, wMin: number | null, wMax: number | null) => `${a ?? "—"} × ${wMin == null ? "—" : wMin === wMax ? wMin : `${wMin}–${wMax}`}`;

export default async function SupplierPriceListPage(props: PageProps<"/admin/catalogue/tarifs-fournisseur/[id]">) {
  await requireRole(["ADMIN"]);
  const { id } = await props.params;
  const sp = await props.searchParams;
  const list = await prisma.supplierPriceList.findUnique({ where: { id: id.slice(0, 64) } });
  if (!list) notFound();
  const report = (list.report ?? {}) as Partial<SupplierPriceReport>;
  const filter = { familySlug: str(sp.famille), variantKey: str(sp.variante), amountRole: str(sp.role), status: str(sp.statut), kind: str(sp.type) };
  const where: Prisma.SupplierPriceRowWhereInput = {
    listId: list.id,
    ...(filter.familySlug ? { familySlug: filter.familySlug } : {}),
    ...(sp.variante !== undefined && sp.variante !== "*" ? { variantKey: filter.variantKey } : {}),
    ...(filter.amountRole ? { amountRole: filter.amountRole } : {}),
    ...(filter.status === "OK" || filter.status === "TO_CHECK" || filter.status === "REJECTED" ? { status: filter.status } : {}),
    ...(filter.kind ? { kind: filter.kind } : {}),
  };
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const [total, rows, facets] = await Promise.all([
    prisma.supplierPriceRow.count({ where }),
    prisma.supplierPriceRow.findMany({ where, orderBy: [{ familySlug: "asc" }, { variantKey: "asc" }, { kind: "asc" }, { code: "asc" }, { dimAmm: "asc" }, { widthMinMm: "asc" }, { amountRole: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.supplierPriceRow.groupBy({ by: ["familySlug", "variantKey", "amountRole"], where: { listId: list.id }, _count: { _all: true } }),
  ]);
  const families = [...new Set(facets.map((f) => f.familySlug))];
  const variants = [...new Set(facets.map((f) => f.variantKey))];
  const roles = [...new Set(facets.map((f) => f.amountRole))];
  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = { famille: filter.familySlug, variante: sp.variante === undefined ? "*" : filter.variantKey, role: filter.amountRole, statut: filter.status, type: filter.kind, ...over };
    for (const [k, v] of Object.entries(cur)) if (v && !(k === "variante" && v === "*")) p.set(k, v);
    const s = p.toString();
    return `/admin/catalogue/tarifs-fournisseur/${list.id}${s ? `?${s}` : ""}`;
  };
  const discrepancies = report.discrepancies ?? [];
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageTitle title={`${list.sourceKey} — v${list.version}`} backHref="/admin/catalogue/tarifs-fournisseur" backLabel="Tarifs fournisseur"><ListStatusBadge status={list.status} /></PageTitle>
      <Flash searchParams={props.searchParams} />
      <div className="sticky top-0 z-10"><Notice tone="warn"><strong>Montants internes — nature non établie, jamais publiés.</strong> Ni prix d'achat, ni prix de vente confirmés ; base HT/TTC inconnue ; aucune conversion de devise. Ne pas recopier ces montants hors de l'administration.</Notice></div>

      <Section>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-stone-700">Fichier source</dt><dd className="break-words">{list.sourceFile}</dd></div>
          <div><dt className="text-stone-700">Empreinte SHA-256</dt><dd className="font-mono text-xs break-all">{list.sourceSha256}</dd></div>
          <div><dt className="text-stone-700">Libellé</dt><dd>{list.label}</dd></div>
          <div><dt className="text-stone-700">Interprétation</dt><dd><InterpretationBadges nature={list.nature} taxBasis={list.taxBasis} currency={list.currency} /></dd></div>
          <div><dt className="text-stone-700">Import</dt><dd>{fmtDate(list.createdAt)} — {list.importedBy ?? "—"}</dd></div>
          <div><dt className="text-stone-700">Activation</dt><dd>{list.activatedAt ? `${fmtDate(list.activatedAt)} — ${list.activatedBy ?? "—"}` : "—"}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-stone-700"><strong>Devise :</strong> {list.currencyNote || "—"}</p>
        <p className="mt-1 text-sm text-stone-700"><strong>Nature :</strong> {list.natureNote || "—"}</p>
        {list.notes && <p className="mt-1 text-sm text-stone-700"><strong>Notes :</strong> {list.notes}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {(list.status === "DRAFT" || list.status === "ARCHIVED") && <form action={activateSupplierPriceListAction}><input type="hidden" name="id" value={list.id} /><input type="hidden" name="returnTo" value={`/admin/catalogue/tarifs-fournisseur/${list.id}`} /><button className="btn-primary" type="submit">Activer cette version</button></form>}
          {list.status === "DRAFT" && <form action={rejectSupplierPriceListAction}><input type="hidden" name="id" value={list.id} /><input type="hidden" name="returnTo" value={`/admin/catalogue/tarifs-fournisseur/${list.id}`} /><button className="btn-secondary" type="submit">Rejeter</button></form>}
        </div>
      </Section>

      <Section title="Contrôles">
        {report.counts && <p className="text-sm">Lignes : <strong>{report.counts.total}</strong> · OK {report.counts.byStatus.OK ?? 0} · à vérifier {report.counts.byStatus.TO_CHECK ?? 0} · rejetées {report.counts.byStatus.REJECTED ?? 0} · montants vides {report.counts.emptyAmounts} · doublons {report.duplicates?.length ?? 0} · combinaisons manquantes {report.gaps?.length ?? 0}</p>}
        {report.notes?.length ? <ul className="mt-2 list-disc pl-5 text-sm">{report.notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
        {report.comparison?.notes?.length ? <ul className="mt-2 list-disc pl-5 text-sm">{report.comparison.notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
        {report.issues?.length ? (
          <details className="mt-3" open><summary className="cursor-pointer text-sm font-medium">Anomalies par type ({report.issues.length})</summary>
            <ul className="mt-2 space-y-1 text-sm">{report.issues.map((i, k) => <li key={k}><span className="badge-warn mr-2">{i.count}</span>{i.issue}</li>)}</ul>
          </details>
        ) : null}
      </Section>

      {report.xlsx && (
        <Section title="Classeur : feuilles analysées">
          <p className="text-sm text-stone-700">Feuilles : {report.xlsx.structure.sheets.length} · masquées : {report.xlsx.structure.hiddenSheets.length ? report.xlsx.structure.hiddenSheets.join(", ") : "aucune"} · liens externes : {report.xlsx.structure.externalLinks} (jamais suivis) · commentaires : {report.xlsx.structure.comments} · noms définis : {report.xlsx.structure.definedNames} (+ {report.xlsx.structure.builtInNames ?? 0} intégrés) · mentions de devise : {report.xlsx.structure.mentionsCurrency.length} · mentions HT/TTC : {report.xlsx.structure.mentionsTax.length}</p>
          <Table caption="Feuilles">
            <thead><tr><th>Feuille</th><th>Famille</th><th>Blocs</th><th>Lignes</th><th>Nombres en texte</th><th>Formules (nb · sans cache · incohérentes · motifs)</th><th>Coefficient(s) « Prix final »</th></tr></thead>
            <tbody>{report.xlsx.sheets.map((s) => (
              <tr key={s.name}>
                <td>{s.name}<div className="text-xs text-stone-700">{s.state}</div></td><td>{s.familySlug ?? "—"}</td>
                <td><ul className="text-xs">{s.blocks.map((b, i) => <li key={i}>« {b.title} » → {b.variantKey || "—"} ({b.rows} l., lignes {b.firstRow}–{b.lastRow})</li>)}</ul></td>
                <td>{s.dataRows}</td><td>{s.textNumbers}</td>
                <td><ul className="text-xs">{s.formulas.map((f) => <li key={f.column}>{f.column} : {f.count} · {f.missingCache} · {f.mismatches} · {Object.keys(f.patterns).join(", ")}</li>)}</ul></td>
                <td className="font-mono text-xs">{s.finalCoefficients.join(" ; ") || "—"}</td>
              </tr>
            ))}</tbody>
          </Table>
          {report.xlsx.sheets.some((s) => s.notes.length) && <ul className="mt-2 list-disc pl-5 text-sm">{report.xlsx.sheets.flatMap((s) => s.notes.map((n, i) => <li key={`${s.name}-${i}`}>{s.name} : {n}</li>))}</ul>}
        </Section>
      )}

      {report.docx && (
        <Section title="Fiche : tableaux analysés">
          <p className="text-sm text-stone-700">{report.docx.title} · lignes d'options chiffrées dans le texte : {report.docx.optionLines} · devises rencontrées : {report.docx.currencies.join(", ") || "aucune"}</p>
          <Table caption="Tableaux">
            <thead><tr><th>#</th><th>Légende</th><th>Type</th><th>Variante</th><th>Colonnes</th><th>Lignes</th><th>Devise</th><th>Rapport final / source</th></tr></thead>
            <tbody>{report.docx.tables.map((t) => (
              <tr key={t.index}><td>{t.index}</td><td>{t.caption || "—"}</td><td>{t.kind}</td><td>{t.variantKey || "—"}</td><td className="text-xs">{t.headers.join(" | ")}</td><td>{t.rows}</td><td>{t.currency ?? "—"}</td><td className="font-mono text-xs">{t.finalRatio ?? "—"}</td></tr>
            ))}</tbody>
          </Table>
        </Section>
      )}

      <Section title={`Écarts fiche ↔ classeur (${discrepancies.length})`}>
        {report.discrepancyCounts && Object.keys(report.discrepancyCounts).length ? <p className="mb-2 text-sm">{Object.entries(report.discrepancyCounts).map(([k, n]) => `${DISCREPANCY_FR[k] ?? k} : ${n}`).join(" · ")}{report.comparison?.roundingOnly ? ` · écarts d'arrondi d'un centime ignorés : ${report.comparison.roundingOnly}` : ""}</p> : <p className="text-sm text-stone-700">Aucun écart (ou aucune source à rapprocher dans le même lot).</p>}
        {discrepancies.length > 0 && (
          <details><summary className="cursor-pointer text-sm font-medium">Détail (300 premiers)</summary>
            <Table caption="Écarts">
              <thead><tr><th>Catégorie</th><th>Famille / variante</th><th>Colonne</th><th>Dim. A × largeur (mm)</th><th>Fiche</th><th>Classeur</th><th>Message</th></tr></thead>
              <tbody>{discrepancies.slice(0, 300).map((d, i) => (
                <tr key={i}><td>{DISCREPANCY_FR[d.category] ?? d.category}</td><td>{d.familySlug} / {d.variantKey || "—"}</td><td>{d.amountRole ?? "—"}</td><td>{d.dimAmm !== undefined ? dims(d.dimAmm ?? null, d.widthMinMm ?? null, d.widthMaxMm ?? null) : "—"}</td>
                  <td className="text-xs">{d.docxRef ?? "—"}{d.docxAmountMinor !== undefined && <div className="font-mono">{fmtMinor(d.docxAmountMinor, null)}</div>}</td>
                  <td className="text-xs">{d.xlsxRef ?? "—"}{d.xlsxAmountMinor !== undefined && <div className="font-mono">{fmtMinor(d.xlsxAmountMinor, null)}</div>}</td>
                  <td className="text-xs">{d.message}</td></tr>
              ))}</tbody>
            </Table>
          </details>
        )}
        {report.gaps?.length ? (
          <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">Combinaisons manquantes dans le rectangle couvert ({report.gaps.length}) — non complétées</summary>
            <ul className="mt-2 columns-2 text-xs sm:columns-3">{report.gaps.slice(0, 600).map((g, i) => <li key={i}>{g.familySlug}/{g.variantKey || "—"} · {g.amountRole} · {g.dimAmm} × {g.widthKey}</li>)}</ul>
          </details>
        ) : null}
        {report.duplicates?.length ? (
          <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">Doublons ({report.duplicates.length})</summary>
            <ul className="mt-2 text-xs">{report.duplicates.map((d, i) => <li key={i}>{d.refs.join(" · ")}</li>)}</ul>
          </details>
        ) : null}
      </Section>

      <Section title={`Lignes (${total})`}>
        <form method="get" className="mb-4 grid gap-3 sm:grid-cols-5">
          <label className="block"><span className="label">Famille</span><select name="famille" className="input" defaultValue={filter.familySlug}><option value="">Toutes</option>{families.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
          <label className="block"><span className="label">Variante</span><select name="variante" className="input" defaultValue={sp.variante === undefined ? "*" : filter.variantKey}><option value="*">Toutes</option>{variants.map((v) => <option key={v} value={v}>{v || "(aucune)"}</option>)}</select></label>
          <label className="block"><span className="label">Colonne</span><select name="role" className="input" defaultValue={filter.amountRole}><option value="">Toutes</option>{roles.map((r) => <option key={r} value={r}>{AMOUNT_ROLE_FR[r] ?? r}</option>)}</select></label>
          <label className="block"><span className="label">Statut</span><select name="statut" className="input" defaultValue={filter.status}><option value="">Tous</option><option value="OK">OK</option><option value="TO_CHECK">À vérifier</option><option value="REJECTED">Rejetée</option></select></label>
          <div className="flex items-end gap-2"><button className="btn-primary" type="submit">Filtrer</button><Link className="btn-secondary" href={`/admin/catalogue/tarifs-fournisseur/${list.id}`}>Effacer</Link></div>
        </form>
        <Table caption="Lignes de tarif">
          <thead><tr><th>Famille / variante</th><th>Type</th><th>Dim. A × largeur (mm)</th><th>Colonne</th><th className="text-right">Montant (interne)</th><th>Formule · cache</th><th>Référence</th><th>Statut</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td>{r.familySlug}<div className="text-xs text-stone-700">{r.variantKey || "—"}</div></td>
              <td className="text-xs">{r.kind}{r.code && <div>{r.code}</div>}{r.kind === "OPTION" && <div className="text-stone-700">{r.label}</div>}</td>
              <td className="text-xs">{r.dimAKey ?? ""} {dims(r.dimAmm, r.widthMinMm, r.widthMaxMm)}</td>
              <td className="text-xs">{AMOUNT_ROLE_FR[r.amountRole] ?? r.amountRole}</td>
              <td className="text-right font-mono text-xs">{fmtMinor(r.amountMinor, r.currency)}</td>
              <td className="font-mono text-xs">{r.formula ?? "—"}{r.cachedValue != null && <div>{r.cachedValue}</div>}</td>
              <td className="max-w-64 break-words text-xs">{r.sourceRef}</td>
              <td><RowStatusBadge status={r.status} />{r.issues.length > 0 && <ul className="mt-1 text-xs text-stone-700">{r.issues.map((i, k) => <li key={k}>{i}</li>)}</ul>}</td>
            </tr>
          ))}</tbody>
        </Table>
        <Pagination page={page} pages={pages} hrefFor={(p) => qs({ page: String(p) })} />
      </Section>
    </div>
  );
}
