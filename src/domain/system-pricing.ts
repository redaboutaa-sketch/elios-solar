/**
 * Prix public d'un système HELIOSTORES lu dans la grille « Prix final HELIOSTORES » du classeur
 * SITUATION DES TARIF (version active). Seule cette colonne est publique ; la colonne « Prix » source reste privée
 * et n'entre jamais dans l'instantané du catalogue.
 *
 * Règle de lecture : la cote saisie est arrondie à la dimension SUPÉRIEURE de la grille, sur chaque axe.
 * Une cote hors de la plage couverte par la grille (en deçà de la première ou au-delà de la dernière dimension)
 * n'a pas de prix : elle reste chiffrée au devis. Les options ne figurent pas au classeur : elles sont chiffrées au devis.
 */
import type { SystemInput, SystemRules } from "./system";

export interface SystemPriceCell {
  /** variante tarifaire du classeur (« murale », « autoportante ») ; vide = unique */
  variantKey: string;
  /** dimension principale de la grille (projection, avancée ou hauteur), mm */
  dimAmm: number;
  widthMinMm: number;
  widthMaxMm: number;
  /** montant en unités mineures de `currency` */
  amountMinor: number;
}

export interface SystemPriceTable {
  /** code ISO (EUR) */
  currency: string;
  /** base fiscale affichée avec le prix (null = non indiquée) */
  taxBasis: "HT" | "TTC" | null;
  /** axe de la dimension principale dans la grille */
  dimAKey: "projection" | "hauteur";
  listVersion: number;
  cells: SystemPriceCell[];
}

export interface SystemPrice {
  amountMinor: number;
  currency: string;
  taxBasis?: "HT" | "TTC" | null;
  variantKey: string;
  /** cote de grille retenue (après arrondi à la dimension supérieure) */
  grid: { widthMm: number; dimMm: number; dimLabel: string };
  /** la cote saisie a été arrondie à la dimension supérieure de la grille */
  roundedUp: boolean;
  listVersion: number;
}

export type SystemPriceLookup = { ok: true; price: SystemPrice } | { ok: false; reason: "no_table" | "incomplete" | "out_of_grid" };

const MOUNTING_VARIANT: Partial<Record<SystemInput["mounting"], string>> = { wall: "murale", freestanding: "autoportante" };

function variantFor(table: SystemPriceTable, mounting: SystemInput["mounting"]): string | null {
  const keys = new Set(table.cells.map((c) => c.variantKey));
  if (keys.size === 1 && keys.has("")) return "";
  const k = MOUNTING_VARIANT[mounting];
  return k && keys.has(k) ? k : null;
}

/** Valeur d'entrée correspondant à l'axe principal de la grille. */
function dimInput(table: SystemPriceTable, input: SystemInput): number | undefined {
  return table.dimAKey === "hauteur" ? input.heightMm : input.depthMm;
}

export function lookupSystemPrice(table: SystemPriceTable | null | undefined, rules: SystemRules, input: SystemInput): SystemPriceLookup {
  if (!table || !table.cells.length) return { ok: false, reason: "no_table" };
  const variant = variantFor(table, input.mounting);
  const dim = dimInput(table, input);
  if (variant == null || dim == null || !Number.isFinite(dim) || !Number.isFinite(input.widthMm) || input.widthMm <= 0) return { ok: false, reason: "incomplete" };
  const cells = table.cells.filter((c) => c.variantKey === variant);
  const dims = [...new Set(cells.map((c) => c.dimAmm))].sort((a, b) => a - b);
  const widthMins = Math.min(...cells.map((c) => c.widthMinMm));
  if (!dims.length || dim < dims[0]! || input.widthMm < widthMins) return { ok: false, reason: "out_of_grid" };
  const gridDim = dims.find((d) => d >= dim);
  if (gridDim == null) return { ok: false, reason: "out_of_grid" };
  const row = cells.filter((c) => c.dimAmm === gridDim).sort((a, b) => a.widthMaxMm - b.widthMaxMm);
  const cell = row.find((c) => c.widthMaxMm >= input.widthMm);
  if (!cell) return { ok: false, reason: "out_of_grid" };
  const dimRule = table.dimAKey === "hauteur" ? rules.dims.height : rules.dims.depth;
  const gridWidth = cell.widthMinMm === cell.widthMaxMm ? cell.widthMaxMm : input.widthMm;
  return {
    ok: true,
    price: {
      amountMinor: cell.amountMinor,
      currency: table.currency,
      taxBasis: table.taxBasis,
      variantKey: variant,
      grid: { widthMm: gridWidth, dimMm: gridDim, dimLabel: dimRule?.label ?? (table.dimAKey === "hauteur" ? "Hauteur" : "Projection") },
      roundedUp: gridDim !== dim || gridWidth !== input.widthMm,
      listVersion: table.listVersion,
    },
  };
}

/** Prix le plus bas de la grille (« à partir de »). */
export function minSystemPrice(table: SystemPriceTable | null | undefined): { amountMinor: number; currency: string; taxBasis: "HT" | "TTC" | null } | null {
  if (!table?.cells.length) return null;
  return { amountMinor: Math.min(...table.cells.map((c) => c.amountMinor)), currency: table.currency, taxBasis: table.taxBasis };
}

const CURRENCY_FR: Record<string, string> = { MAD: "DH", EUR: "€" };

/** « 4 461,29 € HT » : centimes affichés seulement s'ils existent (montant de la grille, jamais arrondi). */
export function formatSystemPrice(amountMinor: number, currency: string, taxBasis?: "HT" | "TTC" | null): string {
  const showCents = amountMinor % 100 !== 0;
  const n = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: showCents ? 2 : 0, maximumFractionDigits: 2 }).format(amountMinor / 100);
  return `${n}\u00a0${CURRENCY_FR[currency] ?? currency}${taxBasis ? `\u00a0${taxBasis}` : ""}`;
}
