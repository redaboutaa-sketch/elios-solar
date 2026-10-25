import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SystemConfigurator } from "@/components/configurator/system-configurator";
import { ensureCatalogSnapshot } from "@/server/catalog/public-snapshot";
import { categoryByKey, productHref } from "@/domain/categories";
import { publishedMediaFor } from "@/server/media/queries";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { prisma } from "@/lib/prisma";
import { isOwner } from "@/server/configuration/service";
import { getLineForOwner } from "@/server/cart/service";
import type { SystemInput } from "@/domain/system";
import { RetiredProduct } from "@/components/catalog/retired-product";
import { getRetiredFamily } from "@/server/catalog/systems";
import { configuratorHref } from "@/domain/categories";

const SYSTEM_KINDS = new Set(["pergola_system", "screen_system", "awning_system", "roof_blind_system", "insect_screen_system"]);

async function systemFamily(slug: string) {
  const catalog = await ensureCatalogSnapshot();
  const family = catalog.families.find((f) => f.slug === slug && SYSTEM_KINDS.has(f.kind) && !f.legacy && f.category && (f.status === "published" || f.status === "quote_only") && f.systemRules);
  return family ? { catalog, family } : null;
}

export async function generateMetadata(props: PageProps<"/configurateur/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const s = await systemFamily(slug);
  if (!s) return {};
  return { title: `Configurer ${s.family.name}`, description: `Configurez ${s.family.name} à vos cotes : dimensions, pose, teinte et équipements, avec vue 3D indicative et prix selon vos dimensions.`, alternates: { canonical: `/configurateur/${slug}` } };
}

export default async function SystemConfiguratorPage(props: PageProps<"/configurateur/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const s = await systemFamily(slug);
  if (!s) {
    // ancien modèle retiré : explication et choix d'une gamme, sans conversion de la configuration
    const retired = await getRetiredFamily(slug);
    if (retired) return <RetiredProduct retired={retired} from="configurateur" />;
    notFound();
  }
  const { catalog, family } = s;
  const cat = categoryByKey(family.category)!;
  const media = await publishedMediaFor(family.slug);
  const hero = media.find((m) => m.role === "hero") ?? media[0];
  let initial: Partial<SystemInput> | undefined;
  let existing: { id: string; token: string; title: string | null } | null = null;
  let cartLineId: string | null = null;
  if (typeof sp.ligne === "string") {
    // modification d'une ligne du panier : seule une ligne du panier du visiteur, pour ce produit
    const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
    const line = await getLineForOwner({ userId: session?.user.id, guestKey }, sp.ligne);
    const li = line?.input as unknown as SystemInput | undefined;
    if (line && li?.kind === "system" && li.familySlug === family.slug) { initial = li; cartLineId = line.id; }
  } else if (typeof sp.projet === "string") {
    const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
    const c = await prisma.configuration.findFirst({ where: { OR: [{ id: sp.projet }, { shareToken: sp.projet }] } });
    const owner = { userId: session?.user.id, guestKey };
    if (c && c.kind === "system" && (c.input as { familySlug?: string }).familySlug === family.slug && (!c.shareRevoked || isOwner(c, owner))) {
      initial = c.input as unknown as SystemInput;
      if (isOwner(c, owner)) existing = { id: c.id, token: c.shareToken, title: c.title };
    }
  }
  const nav = {
    productHref: productHref(cat.key, family.slug),
    familyHref: cat.href,
    familyLabel: cat.label,
    siblings: catalog.families.filter((f) => f.category === family.category && f.slug !== family.slug && !f.legacy && (f.status === "published" || f.status === "quote_only") && f.systemRules).map((f) => ({ slug: f.slug, name: f.name, href: configuratorHref(f.slug) })),
  };
  // eslint-disable-next-line @next/next/no-img-element -- média de la médiathèque
  const art = hero ? <img src={hero.path} alt={hero.alt} className="aspect-[4/3] w-full bg-white object-contain" /> : <div className="grid aspect-[4/3] place-items-center text-sm text-stone-700">Visuel à venir</div>;
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ href: cat.href, label: cat.label }, { href: productHref(cat.key, family.slug), label: family.name }, { label: "Configurer" }]} />
      <h1 className="mt-4 font-display text-display font-semibold">Configurer {family.name}</h1>
      <p className="mt-2 max-w-3xl text-stone-700 text-pretty">Suivez les étapes : la visualisation de votre projet évolue avec vos choix. Le prix s'affiche lorsque vos dimensions figurent dans la grille tarifaire publiée ; sinon, et pour les options, la pose et la livraison, un conseiller établit votre devis.</p>
      <div className="mt-6"><SystemConfigurator catalog={catalog} familySlug={family.slug} art={art} initial={initial} existing={existing} cartLineId={cartLineId} nav={nav} /></div>
    </div>
  );
}
