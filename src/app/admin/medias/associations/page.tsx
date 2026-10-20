import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Section, StatusBadge, Table } from "@/components/admin/ui";
import { MEDIA_NATURE_FR, MEDIA_ROLE_FR, MEDIA_STATUS_FR } from "@/components/admin/media-labels";
import { linkMediaAction, unlinkMediaAction, updateLinkAction } from "@/server/actions/admin/media";

export const metadata: Metadata = { title: "Associations médias" };

const ROLES = Object.keys(MEDIA_ROLE_FR);

function Targeting({ id, finishes, defaults }: { id: string; finishes: Array<{ code: string; label: string }>; defaults?: { variantSku: string | null; finishCode: string | null; mounting: string | null; tags: string[] } }) {
  return (
    <>
      <div><label className="label" htmlFor={`fc-${id}`}>Finition</label><select id={`fc-${id}`} name="finishCode" className="input py-1.5 min-h-0 text-sm" defaultValue={defaults?.finishCode ?? ""}><option value="">Toutes</option>{finishes.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}</select></div>
      <div><label className="label" htmlFor={`mo-${id}`}>Implantation</label><select id={`mo-${id}`} name="mounting" className="input py-1.5 min-h-0 text-sm" defaultValue={defaults?.mounting ?? ""}><option value="">Toutes</option><option value="freestanding">Autoportée</option><option value="wall">Adossée</option></select></div>
      <div><label className="label" htmlFor={`sku-${id}`}>Variante (SKU)</label><input id={`sku-${id}`} name="variantSku" maxLength={80} className="input py-1.5 min-h-0 text-sm font-mono" defaultValue={defaults?.variantSku ?? ""} /></div>
      <div><label className="label" htmlFor={`tg-${id}`}>Tags (virgules)</label><input id={`tg-${id}`} name="tags" maxLength={300} className="input py-1.5 min-h-0 text-sm" defaultValue={defaults?.tags.join(", ") ?? ""} /></div>
    </>
  );
}

export default async function AssociationsPage(props: PageProps<"/admin/medias/associations">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const families = await prisma.productFamily.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true, kind: true, _count: { select: { media: true } } } });
  const familyId = typeof sp.famille === "string" && families.some((f) => f.id === sp.famille) ? sp.famille : families[0]?.id;
  const [family, published] = await Promise.all([
    familyId ? prisma.productFamily.findUnique({ where: { id: familyId }, include: { finishes: { include: { finish: true } }, media: { include: { media: true }, orderBy: { sortOrder: "asc" } } } }) : null,
    prisma.media.findMany({ where: { status: "PUBLISHED", nature: { not: "DOCUMENT" } }, orderBy: [{ nature: "asc" }, { createdAt: "desc" }], select: { id: true, alt: true, title: true, nature: true } }),
  ]);
  const ret = `/admin/medias/associations${familyId ? `?famille=${familyId}` : ""}`;
  const finishes = family?.finishes.map((f) => ({ code: f.finishCode, label: f.finish.label })) ?? [];
  return (
    <div className="space-y-6">
      <PageTitle title="Associations médias ↔ fiches" backHref="/admin/medias" backLabel="Médiathèque" />
      <Flash searchParams={props.searchParams} />
      <p className="text-sm text-stone-700">Seuls les médias <strong>publiés</strong> peuvent être associés. En boutique, les médias ciblés sur la finition / l'implantation affichées passent en premier, puis l'ordre ci-dessous. Un média ciblé sur une autre finition est masqué quand une correspondance existe.</p>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="famille">Famille</label><select id="famille" name="famille" defaultValue={familyId} className="input">{families.map((f) => <option key={f.id} value={f.id}>{f.name} ({f._count.media})</option>)}</select></div>
        <button className="btn-secondary" type="submit">Afficher</button>
        {family && <Link className="text-sm underline" href={`/admin/catalogue/familles/${family.id}`}>Fiche famille</Link>}
      </form>
      {family && (
        <>
          <Section title={`Médias de « ${family.name} » (${family.media.length})`}>
            <Table caption="Médias associés">
              <thead><tr><th>Aperçu</th><th>Média</th><th>Association</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {family.media.map((pm) => (
                  <tr key={pm.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <td>{pm.media.kind === "image" ? <img src={pm.media.path} alt={pm.media.alt} loading="lazy" className="h-16 w-24 rounded object-cover bg-sand-100" /> : <span className="text-xs">{MEDIA_NATURE_FR[pm.media.nature]}</span>}</td>
                    <td className="max-w-xs text-xs"><p className="font-medium text-sm">{pm.media.title || pm.media.alt}</p><p className="flex gap-1 mt-1"><StatusBadge tone={pm.media.status === "PUBLISHED" ? "ok" : "warn"}>{MEDIA_STATUS_FR[pm.media.status]}</StatusBadge><StatusBadge tone={pm.media.nature === "RENDER" ? "demo" : "neutral"}>{MEDIA_NATURE_FR[pm.media.nature]}</StatusBadge></p>{pm.media.status !== "PUBLISHED" && <p className="mt-1 text-warning">Non visible en boutique tant qu'il n'est pas publié.</p>}</td>
                    <td>
                      <form action={updateLinkAction} className="grid gap-2 sm:grid-cols-4">
                        <input type="hidden" name="id" value={pm.id} /><input type="hidden" name="returnTo" value={ret} />
                        <div><label className="label" htmlFor={`ro-${pm.id}`}>Rôle</label><select id={`ro-${pm.id}`} name="role" className="input py-1.5 min-h-0 text-sm" defaultValue={pm.role}>{ROLES.map((r) => <option key={r} value={r}>{MEDIA_ROLE_FR[r]}</option>)}</select></div>
                        <div className="sm:col-span-2"><label className="label" htmlFor={`ca-${pm.id}`}>Légende</label><input id={`ca-${pm.id}`} name="caption" maxLength={300} className="input py-1.5 min-h-0 text-sm" defaultValue={pm.caption} /></div>
                        <div><label className="label" htmlFor={`so-${pm.id}`}>Ordre</label><input id={`so-${pm.id}`} name="sortOrder" type="number" min={0} max={10000} className="input py-1.5 min-h-0 text-sm" defaultValue={pm.sortOrder} /></div>
                        <Targeting id={pm.id} finishes={finishes} defaults={pm} />
                        <div className="sm:col-span-4"><button className="btn-secondary py-1 min-h-0 text-sm" type="submit">Enregistrer</button></div>
                      </form>
                    </td>
                    <td><form action={unlinkMediaAction}><input type="hidden" name="id" value={pm.id} /><input type="hidden" name="returnTo" value={ret} /><button className="btn-ghost py-1 min-h-0 text-danger" type="submit">Retirer</button></form></td>
                  </tr>
                ))}
                {family.media.length === 0 && <tr><td colSpan={4} className="text-stone-700">Aucun média associé : la boutique affiche les illustrations générées.</td></tr>}
              </tbody>
            </Table>
          </Section>
          <Section title="Associer un média publié">
            {published.length === 0 ? <p className="text-sm text-stone-700">Aucun média publié : <Link className="underline" href="/admin/medias">publier un média</Link>.</p> : (
              <form action={linkMediaAction} className="grid gap-3 md:grid-cols-4">
                <input type="hidden" name="familyId" value={family.id} /><input type="hidden" name="returnTo" value={ret} />
                <div className="md:col-span-2"><label className="label" htmlFor="new-media">Média</label><select id="new-media" name="mediaId" required className="input">{published.map((m) => <option key={m.id} value={m.id}>[{MEDIA_NATURE_FR[m.nature]}] {m.title || m.alt}</option>)}</select></div>
                <div><label className="label" htmlFor="new-role">Rôle</label><select id="new-role" name="role" className="input" defaultValue="gallery">{ROLES.map((r) => <option key={r} value={r}>{MEDIA_ROLE_FR[r]}</option>)}</select></div>
                <div><label className="label" htmlFor="new-sort">Ordre</label><input id="new-sort" name="sortOrder" type="number" min={0} max={10000} defaultValue={family.media.length} className="input" /></div>
                <div className="md:col-span-4"><label className="label" htmlFor="new-caption">Légende</label><input id="new-caption" name="caption" maxLength={300} className="input" /></div>
                <Targeting id="new" finishes={finishes} />
                <div className="md:col-span-4"><button className="btn-primary" type="submit">Associer</button></div>
              </form>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
