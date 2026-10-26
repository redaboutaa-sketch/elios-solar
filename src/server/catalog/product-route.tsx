import "server-only";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SystemProductPage } from "@/components/catalog/system-product-page";
import { RetiredProduct } from "@/components/catalog/retired-product";
import { categoryByKey, type CategoryKey } from "@/domain/categories";
import { getRetiredFamily, getSystemFamily } from "./systems";
import { publishedMediaFor } from "@/server/media/queries";
import { publicDocumentsForFamily } from "@/server/documents/queries";
import { productTitle, quoteSafeDescription } from "@/server/seo/product-nature";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/server/seo/og";

/** Métadonnées d'une fiche produit (ou de la page d'un modèle retiré, non indexée). */
export async function productMetadata(category: CategoryKey, slug: string): Promise<Metadata> {
  const f = await getSystemFamily(category, slug);
  if (f) {
    const path = `${categoryByKey(category)!.href}/${f.slug}`;
    // titre « Nom — Nature » ; un titre saisi en administration n'est repris que s'il suit ce format
    const title = f.seoTitle?.startsWith(`${f.name} — `) ? f.seoTitle : productTitle(f.name, f.rules);
    const description = quoteSafeDescription(f.seoDescription ?? f.shortDescription, !!f.fromPrice);
    const img = (await publishedMediaFor(f.slug)).find((m) => m.nature !== "DOCUMENT" && m.nature !== "VIDEO" && m.role !== "technical" && (m.width ?? 0) >= 600);
    return {
      title,
      description,
      alternates: { canonical: path },
      openGraph: { ...OG_BASE, type: "website", title, description, url: path, images: img ? [{ url: img.path, width: img.width ?? undefined, height: img.height ?? undefined, alt: img.alt }] : [DEFAULT_OG_IMAGE] },
    };
  }
  // modèle retiré : page explicative accessible (liens enregistrés), jamais indexée ni dans le sitemap
  if (await getRetiredFamily(slug)) return { title: "Modèle retiré du catalogue", robots: { index: false, follow: true } };
  return {};
}

/** Fiche produit d'une famille publique ; ancien modèle retiré → page explicative ; sinon 404. */
export async function ProductRoute({ category, slug }: { category: CategoryKey; slug: string }) {
  const f = await getSystemFamily(category, slug);
  if (!f) {
    const retired = await getRetiredFamily(slug);
    if (retired && (!retired.category || retired.category === category)) return <RetiredProduct retired={retired} />;
    notFound();
  }
  const [media, docs] = await Promise.all([publishedMediaFor(f.slug), publicDocumentsForFamily(f.id)]);
  return <SystemProductPage family={f} category={category} media={media} docs={docs} />;
}
