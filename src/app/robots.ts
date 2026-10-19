import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";
export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_INDEXABLE !== "true") return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/compte", "/panier", "/commande", "/projets/", "/api/"] }, sitemap: `${BRAND.siteUrl}/sitemap.xml` };
}
