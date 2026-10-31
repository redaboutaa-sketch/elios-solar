import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listDraftFamilies, listSystemFamilies } from "@/server/catalog/systems";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/server/seo/og";

const DESCRIPTION = "Moustiquaires plissées sur mesure pour portes-fenêtres et baies, un ou deux vantaux, sur étude et devis ; modèles enroulables, coulissants et fixes en préparation.";
export const metadata: Metadata = { title: "Moustiquaires plissées sur mesure pour portes-fenêtres", description: DESCRIPTION, alternates: { canonical: "/moustiquaires" }, openGraph: { ...OG_BASE, title: "Moustiquaires plissées sur mesure pour portes-fenêtres", description: DESCRIPTION, url: "/moustiquaires", images: [DEFAULT_OG_IMAGE] } };

export default async function CollectionPage() {
  return <SystemCollection category="MOUSTIQUAIRES" items={await listSystemFamilies("MOUSTIQUAIRES")} drafts={await listDraftFamilies("MOUSTIQUAIRES")} />;
}
