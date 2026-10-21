import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PUBLIC_SECTIONS } from "@/config/brand";
import { prisma } from "@/lib/prisma";
import { PergolaArt } from "@/components/illustrations/pergola";
export const metadata: Metadata = { title: "Réalisations", description: "Projets réalisés : pergolas, fermetures et stores bannes installés chez nos clients." };
/** Rubrique masquée tant qu'aucun contenu réel n'est fourni (PUBLIC_SECTIONS). */
export default async function Page() {
  if (!PUBLIC_SECTIONS.realisations) notFound();
  const items = await prisma.realisation.findMany({ where: { published: true }, include: { media: true }, orderBy: { sortOrder: "asc" } });
  return (
    <div className="container-x py-8"><Breadcrumbs items={[{ label: "Réalisations" }]} /><h1 className="mt-4 font-display text-4xl">Réalisations</h1>
      {items.length === 0 ? <div className="mt-8 card p-10 text-center"><p className="font-display text-2xl">Nos premières réalisations arrivent.</p><p className="mt-2 text-stone-700">Cette rubrique est administrable ; seules des réalisations réelles et autorisées y seront publiées.</p></div> : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{items.map((r) => <article key={r.id} className="card overflow-hidden">{r.media ? <img src={r.media.path} alt={r.media.alt} className="w-full h-auto" loading="lazy" /> : <PergolaArt className="w-full h-auto" />}<div className="p-5"><h2 className="font-display text-xl">{r.title}</h2>{r.location && <p className="text-sm text-stone-700">{r.location}</p>}<p className="mt-2 text-sm">{r.description}</p></div></article>)}</div>
      )}
    </div>
  );
}
