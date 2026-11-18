import type { Locale } from "../config";

/** Forme d'un message traduit : même structure que le français, chaînes libres (variables « {nom} »). */
export type Shape<T> = T extends string ? string : T extends readonly string[] ? readonly string[] : { readonly [K in keyof T]: Shape<T[K]> };

/**
 * Messages d'une zone du site : le français est la référence (structure et clés), chaque autre langue doit fournir
 * exactement les mêmes clés (contrôlé par le typage et par tests/unit/i18n.test.ts).
 */
export function defineMessages<const F>(fr: F, others: { [K in Exclude<Locale, "fr">]: Shape<F> }): { [K in Locale]: Shape<F> } {
  return { fr: fr as Shape<F>, ...others };
}
