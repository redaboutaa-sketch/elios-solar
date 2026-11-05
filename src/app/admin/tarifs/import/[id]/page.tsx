import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Flash, PageTitle, Section, StatusBadge, Table } from "@/components/admin/ui";
import { NATURE_LABEL, formatAmount, type Nature } from "@/domain/tariffs";
import { COLUMN_FR, TariffError } from "@/server/tariffs/grids";
import { familiesInfo } from "@/server/tariffs/queries";
import { previewUpload } from "@/server/tariffs/upload";
import { cancelUploadAction, saveMappingAction } from "@/server/actions/admin/tariffs";
import { ConfidentialNote, fmtMm, fmtWidth, variantLabel } from "../../labels";

export const metadata: Metadata = { title: "Prévisualisation de l'import" };

export default async function UploadPreviewPage(props: PageProps<"/admin/tarifs/import/[id]">) {
  await requireRole(["ADMIN"]);
  const { id } = await props.params;
  const up = await prisma.priceImportUpload.findUnique({ where: { id }, include: { files: { select: { fileName: true, sha256: true, size: true } } } });
  if (!up) notFound();
  if (up.status !== "ANALYSED") {
    const r = up.result as { imports?: { fileName: string; version: number; reused: boolean }[]; grids?: { fileName: string; created: { id: string; sourceKey: string; version: number; cells: number }[]; unchanged: { sourceKey: string; version: number }[]; keptDrafts: { sourceKey: string; version: number }[] }[] };
    return (
      <div className="space-y-6">
        <PageTitle title="Import" backHref="/admin/tarifs/import" backLabel="Importer" />
        <Flash searchParams={props.searchParams} />
        <Section title={up.status === "IMPORTED" ? "Résultat de l'import" : "Téléversement abandonné"}>
          {up.status === "IMPORTED" ? (
            <div className="space-y-3 text-sm" data-testid="import-result">
              {r.imports?.map((i) => <p key={i.fileName}>{i.fileName} : {i.reused ? `déjà importé (version v${i.version} réutilisée, aucun doublon)` : `nouvelle version v${i.version}`}.</p>)}
              {r.grids?.map((g) => (
                <div key={g.fileName}>
                  <p>Brouillons créés : {g.created.length} · grilles inchangées : {g.unchanged.length}{g.keptDrafts.length ? ` · brouillons existants conservés : ${g.keptDrafts.map((k) => `${k.sourceKey} v${k.version}`).join(", ")}` : ""}</p>
                  <ul className="list-disc pl-5">{g.created.map((c) => <li key={c.id}><Link className="underline" href={`/admin/tarifs/grilles/${c.id}`}>{c.sourceKey} v{c.version}</Link> ({c.cells} cellules)</li>)}</ul>
                </div>
              ))}
              <p className="text-stone-700">Rien n'a été publié. Complétez les paramètres de chaque brouillon, vérifiez-le, puis publiez-le. Les fichiers téléversés ont été effacés.</p>
            </div>
          ) : <p className="text-sm">Fichiers effacés ; rien n'a été importé.</p>}
        </Section>
      </div>
    );
  }
  let p;
  try {
    p = await previewUpload(id);
  } catch (e) {
    if (e instanceof Error && (e instanceof TariffError || e.name === "SourceError" || e.name === "SupplierPriceError")) return <div className="space-y-4"><PageTitle title="Prévisualisation" backHref="/admin/tarifs/import" backLabel="Importer" /><Section><p className="text-danger">{e.message}</p><form action={cancelUploadAction} className="mt-3"><input type="hidden" name="uploadId" value={id} /><button className="btn-secondary" type="submit">Abandonner</button></form></Section></div>;
    throw e;
  }
  const fams = await familiesInfo();
  return (
    <div className="space-y-6">
      <PageTitle title="Analyse et prévisualisation" backHref="/admin/tarifs/import" backLabel="Importer" />
      <Flash searchParams={props.searchParams} />
      <ConfidentialNote />
      <Section title="2. Analyse des fichiers">
        <Table caption="Fichiers analysés">
          <thead><tr><th>Fichier</th><th>Empreinte</th><th>Déjà importé</th><th>Devise</th><th>Structure</th><th>Lignes</th><th>Combinaisons manquantes</th><th>Écarts fiche ↔ classeur</th></tr></thead>
          <tbody data-testid="upload-sources">
            {p.sources.map((s) => (
              <tr key={s.sha256}>
                <td>{s.fileName}<div className="text-xs text-stone-700">{s.type} · {s.sourceKey}</div></td>
                <td className="font-mono text-xs">{s.sha256.slice(0, 12)}</td>
                <td>{s.existing ? <StatusBadge tone="neutral">oui — v{s.existing.version} réutilisée</StatusBadge> : "non"}</td>
                <td className="max-w-64 text-xs">{s.currency ?? <StatusBadge tone="warn">non indiquée</StatusBadge>}<div className="text-stone-700">{s.currencyNote}</div></td>
                <td className="text-xs">{s.structure ? <>feuilles masquées {s.structure.hiddenSheets.length} · liens externes {s.structure.externalLinks} (non suivis) · commentaires {s.structure.comments} · mentions HT/TTC {s.structure.mentionsTax}</> : "—"}</td>
                <td className="text-xs">{s.counts.total} · {Object.entries(s.counts.byStatus).map(([k, v]) => `${k} ${v}`).join(" · ")}</td>
                <td>{s.gaps}</td>
                <td className="text-xs">{Object.entries(s.discrepancies).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        {p.sources.flatMap((s) => s.notes).length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-stone-800">{[...new Set(p.sources.flatMap((s) => s.notes))].map((n) => <li key={n}>{n}</li>)}</ul>}
      </Section>

      <form action={saveMappingAction} className="space-y-6">
        <input type="hidden" name="uploadId" value={id} />
        <Section title="3. Produits, variantes et grilles reconnus — corriger les correspondances">
          <Table caption="Grilles détectées">
            <thead><tr><th>Feuille / bloc détecté</th><th>Produit</th><th>Variante</th><th>Axe principal</th><th>Colonnes, unités et montants interprétés</th><th>Contrôles</th></tr></thead>
            <tbody data-testid="upload-groups">
              {p.groups.map((g) => {
                const m = p.defaults.groups[g.id]!;
                return (
                  <tr key={g.id}>
                    <td><input type="hidden" name="group" value={g.id} />{g.sheet}<div className="text-xs text-stone-700">{g.fileName} · détecté : {g.detectedFamily} / {variantLabel(g.detectedVariant)}</div></td>
                    <td><select name={`g:${g.id}:family`} className="input min-h-0 py-1" defaultValue={m.familySlug ?? "_skip"} aria-label={`Produit pour ${g.sheet}`}><option value="_skip">Ignorer ce bloc</option>{fams.map((f) => <option key={f.slug} value={f.slug}>{f.name} ({f.supplierRef ?? f.slug})</option>)}</select></td>
                    <td><input name={`g:${g.id}:variant`} className="input min-h-0 w-32 py-1" defaultValue={m.variantKey} aria-label={`Variante pour ${g.sheet}`} placeholder="unique" /></td>
                    <td><select name={`g:${g.id}:dim`} className="input min-h-0 py-1" defaultValue={m.dimAKey} aria-label={`Axe pour ${g.sheet}`}><option value="projection">Projection / avancée</option><option value="hauteur">Hauteur</option></select></td>
                    <td className="text-xs">{g.roles.map((r) => <div key={r.role} className="mb-1"><strong>{r.label}</strong> : {r.cells} cellule(s){r.empty ? `, ${r.empty} vide(s)` : ""}{r.toCheck ? `, ${r.toCheck} à vérifier` : ""} · de {formatAmount(r.minMinor, "")} à {formatAmount(r.maxMinor, "")} (devise selon la colonne) · axe {r.dims.length} valeur(s) {r.dims.length ? `${fmtMm(r.dims[0]!)} → ${fmtMm(r.dims.at(-1)!)}` : ""} · largeurs {r.widths.length} {r.widths.length ? `(${fmtWidth(r.widths[0]!.min, r.widths[0]!.max)} → ${fmtWidth(r.widths.at(-1)!.min, r.widths.at(-1)!.max)})` : ""} · unités source : cm, converties en mm</div>)}</td>
                    <td className="max-w-72 text-xs">{g.issues.map((i) => <div key={i.issue}>{i.issue} ({i.count})</div>)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Section>

        <Section title="Interprétation des colonnes">
          <p className="mb-2 text-sm text-stone-700">Aucune source n'établit la nature, la devise ou la fiscalité du classeur : sans valeur établie, les grilles restent des brouillons non publiables. Les valeurs proposées sont reprises de la grille publiée correspondante quand elle existe.</p>
          <Table caption="Colonnes">
            <thead><tr><th>Colonne</th><th>Créer des grilles</th><th>Nature</th><th>Devise</th><th>HT / TTC</th></tr></thead>
            <tbody>
              {Object.entries(p.defaults.columns).map(([role, c]) => (
                <tr key={role}>
                  <td><input type="hidden" name="column" value={role} />{COLUMN_FR[role] ?? role}</td>
                  <td><input type="checkbox" name={`c:${role}:enabled`} defaultChecked={c.enabled} aria-label={`Créer des grilles pour ${COLUMN_FR[role] ?? role}`} /></td>
                  <td><select name={`c:${role}:nature`} className="input min-h-0 py-1" defaultValue={c.nature} aria-label="Nature">{(Object.keys(NATURE_LABEL) as Nature[]).map((n) => <option key={n} value={n}>{NATURE_LABEL[n]}</option>)}</select></td>
                  <td><input name={`c:${role}:currency`} className="input min-h-0 w-20 py-1 uppercase" maxLength={3} defaultValue={c.currency ?? ""} placeholder="?" aria-label="Devise" /></td>
                  <td><select name={`c:${role}:tax`} className="input min-h-0 py-1" defaultValue={c.taxBasis} aria-label="HT ou TTC"><option value="UNKNOWN">Non établi</option><option value="HT">HT</option><option value="TTC">TTC</option></select></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <Section title="4. Changements par rapport aux grilles existantes">
          <Table caption="Changements">
            <thead><tr><th>Grille</th><th>Dernière version</th><th>Modifiées</th><th>Ajoutées</th><th>Retirées</th><th>Identiques</th><th>Effet</th></tr></thead>
            <tbody data-testid="upload-changes">
              {p.changes.map((c) => {
                const same = c.previous && !c.added && !c.removed && !c.changed;
                return <tr key={c.sourceKey}><td>{c.sourceKey}</td><td>{c.previous ? `v${c.previous.version} (${c.previous.status})` : "aucune"}</td><td>{c.changed}</td><td>{c.added}</td><td>{c.removed}</td><td>{c.unchanged}</td><td>{same ? <StatusBadge tone="neutral">inchangée : aucun brouillon</StatusBadge> : <StatusBadge tone="warn">nouveau brouillon</StatusBadge>}</td></tr>;
              })}
            </tbody>
          </Table>
          {p.unusable.length > 0 && <details className="mt-3 text-sm"><summary>{p.unusable.length} cellule(s) non exploitable(s)</summary><ul className="mt-1 list-disc pl-5 text-xs">{p.unusable.map((u) => <li key={u.sourceRef}>{u.sourceRef} — {u.issues.join(" ; ") || "vide"}</li>)}</ul></details>}
        </Section>

        <Section title="Informations empêchant une publication">
          {p.blockers.length ? <ul className="list-disc pl-5 text-sm text-danger" data-testid="upload-blockers">{p.blockers.map((b) => <li key={b}>{b}</li>)}</ul> : <p className="text-sm text-stone-700">Aucune au niveau de l'import (chaque grille est contrôlée de nouveau avant publication).</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn-secondary" type="submit" name="intent" value="save">Enregistrer les correspondances et actualiser</button>
            <button className="btn-primary" type="submit" name="intent" value="import" data-testid="import-upload">Importer en brouillon</button>
          </div>
        </Section>
      </form>
      <form action={cancelUploadAction}><input type="hidden" name="uploadId" value={id} /><button className="btn-ghost text-danger" type="submit">Abandonner ce téléversement</button></form>
      <p className="text-xs text-stone-700">Téléversé le {up.createdAt.toLocaleString("fr-FR")} par {up.createdBy ?? "—"} · {up.files.map((f) => `${f.fileName} (${Math.round(f.size / 1024)} Ko)`).join(", ")}</p>
    </div>
  );
}
