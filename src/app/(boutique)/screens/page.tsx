import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listSystemFamilies } from "@/server/catalog/systems";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/server/seo/og";

const DESCRIPTION = "Screens HelioScreen pour les baies et façades, et HelioRoof Screen pour les toitures vitrées.";
export const metadata: Metadata = { title: "Screens extérieurs et screens de toiture", description: DESCRIPTION, alternates: { canonical: "/screens" }, openGraph: { ...OG_BASE, title: "Screens extérieurs et screens de toiture", description: DESCRIPTION, url: "/screens", images: [DEFAULT_OG_IMAGE] } };

export default async function CollectionPage() {
  return <SystemCollection category="SCREENS" items={await listSystemFamilies("SCREENS")} />;
}
