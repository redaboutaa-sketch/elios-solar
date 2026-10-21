import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listSystemFamilies } from "@/server/catalog/systems";

export const metadata: Metadata = { title: "Screens", description: "Screen REFLEKSOL 120 ZiiiP à toile tendue, motorisé, pour la protection solaire des baies. Prix selon vos dimensions.", alternates: { canonical: "/screens" } };

export default async function CollectionPage() {
  return <SystemCollection category="SCREENS" items={await listSystemFamilies("SCREENS")} />;
}
