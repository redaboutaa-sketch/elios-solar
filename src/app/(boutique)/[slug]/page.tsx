import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Notice } from "@/components/ui/alert";
import { prisma } from "@/lib/prisma";
import { renderMarkdown } from "@/server/content/render";
import { getSession } from "@/lib/session";

const SLUGS = ["mentions-legales", "cgv", "confidentialite", "cookies", "livraison-installation", "aide"];

export async function generateMetadata(props: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const page = SLUGS.includes(slug) ? await prisma.contentPage.findUnique({ where: { slug } }) : null;
  // document provisoire (non publié) : consultable, jamais indexé ni dans le sitemap
  return page ? { title: page.title, alternates: { canonical: `/${slug}` }, ...(page.status !== "PUBLISHED" ? { robots: { index: false, follow: true } } : {}) } : {};
}

export default async function ContentPage(props: PageProps<"/[slug]">) {
  const { slug } = await props.params;
  if (!SLUGS.includes(slug)) notFound();
  const [page, settings, session] = await Promise.all([prisma.contentPage.findUnique({ where: { slug } }), prisma.siteSettings.findUnique({ where: { id: 1 } }), getSession()]);
  if (!page) notFound();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const vars = { legalName: settings?.legalName, legalForm: settings?.legalForm, addressLine1: settings?.addressLine1, postalCode: settings?.postalCode, city: settings?.city, siret: settings?.siret, vatNumber: settings?.vatNumber, shareCapital: settings?.shareCapital, rcsCity: settings?.rcsCity, contactEmail: settings?.contactEmail, phone: settings?.phone, phoneHref: settings?.phone?.replace(/\s+/g, "") };
  const missing = (page.missingFields as string[]).filter((k) => !vars[k as keyof typeof vars]);
  return (
    <div className="container-x py-8 max-w-3xl">
      <Breadcrumbs items={[{ label: page.title }]} />
      <h1 className="mt-4 font-display text-4xl">{page.title}</h1>
      {page.status !== "PUBLISHED" && <div className="mt-4"><Notice tone="warn">Document provisoire : contenu à adapter et valider avant toute vente réelle.{(role === "ADMIN" || role === "MANAGER") && missing.length > 0 && <> Champs manquants : {missing.join(", ")} (voir Administration → Réglages).</>}</Notice></div>}
      <div className="prose-shop mt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body, vars) }} />
    </div>
  );
}
