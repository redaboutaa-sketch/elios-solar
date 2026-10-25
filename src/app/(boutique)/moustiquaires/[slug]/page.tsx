import type { Metadata } from "next";
import { ProductRoute, productMetadata } from "@/server/catalog/product-route";

export async function generateMetadata(props: PageProps<"/moustiquaires/[slug]">): Promise<Metadata> {
  return productMetadata("MOUSTIQUAIRES", (await props.params).slug);
}

export default async function ProductPage(props: PageProps<"/moustiquaires/[slug]">) {
  return <ProductRoute category="MOUSTIQUAIRES" slug={(await props.params).slug} />;
}
