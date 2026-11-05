import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listSystemFamilies } from "@/server/catalog/systems";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/server/seo/og";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = (await getT("catalog")).meta.STORES_BANNES;
  return { title, description, alternates: { canonical: "/stores-bannes" }, openGraph: { ...OG_BASE, title, description, url: "/stores-bannes", images: [DEFAULT_OG_IMAGE] } };
}

export default async function CollectionPage() {
  return <SystemCollection category="STORES_BANNES" items={await listSystemFamilies("STORES_BANNES")} />;
}
