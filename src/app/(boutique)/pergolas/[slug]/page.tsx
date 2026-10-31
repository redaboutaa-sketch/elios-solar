import type { Metadata } from "next";
import { ProductRoute, productMetadata } from "@/server/catalog/product-route";

export async function generateMetadata(props: PageProps<"/pergolas/[slug]">): Promise<Metadata> {
  return productMetadata("PERGOLAS", (await props.params).slug);
}

export default async function ProductPage(props: PageProps<"/pergolas/[slug]">) {
  return <ProductRoute category="PERGOLAS" slug={(await props.params).slug} />;
}
