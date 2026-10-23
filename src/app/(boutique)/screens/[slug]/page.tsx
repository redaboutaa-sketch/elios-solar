import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SystemProductPage } from "@/components/catalog/system-product-page";
import { getSystemFamily } from "@/server/catalog/systems";
import { publishedMediaFor } from "@/server/media/queries";
import { publicDocumentsForFamily } from "@/server/documents/queries";

export async function generateMetadata(props: PageProps<"/screens/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const f = await getSystemFamily("SCREENS", slug);
  if (!f) return {};
  return { title: f.seoTitle ?? f.name, description: f.seoDescription ?? f.shortDescription, alternates: { canonical: `/screens/${f.slug}` } };
}

export default async function ProductPage(props: PageProps<"/screens/[slug]">) {
  const { slug } = await props.params;
  const f = await getSystemFamily("SCREENS", slug);
  if (!f) notFound();
  const [media, docs] = await Promise.all([publishedMediaFor(f.slug), publicDocumentsForFamily(f.id)]);
  return <SystemProductPage family={f} category="SCREENS" media={media} docs={docs} />;
}
