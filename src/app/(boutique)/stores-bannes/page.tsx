import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listSystemFamilies } from "@/server/catalog/systems";

export const metadata: Metadata = { title: "Stores bannes", description: "Store banne à coffre HELIO Riviera, jusqu'à 6 m de largeur et 3,6 m d'avancée. Prix selon vos dimensions.", alternates: { canonical: "/stores-bannes" } };

export default async function CollectionPage() {
  return <SystemCollection category="STORES_BANNES" items={await listSystemFamilies("STORES_BANNES")} />;
}
