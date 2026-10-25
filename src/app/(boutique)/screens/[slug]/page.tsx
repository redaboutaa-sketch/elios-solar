import type { Metadata } from "next";
import { ProductRoute, productMetadata } from "@/server/catalog/product-route";

export async function generateMetadata(props: PageProps<"/screens/[slug]">): Promise<Metadata> {
  return productMetadata("SCREENS", (await props.params).slug);
}

export default async function ProductPage(props: PageProps<"/screens/[slug]">) {
  return <ProductRoute category="SCREENS" slug={(await props.params).slug} />;
}
