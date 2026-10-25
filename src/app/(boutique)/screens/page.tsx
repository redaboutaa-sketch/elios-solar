import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listSystemFamilies } from "@/server/catalog/systems";

export const metadata: Metadata = { title: "Screens", description: "Screens HelioScreen pour les baies et façades, et HelioRoof Screen pour les toitures vitrées.", alternates: { canonical: "/screens" } };

export default async function CollectionPage() {
  return <SystemCollection category="SCREENS" items={await listSystemFamilies("SCREENS")} />;
}
