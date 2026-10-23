import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PUBLIC_SECTIONS } from "@/config/brand";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Production et savoir-faire", description: "Fabrication, matériaux, assemblage et contrôle qualité." };

/** Rubrique masquée tant qu'aucune photo de production réelle et documentée n'est fournie (PUBLIC_SECTIONS). */
export default async function SavoirFaire() {
  if (!PUBLIC_SECTIONS.production) notFound();
  const items = await prisma.realisation.findMany({ where: { published: true, kind: "PRODUCTION", placeholder: false, isDemo: false }, include: { media: true }, orderBy: { sortOrder: "asc" } });
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: "Production et savoir-faire" }]} />
      <h1 className="mt-4 font-display text-4xl">Production et savoir-faire</h1>
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <article key={r.id} className="card overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.media && <img src={r.media.path} alt={r.media.alt} className="h-auto w-full" loading="lazy" />}
            <div className="p-5"><h2 className="font-display text-xl">{r.title}</h2>{r.caption && <p className="text-sm text-stone-700">{r.caption}</p>}{r.partnerNote && <p className="mt-1 text-xs text-stone-700">{r.partnerNote}</p>}<p className="mt-2 text-sm">{r.description}</p></div>
          </article>
        ))}
      </div>
    </div>
  );
}
