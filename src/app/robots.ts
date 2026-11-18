import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { BRAND } from "@/config/brand";
import { robotsRules } from "@/server/seo/robots-rules";

/** Lu à chaque requête (jamais figé au build) : la même image sert la préproduction (fermée) et la production. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return robotsRules(process.env.SITE_INDEXABLE === "true", BRAND.siteUrl);
}
