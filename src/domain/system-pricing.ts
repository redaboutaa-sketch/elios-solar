/**
 * Prix public d'un système HELIOSTORES lu dans la grille « Prix final HELIOSTORES » du classeur
 * SITUATION DES TARIF (version active). Seule cette colonne est publique ; la colonne « Prix » source reste privée
 * et n'entre jamais dans l'instantané du catalogue.
 *
 * Règle de lecture, fixée par chaque grille publiée (administration → Tarifs) :
 * - « exacte » (par défaut) : la cote saisie doit être une dimension de la grille sur chaque axe (ou tomber dans une
 *   plage de largeur de la grille) ; sinon, prix sur devis. Aucune interpolation.
 * - « dimension supérieure » : la cote est lue à la dimension de grille immédiatement supérieure, seulement si la
 *   règle a été confirmée et justifiée dans la grille.
 * Une cote hors de la plage couverte par la grille n'a pas de prix : elle reste chiffrée au devis. Les options sont
 * chiffrées au devis.
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

export type SystemDimRule = "exact" | "round_up";

/** Paramètres propres à une variante (chaque variante est une grille versionnée distincte). */
export interface SystemPriceGridMeta {
  currency: string;
  taxBasis: "HT" | "TTC" | null;
  dimRule: SystemDimRule;
  /** taux de TVA de la grille (points de base) ; null = taux du catalogue */
  vatRateBps: number | null;
  listVersion: number;
  versionId?: string;
}

export interface SystemPriceTable {
  /** code ISO (EUR) */
  currency: string;
  /** base fiscale affichée avec le prix (null = non indiquée) */
  taxBasis: "HT" | "TTC" | null;
  /** axe de la dimension principale dans la grille */
  dimAKey: "projection" | "hauteur";
  listVersion: number;
  /** lecture d'une cote ; défaut « exacte » */
  dimRule?: SystemDimRule;
  vatRateBps?: number | null;
  /** paramètres par variante (prioritaires sur ceux de la table) */
  variants?: Record<string, SystemPriceGridMeta>;
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
  versionId?: string;
  dimRule?: SystemDimRule;
  /** taux de TVA de la grille ; null = taux du catalogue */
  vatRateBps?: number | null;
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

/** Paramètres de la grille d'une variante. */
export function gridMeta(table: SystemPriceTable, variantKey: string): SystemPriceGridMeta {
  return table.variants?.[variantKey] ?? { currency: table.currency, taxBasis: table.taxBasis, dimRule: table.dimRule ?? "exact", vatRateBps: table.vatRateBps ?? null, listVersion: table.listVersion };
}

export function lookupSystemPrice(table: SystemPriceTable | null | undefined, rules: SystemRules, input: SystemInput): SystemPriceLookup {
  if (!table || !table.cells.length) return { ok: false, reason: "no_table" };
  const variant = variantFor(table, input.mounting);
  const dim = dimInput(table, input);
  if (variant == null || dim == null || !Number.isFinite(dim) || !Number.isFinite(input.widthMm) || input.widthMm <= 0) return { ok: false, reason: "incomplete" };
  const meta = gridMeta(table, variant);
  const cells = table.cells.filter((c) => c.variantKey === variant);
  const dims = [...new Set(cells.map((c) => c.dimAmm))].sort((a, b) => a - b);
  const widthMins = Math.min(...cells.map((c) => c.widthMinMm));
  if (!dims.length || dim < dims[0]! || input.widthMm < widthMins) return { ok: false, reason: "out_of_grid" };
  const gridDim = meta.dimRule === "round_up" ? dims.find((d) => d >= dim) : dims.find((d) => d === dim);
  if (gridDim == null) return { ok: false, reason: "out_of_grid" };
  const row = cells.filter((c) => c.dimAmm === gridDim).sort((a, b) => a.widthMaxMm - b.widthMaxMm);
  // plage de largeur (store banne) : la cote doit y tomber ; largeur ponctuelle : cote exacte, ou supérieure si la règle l'autorise
  const cell = meta.dimRule === "round_up" ? row.find((c) => c.widthMaxMm >= input.widthMm) : row.find((c) => c.widthMinMm <= input.widthMm && input.widthMm <= c.widthMaxMm);
  if (!cell) return { ok: false, reason: "out_of_grid" };
  const dimRule = table.dimAKey === "hauteur" ? rules.dims.height : rules.dims.depth;
  const gridWidth = cell.widthMinMm === cell.widthMaxMm ? cell.widthMaxMm : input.widthMm;
  return {
    ok: true,
    price: {
      amountMinor: cell.amountMinor,
      currency: meta.currency,
      taxBasis: meta.taxBasis,
      variantKey: variant,
      grid: { widthMm: gridWidth, dimMm: gridDim, dimLabel: dimRule?.label ?? (table.dimAKey === "hauteur" ? "Hauteur" : "Projection") },
      roundedUp: gridDim !== dim || gridWidth !== input.widthMm,
      listVersion: meta.listVersion,
      versionId: meta.versionId,
      dimRule: meta.dimRule,
      vatRateBps: meta.vatRateBps,
    },
  };
}

/** Dimensions tarifées de la variante correspondant à la pose (affichées quand une cote est hors grille). */
export function pricedSizes(table: SystemPriceTable | null | undefined, rules: SystemRules, input: SystemInput): { dimLabel: string; dims: number[]; widths: { min: number; max: number }[]; roundUp: boolean } | null {
  if (!table?.cells.length) return null;
  const variant = variantFor(table, input.mounting);
  if (variant == null) return null;
  const cells = table.cells.filter((c) => c.variantKey === variant);
  const w = new Map<string, { min: number; max: number }>();
  for (const c of cells) w.set(`${c.widthMinMm}|${c.widthMaxMm}`, { min: c.widthMinMm, max: c.widthMaxMm });
  const dimRule = table.dimAKey === "hauteur" ? rules.dims.height : rules.dims.depth;
  return { dimLabel: dimRule?.label ?? (table.dimAKey === "hauteur" ? "Hauteur" : "Projection"), dims: [...new Set(cells.map((c) => c.dimAmm))].sort((a, b) => a - b), widths: [...w.values()].sort((a, b) => a.min - b.min), roundUp: gridMeta(table, variant).dimRule === "round_up" };
}

/** Prix le plus bas de la grille (« à partir de »). */
export function minSystemPrice(table: SystemPriceTable | null | undefined): { amountMinor: number; currency: string; taxBasis: "HT" | "TTC" | null } | null {
  if (!table?.cells.length) return null;
  const min = table.cells.reduce((a, b) => (b.amountMinor < a.amountMinor ? b : a));
  const meta = gridMeta(table, min.variantKey);
  return { amountMinor: min.amountMinor, currency: meta.currency, taxBasis: meta.taxBasis };
}

const CURRENCY_FR: Record<string, string> = { MAD: "DH", EUR: "€" };

/** « 4 461,29 € HT » : centimes affichés seulement s'ils existent (montant de la grille, jamais arrondi). */
export function formatSystemPrice(amountMinor: number, currency: string, taxBasis?: "HT" | "TTC" | null): string {
  const showCents = amountMinor % 100 !== 0;
  const n = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: showCents ? 2 : 0, maximumFractionDigits: 2 }).format(amountMinor / 100);
  return `${n}\u00a0${CURRENCY_FR[currency] ?? currency}${taxBasis ? `\u00a0${taxBasis}` : ""}`;
}
