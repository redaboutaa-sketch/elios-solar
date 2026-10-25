import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listSystemFamilies } from "@/server/catalog/systems";

export const metadata: Metadata = { title: "Stores bannes", description: "Stores bannes Casablanca, Corsica, Jamaica et Madera : coffre, semi-coffre ou sans coffre, manuels ou motorisés.", alternates: { canonical: "/stores-bannes" } };

export default async function CollectionPage() {
  return <SystemCollection category="STORES_BANNES" items={await listSystemFamilies("STORES_BANNES")} />;
}
