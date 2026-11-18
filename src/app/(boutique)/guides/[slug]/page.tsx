import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { GuidePage } from "@/components/guides/guide-page";
import { GUIDES, GUIDE_REDIRECTS, PUBLISHED_GUIDES } from "@/server/content/guides";
import { renderMarkdown } from "@/server/content/render";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/server/seo/og";

export async function generateMetadata(props: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const g = GUIDES[slug];
  return g ? { title: g.title, description: g.description, alternates: { canonical: `/guides/${slug}` }, openGraph: { ...OG_BASE, title: g.title, description: g.description, url: `/guides/${slug}`, type: "article", images: [DEFAULT_OG_IMAGE] } } : {};
}
export function generateStaticParams() { return Object.keys(GUIDES).map((slug) => ({ slug })); }
export default async function Page(props: PageProps<"/guides/[slug]">) {
  const { slug } = await props.params;
  if (GUIDE_REDIRECTS[slug]) permanentRedirect(GUIDE_REDIRECTS[slug]);
  const g = GUIDES[slug];
  if (!g) notFound();
  const related = PUBLISHED_GUIDES.filter((x) => x.href !== `/guides/${slug}`).slice(0, 6).map((x) => [x.href, x.title] as [string, string]);
  return (
    <GuidePage path={`/guides/${slug}`} title={g.title} intro={g.description} related={related}>
      <div className="prose-shop max-w-3xl" dangerouslySetInnerHTML={{ __html: renderMarkdown(g.body) }} />
    </GuidePage>
  );
}
