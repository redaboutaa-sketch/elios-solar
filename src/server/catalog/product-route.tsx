import "server-only";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SystemProductPage } from "@/components/catalog/system-product-page";
import { RetiredProduct } from "@/components/catalog/retired-product";
import { categoryByKey, type CategoryKey } from "@/domain/categories";
import { getRetiredFamily, getSystemFamily } from "./systems";
import { publishedMediaFor } from "@/server/media/queries";
import { publicDocumentsForFamily } from "@/server/documents/queries";

/** Métadonnées d'une fiche produit (ou de la page d'un modèle retiré, non indexée). */
export async function productMetadata(category: CategoryKey, slug: string): Promise<Metadata> {
  const f = await getSystemFamily(category, slug);
  if (f) return { title: f.seoTitle ?? f.name, description: f.seoDescription ?? f.shortDescription, alternates: { canonical: `${categoryByKey(category)!.href}/${f.slug}` } };
  if (await getRetiredFamily(slug)) return { title: "Modèle retiré du catalogue", robots: { index: false } };
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
