import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SystemProductPage } from "@/components/catalog/system-product-page";
import { getSystemFamily } from "@/server/catalog/systems";
import { publishedMediaFor } from "@/server/media/queries";
import { publicDocumentsForFamily } from "@/server/documents/queries";

export async function generateMetadata(props: PageProps<"/stores-bannes/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const f = await getSystemFamily("STORES_BANNES", slug);
  if (!f) return {};
  return { title: f.seoTitle ?? f.name, description: f.seoDescription ?? f.shortDescription, alternates: { canonical: `/stores-bannes/${f.slug}` } };
}

export default async function ProductPage(props: PageProps<"/stores-bannes/[slug]">) {
  const { slug } = await props.params;
  const f = await getSystemFamily("STORES_BANNES", slug);
  if (!f) notFound();
  const [media, docs] = await Promise.all([publishedMediaFor(f.slug), publicDocumentsForFamily(f.id)]);
  return <SystemProductPage family={f} category="STORES_BANNES" media={media} docs={docs} />;
}
