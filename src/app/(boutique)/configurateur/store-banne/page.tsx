import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { AwningConfigurator } from "@/components/configurator/awning-configurator";
import { ensureCatalogSnapshot } from "@/server/catalog/public-snapshot";

export const metadata: Metadata = { title: "Configurateur de store banne", description: "Choisissez largeur, avancée, couleur du coffre et de la toile, fixation et options parmi les variantes réellement disponibles." };

export default async function AwningConfiguratorPage(props: PageProps<"/configurateur/store-banne">) {
  const sp = await props.searchParams;
  const catalog = await ensureCatalogSnapshot();
  const awnings = catalog.families.filter((f) => f.kind === "awning" && f.status === "published");
  const slug = awnings.some((f) => f.slug === sp.gamme) ? String(sp.gamme) : awnings[0]?.slug;
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ href: "/stores-bannes", label: "Stores bannes" }, { label: "Configurateur" }]} />
      <h1 className="mt-4 font-display text-4xl">Configurer votre store banne</h1>
      {slug ? <div className="mt-8"><AwningConfigurator catalog={catalog} familySlug={slug} /></div> : <p className="mt-6">Aucun store banne publié.</p>}
    </div>
  );
}
