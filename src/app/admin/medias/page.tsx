import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Section, fmtDate } from "@/components/admin/ui";
import { deleteMediaAction, updateMediaAction, uploadMediaAction } from "@/server/actions/admin/media";

export const metadata: Metadata = { title: "Médias" };

function size(bytes: number | null) {
  if (bytes == null) return "—";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.ceil(bytes / 1024)} Ko`;
}

export default async function MediaPage(props: PageProps<"/admin/medias">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const items = await prisma.media.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { products: true, documents: true, realisations: true } } } });
  return (
    <div className="space-y-6">
      <PageTitle title="Médiathèque" />
      <Flash searchParams={props.searchParams} />
      <Section title="Téléverser un fichier">
        <form action={uploadMediaAction} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><label className="label" htmlFor="file">Fichier (JPEG, PNG, WebP, SVG ou PDF — 8 Mo max.)</label><input id="file" name="file" type="file" required accept="image/jpeg,image/png,image/webp,image/svg+xml,application/pdf" className="input" /></div>
          <div className="md:col-span-2"><label className="label" htmlFor="alt">Texte alternatif / titre</label><input id="alt" name="alt" required maxLength={300} className="input" /></div>
          <div><label className="label" htmlFor="source">Source (fournisseur, photographe, URL…)</label><input id="source" name="source" required maxLength={300} className="input" /></div>
          <div><label className="label" htmlFor="license">Licence / droits</label><input id="license" name="license" required maxLength={200} placeholder="ex. cession de droits fournisseur" className="input" /></div>
          <div><label className="label" htmlFor="credit">Crédit</label><input id="credit" name="credit" required maxLength={200} className="input" /></div>
          <div className="flex items-end"><button className="btn-primary" type="submit">Téléverser</button></div>
          <p className="md:col-span-2 text-xs text-stone-700">Source, licence et crédit sont obligatoires (registre des droits). Le nom du fichier est remplacé par un identifiant aléatoire.</p>
        </form>
      </Section>
      <Section title={`Fichiers (${items.length})`}>
        {items.length === 0 && <p className="text-sm text-stone-700">Aucun média.</p>}
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((m) => {
            const refs = m._count.products + m._count.documents + m._count.realisations;
            return (
              <li key={m.id} className="rounded-lg border border-sand-200 p-3">
                <div className="flex gap-3">
                  {m.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.path} alt={m.alt} className="h-24 w-32 shrink-0 rounded bg-sand-100 object-contain" />
                  ) : (
                    <a href={m.path} className="flex h-24 w-32 shrink-0 items-center justify-center rounded bg-sand-100 text-sm underline">PDF</a>
                  )}
                  <div className="min-w-0 text-xs text-stone-700">
                    <p className="break-all font-mono">{m.path}</p>
                    <p>{m.mimeType ?? m.kind} · {size(m.sizeBytes)}{m.width ? ` · ${m.width}×${m.height}` : ""}</p>
                    <p>{fmtDate(m.createdAt)} · utilisé {refs} fois</p>
                  </div>
                </div>
                <form action={updateMediaAction} className="mt-3 grid gap-2">
                  <input type="hidden" name="id" value={m.id} />
                  <div><label className="label" htmlFor={`alt-${m.id}`}>Texte alternatif</label><input id={`alt-${m.id}`} name="alt" required className="input py-1.5 min-h-0 text-sm" defaultValue={m.alt} /></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="label" htmlFor={`src-${m.id}`}>Source</label><input id={`src-${m.id}`} name="source" required className="input py-1.5 min-h-0 text-sm" defaultValue={m.source} /></div>
                    <div><label className="label" htmlFor={`lic-${m.id}`}>Licence</label><input id={`lic-${m.id}`} name="license" required className="input py-1.5 min-h-0 text-sm" defaultValue={m.license} /></div>
                    <div><label className="label" htmlFor={`cr-${m.id}`}>Crédit</label><input id={`cr-${m.id}`} name="credit" required className="input py-1.5 min-h-0 text-sm" defaultValue={m.credit} /></div>
                  </div>
                  <button className="btn-secondary py-1.5 min-h-0" type="submit">Enregistrer</button>
                </form>
                {refs === 0 ? (
                  <form action={deleteMediaAction} className="mt-2"><input type="hidden" name="id" value={m.id} /><button className="btn-ghost py-1 min-h-0 text-danger" type="submit">Supprimer le fichier</button></form>
                ) : <p className="mt-2 text-xs text-stone-700">Utilisé : suppression impossible tant qu'il est référencé.</p>}
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
