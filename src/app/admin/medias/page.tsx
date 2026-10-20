import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
import { MEDIA_NATURES, MEDIA_STATUSES, type MediaStatusValue } from "@/server/media/types";
import { Flash, Options, PageTitle, Pagination, Section, StatusBadge, fmtDate } from "@/components/admin/ui";
import { toDateInput } from "@/server/admin/form";
import { MEDIA_NATURE_FR, MEDIA_STATUS_FR } from "@/components/admin/media-labels";
import { deleteMediaAction, setMediaStatusAction, updateMediaAction, uploadMediaAction } from "@/server/actions/admin/media";

export const metadata: Metadata = { title: "Médias" };

const PER_PAGE = 24;
const STATUS_TONE: Record<string, "ok" | "warn" | "err" | "neutral"> = { DRAFT: "neutral", VALIDATED: "warn", PUBLISHED: "ok", REJECTED: "err" };
const ACTIONS: Record<string, Array<[string, string]>> = {
  DRAFT: [["VALIDATED", "Valider"], ["REJECTED", "Refuser"]],
  VALIDATED: [["PUBLISHED", "Publier"], ["DRAFT", "Remettre en brouillon"], ["REJECTED", "Refuser"]],
  PUBLISHED: [["VALIDATED", "Dépublier"], ["REJECTED", "Refuser"]],
  REJECTED: [["DRAFT", "Remettre en brouillon"]],
};

function size(bytes: number | null) {
  if (bytes == null) return "—";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.ceil(bytes / 1024)} Ko`;
}

export default async function MediaPage(props: PageProps<"/admin/medias">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const statut = typeof sp.statut === "string" && (MEDIA_STATUSES as readonly string[]).includes(sp.statut) ? (sp.statut as MediaStatusValue) : undefined;
  const nature = typeof sp.nature === "string" && (MEDIA_NATURES as readonly string[]).includes(sp.nature) ? (sp.nature as (typeof MEDIA_NATURES)[number]) : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.MediaWhereInput = { ...(statut ? { status: statut } : {}), ...(nature ? { nature } : {}), ...(q ? { OR: [{ alt: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }, { source: { contains: q, mode: "insensitive" } }] } : {}) };
  const [items, total, counts] = await Promise.all([
    prisma.media.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { _count: { select: { products: true, documents: true, realisations: true } } } }),
    prisma.media.count({ where }),
    prisma.media.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (p: number) => `/admin/medias?${new URLSearchParams({ ...(statut ? { statut } : {}), ...(nature ? { nature } : {}), ...(q ? { q } : {}), page: String(p) }).toString()}`;
  const ret = qs(page);
  const now = new Date();
  return (
    <div className="space-y-6">
      <PageTitle title="Médiathèque">
        <div className="flex gap-2 text-sm"><Link className="btn-secondary py-1.5 min-h-0" href="/admin/medias/associations">Associations aux fiches</Link><Link className="btn-secondary py-1.5 min-h-0" href="/admin/documents">Documents</Link></div>
      </PageTitle>
      <Flash searchParams={props.searchParams} />
      <p className="text-sm text-stone-700">Cycle : brouillon → validé (registre des droits vérifié) → publié. Seuls les médias <strong>publiés</strong> apparaissent en boutique, sur les fiches auxquelles ils sont associés. Un rendu 3D n'est jamais présenté comme une photographie.</p>
      <Section title="Ajouter un média">
        <form action={uploadMediaAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="returnTo" value="/admin/medias" />
          <div className="md:col-span-2"><label className="label" htmlFor="file">Fichier (JPEG, PNG, WebP, SVG ou PDF — 8 Mo max.)</label><input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml,application/pdf" className="input" /></div>
          <div className="md:col-span-2"><label className="label" htmlFor="externalUrl">… ou URL d'une vidéo hébergée (https, sans fichier)</label><input id="externalUrl" name="externalUrl" type="url" pattern="https://.*" maxLength={500} placeholder="https://" className="input" /></div>
          <div className="md:col-span-2"><label className="label" htmlFor="alt">Texte alternatif (description de l'image)</label><input id="alt" name="alt" required maxLength={300} className="input" /></div>
          <div className="md:col-span-2"><label className="label" htmlFor="title">Titre</label><input id="title" name="title" maxLength={200} className="input" /></div>
          <div><label className="label" htmlFor="nature">Nature</label><select id="nature" name="nature" className="input" defaultValue="PHOTO"><Options values={MEDIA_NATURES} labels={MEDIA_NATURE_FR} /></select></div>
          <div><label className="label" htmlFor="takenAt">Date de prise de vue / création</label><input id="takenAt" name="takenAt" type="date" className="input" /></div>
          <div><label className="label" htmlFor="sortOrder">Ordre d'affichage</label><input id="sortOrder" name="sortOrder" type="number" min={-1000} max={100000} defaultValue={0} className="input" /></div>
          <div><label className="label" htmlFor="rightsExpiresAt">Fin des droits (facultatif)</label><input id="rightsExpiresAt" name="rightsExpiresAt" type="date" className="input" /></div>
          <div><label className="label" htmlFor="source">Source (fournisseur, photographe, URL…)</label><input id="source" name="source" required maxLength={300} className="input" /></div>
          <div><label className="label" htmlFor="license">Licence / droits</label><input id="license" name="license" required maxLength={200} placeholder="ex. cession de droits fournisseur" className="input" /></div>
          <div><label className="label" htmlFor="credit">Crédit</label><input id="credit" name="credit" required maxLength={200} className="input" /></div>
          <div><label className="label" htmlFor="rightsNote">Note sur les droits</label><input id="rightsNote" name="rightsNote" maxLength={1000} placeholder="usage web, durée, territoire…" className="input" /></div>
          <div className="md:col-span-2 xl:col-span-3"><label className="label" htmlFor="visibleOptions">Options visibles non comprises dans le prix</label><input id="visibleOptions" name="visibleOptions" maxLength={500} placeholder="ex. parois vitrées, lampe chauffante" className="input" /></div>
          <div className="flex items-end"><button className="btn-primary w-full" type="submit">Ajouter</button></div>
          <p className="md:col-span-2 xl:col-span-4 text-xs text-stone-700">Source, licence, crédit et texte alternatif sont obligatoires (registre des droits). Le nom du fichier est remplacé par un identifiant aléatoire et sa signature binaire est vérifiée. Le média est créé en brouillon.</p>
        </form>
      </Section>

      <Section title={`Médias (${total})`}>
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
          <div><label className="label" htmlFor="f-statut">Statut</label><select id="f-statut" name="statut" defaultValue={statut ?? ""} className="input py-1.5 min-h-0"><Options includeEmpty="Tous" values={MEDIA_STATUSES} labels={MEDIA_STATUS_FR} /></select></div>
          <div><label className="label" htmlFor="f-nature">Nature</label><select id="f-nature" name="nature" defaultValue={nature ?? ""} className="input py-1.5 min-h-0"><Options includeEmpty="Toutes" values={MEDIA_NATURES} labels={MEDIA_NATURE_FR} /></select></div>
          <div><label className="label" htmlFor="f-q">Recherche</label><input id="f-q" name="q" defaultValue={q} className="input py-1.5 min-h-0" /></div>
          <button className="btn-secondary py-1.5 min-h-0" type="submit">Filtrer</button>
          <p className="text-xs text-stone-700">{counts.map((c) => `${MEDIA_STATUS_FR[c.status]} : ${c._count._all}`).join(" · ")}</p>
        </form>
        {items.length === 0 && <p className="text-sm text-stone-700">Aucun média.</p>}
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((m) => {
            const refs = m._count.products + m._count.documents + m._count.realisations;
            const expired = !!m.rightsExpiresAt && m.rightsExpiresAt <= now;
            return (
              <li key={m.id} className="rounded-lg border border-sand-200 p-3" data-media-id={m.id}>
                <div className="flex gap-3">
                  {m.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.path} alt={m.alt} loading="lazy" className="h-24 w-32 shrink-0 rounded bg-sand-100 object-cover" />
                  ) : m.kind === "video" ? (
                    <a href={m.externalUrl ?? m.path} target="_blank" rel="noopener noreferrer nofollow" className="flex h-24 w-32 shrink-0 items-center justify-center rounded bg-sand-100 text-sm underline">Vidéo ↗</a>
                  ) : (
                    <a href={m.path} className="flex h-24 w-32 shrink-0 items-center justify-center rounded bg-sand-100 text-sm underline">PDF</a>
                  )}
                  <div className="min-w-0 text-xs text-stone-700 space-y-0.5">
                    <p className="flex flex-wrap gap-1"><StatusBadge tone={STATUS_TONE[m.status] ?? "neutral"}>{MEDIA_STATUS_FR[m.status]}</StatusBadge><StatusBadge tone={m.nature === "RENDER" ? "demo" : "neutral"}>{MEDIA_NATURE_FR[m.nature]}</StatusBadge>{expired && <StatusBadge tone="err">Droits expirés</StatusBadge>}</p>
                    <p className="font-medium text-ink">{m.title || m.alt}</p>
                    <p>{m.mimeType ?? m.kind} · {size(m.sizeBytes)}{m.width ? ` · ${m.width}×${m.height}` : ""} · ordre {m.sortOrder}</p>
                    <p>Créé {fmtDate(m.createdAt)} · utilisé {refs} fois</p>
                    {m.validatedAt && <p>Validé par {m.validatedBy ?? "—"} le {fmtDate(m.validatedAt)}</p>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(ACTIONS[m.status] ?? []).filter(([s]) => m.nature !== "DOCUMENT" || s === "DRAFT" || s === "REJECTED").map(([s, label]) => (
                    <form key={s} action={setMediaStatusAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value={s} /><input type="hidden" name="returnTo" value={ret} /><button className={`${s === "PUBLISHED" ? "btn-primary" : s === "REJECTED" ? "btn-ghost text-danger" : "btn-secondary"} py-1 min-h-0 text-xs`} type="submit">{label}</button></form>
                  ))}
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm underline">Modifier les informations et les droits</summary>
                  <form action={updateMediaAction} className="mt-2 grid gap-2">
                    <input type="hidden" name="id" value={m.id} /><input type="hidden" name="returnTo" value={ret} />
                    <div><label className="label" htmlFor={`alt-${m.id}`}>Texte alternatif</label><input id={`alt-${m.id}`} name="alt" required maxLength={300} className="input py-1.5 min-h-0 text-sm" defaultValue={m.alt} /></div>
                    <div><label className="label" htmlFor={`title-${m.id}`}>Titre</label><input id={`title-${m.id}`} name="title" maxLength={200} className="input py-1.5 min-h-0 text-sm" defaultValue={m.title} /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className="label" htmlFor={`nat-${m.id}`}>Nature</label><select id={`nat-${m.id}`} name="nature" className="input py-1.5 min-h-0 text-sm" defaultValue={m.nature}><Options values={MEDIA_NATURES} labels={MEDIA_NATURE_FR} /></select></div>
                      <div><label className="label" htmlFor={`tk-${m.id}`}>Date</label><input id={`tk-${m.id}`} name="takenAt" type="date" className="input py-1.5 min-h-0 text-sm" defaultValue={toDateInput(m.takenAt)} /></div>
                      <div><label className="label" htmlFor={`so-${m.id}`}>Ordre</label><input id={`so-${m.id}`} name="sortOrder" type="number" className="input py-1.5 min-h-0 text-sm" defaultValue={m.sortOrder} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className="label" htmlFor={`src-${m.id}`}>Source</label><input id={`src-${m.id}`} name="source" required className="input py-1.5 min-h-0 text-sm" defaultValue={m.source} /></div>
                      <div><label className="label" htmlFor={`lic-${m.id}`}>Licence</label><input id={`lic-${m.id}`} name="license" required className="input py-1.5 min-h-0 text-sm" defaultValue={m.license} /></div>
                      <div><label className="label" htmlFor={`cr-${m.id}`}>Crédit</label><input id={`cr-${m.id}`} name="credit" required className="input py-1.5 min-h-0 text-sm" defaultValue={m.credit} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="label" htmlFor={`rn-${m.id}`}>Note sur les droits</label><input id={`rn-${m.id}`} name="rightsNote" maxLength={1000} className="input py-1.5 min-h-0 text-sm" defaultValue={m.rightsNote} /></div>
                      <div><label className="label" htmlFor={`re-${m.id}`}>Fin des droits</label><input id={`re-${m.id}`} name="rightsExpiresAt" type="date" className="input py-1.5 min-h-0 text-sm" defaultValue={toDateInput(m.rightsExpiresAt)} /></div>
                    </div>
                    <div><label className="label" htmlFor={`vo-${m.id}`}>Options visibles non comprises</label><input id={`vo-${m.id}`} name="visibleOptions" maxLength={500} className="input py-1.5 min-h-0 text-sm" defaultValue={m.visibleOptions} /></div>
                    {m.kind === "video" && <div><label className="label" htmlFor={`ex-${m.id}`}>URL vidéo (https)</label><input id={`ex-${m.id}`} name="externalUrl" type="url" className="input py-1.5 min-h-0 text-sm" defaultValue={m.externalUrl ?? ""} /></div>}
                    {m.renderConfig != null && <p className="text-xs text-stone-700 break-all">Paramètres du rendu : <code>{JSON.stringify(m.renderConfig)}</code></p>}
                    <button className="btn-secondary py-1.5 min-h-0" type="submit">Enregistrer</button>
                  </form>
                </details>
                {refs === 0 ? (
                  <form action={deleteMediaAction} className="mt-2"><input type="hidden" name="id" value={m.id} /><input type="hidden" name="returnTo" value={ret} /><button className="btn-ghost py-1 min-h-0 text-danger" type="submit">Supprimer le fichier</button></form>
                ) : <p className="mt-2 text-xs text-stone-700">Utilisé : suppression impossible tant qu'il est référencé.</p>}
              </li>
            );
          })}
        </ul>
        <Pagination page={page} pages={pages} hrefFor={qs} />
      </Section>
    </div>
  );
}
