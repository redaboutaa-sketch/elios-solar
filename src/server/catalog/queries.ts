import "server-only";
import { prisma } from "@/lib/prisma";
import type { FamilyKind as DbFamilyKind } from "@/generated/prisma/enums";

export async function listFamilies(kinds: DbFamilyKind[]) {
  return prisma.productFamily.findMany({
    where: { kind: { in: kinds }, status: { in: ["PUBLISHED", "QUOTE_ONLY"] } },
    include: { finishes: { include: { finish: true } }, dimensions: { include: { dimension: true } }, variants: { where: { active: true }, select: { priceCents: true, purchasable: true, dataStatus: true, attributes: true } }, media: { include: { media: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });
}

export type FamilyListItem = Awaited<ReturnType<typeof listFamilies>>[number];

export function priceFrom(f: { variants: Array<{ priceCents: number; purchasable: boolean }> }): number | null {
  const prices = f.variants.filter((v) => v.purchasable).map((v) => v.priceCents);
  return prices.length ? Math.min(...prices) : null;
}

export async function getFamily(slug: string) {
  return prisma.productFamily.findFirst({
    where: { slug, status: { not: "ARCHIVED" } },
    include: {
      finishes: { include: { finish: true }, orderBy: { finish: { sortOrder: "asc" } } },
      dimensions: { include: { dimension: true }, orderBy: { dimension: { sortOrder: "asc" } } },
      variants: { where: { active: true }, orderBy: { priceCents: "asc" } },
      media: { include: { media: true }, orderBy: { sortOrder: "asc" } },
      documents: { include: { media: true } },
    },
  });
}

export type FamilyDetail = NonNullable<Awaited<ReturnType<typeof getFamily>>>;

export async function getSiteSettings() {
  return prisma.siteSettings.findUnique({ where: { id: 1 } });
}
