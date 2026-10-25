import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listSystemFamilies } from "@/server/catalog/systems";

export const metadata: Metadata = { title: "Pergolas", description: "Pergolas Malaga, Marbella et Sevilla : lames orientables ou toiture en toile, autoportantes ou adossées.", alternates: { canonical: "/pergolas" } };

export default async function CollectionPage() {
  return <SystemCollection category="PERGOLAS" items={await listSystemFamilies("PERGOLAS")} />;
}
