import "server-only";
import { prisma } from "@/lib/prisma";
import { categoryByKey, CATEGORIES } from "@/domain/categories";
import { PUBLIC_SECTIONS } from "@/config/brand";
import { PUBLISHED_GUIDES } from "@/server/content/guides";
import { INSTALL_GUIDES } from "@/server/content/install-guides";
import { guideStatuses } from "@/server/guides/status";
import { GUIDES_UPDATED } from "@/server/content/guides";

export interface SitemapEntry { path: string; lastModified?: Date }

/**
 * Pages canoniques publiées seulement : accueil, familles, fiches publiées ou sur devis (ni brouillon, ni modèle retiré),
 * guides publiés, pages de contenu PUBLIÉES, et pages de service indexables. Exclus : configurateurs (non indexés),
 * compte, panier, commande, paiement, projets, comparateur, Références tant qu'aucune fiche authentique n'est publiée.
 */
export async function sitemapEntries(): Promise<SitemapEntry[]> {
  const [fams, pages, realisations, st] = await Promise.all([
    prisma.productFamily.findMany({ where: { status: { in: ["PUBLISHED", "QUOTE_ONLY"] }, legacy: false, category: { not: null } }, select: { slug: true, category: true, updatedAt: true, systemRules: true } }),
    prisma.contentPage.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    PUBLIC_SECTIONS.references ? prisma.realisation.count({ where: { published: true, placeholder: false, isDemo: false } }) : Promise.resolve(0),
    guideStatuses(),
  ]);
  const guidesDate = new Date(`${GUIDES_UPDATED}T00:00:00Z`);
  const CONTENT_SLUGS = ["mentions-legales", "cgv", "confidentialite", "cookies", "livraison-installation", "aide"];
  return [
    { path: "/" },
    ...CATEGORIES.map((c) => ({ path: c.href })),
    { path: "/accessoires" },
    ...fams.filter((f) => f.systemRules && categoryByKey(f.category)).map((f) => ({ path: `${categoryByKey(f.category)!.href}/${f.slug}`, lastModified: f.updatedAt })),
    { path: "/guides" },
    ...PUBLISHED_GUIDES.map((g) => ({ path: g.href, lastModified: guidesDate })),
    ...INSTALL_GUIDES.filter((g) => st.get(g.slug)?.status === "PUBLISHED").map((g) => ({ path: `/guides/installation/${g.slug}` })),
    ...(realisations > 0 ? [{ path: "/references" }] : []),
    { path: "/devis" },
    { path: "/contact" },
    ...pages.filter((p) => CONTENT_SLUGS.includes(p.slug)).map((p) => ({ path: `/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
