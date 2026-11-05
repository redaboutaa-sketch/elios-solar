import "server-only";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_DEFS, LOCALE_HEADER, isLocale, localizePath, parseLocaleList, type Locale } from "./config";
import { AREAS, messagesFor, type AreaKey } from "./messages";

/** Langues servies (SITE_LOCALES, défaut français seul). */
export function enabledLocales(): Locale[] {
  return parseLocaleList(process.env["SITE_LOCALES"]);
}

/** Langues relues et validées (SITE_LOCALES_PUBLISHED) parmi les langues servies : seules indexables. */
export function publishedLocales(): Locale[] {
  const on = enabledLocales();
  return parseLocaleList(process.env["SITE_LOCALES_PUBLISHED"]).filter((l) => on.includes(l));
}

export function isPreviewLocale(l: Locale): boolean {
  return l !== DEFAULT_LOCALE && !publishedLocales().includes(l);
}

/** Langue de la requête (en-tête posé par src/proxy.ts d'après le préfixe de l'URL ; jamais d'après l'adresse IP). */
export async function getLocale(): Promise<Locale> {
  const v = (await headers()).get(LOCALE_HEADER);
  return isLocale(v) && enabledLocales().includes(v) ? v : DEFAULT_LOCALE;
}

/** Messages d'une zone dans la langue de la requête. */
export async function getT<A extends AreaKey>(area: A): Promise<(typeof AREAS)[A]["fr"]> {
  return AREAS[area][await getLocale()] as (typeof AREAS)[A]["fr"];
}

/** Chemin dans la langue de la requête (redirections serveur). */
export async function localePath(path: string): Promise<string> {
  return localizePath(path, await getLocale());
}

/** Données transmises au fournisseur client (une seule langue sérialisée). */
export async function i18nPayload() {
  const locale = await getLocale();
  return {
    locale,
    intl: LOCALE_DEFS[locale].intl,
    preview: isPreviewLocale(locale),
    enabled: enabledLocales().map((l) => ({ code: l, label: LOCALE_DEFS[l].label, htmlLang: LOCALE_DEFS[l].htmlLang })),
    messages: messagesFor(locale),
  };
}
export type I18nPayload = Awaited<ReturnType<typeof i18nPayload>>;
