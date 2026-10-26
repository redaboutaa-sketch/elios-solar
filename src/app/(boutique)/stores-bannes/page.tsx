import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listSystemFamilies } from "@/server/catalog/systems";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/server/seo/og";

const DESCRIPTION = "Stores bannes sur mesure Casablanca (coffre), Corsica (semi-coffre), Jamaica (sans coffre) et Madera, manuels ou motorisés. Configurez et demandez votre devis.";
export const metadata: Metadata = { title: "Stores bannes sur mesure : coffre, semi-coffre ou sans coffre", description: DESCRIPTION, alternates: { canonical: "/stores-bannes" }, openGraph: { ...OG_BASE, title: "Stores bannes sur mesure : coffre, semi-coffre ou sans coffre", description: DESCRIPTION, url: "/stores-bannes", images: [DEFAULT_OG_IMAGE] } };

export default async function CollectionPage() {
  return <SystemCollection category="STORES_BANNES" items={await listSystemFamilies("STORES_BANNES")} />;
}
