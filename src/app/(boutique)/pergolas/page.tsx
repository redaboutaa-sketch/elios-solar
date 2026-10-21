import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listSystemFamilies } from "@/server/catalog/systems";

export const metadata: Metadata = { title: "Pergolas à lames orientables", description: "Pergolas SB400 et SB500 à lames orientables motorisées, murales ou autoportantes, configurées à vos cotes. Prix selon vos dimensions.", alternates: { canonical: "/pergolas" } };

export default async function CollectionPage() {
  return <SystemCollection category="PERGOLAS" items={await listSystemFamilies("PERGOLAS")} />;
}
