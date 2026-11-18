import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import type { Realisation } from "@/generated/prisma/client";
import { Flash, PageTitle, Section, StatusBadge } from "@/components/admin/ui";
import { deleteRealisationAction, saveRealisationAction } from "@/server/actions/admin/content";

export const metadata: Metadata = { title: "Réalisations et production" };

const KIND_FR = { REALISATION: "Réalisations HELIOSTORES", PRODUCTION: "Production et savoir-faire" } as const;

type MediaOpt = { id: string; path: string; alt: string };

function RealisationForm({ r, kind, families, medias }: { r: (Realisation & { media: MediaOpt | null }) | null; kind: "REALISATION" | "PRODUCTION"; families: Array<{ slug: string; name: string }>; medias: MediaOpt[] }) {
  const p = r ? `r-${r.id}` : `r-new-${kind}`;
  return (
    <form action={saveRealisationAction} className="grid gap-3 md:grid-cols-2">
      {r && <input type="hidden" name="id" value={r.id} />}
      <input type="hidden" name="kind" value={r?.kind ?? kind} />
      <div><label className="label" htmlFor={`${p}-t`}>Titre</label><input id={`${p}-t`} name="title" required maxLength={160} className="input" defaultValue={r?.title ?? ""} /></div>
      <div><label className="label" htmlFor={`${p}-l`}>Localisation</label><input id={`${p}-l`} name="location" maxLength={160} className="input" defaultValue={r?.location ?? ""} /><label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" name="locationPublic" className="h-4 w-4" defaultChecked={r?.locationPublic ?? false} /> Localisation publiable (accord obtenu)</label></div>
      <div><label className="label" htmlFor={`${p}-cr`}>Crédit photo</label><input id={`${p}-cr`} name="credit" maxLength={200} className="input" defaultValue={r?.credit ?? ""} /></div>
      <div><label className="label" htmlFor={`${p}-au`}>Autorisation de publication (requise pour publier)</label><input id={`${p}-au`} name="authorization" maxLength={500} className="input" placeholder="ex. accord écrit du client du …" defaultValue={r?.authorization ?? ""} />{r?.authorizedAt ? <p className="mt-1 text-xs text-stone-700">Renseignée le {r.authorizedAt.toLocaleDateString("fr-FR")}</p> : null}</div>
      <div className="md:col-span-2"><label className="label" htmlFor={`${p}-c`}>Légende publique de la photo</label><input id={`${p}-c`} name="caption" maxLength={300} className="input" defaultValue={r?.caption ?? ""} /></div>
      {(r?.kind ?? kind) === "PRODUCTION" && <div className="md:col-span-2"><label className="label" htmlFor={`${p}-pn`}>Site de production (ex. « usine d'un partenaire fabricant ») — obligatoire pour une photo de partenaire</label><input id={`${p}-pn`} name="partnerNote" maxLength={300} className="input" defaultValue={r?.partnerNote ?? ""} /></div>}
      <div className="md:col-span-2"><label className="label" htmlFor={`${p}-d`}>Description</label><textarea id={`${p}-d`} name="description" rows={3} className="input" defaultValue={r?.description ?? ""} /></div>
      <div><label className="label" htmlFor={`${p}-f`}>Gamme</label><select id={`${p}-f`} name="familySlug" className="input" defaultValue={r?.familySlug ?? ""}><option value="">—</option>{families.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}</select></div>
      <div><label className="label" htmlFor={`${p}-m`}>Image</label><select id={`${p}-m`} name="mediaId" className="input" defaultValue={r?.mediaId ?? ""}><option value="">Aucune</option>{medias.map((m) => <option key={m.id} value={m.id}>{m.alt || m.path}</option>)}</select></div>
      <div><label className="label" htmlFor={`${p}-o`}>Ordre</label><input id={`${p}-o`} name="sortOrder" type="number" min={0} className="input" defaultValue={r?.sortOrder ?? 0} /></div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="published" className="h-4 w-4" defaultChecked={r?.published ?? false} /> Publiée</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isDemo" className="h-4 w-4" defaultChecked={r?.isDemo ?? false} /> Exemple de démonstration</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="placeholder" className="h-4 w-4" defaultChecked={r?.placeholder ?? false} /> Emplacement à compléter</label>
      </div>
      <div className="md:col-span-2"><button className="btn-primary" type="submit">{r ? "Enregistrer" : "Ajouter"}</button></div>
    </form>
  );
}

export default async function RealisationsPage(props: PageProps<"/admin/contenus/realisations">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const [items, families, medias] = await Promise.all([
    prisma.realisation.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], include: { media: { select: { id: true, path: true, alt: true } } } }),
    prisma.productFamily.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    prisma.media.findMany({ where: { kind: "image" }, orderBy: { createdAt: "desc" }, select: { id: true, path: true, alt: true } }),
  ]);
  return (
    <div className="space-y-6">
      <PageTitle title="Réalisations et production" />
      <p className="text-sm text-stone-700">Deux ensembles distincts : les <strong>réalisations</strong> sont des projets réellement installés par HELIOSTORES (produit, contexte, localisation publiable) ; la <strong>production</strong> montre fabrication, matériaux, assemblage et contrôle qualité, en nommant le site comme tel s'il appartient à un partenaire. Un visuel du fournisseur ne peut pas être publié comme réalisation ; un emplacement à compléter ou une démonstration ne peut pas être publié.</p>
      <p className="mb-4 rounded-lg border border-sand-300 bg-white px-4 py-3 text-sm" data-testid="section-hidden">Page publique « Références » : chaque catégorie affiche seulement les fiches publiées ; tant qu'aucune n'est publiée, la page l'indique honnêtement (aucun faux projet). Publication refusée sans photo, sans autorisation, sans produit (réalisation), ou pour un visuel du fournisseur présenté comme réalisation.</p>
      <Flash searchParams={props.searchParams} />
      {(["REALISATION", "PRODUCTION"] as const).map((kind) => (
        <div key={kind} className="space-y-4" data-testid={`set-${kind}`}>
          <h2 className="font-display text-2xl">{KIND_FR[kind]}</h2>
          {items.filter((r) => r.kind === kind).map((r) => (
            <Section key={r.id}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.media && <img src={r.media.path} alt={r.media.alt} className="h-16 w-24 rounded object-cover bg-sand-100" />}
                <h3 className="font-display text-xl">{r.title}</h3>
                {r.published ? <StatusBadge tone="ok">Publiée</StatusBadge> : <StatusBadge tone="neutral">Brouillon</StatusBadge>}
                {r.placeholder && <StatusBadge tone="warn">À fournir</StatusBadge>}
                {r.isDemo && <StatusBadge tone="demo">Démo</StatusBadge>}
                <form action={deleteRealisationAction} className="ml-auto"><input type="hidden" name="id" value={r.id} /><button className="btn-ghost py-1 min-h-0 text-danger" type="submit">Supprimer</button></form>
              </div>
              <RealisationForm r={r} kind={kind} families={families} medias={medias} />
            </Section>
          ))}
          <Section title={`Ajouter — ${KIND_FR[kind]}`}><RealisationForm r={null} kind={kind} families={families} medias={medias} /></Section>
        </div>
      ))}
    </div>
  );
}
