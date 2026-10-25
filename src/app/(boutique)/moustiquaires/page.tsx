import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listDraftFamilies, listSystemFamilies } from "@/server/catalog/systems";

export const metadata: Metadata = { title: "Moustiquaires", description: "Moustiquaires plissées, enroulables, coulissantes et fixes pour portes et fenêtres, sur devis.", alternates: { canonical: "/moustiquaires" } };

export default async function CollectionPage() {
  return <SystemCollection category="MOUSTIQUAIRES" items={await listSystemFamilies("MOUSTIQUAIRES")} drafts={await listDraftFamilies("MOUSTIQUAIRES")} />;
}
