import type { Metadata } from "next";
import Link from "@/i18n/link";
import { permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { QuoteForm } from "@/components/configurator/quote-form";
import { prisma } from "@/lib/prisma";
import { configuratorHref } from "@/domain/categories";
import { canonicalFamilySlug } from "@/server/catalog/legacy-slugs";
import { getT, localePath } from "@/i18n/server";
import { fmt } from "@/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getT("forms")).quote;
  return { title: t.metaTitle, description: t.metaDescription, alternates: { canonical: "/devis" } };
}

export default async function Page(props: PageProps<"/devis">) {
  const sp = await props.searchParams;
  const t = (await getT("forms")).quote;
  const slug = typeof sp.produit === "string" ? canonicalFamilySlug(sp.produit) : null;
  // un ancien lien « ?produit=<ancien identifiant> » est redirigé vers le nom commercial actuel
  if (slug && slug !== sp.produit) permanentRedirect(await localePath(`/devis?produit=${encodeURIComponent(slug)}`));
  const product = slug ? await prisma.productFamily.findFirst({ where: { slug, legacy: false, category: { not: null }, status: { in: ["PUBLISHED", "QUOTE_ONLY", "DRAFT"] } }, select: { slug: true, name: true, status: true } }) : null;
  return (
    <div className="container-x py-8 max-w-3xl"><Breadcrumbs items={[{ label: t.breadcrumb }]} /><h1 className="mt-4 font-display text-4xl">{t.title}</h1>
      <p className="mt-2 text-stone-700">{t.describe}{product ? ` (${product.name})` : ""}{t.precise}{product && product.status !== "DRAFT" ? <Link href={configuratorHref(product.slug)} className="underline">{fmt(t.configureProduct, { name: product.name })}</Link> : <Link href="/configurateur" className="underline">{t.configureGeneric}</Link>}{t.after}</p>
      <div className="mt-6 card p-6"><QuoteForm input={null} kind="general" configurationId={null} /></div>
    </div>
  );
}
