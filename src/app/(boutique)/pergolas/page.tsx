import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listSystemFamilies } from "@/server/catalog/systems";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/server/seo/og";

const DESCRIPTION = "Pergolas à lames orientables Malaga et Marbella, pergola à toiture en toile Sevilla : autoportantes ou adossées, sur mesure ou en tailles définies, sur devis.";
export const metadata: Metadata = { title: "Pergolas bioclimatiques et pergolas à toiture en toile", description: DESCRIPTION, alternates: { canonical: "/pergolas" }, openGraph: { ...OG_BASE, title: "Pergolas bioclimatiques et pergolas à toiture en toile", description: DESCRIPTION, url: "/pergolas", images: [DEFAULT_OG_IMAGE] } };

export default async function CollectionPage() {
  return <SystemCollection category="PERGOLAS" items={await listSystemFamilies("PERGOLAS")} />;
}
