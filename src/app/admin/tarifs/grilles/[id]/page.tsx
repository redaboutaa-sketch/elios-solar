import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Section, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { TariffGridEditor, type EditorCell } from "@/components/admin/tariff-grid-editor";
import { CLIENTELE_LABEL, DERIVE_LABEL, DIM_RULE_LABEL, NATURE_LABEL, diffCells, formatAmount, formatAmountInput, type Clientele, type DimRule, type Nature } from "@/domain/tariffs";
import { checksFor, EDITABLE, getGrid, gridCells, TariffError } from "@/server/tariffs/grids";
import { gridDetail, previousVersionOf } from "@/server/tariffs/queries";
import { deactivateAction, deriveAction, publishAction, rejectAction, restoreAction, saveCellsAction, saveFixedAction, saveParamsAction, verifyAction } from "@/server/actions/admin/tariffs";
import { toDateInput } from "@/server/admin/form";
import { ConfidentialNote, ContextBadges, StateBadge, columnLabel, fmtMm, fmtWidth, variantLabel } from "../../labels";

export const metadata: Metadata = { title: "Grille tarifaire" };

const ACTION_FR: Record<string, string> = { "tariffs.cells": "Cellules modifiées", "tariffs.params": "Paramètres modifiés", "tariffs.verify": "Vérifiée", "tariffs.publish": "Publiée", "tariffs.deactivate": "Désactivée", "tariffs.restoreAsDraft": "Créée en reprenant une version", "tariffs.reject": "Rejetée", "tariffs.derive": "Créée par recalcul", "tariffs.fixed": "Tarifs fixes modifiés", "tariffs.create": "Créée (saisie manuelle)" };
const dtLocal = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");

export default async function GridPage(props: PageProps<"/admin/tarifs/grilles/[id]">) {
  await requireRole(["ADMIN"]);
  const { id } = await props.params;
  const sp = await props.searchParams;
  let detail;
  try {
    detail = await gridDetail(id);
  } catch (e) {
    if (e instanceof TariffError) notFound();
    throw e;
  }
  const { grid: g, state, rows, versions, origin, basedOn, family, history, siblings } = detail;
  const editable = EDITABLE.has(g.status);
  const checks = await checksFor(g);
  const blocking = checks.filter((c) => c.severity === "blocking");
  const gridRows = rows.filter((r) => r.kind === "GRID" && r.dimAmm != null && r.widthMaxMm != null);
  const fixed = rows.filter((r) => r.kind === "FIXED");
  const dimAKey = gridRows[0]?.dimAKey ?? (/hauteur/.test(g.notes) ? "hauteur" : "projection");
  const dimLabel = dimAKey === "hauteur" ? "Hauteur" : g.familySlug === "helio-riviera" ? "Avancée" : "Projection";
  const cells: EditorCell[] = gridRows.map((r) => ({ dimAmm: r.dimAmm!, widthMinMm: r.widthMinMm ?? r.widthMaxMm!, widthMaxMm: r.widthMaxMm!, amountMinor: r.amountMinor, sourceRef: r.sourceRef, origin: r.origin, editedBy: r.editedBy, editedAt: r.editedAt?.toISOString() ?? null, status: r.status, issues: r.issues, formula: r.formula }));

  // comparaison : version choisie (?compare=) ou version publiée précédente
  const cmpId = typeof sp.compare === "string" ? sp.compare : (await previousVersionOf(g))?.id;
  const cmp = cmpId ? await getGrid(cmpId).catch(() => null) : null;
  const diff = cmp ? diffCells(await gridCells(cmp.id), await gridCells(g.id)) : null;
  const pct = (a: number | null, b: number | null) => (a && b != null ? `${((b - a) / a * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2, signDisplay: "always" })} %` : "");
  const formulas = [...new Set(gridRows.map((r) => r.formula?.replace(/[A-Z]+\d+/g, "Prix")).filter(Boolean))];

  return (
    <div className="space-y-6">
      <PageTitle title={`${family?.name ?? g.familySlug} — ${variantLabel(g.variantKey)} · v${g.version}`} backHref="/admin/tarifs" backLabel="Tarifs" />
      <Flash searchParams={props.searchParams} />
      <ConfidentialNote />

      <Section>
        <div className="flex flex-wrap items-center gap-3 text-sm" data-testid="grid-header">
          <StateBadge state={state} />
          <ContextBadges nature={g.nature} currency={g.currency} taxBasis={g.taxBasis} clientele={g.clientele} />
          <span>Colonne : <strong>{columnLabel(g.amountRole)}</strong></span>
          <span>Correspondance fournisseur (interne) : <strong>{family?.supplierRef ?? "—"}</strong></span>
          {family?.status === "DRAFT" && <StatusBadge tone="warn">Produit en brouillon : hors catalogue public</StatusBadge>}
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div><dt className="inline text-stone-700">Libellé : </dt><dd className="inline">{g.label}</dd></div>
          <div><dt className="inline text-stone-700">Origine : </dt><dd className="inline">{origin ? <>fichier <strong>{origin.sourceFile}</strong> (import {origin.sourceKey} v{origin.version}, le {fmtDate(origin.createdAt)}{origin.importedBy ? ` par ${origin.importedBy}` : ""}, empreinte {origin.sourceSha256.slice(0, 12)})</> : g.sourceFile}</dd></div>
          {basedOn && <div><dt className="inline text-stone-700">Reprise de : </dt><dd className="inline"><Link className="underline" href={`/admin/tarifs/grilles/${basedOn.id}`}>{basedOn.sourceKey} v{basedOn.version}</Link></dd></div>}
          <div><dt className="inline text-stone-700">Validité : </dt><dd className="inline">{g.validFrom ? fmtDate(g.validFrom) : "dès publication"} → {g.validTo ? fmtDate(g.validTo) : "sans fin"}</dd></div>
          <div><dt className="inline text-stone-700">Lecture des cotes : </dt><dd className="inline">{DIM_RULE_LABEL[g.dimRule as DimRule]}{g.dimRuleNote ? ` — ${g.dimRuleNote}` : ""}</dd></div>
          <div><dt className="inline text-stone-700">Publication : </dt><dd className="inline">{g.publishedAt ? `${fmtDate(g.publishedAt)} par ${g.publishedBy ?? "—"}` : "—"}{g.verifiedAt ? ` · vérifiée ${fmtDate(g.verifiedAt)} par ${g.verifiedBy ?? "—"}` : ""}{g.deactivatedAt ? ` · désactivée ${fmtDate(g.deactivatedAt)} par ${g.deactivatedBy ?? "—"}` : ""}</dd></div>
        </dl>
      </Section>

      <Section title="Contrôles avant publication">
        {checks.length ? (
          <ul className="space-y-1 text-sm" data-testid="grid-checks">
            {checks.map((c) => <li key={c.code + c.message} className={c.severity === "blocking" ? "text-danger" : "text-stone-800"}><strong>{c.severity === "blocking" ? "Bloquant" : "Avertissement"} :</strong> {c.message}</li>)}
          </ul>
        ) : <p className="text-sm text-success">Aucune anomalie.</p>}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          {editable && (
            <form action={verifyAction}><input type="hidden" name="id" value={g.id} /><input type="hidden" name="revision" value={g.revision} /><button className="btn-secondary" type="submit" data-testid="verify-grid">Vérifier la grille</button></form>
          )}
          {g.status === "VERIFIED" && (
            <form action={publishAction} className="flex flex-wrap items-end gap-2 rounded-md border border-sand-200 p-2 text-sm" data-testid="publish-form">
              <input type="hidden" name="id" value={g.id} /><input type="hidden" name="revision" value={g.revision} />
              <label className="flex items-center gap-1"><input type="radio" name="when" value="now" defaultChecked /> immédiatement</label>
              <label className="flex items-center gap-1"><input type="radio" name="when" value="later" /> le</label>
              <label className="sr-only" htmlFor="publish-at">Date et heure de publication</label>
              <input id="publish-at" type="datetime-local" name="at" className="input min-h-0 py-1" />
              <button className="btn-primary" type="submit" disabled={blocking.length > 0}>Publier</button>
            </form>
          )}
          {editable && <form action={rejectAction}><input type="hidden" name="id" value={g.id} /><button className="btn-ghost text-danger" type="submit">Rejeter le brouillon</button></form>}
          {g.status === "ACTIVE" && (
            <form action={deactivateAction}><input type="hidden" name="id" value={g.id} /><button className="btn-secondary text-danger" type="submit" data-testid="deactivate-grid">Désactiver cette version</button></form>
          )}
          {!editable && <form action={restoreAction}><input type="hidden" name="id" value={g.id} /><button className="btn-secondary" type="submit" data-testid="restore-grid">{g.status === "ACTIVE" ? "Modifier (nouveau brouillon)" : "Reprendre en brouillon"}</button></form>}
        </div>
        <p className="mt-2 text-xs text-stone-700">Une version publiée n'est jamais modifiée : « Modifier » crée un brouillon. Publier fixe la fin de validité de la version en vigueur du même contexte ; un brouillon créé avant une autre publication est refusé (obsolète). Désactiver ne réactive aucune ancienne version : les configurations concernées passent au devis. Les devis et commandes émis gardent leur prix.</p>
      </Section>

      <Section title="Paramètres commerciaux">
        {editable ? (
          <form action={saveParamsAction} className="grid gap-3 text-sm md:grid-cols-3">
            <input type="hidden" name="id" value={g.id} /><input type="hidden" name="revision" value={g.revision} />
            <label className="flex flex-col">Nature du prix<select name="nature" className="input" defaultValue={g.nature}>{(Object.keys(NATURE_LABEL) as Nature[]).map((n) => <option key={n} value={n}>{NATURE_LABEL[n]}</option>)}</select></label>
            <label className="flex flex-col">Devise (ISO)<input name="currency" className="input uppercase" maxLength={3} defaultValue={g.currency ?? ""} placeholder="non renseignée" /></label>
            <label className="flex flex-col">Montants<select name="taxBasis" className="input" defaultValue={g.taxBasis}><option value="UNKNOWN">HT ou TTC : non établi</option><option value="HT">HT</option><option value="TTC">TTC</option></select></label>
            <label className="flex flex-col">Taux de TVA (%) — vide = taux du catalogue<input name="vatRate" className="input" inputMode="decimal" defaultValue={g.vatRateBps != null ? String(g.vatRateBps / 100).replace(".", ",") : ""} /></label>
            <label className="flex flex-col">Clientèle<select name="clientele" className="input" defaultValue={g.clientele}>{(Object.keys(CLIENTELE_LABEL) as Clientele[]).map((c) => <option key={c} value={c}>{CLIENTELE_LABEL[c]}</option>)}</select></label>
            <label className="flex flex-col">Lecture des cotes<select name="dimRule" className="input" defaultValue={g.dimRule}>{(Object.keys(DIM_RULE_LABEL) as DimRule[]).map((r) => <option key={r} value={r}>{DIM_RULE_LABEL[r]}</option>)}</select></label>
            <label className="flex flex-col md:col-span-3">Justification de la lecture à la dimension supérieure (qui l'a confirmée, quand)<input name="dimRuleNote" className="input" defaultValue={g.dimRuleNote} /></label>
            <label className="flex flex-col">Début de validité (vide = à la publication)<input type="datetime-local" name="validFrom" className="input" defaultValue={dtLocal(g.validFrom)} /></label>
            <label className="flex flex-col">Fin de validité (vide = sans fin)<input type="datetime-local" name="validTo" className="input" defaultValue={dtLocal(g.validTo)} /></label>
            <label className="flex items-center gap-2 self-end"><input type="checkbox" name="zeroConfirmed" defaultChecked={g.zeroConfirmed} /> Les prix nuls sont voulus</label>
            <label className="flex flex-col md:col-span-3">Origine de la nature (source, décision)<textarea name="natureNote" className="input min-h-16" defaultValue={g.natureNote} /></label>
            <label className="flex flex-col md:col-span-3">Variantes ou implantations concernées<input name="scopeNote" className="input" defaultValue={g.scopeNote} placeholder={g.variantKey ? `variante « ${g.variantKey} » du classeur` : ""} /></label>
            <label className="flex flex-col md:col-span-3">Éléments inclus<textarea name="included" className="input min-h-16" defaultValue={g.included} /></label>
            <label className="flex flex-col md:col-span-3">Éléments exclus<textarea name="excluded" className="input min-h-16" defaultValue={g.excluded} /></label>
            <label className="flex flex-col md:col-span-3">Notes internes<textarea name="notes" className="input min-h-16" defaultValue={g.notes} /></label>
            <div className="md:col-span-3"><button className="btn-secondary" type="submit">Enregistrer les paramètres</button></div>
          </form>
        ) : (
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div><dt className="inline text-stone-700">Nature : </dt><dd className="inline">{NATURE_LABEL[g.nature as Nature]}</dd></div>
            <div><dt className="inline text-stone-700">Devise / base : </dt><dd className="inline">{g.currency ?? "—"} · {g.taxBasis}</dd></div>
            <div><dt className="inline text-stone-700">TVA : </dt><dd className="inline">{g.vatRateBps != null ? `${g.vatRateBps / 100} %` : "taux du catalogue"}</dd></div>
            <div><dt className="inline text-stone-700">Clientèle : </dt><dd className="inline">{CLIENTELE_LABEL[g.clientele as Clientele]}</dd></div>
            <div className="sm:col-span-2"><dt className="inline text-stone-700">Origine de la nature : </dt><dd className="inline">{g.natureNote || "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="inline text-stone-700">Concerne : </dt><dd className="inline">{g.scopeNote || "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="inline text-stone-700">Inclus : </dt><dd className="inline">{g.included || "non renseigné"}</dd></div>
            <div className="sm:col-span-2"><dt className="inline text-stone-700">Exclus : </dt><dd className="inline">{g.excluded || "non renseigné"}</dd></div>
            <div className="sm:col-span-2"><dt className="inline text-stone-700">Notes : </dt><dd className="inline whitespace-pre-line">{g.notes || "—"}</dd></div>
          </dl>
        )}
      </Section>

      <Section title={`Grille : ${dimLabel.toLowerCase()} × largeur (${gridRows.length} cellule(s), montants en ${g.currency ?? "devise non renseignée"} ${g.taxBasis === "UNKNOWN" ? "HT/TTC non établi" : g.taxBasis})`}>
        <p className="mb-2 text-xs text-stone-700">Unités : cotes en mètres (enregistrées en millimètres), montants en {g.currency ?? "devise à renseigner"}, au centime. {editable ? "Saisissez directement une cellule, ou sélectionnez-en plusieurs pour une action groupée." : "Version non modifiable."}</p>
        <TariffGridEditor id={g.id} revision={g.revision} editable={editable} dimLabel={dimLabel} currency={g.currency} cells={cells} importedAt={origin?.createdAt.toISOString() ?? null} action={saveCellsAction} />
        {formulas.length > 0 && <p className="mt-3 text-xs text-stone-700">Règle observée dans le classeur pour cette colonne (valeurs en cache, jamais recalculées ; non validée comme règle commerciale) : {formulas.slice(0, 3).map((f) => <code key={f} className="mr-2">{f}</code>)}</p>}
      </Section>

      <Section title={`Tarifs fixes (${fixed.length})`}>
        <p className="mb-2 text-xs text-stone-700">Forfaits ou options à prix fixe, versionnés avec la grille. Les options restent chiffrées au devis par le configurateur : un tarif fixe ne rend pas une option commandable en ligne.</p>
        {editable ? (
          <form action={saveFixedAction} className="space-y-2 text-sm">
            <input type="hidden" name="id" value={g.id} /><input type="hidden" name="revision" value={g.revision} />
            <Table caption="Tarifs fixes">
              <thead><tr><th>Code</th><th>Libellé</th><th>Unité</th><th>Montant ({g.currency ?? "?"})</th><th>Origine</th></tr></thead>
              <tbody>
                {[...fixed, null, null].map((r, i) => (
                  <tr key={r?.id ?? `new-${i}`}>
                    <td><input name="code" className="input min-h-0 w-32 py-1" defaultValue={r?.code ?? ""} aria-label="Code" /></td>
                    <td><input name="label" className="input min-h-0 w-64 py-1" defaultValue={r?.label ?? ""} aria-label="Libellé" /></td>
                    <td><input name="unit" className="input min-h-0 w-28 py-1" defaultValue={(r?.conditions as { unit?: string } | null)?.unit ?? "forfait"} aria-label="Unité" /></td>
                    <td><input name="value" className="input min-h-0 w-28 py-1" inputMode="decimal" defaultValue={formatAmountInput(r?.amountMinor)} aria-label="Montant" /></td>
                    <td className="text-xs text-stone-700">{r ? r.sourceRef : "nouveau"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <button className="btn-secondary" type="submit">Enregistrer les tarifs fixes</button>
          </form>
        ) : fixed.length ? (
          <Table caption="Tarifs fixes"><thead><tr><th>Code</th><th>Libellé</th><th>Unité</th><th>Montant</th></tr></thead><tbody>{fixed.map((r) => <tr key={r.id}><td>{r.code}</td><td>{r.label}</td><td>{(r.conditions as { unit?: string } | null)?.unit ?? "—"}</td><td>{formatAmount(r.amountMinor, g.currency)}</td></tr>)}</tbody></Table>
        ) : <p className="text-sm text-stone-700">Aucun.</p>}
      </Section>

      <Section title="Comparaison avant publication">
        <form method="get" className="mb-3 flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col">Comparer avec<select name="compare" className="input min-h-0 py-1" defaultValue={cmp?.id ?? ""}>
            {versions.filter((v) => v.id !== g.id).map((v) => <option key={v.id} value={v.id}>v{v.version} — {v.state}</option>)}
            {siblings.map((s) => <option key={s.id} value={s.id}>{columnLabel(s.amountRole)} v{s.version}</option>)}
          </select></label>
          <button className="btn-secondary min-h-0 py-1.5" type="submit">Comparer</button>
        </form>
        {cmp && diff ? (
          <>
            <p className="text-sm" data-testid="grid-diff-summary">Par rapport à <Link className="underline" href={`/admin/tarifs/grilles/${cmp.id}`}>{cmp.sourceKey} v{cmp.version}</Link> : <strong>{diff.changed.length}</strong> modifiée(s), <strong>{diff.added.length}</strong> ajoutée(s), <strong>{diff.removed.length}</strong> retirée(s), {diff.unchanged} identique(s).</p>
            {diff.changed.length + diff.added.length + diff.removed.length > 0 && (
              <Table caption="Cellules différentes">
                <thead><tr><th>{dimLabel}</th><th>Largeur</th><th>v{cmp.version}</th><th>v{g.version}</th><th>Écart</th></tr></thead>
                <tbody>
                  {[...diff.changed, ...diff.added, ...diff.removed].slice(0, 300).map((c) => (
                    <tr key={`${c.dimAmm}|${c.widthMinMm}|${c.widthMaxMm}`}>
                      <td>{fmtMm(c.dimAmm)}</td><td>{fmtWidth(c.widthMinMm, c.widthMaxMm)}</td>
                      <td>{c.before == null && !diff.changed.includes(c) && !diff.removed.includes(c) ? "non tarifée" : formatAmount(c.before, cmp.currency)}</td>
                      <td>{diff.removed.includes(c) ? "non tarifée" : formatAmount(c.after, g.currency)}</td>
                      <td>{pct(c.before, c.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        ) : <p className="text-sm text-stone-700">Aucune autre version à comparer.</p>}
      </Section>

      {siblings.length > 0 && (
        <Section title="Recalculer depuis une grille de base">
          <p className="mb-2 text-sm text-stone-700">Crée un nouveau brouillon de cette grille, recalculé cellule par cellule depuis une autre grille du même produit et de la même variante. Aucune valeur n'est proposée : saisissez la règle confirmée. Arrondi au centime, au demi supérieur.</p>
          <form action={deriveAction} className="flex flex-wrap items-end gap-3 text-sm">
            <input type="hidden" name="id" value={g.id} />
            <label className="flex flex-col">Grille de base<select name="baseId" className="input min-h-0 py-1">{siblings.map((s) => <option key={s.id} value={s.id}>{columnLabel(s.amountRole)} v{s.version} ({NATURE_LABEL[s.nature as Nature]})</option>)}</select></label>
            <label className="flex flex-col">Règle<select name="mode" className="input min-h-0 py-1">{(Object.keys(DERIVE_LABEL) as (keyof typeof DERIVE_LABEL)[]).map((m) => <option key={m} value={m}>{DERIVE_LABEL[m]}</option>)}</select></label>
            <label className="flex flex-col">Valeur (k ou %)<input name="value" className="input min-h-0 w-28 py-1" inputMode="decimal" required /></label>
            <button className="btn-secondary min-h-0 py-1.5" type="submit">Créer le brouillon recalculé</button>
          </form>
          <p className="mt-2 text-xs text-stone-700">Majoration sur coût (m % du coût d'achat) et marge sur prix de vente (t % du prix de vente) ne sont pas équivalentes : 25 % de majoration ≠ 25 % de marge. La commission commerciale n'est pas une règle de majoration.</p>
        </Section>
      )}

      <Section title="Versions et journal">
        <Table caption="Versions de cette grille">
          <thead><tr><th>Version</th><th>Statut</th><th>Créée</th><th>Publiée</th><th>Validité</th></tr></thead>
          <tbody>{versions.map((v) => <tr key={v.id} className={v.id === g.id ? "bg-brand-50" : ""}><td><Link className="underline" href={`/admin/tarifs/grilles/${v.id}`}>v{v.version}</Link></td><td><StateBadge state={v.state} /></td><td>{fmtDate(v.createdAt)}</td><td>{fmtDate(v.publishedAt)}</td><td className="text-xs">{v.validFrom ? toDateInput(v.validFrom) : "—"} → {v.validTo ? toDateInput(v.validTo) : "sans fin"}</td></tr>)}</tbody>
        </Table>
        <h3 className="mt-4 font-medium">Journal de cette version</h3>
        <ul className="mt-1 space-y-1 text-sm" data-testid="grid-history">
          {history.length ? history.map((h) => <li key={h.id}>{fmtDate(h.createdAt)} · <strong>{ACTION_FR[h.action] ?? h.action}</strong> · {h.actorEmail ?? "—"} <span className="text-xs text-stone-700">{summarize(h.after)}</span></li>) : <li className="text-stone-700">Aucune opération.</li>}
        </ul>
      </Section>
    </div>
  );
}

function summarize(after: unknown): string {
  if (!after || typeof after !== "object") return "";
  const a = after as Record<string, unknown>;
  const parts: string[] = [];
  for (const k of ["added", "changed", "cleared", "removed"]) if (typeof a[k] === "number" && a[k]) parts.push(`${k} ${a[k]}`);
  if (a.from) parts.push(`à partir du ${new Date(String(a.from)).toLocaleString("fr-FR")}`);
  if (Array.isArray(a.replaced) && a.replaced.length) parts.push(`remplace v${(a.replaced as { version: number }[]).map((r) => r.version).join(", v")}`);
  const keys = Object.keys(a).filter((k) => !["sourceKey", "version", "added", "changed", "cleared", "removed", "from", "replaced", "scheduled"].includes(k));
  if (keys.length && !parts.length) parts.push(keys.join(", "));
  return parts.join(" · ");
}
