import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listSystemFamilies } from "@/server/catalog/systems";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/server/seo/og";

const DESCRIPTION = "Store screen HelioScreen sur mesure pour baies et façades, toile tendue par coulisses zip, et HelioRoof pour vérandas et verrières. Demandez votre devis.";
export const metadata: Metadata = { title: "Stores screens extérieurs sur mesure et screens de toiture", description: DESCRIPTION, alternates: { canonical: "/screens" }, openGraph: { ...OG_BASE, title: "Stores screens extérieurs sur mesure et screens de toiture", description: DESCRIPTION, url: "/screens", images: [DEFAULT_OG_IMAGE] } };

export default async function CollectionPage() {
  return <SystemCollection category="SCREENS" items={await listSystemFamilies("SCREENS")} />;
}
