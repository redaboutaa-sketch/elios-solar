/**
 * Marchés (pays de livraison) : DISTINCTS des langues. Aucune information n'est inventée : tant qu'une décision écrite
 * du client n'est pas fournie, la livraison, la pose, la devise locale, la fiscalité et les conditions commerciales d'un
 * pays sont « à valider » — la lecture d'une traduction ne vaut pas confirmation de livraison dans ce pays.
 * Le site français reste la seule offre en vigueur (EUR, conditions et documents juridiques français).
 */
import type { Locale } from "./config";

export type MarketStatus = "active" | "to_validate";

export interface Market {
  country: string;
  name: string;
  /** langues de lecture adaptées (la Belgique n'est pas une langue : français ou néerlandais) */
  locales: Locale[];
  status: MarketStatus;
  /** devise d'une éventuelle offre locale : null = non décidée (aucun prix converti n'est publié) */
  currency: string | null;
  delivery: "confirmed" | "to_validate";
  installation: "to_validate";
  taxes: "fr_only" | "to_validate";
  terms: "fr_only" | "to_validate";
}

export const MARKETS: Market[] = [
  { country: "FR", name: "France", locales: ["fr"], status: "active", currency: "EUR", delivery: "confirmed", installation: "to_validate", taxes: "fr_only", terms: "fr_only" },
  { country: "ES", name: "Espagne", locales: ["es"], status: "to_validate", currency: null, delivery: "to_validate", installation: "to_validate", taxes: "to_validate", terms: "to_validate" },
  { country: "BE", name: "Belgique", locales: ["fr", "nl"], status: "to_validate", currency: null, delivery: "to_validate", installation: "to_validate", taxes: "to_validate", terms: "to_validate" },
  { country: "NL", name: "Pays-Bas", locales: ["nl"], status: "to_validate", currency: null, delivery: "to_validate", installation: "to_validate", taxes: "to_validate", terms: "to_validate" },
  { country: "DE", name: "Allemagne", locales: ["de"], status: "to_validate", currency: null, delivery: "to_validate", installation: "to_validate", taxes: "to_validate", terms: "to_validate" },
  { country: "GB", name: "Royaume-Uni", locales: ["en"], status: "to_validate", currency: null, delivery: "to_validate", installation: "to_validate", taxes: "to_validate", terms: "to_validate" },
];
