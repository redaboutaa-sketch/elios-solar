import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { BRAND } from "@/config/brand";
import { GUIDES } from "@/server/content/guides";
import { categoryByKey } from "@/domain/categories";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.SITE_INDEXABLE !== "true") return [];
  const base = BRAND.siteUrl;
  const fams = await prisma.productFamily.findMany({ where: { status: { in: ["PUBLISHED", "QUOTE_ONLY"] }, legacy: false, category: { not: null } }, select: { slug: true, category: true, updatedAt: true } });
  const path = (f: { slug: string; category: string | null }) => { const c = categoryByKey(f.category); return c ? `${c.href}/${f.slug}` : null; };
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    ...["/pergolas", "/screens", "/stores-bannes", "/configurateur", "/devis", "/contact", "/aide", "/livraison-installation", "/cgv", "/mentions-legales", "/confidentialite", "/cookies"].map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...Object.keys(GUIDES).map((g) => ({ url: `${base}/guides/${g}`, changeFrequency: "monthly" as const, priority: 0.5 })),
    { url: `${base}/guides/preparation-projet`, changeFrequency: "monthly" as const, priority: 0.5 },
    ...fams.filter((f) => path(f)).map((f) => ({ url: `${base}${path(f)}`, lastModified: f.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
