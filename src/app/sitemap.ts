import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { BRAND } from "@/config/brand";
import { GUIDES } from "@/server/content/guides";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.SITE_INDEXABLE !== "true") return [];
  const base = BRAND.siteUrl;
  const fams = await prisma.productFamily.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, kind: true, updatedAt: true } });
  const path = (f: { slug: string; kind: string }) => (f.kind === "AWNING" ? `/stores-bannes/${f.slug}` : f.kind === "PERGOLA_STANDARD" ? `/pergolas/${f.slug}` : f.kind === "SIDE_CLOSURE" || f.kind === "OPTION" ? `/accessoires/${f.slug}` : null);
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    ...["/pergolas", "/accessoires", "/stores-bannes", "/comparer", "/configurateur", "/configurateur/sur-mesure", "/configurateur/store-banne", "/devis", "/contact", "/aide", "/livraison-installation", "/realisations", "/showroom", "/cgv", "/mentions-legales", "/confidentialite", "/cookies"].map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...Object.keys(GUIDES).map((g) => ({ url: `${base}/guides/${g}`, changeFrequency: "monthly" as const, priority: 0.5 })),
    { url: `${base}/guides/preparation-projet`, changeFrequency: "monthly" as const, priority: 0.5 },
    ...fams.filter((f) => path(f)).map((f) => ({ url: `${base}${path(f)}`, lastModified: f.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
