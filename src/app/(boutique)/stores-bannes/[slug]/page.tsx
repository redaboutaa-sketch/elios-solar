import type { Metadata } from "next";
import { ProductRoute, productMetadata } from "@/server/catalog/product-route";

export async function generateMetadata(props: PageProps<"/stores-bannes/[slug]">): Promise<Metadata> {
  return productMetadata("STORES_BANNES", (await props.params).slug);
}

export default async function ProductPage(props: PageProps<"/stores-bannes/[slug]">) {
  return <ProductRoute category="STORES_BANNES" slug={(await props.params).slug} />;
}
