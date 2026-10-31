import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { GuideView } from "@/components/guides/guide-view";
import { installGuide } from "@/server/content/install-guides";
import { guideMedia, isPublished } from "@/server/guides/status";

export async function generateMetadata(props: PageProps<"/guides/installation/[slug]">): Promise<Metadata> {
  const g = installGuide((await props.params).slug);
  return g ? { title: g.title, description: g.summary, alternates: { canonical: `/guides/installation/${g.slug}` } } : {};
}

/** Guide d'installation publié (validé techniquement) ; un brouillon n'existe pas pour le public. */
export default async function InstallGuidePage(props: PageProps<"/guides/installation/[slug]">) {
  const { slug } = await props.params;
  const g = installGuide(slug);
  if (!g || !(await isPublished(slug))) notFound();
  const media = await guideMedia(g.sections.flatMap((x) => x.media?.map((m) => m.key) ?? []));
  return (
    <div className="container-x py-10">
      <Breadcrumbs items={[{ label: "Guides et installation", href: "/guides" }, { label: g.title }]} />
      <h1 className="mt-5 font-display text-display font-semibold">{g.title}</h1>
      <p className="mt-3 max-w-2xl text-stone-800">{g.summary}</p>
      <p className="mt-3"><a className="btn-secondary" href={`/api/guides/${g.slug}/pdf`}>Télécharger le PDF</a></p>
      <div className="mt-8"><GuideView guide={g} media={media} /></div>
    </div>
  );
}
