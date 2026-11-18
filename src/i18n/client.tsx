"use client";
/**
 * Fournisseur de langue côté navigateur : une seule langue sérialisée (celle de la page). Hors fournisseur (ex.
 * administration), les liens restent en français et `useT` signale l'oubli.
 */
import { createContext, useContext, useMemo } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_LOCALE, localizePath, splitLocale, type Locale } from "./config";
import type { AreaKey, AreaMessages } from "./messages";
import type { I18nPayload } from "./server";

const Ctx = createContext<I18nPayload | null>(null);

export function I18nProvider({ value, children }: { value: I18nPayload; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nPayload | null {
  return useContext(Ctx);
}

export function useLocale(): Locale {
  return useContext(Ctx)?.locale ?? DEFAULT_LOCALE;
}

/** Format des nombres (« 2,5 m » / « 2.5 m ») de la langue courante. */
export function useIntl(): string {
  return useContext(Ctx)?.intl ?? "fr-FR";
}

export function useT<A extends AreaKey>(area: A): AreaMessages<A> {
  const v = useContext(Ctx);
  if (!v) throw new Error(`useT("${area}") hors de I18nProvider`);
  return v.messages[area] as AreaMessages<A>;
}

/** Fonction de localisation des chemins internes pour la langue courante. */
export function useLocalePath(): (href: string) => string {
  const locale = useLocale();
  return useMemo(() => (href: string) => localizePath(href, locale), [locale]);
}

/** Chemin courant sans préfixe de langue (comparaison avec les liens de navigation). */
export function useBarePathname(): string {
  return splitLocale(usePathname() ?? "/").path;
}
