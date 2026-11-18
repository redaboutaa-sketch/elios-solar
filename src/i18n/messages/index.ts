/**
 * Registre des messages par zone. Le français est la référence ; les autres langues sont des traductions NON RELUES
 * tant que la langue n'est pas listée dans SITE_LOCALES_PUBLISHED (aperçu, noindex). Les noms commerciaux (HELIO…,
 * Moski…), codes RAL, unités et caractéristiques ne sont jamais traduits ; les contenus du catalogue (descriptions,
 * FAQ, guides, documents juridiques) restent en français dans les aperçus.
 */
import type { Locale } from "../config";
import { layout } from "./layout";
import { home } from "./home";
import { configurator } from "./configurator";
import { catalog } from "./catalog";
import { forms } from "./forms";
import { chat } from "./chat";

export const AREAS = { layout, home, configurator, catalog, forms, chat } as const;
export type AreaKey = keyof typeof AREAS;
export type AreaMessages<A extends AreaKey> = (typeof AREAS)[A]["fr"];
export type AllMessages = { [A in AreaKey]: AreaMessages<A> };

export function messagesFor(locale: Locale): AllMessages {
  return Object.fromEntries(Object.entries(AREAS).map(([k, v]) => [k, v[locale]])) as AllMessages;
}
