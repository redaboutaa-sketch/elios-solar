import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { DATA_STATUS_FR, DataStatusBadge, Flash, Options, PageTitle, Section, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { DATA_STATUSES, DOCUMENT_AUDIENCES, DOCUMENT_AUDIENCE_FR, DOCUMENT_KINDS, DOCUMENT_KIND_FR, DOCUMENT_STATUS_FR, DOCUMENT_TRANSITIONS } from "@/server/documents/versions";
import { createDocumentAction, deleteDocumentAction, newVersionAction, setDocumentStatusAction, updateDocumentAction } from "@/server/actions/admin/documents";

export const metadata: Metadata = { title: "Documents" };

const STATUS_TONE: Record<string, "ok" | "warn" | "neutral" | "err"> = { DRAFT: "neutral", REVIEW: "warn", PUBLISHED: "ok", ARCHIVED: "err" };
const ACTION_FR: Record<string, string> = { REVIEW: "Soumettre à relecture", PUBLISHED: "Valider et publier", ARCHIVED: "Archiver", DRAFT: "Remettre en brouillon" };

type Fam = { id: string; name: string };

function MetaFields({ prefix, families, pdfs, d }: { prefix: string; families: Fam[]; pdfs: Array<{ id: string; title: string; alt: string }>; d?: { title: string; kind: string; summary: string; audience: string; dataStatus: string; source: string; notes: string; familyId: string | null; variantSku: string | null; mediaId: string | null } }) {
  return (
    <>
      <div className="md:col-span-2"><label className="label" htmlFor={`${prefix}-title`}>Titre</label><input id={`${prefix}-title`} name="title" required maxLength={200} className="input" defaultValue={d?.title} /></div>
      <div><label className="label" htmlFor={`${prefix}-kind`}>Type</label><select id={`${prefix}-kind`} name="kind" className="input" defaultValue={d?.kind ?? "notice"}><Options values={DOCUMENT_KINDS} labels={DOCUMENT_KIND_FR} /></select></div>
      <div><label className="label" htmlFor={`${prefix}-audience`}>Audience</label><select id={`${prefix}-audience`} name="audience" className="input" defaultValue={d?.audience ?? "PUBLIC"}><Options values={DOCUMENT_AUDIENCES} labels={DOCUMENT_AUDIENCE_FR} /></select></div>
      <div><label className="label" htmlFor={`${prefix}-family`}>Famille</label><select id={`${prefix}-family`} name="familyId" className="input" defaultValue={d?.familyId ?? ""}><option value="">Aucune (document général)</option>{families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
      <div><label className="label" htmlFor={`${prefix}-sku`}>Variante (SKU, facultatif)</label><input id={`${prefix}-sku`} name="variantSku" maxLength={80} className="input font-mono" defaultValue={d?.variantSku ?? ""} /></div>
      <div><label className="label" htmlFor={`${prefix}-ds`}>Fiabilité des données</label><select id={`${prefix}-ds`} name="dataStatus" className="input" defaultValue={d?.dataStatus ?? "UNKNOWN"}><Options values={DATA_STATUSES} labels={DATA_STATUS_FR} /></select></div>
      <div><label className="label" htmlFor={`${prefix}-source`}>Source</label><input id={`${prefix}-source`} name="source" maxLength={300} className="input" placeholder="fournisseur, référence, date de réception" defaultValue={d?.source} /></div>
      <div className="md:col-span-2"><label className="label" htmlFor={`${prefix}-summary`}>Résumé (affiché en boutique)</label><textarea id={`${prefix}-summary`} name="summary" rows={2} maxLength={2000} className="input" defaultValue={d?.summary} /></div>
      <div className="md:col-span-2"><label className="label" htmlFor={`${prefix}-notes`}>Notes internes</label><textarea id={`${prefix}-notes`} name="notes" rows={2} maxLength={2000} className="input" defaultValue={d?.notes} /></div>
      <div className="md:col-span-2"><label className="label" htmlFor={`${prefix}-media`}>PDF existant de la médiathèque</label><select id={`${prefix}-media`} name="mediaId" className="input" defaultValue={d?.mediaId ?? ""}><option value="">Aucun</option>{pdfs.map((m) => <option key={m.id} value={m.id}>{m.title || m.alt}</option>)}</select></div>
      <div className="md:col-span-2"><label className="label" htmlFor={`${prefix}-file`}>… ou téléverser un PDF (8 Mo max.)</label><input id={`${prefix}-file`} name="file" type="file" accept="application/pdf" className="input" /></div>
    </>
  );
}

export default async function DocumentsPage(props: PageProps<"/admin/documents">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const open = typeof sp.groupe === "string" ? sp.groupe : null;
  const [docs, families, pdfs] = await Promise.all([
    prisma.document.findMany({ orderBy: [{ updatedAt: "desc" }], include: { media: { select: { path: true, sizeBytes: true } }, family: { select: { name: true } } } }),
    prisma.productFamily.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.media.findMany({ where: { kind: "document" }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, alt: true } }),
  ]);
  const groups = new Map<string, typeof docs>();
  for (const d of docs) groups.set(d.groupKey, [...(groups.get(d.groupKey) ?? []), d]);
  for (const list of groups.values()) list.sort((a, b) => b.version - a.version);
  return (
    <div className="space-y-6">
      <PageTitle title="Espace documentaire"><Link className="btn-secondary py-1.5 min-h-0 text-sm" href="/admin/medias">Médiathèque</Link></PageTitle>
      <Flash searchParams={props.searchParams} />
      <p className="text-sm text-stone-700">Cycle : brouillon → relecture → publié → archivé. Publier une version archive automatiquement la version publiée précédente du même document. Une notice, fiche technique, certificat ou garantie ne peut être publié que s'il est <strong>vérifié fournisseur</strong> et accompagné de son PDF : aucun contenu technique n'est rédigé par le site. Audience « Public » : fiche produit ; « Clients » : espace client des acheteurs de la famille ; « Interne » : jamais affiché.</p>

      <Section title={`Documents (${groups.size})`}>
        {groups.size === 0 && <p className="text-sm text-stone-700">Aucun document.</p>}
        <div className="space-y-4">
          {[...groups.entries()].map(([groupKey, versions]) => {
            const latest = versions[0]!;
            const published = versions.find((v) => v.status === "PUBLISHED");
            return (
              <details key={groupKey} open={open === groupKey || groups.size <= 3} className="rounded-lg border border-sand-200 p-3" data-group={groupKey}>
                <summary className="cursor-pointer">
                  <span className="font-medium">{latest.title}</span> <span className="text-sm text-stone-700">· {DOCUMENT_KIND_FR[latest.kind] ?? latest.kind} · {latest.family?.name ?? "général"} · {versions.length} version{versions.length > 1 ? "s" : ""} · {published ? `v${published.version} publiée` : "non publié"}</span>
                </summary>
                <div className="mt-3">
                  <Table caption={`Versions de ${latest.title}`}>
                    <thead><tr><th>Version</th><th>Statut</th><th>Audience</th><th>Fiabilité</th><th>Fichier</th><th>Validation</th><th><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody>
                      {versions.map((v) => (
                        <tr key={v.id} data-version={v.version}>
                          <td>v{v.version}<p className="text-xs text-stone-700">{fmtDate(v.createdAt)}{v.createdBy ? ` · ${v.createdBy}` : ""}</p></td>
                          <td><StatusBadge tone={STATUS_TONE[v.status] ?? "neutral"}>{DOCUMENT_STATUS_FR[v.status]}</StatusBadge></td>
                          <td>{DOCUMENT_AUDIENCE_FR[v.audience]}</td>
                          <td><DataStatusBadge status={v.dataStatus} /></td>
                          <td>{v.media ? <a className="underline" href={v.media.path} target="_blank" rel="noopener">PDF</a> : <span className="text-warning">aucun</span>}</td>
                          <td className="text-xs">{v.validatedAt ? `${v.validatedBy ?? "—"}, ${fmtDate(v.validatedAt)}` : "—"}</td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {(DOCUMENT_TRANSITIONS[v.status] ?? []).map((to) => (
                                <form key={to} action={setDocumentStatusAction}><input type="hidden" name="id" value={v.id} /><input type="hidden" name="status" value={to} /><input type="hidden" name="returnTo" value={`/admin/documents?groupe=${groupKey}`} /><button type="submit" aria-label={`${ACTION_FR[to]} v${v.version}`} className={`${to === "PUBLISHED" ? "btn-primary" : "btn-secondary"} py-1 min-h-0 text-xs`}>{ACTION_FR[to]}</button></form>
                              ))}
                              {v.status === "DRAFT" && <form action={deleteDocumentAction}><input type="hidden" name="id" value={v.id} /><button type="submit" className="btn-ghost py-1 min-h-0 text-xs text-danger">Supprimer</button></form>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  {(latest.status === "DRAFT" || latest.status === "REVIEW") && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm underline">Modifier la version v{latest.version}</summary>
                      <form action={updateDocumentAction} className="mt-2 grid gap-3 md:grid-cols-4">
                        <input type="hidden" name="id" value={latest.id} /><input type="hidden" name="returnTo" value={`/admin/documents?groupe=${groupKey}`} />
                        <MetaFields prefix={`ed-${latest.id}`} families={families} pdfs={pdfs} d={latest} />
                        <div className="md:col-span-4"><button className="btn-secondary" type="submit">Enregistrer la version</button></div>
                      </form>
                    </details>
                  )}
                  <form action={newVersionAction} className="mt-3 grid gap-3 md:grid-cols-[2fr_2fr_auto] md:items-end rounded-lg bg-sand-50 p-3">
                    <input type="hidden" name="groupKey" value={groupKey} /><input type="hidden" name="returnTo" value={`/admin/documents?groupe=${groupKey}`} />
                    <div><label className="label" htmlFor={`nv-file-${latest.id}`}>PDF de la nouvelle version</label><input id={`nv-file-${latest.id}`} name="file" type="file" accept="application/pdf" className="input" /></div>
                    <div><label className="label" htmlFor={`nv-summary-${latest.id}`}>Résumé des changements (facultatif)</label><input id={`nv-summary-${latest.id}`} name="summary" maxLength={2000} className="input" /></div>
                    <button className="btn-secondary" type="submit">Créer la version v{latest.version + 1}</button>
                  </form>
                </div>
              </details>
            );
          })}
        </div>
      </Section>

      <Section title="Nouveau document">
        <form action={createDocumentAction} className="grid gap-3 md:grid-cols-4">
          <input type="hidden" name="returnTo" value="/admin/documents" />
          <MetaFields prefix="new" families={families} pdfs={pdfs} />
          <div className="md:col-span-4"><button className="btn-primary" type="submit">Créer le document (v1, brouillon)</button></div>
        </form>
      </Section>
    </div>
  );
}
