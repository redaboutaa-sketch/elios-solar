import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { GUIDES } from "@/server/content/guides";
import { renderMarkdown } from "@/server/content/render";
export async function generateMetadata(props: PageProps<"/guides/[slug]">): Promise<Metadata> { const { slug } = await props.params; const g = GUIDES[slug]; return g ? { title: g.title, description: g.description, alternates: { canonical: `/guides/${slug}` } } : {}; }
export function generateStaticParams() { return Object.keys(GUIDES).map((slug) => ({ slug })); }
export default async function Page(props: PageProps<"/guides/[slug]">) {
  const { slug } = await props.params;
  const g = GUIDES[slug];
  if (!g) notFound();
  return (
    <div className="container-x py-8 max-w-3xl"><Breadcrumbs items={[{ label: "Guides" }, { label: g.title }]} /><h1 className="mt-4 font-display text-4xl">{g.title}</h1><p className="mt-2 text-stone-700">{g.description}</p>
      <div className="prose-shop mt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(g.body) }} />
      <nav aria-label="Autres guides" className="mt-10 card p-5"><p className="font-medium">Autres guides</p><ul className="mt-2 list-disc pl-5">{Object.entries(GUIDES).filter(([k]) => k !== slug).map(([k, v]) => <li key={k}><Link href={`/guides/${k}`} className="underline">{v.title}</Link></li>)}</ul></nav>
      <p className="mt-6"><Link href="/configurateur" className="btn-accent">Configurer ma pergola</Link></p>
    </div>
  );
}
