import type { Metadata } from "next";
import { SystemCollection } from "@/components/catalog/system-collection";
import { listDraftFamilies, listSystemFamilies } from "@/server/catalog/systems";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/server/seo/og";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = (await getT("catalog")).meta.MOUSTIQUAIRES;
  return { title, description, alternates: { canonical: "/moustiquaires" }, openGraph: { ...OG_BASE, title, description, url: "/moustiquaires", images: [DEFAULT_OG_IMAGE] } };
}

export default async function CollectionPage() {
  return <SystemCollection category="MOUSTIQUAIRES" items={await listSystemFamilies("MOUSTIQUAIRES")} drafts={await listDraftFamilies("MOUSTIQUAIRES")} />;
}
