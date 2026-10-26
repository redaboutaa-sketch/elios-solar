import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listSystemFamilies } from "@/server/catalog/systems";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/server/seo/og";

const DESCRIPTION = "Pergolas Malaga, Marbella et Sevilla : lames orientables ou toiture en toile, autoportantes ou adossées.";
export const metadata: Metadata = { title: "Pergolas à lames orientables ou à toiture en toile", description: DESCRIPTION, alternates: { canonical: "/pergolas" }, openGraph: { ...OG_BASE, title: "Pergolas à lames orientables ou à toiture en toile", description: DESCRIPTION, url: "/pergolas", images: [DEFAULT_OG_IMAGE] } };

export default async function CollectionPage() {
  return <SystemCollection category="PERGOLAS" items={await listSystemFamilies("PERGOLAS")} />;
}
