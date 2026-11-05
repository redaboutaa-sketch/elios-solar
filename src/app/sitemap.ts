import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { BRAND } from "@/config/brand";
import { sitemapEntries } from "@/server/seo/sitemap-entries";
import { LOCALE_DEFS, localizePath } from "@/i18n/config";
import { publishedLocales } from "@/i18n/server";

/** Documents juridiques : en français seulement (aucune traduction juridique publiée sans relecture). */
const FRENCH_ONLY = new Set(["/mentions-legales", "/cgv", "/confidentialite", "/cookies"]);

/**
 * Lu à chaque requête (jamais figé au build) ; vide hors production indexable. Seules les langues PUBLIÉES
 * (SITE_LOCALES_PUBLISHED) y figurent, avec des hreflang réciproques ; les aperçus de traduction n'y sont jamais.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  if (process.env.SITE_INDEXABLE !== "true") return [];
  const base = BRAND.siteUrl.replace(/\/$/, "");
  const locales = publishedLocales();
  const abs = (p: string) => `${base}${p === "/" ? "" : p}`;
  return (await sitemapEntries()).flatMap((e) => {
    const langs = FRENCH_ONLY.has(e.path) ? locales.filter((l) => l === "fr") : locales;
    const alternates = langs.length > 1 ? { alternates: { languages: Object.fromEntries([...langs.map((l) => [LOCALE_DEFS[l].htmlLang, abs(localizePath(e.path, l))]), ["x-default", abs(e.path)]]) } } : {};
    return langs.map((l) => ({ url: abs(localizePath(e.path, l)), ...(e.lastModified ? { lastModified: e.lastModified } : {}), ...alternates }));
  });
}
