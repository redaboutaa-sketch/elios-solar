import "server-only";
import { prisma } from "@/lib/prisma";
import { CATEGORIES, productHref, type CategoryKey } from "@/domain/categories";

export interface NavProduct { slug: string; name: string; shortDescription: string; href: string }
export interface NavCategory { key: CategoryKey; label: string; href: string; intro: string; items: NavProduct[] }

/** Navigation principale : Pergolas — Screens — Stores bannes, avec les produits publiés de chaque famille. */
export async function publicNavigation(): Promise<NavCategory[]> {
  const rows = await prisma.productFamily.findMany({
    where: { category: { not: null }, legacy: false, status: { in: ["PUBLISHED", "QUOTE_ONLY"] } },
    select: { slug: true, name: true, shortDescription: true, category: true },
    orderBy: { sortOrder: "asc" },
  });
  return CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    href: c.href,
    intro: c.intro,
    items: rows.filter((r) => r.category === c.key).map((r) => ({ slug: r.slug, name: r.name, shortDescription: r.shortDescription, href: productHref(c.key, r.slug) })),
  }));
}
