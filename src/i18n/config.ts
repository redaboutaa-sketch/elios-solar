/**
 * Langues de lecture du site (retour client : versions internationales, 2026-11-01).
 *
 * Une LANGUE n'est ni un pays de livraison, ni une devise, ni une fiscalité, ni des conditions commerciales : ces
 * éléments sont décrits par marché dans `markets.ts` et restent ceux du site français tant qu'aucune décision n'est
 * fournie. Le français reste à la racine (URL existantes inchangées) ; les autres langues sont servies sous un préfixe
 * (/es, /nl, /de, /en) par les MÊMES pages (réécriture dans src/proxy.ts) — aucune copie du site.
 *
 * Activation (variables d'environnement du serveur, lues à l'exécution) :
 * - SITE_LOCALES : langues servies (défaut « fr ») — une langue absente répond 404 ;
 * - SITE_LOCALES_PUBLISHED : langues relues et validées, indexables (défaut « fr »). Une langue servie mais non
 *   publiée est un APERÇU : noindex, absente du sitemap et des hreflang, bandeau « traduction en préparation ».
 */
export const LOCALES = ["fr", "es", "nl", "de", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

export interface LocaleDef {
  code: Locale;
  /** libellé dans sa propre langue (sélecteur) */
  label: string;
  /** attribut lang / hreflang (langue seule : une version sert plusieurs pays, ex. néerlandais aux Pays-Bas et en Belgique) */
  htmlLang: string;
  /** formats de nombres et de dates */
  intl: string;
  /** Open Graph */
  og: string;
}

export const LOCALE_DEFS: Record<Locale, LocaleDef> = {
  fr: { code: "fr", label: "Français", htmlLang: "fr", intl: "fr-FR", og: "fr_FR" },
  es: { code: "es", label: "Español", htmlLang: "es", intl: "es-ES", og: "es_ES" },
  nl: { code: "nl", label: "Nederlands", htmlLang: "nl", intl: "nl-NL", og: "nl_NL" },
  de: { code: "de", label: "Deutsch", htmlLang: "de", intl: "de-DE", og: "de_DE" },
  en: { code: "en", label: "English", htmlLang: "en", intl: "en-GB", og: "en_GB" },
};

export const LOCALE_HEADER = "x-hs-locale";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export function parseLocaleList(raw: string | undefined, fallback: readonly Locale[] = [DEFAULT_LOCALE]): Locale[] {
  const list = (raw ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(isLocale);
  const set = new Set<Locale>([DEFAULT_LOCALE, ...(list.length ? list : fallback)]);
  return LOCALES.filter((l) => set.has(l));
}

/** Chemins jamais préfixés : administration, API, fichiers techniques et médias. */
const UNPREFIXED = /^\/(admin|api|_next|uploads|media|brand|robots\.txt|sitemap\.xml|favicon|icon|apple-icon|manifest)(\/|$|\.)/;

/** Sépare le préfixe de langue d'un chemin : « /es/pergolas » → { locale: "es", path: "/pergolas" }. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const m = /^\/(es|nl|de|en)(\/.*)?$/.exec(pathname);
  if (!m) return { locale: DEFAULT_LOCALE, path: pathname || "/" };
  return { locale: m[1] as Locale, path: m[2] || "/" };
}

/** Chemin dans une langue : le français reste à la racine. Liens externes, ancres et chemins techniques inchangés. */
export function localizePath(href: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE || !href.startsWith("/") || href.startsWith("//") || UNPREFIXED.test(href)) return href;
  if (/^\/(es|nl|de|en)(\/|$|\?|#)/.test(href)) return href;
  if (href === "/") return `/${locale}`;
  if (href.startsWith("/?") || href.startsWith("/#")) return `/${locale}${href.slice(1)}`;
  return `/${locale}${href}`;
}
