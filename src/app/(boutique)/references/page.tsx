import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { MediaImage } from "@/components/ui/media-image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PUBLIC_SECTIONS } from "@/config/brand";

export const metadata: Metadata = { title: "Références", description: "Réalisations clients et production : uniquement des contenus authentiques, autorisés et identifiés.", alternates: { canonical: "/references" } };

const SETS = [
  { kind: "REALISATION", id: "realisations", title: "Réalisations clients", empty: "Les premières réalisations de nos clients seront publiées ici, avec leur accord. Aucun visuel de fabricant n'y est présenté comme un chantier." },
  { kind: "PRODUCTION", id: "production", title: "Production et fabrication", empty: "Les photographies de fabrication, de matériaux et de contrôle seront publiées ici, en précisant le site (atelier ou usine d'un partenaire)." },
] as const;

/**
 * Page Références : deux catégories distinctes. Seules les fiches publiées (photo, autorisation, produit renseignés ;
 * jamais un emplacement à compléter, une démonstration ou un visuel du fournisseur présenté comme chantier) s'affichent.
 */
export default async function ReferencesPage() {
  const [items, families] = await Promise.all([
    prisma.realisation.findMany({ where: { published: true, placeholder: false, isDemo: false }, include: { media: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
    prisma.productFamily.findMany({ where: { legacy: false }, select: { slug: true, name: true } }),
  ]);
  if (!PUBLIC_SECTIONS.references || items.length === 0) notFound();
  const nameOf = new Map(families.map((f) => [f.slug, f.name]));
  return (
    <div className="container-x py-10">
      <Breadcrumbs items={[{ label: "Références" }]} />
      <h1 className="mt-5 font-display text-display font-semibold">Références</h1>
      <p className="mt-3 max-w-3xl text-stone-800 text-pretty">Des projets réels et des photographies de fabrication, publiés avec l'accord des personnes concernées. Les visuels des fiches produits sont ceux du fabricant : ils ne figurent pas ici.</p>
      <nav aria-label="Catégories" className="mt-6 flex gap-2 text-sm">{SETS.map((s) => <a key={s.id} href={`#${s.id}`} className="btn-secondary px-3 py-1.5">{s.title}</a>)}</nav>
      {SETS.map((set) => {
        const list = items.filter((r) => r.kind === set.kind && r.media);
        return (
          <section key={set.id} id={set.id} className="section-y scroll-mt-24 border-t border-sand-200" aria-labelledby={`${set.id}-t`} data-testid={`references-${set.id}`}>
            <h2 id={`${set.id}-t`} className="font-display text-2xl font-semibold">{set.title}</h2>
            {list.length === 0 ? <p className="mt-3 max-w-2xl text-stone-700" data-testid={`references-${set.id}-empty`}>{set.empty}</p> : (
              <ul className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {list.map((r) => (
                  <li key={r.id} className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
                    <MediaImage media={r.media!} sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 92vw" className="aspect-[4/3] w-full object-cover" />
                    <div className="p-5">
                      <h3 className="font-display text-xl font-semibold">{r.title}</h3>
                      <p className="mt-1 text-sm text-stone-700">{[r.familySlug ? nameOf.get(r.familySlug) : null, r.locationPublic ? r.location : null, r.kind === "PRODUCTION" ? r.partnerNote : null].filter(Boolean).join(" · ")}</p>
                      {r.caption && <p className="mt-2 text-sm">{r.caption}</p>}
                      {r.description && <p className="mt-2 text-sm text-stone-800">{r.description}</p>}
                      {r.credit && <p className="mt-3 text-xs text-stone-700">Photo : {r.credit}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <p className="text-sm text-stone-700">Vous êtes client et souhaitez partager votre projet ? <Link href="/contact" className="underline">Écrivez-nous</Link>.</p>
    </div>
  );
}
