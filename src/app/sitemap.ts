import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { BRAND } from "@/config/brand";
import { sitemapEntries } from "@/server/seo/sitemap-entries";

/** Lu à chaque requête (jamais figé au build) ; vide hors production indexable. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  if (process.env.SITE_INDEXABLE !== "true") return [];
  const base = BRAND.siteUrl.replace(/\/$/, "");
  return (await sitemapEntries()).map((e) => ({ url: `${base}${e.path === "/" ? "" : e.path}`, ...(e.lastModified ? { lastModified: e.lastModified } : {}) }));
}
