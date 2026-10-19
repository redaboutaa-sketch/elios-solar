import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PergolaConfigurator } from "@/components/configurator/pergola-configurator";
import { ensureCatalogSnapshot } from "@/server/catalog/public-snapshot";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { prisma } from "@/lib/prisma";
import { isOwner } from "@/server/configuration/service";
import type { PergolaStandardInput } from "@/domain/types";

export const metadata: Metadata = { title: "Configurateur de pergola", description: "Composez votre pergola bioclimatique : gamme, implantation, dimension, finition, fermetures latérales et options, avec prix calculé." };

export default async function ConfiguratorPage(props: PageProps<"/configurateur">) {
  const sp = await props.searchParams;
  const catalog = await ensureCatalogSnapshot();
  const families = catalog.families.filter((f) => f.kind === "pergola_standard" && f.status === "published");
  const first = families[0]!;
  let initial: PergolaStandardInput = {
    kind: "pergola_standard",
    familySlug: families.some((f) => f.slug === sp.gamme) ? String(sp.gamme) : first.slug,
    mounting: sp.implantation === "adossee" ? "wall" : "freestanding",
    dimensionCode: typeof sp.dimension === "string" && catalog.dimensions.some((d) => d.code === sp.dimension) ? sp.dimension : "3x4",
    finishCode: typeof sp.finition === "string" && catalog.finishes.some((f) => f.code === sp.finition) ? sp.finition : "ANTHRACITE",
    segments: {},
    options: [],
    installation: "self",
    delivery: { countryCode: "FR" },
  };
  const fam = families.find((f) => f.slug === initial.familySlug)!;
  if (!fam.finishCodes?.includes(initial.finishCode)) initial.finishCode = fam.finishCodes?.[0] ?? initial.finishCode;
  let existing: { id: string; token: string; title: string | null } | null = null;
  if (typeof sp.projet === "string") {
    const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
    const c = await prisma.configuration.findFirst({ where: { OR: [{ id: sp.projet }, { shareToken: sp.projet }] } });
    if (c && c.kind === "pergola_standard" && (!c.shareRevoked || isOwner(c, { userId: session?.user.id, guestKey }))) {
      initial = c.input as unknown as PergolaStandardInput;
      if (isOwner(c, { userId: session?.user.id, guestKey })) existing = { id: c.id, token: c.shareToken, title: c.title };
    }
  }
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: "Configurateur" }]} />
      <h1 className="mt-4 font-display text-4xl">Configurer votre pergola</h1>
      <p className="mt-2 text-stone-700 max-w-2xl">Huit étapes, un prix recalculé à chaque choix et confirmé par le serveur. Les points non confirmés par le fournisseur sont signalés et orientés vers un devis.</p>
      <div className="mt-8"><PergolaConfigurator catalog={catalog} initial={initial} existing={existing} /></div>
    </div>
  );
}
