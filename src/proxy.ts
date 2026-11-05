import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { robotsHeaderFor } from "@/lib/robots-header";
import { DEFAULT_LOCALE, LOCALE_HEADER, parseLocaleList, splitLocale } from "@/i18n/config";

/**
 * En-tête X-Robots-Tag décidé à l'exécution (et non au build, comme le ferait `headers()` de next.config) :
 * une même image sert la préproduction (tout en noindex) et la production (pages privées seulement en noindex).
 * Le noindex ne protège rien : comptes, devis, commandes et administration restent soumis à l'autorisation serveur.
 *
 * Langues (src/i18n/config.ts) : « /es/… » est réécrit vers la même page « /… » avec la langue dans un en-tête de
 * requête ; une langue non servie (SITE_LOCALES) n'est pas réécrite et répond 404. Aucune redirection selon l'adresse
 * IP ni selon le navigateur. L'en-tête reçu du client est toujours remplacé (jamais de langue imposée de l'extérieur).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { locale, path } = splitLocale(pathname);
  const enabled = parseLocaleList(process.env["SITE_LOCALES"]);
  const indexable = process.env["SITE_INDEXABLE"] === "true";
  const headers = new Headers(request.headers);
  let res: NextResponse;
  if (locale !== DEFAULT_LOCALE && enabled.includes(locale)) {
    headers.set(LOCALE_HEADER, locale);
    const url = request.nextUrl.clone();
    url.pathname = path;
    res = NextResponse.rewrite(url, { request: { headers } });
  } else {
    headers.set(LOCALE_HEADER, DEFAULT_LOCALE);
    res = NextResponse.next({ request: { headers } });
  }
  const published = parseLocaleList(process.env["SITE_LOCALES_PUBLISHED"]);
  const preview = locale !== DEFAULT_LOCALE && !published.includes(locale);
  const value = robotsHeaderFor(locale === DEFAULT_LOCALE ? pathname : path, indexable && !preview);
  if (value) res.headers.set("X-Robots-Tag", value);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
