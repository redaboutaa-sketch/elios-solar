import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { AwningConfigurator } from "@/components/configurator/awning-configurator";
import { ensureCatalogSnapshot } from "@/server/catalog/public-snapshot";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { getLineForOwner } from "@/server/cart/service";
import type { AwningInput } from "@/domain/types";

export const metadata: Metadata = { title: "Configurateur de store banne", description: "Choisissez largeur, avancée, couleur du coffre et de la toile, fixation et options parmi les variantes réellement disponibles." };

export default async function AwningConfiguratorPage(props: PageProps<"/configurateur/store-banne">) {
  const sp = await props.searchParams;
  const catalog = await ensureCatalogSnapshot();
  const awnings = catalog.families.filter((f) => f.kind === "awning" && f.status === "published");
  let slug = awnings.some((f) => f.slug === sp.gamme) ? String(sp.gamme) : awnings[0]?.slug;
  let initial: AwningInput | null = null;
  let replaceLineId: string | null = null;
  if (typeof sp.ligne === "string") {
    const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
    const line = await getLineForOwner({ userId: session?.user.id, guestKey }, sp.ligne);
    const li = line?.input as AwningInput | undefined;
    if (li?.kind === "awning") { initial = li; replaceLineId = line!.id; slug = li.familySlug; }
  }
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ href: "/stores-bannes", label: "Stores bannes" }, { label: "Configurateur" }]} />
      <h1 className="mt-4 font-display text-4xl">Configurer votre store banne</h1>
      {slug ? <div className="mt-8"><AwningConfigurator catalog={catalog} familySlug={slug} initial={initial} replaceLineId={replaceLineId} /></div> : <p className="mt-6">Aucun store banne publié.</p>}
    </div>
  );
}
