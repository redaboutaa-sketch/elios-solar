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
import { SIDE_FR, type DimRule, type SystemInput, type SystemRules } from "./system";

export interface SystemPriceCell {
  /** variante tarifaire du classeur (« murale », « autoportante ») ; vide = unique */
  variantKey: string;
  /** dimension principale de la grille (projection, avancée ou hauteur), mm */
  dimAmm: number;
  widthMinMm: number;
  widthMaxMm: number;
  /** montant en unités mineures de `currency` */
  amountMinor: number;
  /** exigence de la cellule dans la source (ex. « moteur_20nm » : cellule turquoise du catalogue) */
  requirement?: string;
}

/**
 * Supplément versionné avec la grille (administration → Tarifs → grille → suppléments) :
 * - fixed : montant fixe (unités mineures de la devise de la grille) ;
 * - percent : pourcentage du prix du système, c'est-à-dire de la cellule de la grille (assiette documentée), arrondi
 *   au centime (demi supérieur), sans cumul entre pourcentages ;
 * - pending : élément connu sans prix applicable — le prix affiché devient partiel et l'élément est listé « à chiffrer ».
 * `applies` : cibles dans la configuration (« finition:<code> », « tier:special », « option:<code> », « commande:<code> »,
 * « toile:<code> », « exigence:<code> », « toujours », « non_configurable » — jamais appliqué automatiquement).
 */
export interface PriceSupplement {
  code: string;
  label: string;
  /** table : montant lu dans un tableau selon une cote (LED selon l'avancée, poteau selon la hauteur…) */
  mode: "fixed" | "percent" | "pending" | "table";
  amountMinor?: number | null;
  percentBps?: number | null;
  applies: string[];
  /** élément à chiffrer obligatoire (moteur d'un store exclusivement motorisé…) : pas de prix « à partir de » */
  mandatory?: boolean;
  rule?: string;
  /** mode table : axe principal (et largeur éventuelle), cellules en mm, montants en unités mineures */
  table?: SupplementTable;
  /** quantité : celle de l'option indiquée (ex. nombre de poteaux supplémentaires) */
  perOptionQty?: string;
  /** élément à chiffrer : fourchette documentée des montants possibles (affichée, jamais ajoutée au total) */
  rangeMinor?: [number, number];
}

export interface SupplementTable {
  axis: "largeur" | "avancee" | "hauteur";
  /** cellules : plage [dimMin, dimMax] de l'axe (point si égales), plage de largeur facultative */
  cells: Array<{ dimMin: number; dimMax: number; widthMin?: number; widthMax?: number; amountMinor: number }>;
}

/**
 * Lecture d'un tableau de supplément (LED selon l'avancée, poteau selon la hauteur…) : valeur dans une plage, sinon
 * valeur immédiatement supérieure entre deux valeurs du tableau (même décision que les grilles) ; sous la première
 * valeur de l'axe PRINCIPAL du tableau, première valeur seulement si la cote reste dans le domaine technique documenté
 * (`rules`, décision du 2026-11-18) ; sur la largeur secondaire d'un tableau à deux axes, jamais (compatibilité de
 * l'équipement sous sa première largeur non confirmée, ex. spots sous 1,50 m) ; au-delà de la dernière : null.
 */
export function lookupSupplementTable(t: SupplementTable, input: SystemInput, rules?: SystemRules): number | null {
  const v = t.axis === "largeur" ? input.widthMm : t.axis === "avancee" ? input.depthMm : input.heightMm;
  if (v == null) return null;
  const axisRule = (axis: SupplementTable["axis"]) => (axis === "largeur" ? rules?.dims.width : axis === "avancee" ? rules?.dims.depth : rules?.dims.height);
  const pick = (cells: SupplementTable["cells"], x: number, axis: SupplementTable["axis"] | null) => {
    const sorted = [...cells].sort((a, b) => a.dimMin - b.dimMin);
    if (!sorted.length || x > sorted[sorted.length - 1]!.dimMax) return [];
    if (x < sorted[0]!.dimMin) return axis && technicallyAdmissible(axisRule(axis), x) ? sorted.filter((c) => c.dimMin === sorted[0]!.dimMin) : [];
    const inRange = sorted.filter((c) => c.dimMin <= x && x <= c.dimMax);
    if (inRange.length) return inRange;
    const next = sorted.find((c) => c.dimMin >= x);
    return next ? sorted.filter((c) => c.dimMin === next.dimMin) : [];
  };
  const row = pick(t.cells, v, t.axis);
  if (!row.length) return null;
  if (row.every((c) => c.widthMin == null)) return row[0]!.amountMinor;
  const w = input.widthMm;
  const byWidth = row.map((c) => ({ ...c, dimMin: c.widthMin!, dimMax: c.widthMax! }));
  return pick(byWidth, w, null)[0]?.amountMinor ?? null;
}

export type SystemDimRule = "exact" | "round_up";

/** Paramètres propres à une variante (chaque variante est une grille versionnée distincte). */
/** Arrondi commercial du total TTC final d'une configuration de vente (versionné avec la grille). */
export type SaleRounding = "none" | "nearest_99_ttc";

/**
 * Terminaison « 99 € » la plus proche (99, 199, 299…) d'un montant en centimes ; égalité → montant supérieur ; un montant
 * déjà terminé par 99 € est inchangé ; sous 99 € : montant conservé, exception signalée.
 * Ex. 7 076,16 → 7 099 ; 806,40 → 799 ; 609,84 → 599 ; 149 → 199 (égalité).
 */
export function roundTo99(amountMinor: number): { roundedMinor: number; adjustmentMinor: number; exception: "below_99" | null } {
  if (amountMinor < 9_900) return { roundedMinor: amountMinor, adjustmentMinor: 0, exception: "below_99" };
  const lower = Math.floor((amountMinor - 9_900) / 10_000) * 10_000 + 9_900;
  const upper = lower + 10_000;
  const roundedMinor = upper - amountMinor <= amountMinor - lower ? upper : lower;
  return { roundedMinor, adjustmentMinor: roundedMinor - amountMinor, exception: null };
}

export interface TtcRounding {
  /** vente HT calculée avant arrondi et TTC correspondant (TVA au demi-centime supérieur) */
  computedHtMinor: number;
  computedTtcMinor: number;
  /** TTC final (terminaison 99 €) et ajustement commercial TTC */
  ttcMinor: number;
  adjustmentTtcMinor: number;
  /** HT final = TTC final ÷ (1 + taux), au centime (demi supérieur) ; TVA = TTC − HT (le TTC reste exact) */
  htMinor: number;
  vatMinor: number;
  /** écart de ventilation : TVA retenue − TVA calculée sur le HT final (0 ou ± 1 centime), documenté */
  ventilationMinor: number;
  exception: "below_99" | null;
}

/**
 * Arrondi commercial TTC d'un total HT calculé (taux de TVA unique de la configuration) : TTC calculé, arrondi une seule
 * fois à la terminaison 99 €, puis HT final et TVA déduits de ce TTC. Toujours à partir du HT calculé (jamais d'un prix
 * déjà arrondi). Ex. 5 896,80 HT → 7 076,16 TTC → 7 099 TTC → 5 915,83 HT + 1 183,17 TVA.
 */
export function roundTtcTo99(computedHtMinor: number, vatRateBps: number): TtcRounding {
  const computedTtcMinor = computedHtMinor + applyBpsHalfUp(computedHtMinor, vatRateBps);
  const r = roundTo99(computedTtcMinor);
  if (r.exception || !r.adjustmentMinor) return { computedHtMinor, computedTtcMinor, ttcMinor: computedTtcMinor, adjustmentTtcMinor: 0, htMinor: computedHtMinor, vatMinor: computedTtcMinor - computedHtMinor, ventilationMinor: 0, exception: r.exception };
  const den = 10_000 + vatRateBps;
  const htMinor = Math.floor((2 * r.roundedMinor * 10_000 + den) / (2 * den));
  const vatMinor = r.roundedMinor - htMinor;
  return { computedHtMinor, computedTtcMinor, ttcMinor: r.roundedMinor, adjustmentTtcMinor: r.adjustmentMinor, htMinor, vatMinor, ventilationMinor: vatMinor - applyBpsHalfUp(htMinor, vatRateBps), exception: null };
}

/** Code de la ligne d'ajustement d'arrondi dans une décomposition (jamais un composant tarifé). */
export const ROUNDING_LINE = "arrondi";

export interface SystemPriceGridMeta {
  /** arrondi commercial du total TTC final (absent = aucun) */
  saleRounding?: SaleRounding;
  currency: string;
  taxBasis: "HT" | "TTC" | null;
  dimRule: SystemDimRule;
  /** taux de TVA de la grille (points de base) ; null = taux du catalogue */
  vatRateBps: number | null;
  listVersion: number;
  versionId?: string;
  supplements?: PriceSupplement[];
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
  /** exigence de la cellule retenue (ex. moteur 20 Nm minimum) */
  requirement?: string;
  /**
   * Traçabilité (détail administrateur, devis figé) : cotes réelles demandées (elles seules alimentent champs, dessin,
   * 3D, récapitulatif et devis), plage de largeur de la cellule facturée et règle de sélection.
   */
  requested?: { widthMm: number; dimMm: number };
  cellWidth?: { minMm: number; maxMm: number };
  selection?: SystemPriceSelection;
}

/**
 * Motif précis d'une cote non chiffrable (« out_of_grid ») :
 * - above_max : au-delà de la dernière tranche de la grille (aucune extrapolation) ;
 * - below_technical_min : sous le minimum technique documenté (la configuration est aussi bloquée par ses règles) ;
 * - below_min_undocumented : sous la première tranche, sans minimum technique documenté qui l'admette ;
 * - below_row_min : largeur sous le début de la première plage de la ligne (largeur minimale selon l'avancée) ;
 * - cell_forbidden : la cellule supérieure immédiate est vide ou interdite (jamais comblée par une cellule voisine) ;
 * - not_round_up : cote entre deux valeurs, grille en lecture exacte (règle de la tranche supérieure non confirmée).
 */
export type OutOfGridCode = "above_max" | "below_technical_min" | "below_min_undocumented" | "below_row_min" | "cell_forbidden" | "not_round_up";
export interface OutOfGridDetail { code: OutOfGridCode; axis: "largeur" | "dimension" }

export type SystemPriceLookup = { ok: true; price: SystemPrice } | { ok: false; reason: "no_table" | "incomplete" | "out_of_grid"; detail?: OutOfGridDetail };

/**
 * Règle ayant conduit à la cellule retenue :
 * - exact : cotes de la grille ;
 * - round_up : tranche immédiatement supérieure entre deux valeurs de la grille ;
 * - first_tranche : cote sous la première tranche de la grille, mais dans le domaine technique documenté → première
 *   tranche comme minimum de facturation (décision commerciale HELIOSTORES du 2026-11-18, jamais une règle fournisseur).
 */
export type SystemPriceSelection = "exact" | "round_up" | "first_tranche";

const MOUNTING_VARIANT: Partial<Record<SystemInput["mounting"], string>> = { wall: "murale", freestanding: "autoportante" };

export function variantFor(table: SystemPriceTable, mounting: SystemInput["mounting"]): string | null {
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

/**
 * Une cote sous la première tranche est-elle dans le domaine technique DOCUMENTÉ de l'axe ? (minimum établi par les
 * sources, ou valeur discrète documentée). Minimum non documenté : jamais admise (aucun prix inventé).
 */
function belowDocumentedMin(rule: DimRule | undefined, v: number): boolean {
  return !!rule && !rule.valuesMm?.length && rule.minMm != null && v < rule.minMm;
}

function technicallyAdmissible(rule: DimRule | undefined, v: number): boolean {
  if (!rule || rule.maxMm <= 0) return false;
  if (rule.valuesMm?.length) return rule.valuesMm.includes(v);
  return rule.minMm != null && v >= rule.minMm && v <= rule.maxMm;
}

export function lookupSystemPrice(table: SystemPriceTable | null | undefined, rules: SystemRules, input: SystemInput): SystemPriceLookup {
  if (!table || !table.cells.length) return { ok: false, reason: "no_table" };
  const variant = variantFor(table, input.mounting);
  const dim = dimInput(table, input);
  if (variant == null || dim == null || !Number.isFinite(dim) || !Number.isFinite(input.widthMm) || input.widthMm <= 0) return { ok: false, reason: "incomplete" };
  const meta = gridMeta(table, variant);
  const cells = table.cells.filter((c) => c.variantKey === variant);
  const dims = [...new Set(cells.map((c) => c.dimAmm))].sort((a, b) => a - b);
  const roundUp = meta.dimRule === "round_up";
  if (!dims.length) return { ok: false, reason: "out_of_grid" };
  const out = (code: OutOfGridCode, axis: OutOfGridDetail["axis"]): SystemPriceLookup => ({ ok: false, reason: "out_of_grid", detail: { code, axis } });
  const dimRule = table.dimAKey === "hauteur" ? rules.dims.height : rules.dims.depth;
  // Lecture exacte : la cote doit figurer dans la grille. Tranche supérieure (décision écrite du 2026-11-02, étendue le
  // 2026-11-18) : plus petite tranche supérieure ou égale à la cote réelle, sur chaque axe ; sous la première tranche,
  // seulement si la cote reste dans le domaine technique documenté (première tranche = minimum de facturation). Au-delà
  // de la dernière tranche : jamais de prix (aucune extrapolation).
  let selection: SystemPriceSelection = "exact";
  if (dim > dims[dims.length - 1]!) return out("above_max", "dimension");
  let gridDim: number | undefined;
  if (dim < dims[0]!) {
    if (!roundUp) return out("not_round_up", "dimension");
    if (!technicallyAdmissible(dimRule, dim)) return out(belowDocumentedMin(dimRule, dim) ? "below_technical_min" : "below_min_undocumented", "dimension");
    gridDim = dims[0]!;
    selection = "first_tranche";
  } else {
    gridDim = roundUp ? dims.find((d) => d >= dim) : dims.find((d) => d === dim);
    if (gridDim == null) return out("not_round_up", "dimension");
    if (gridDim !== dim) selection = "round_up";
  }
  const row = cells.filter((c) => c.dimAmm === gridDim).sort((a, b) => a.widthMaxMm - b.widthMaxMm);
  // colonnes de largeur de la variante (fin de plage, ou largeur ponctuelle) : la colonne immédiatement supérieure ou
  // égale est cherchée sur toute la grille, puis dans la ligne — une cellule absente de la ligne est vide ou interdite,
  // jamais remplacée par une cellule voisine.
  const w = input.widthMm;
  const columns = [...new Set(cells.map((c) => c.widthMaxMm))].sort((a, b) => a - b);
  if (w > columns[columns.length - 1]!) return out("above_max", "largeur");
  let cell: SystemPriceCell | undefined;
  if (!roundUp) {
    cell = row.find((c) => c.widthMinMm <= w && w <= c.widthMaxMm);
    if (!cell) return out("not_round_up", "largeur");
  } else {
    const col = columns.find((x) => x >= w)!;
    cell = row.find((c) => c.widthMaxMm === col);
    const first = row[0];
    if (first && w < first.widthMinMm) {
      if (first.widthMinMm < first.widthMaxMm) return out("below_row_min", "largeur"); // largeur minimale selon l'avancée (plages)
      // largeurs ponctuelles : sous la première colonne, seulement dans le domaine technique documenté
      if (!technicallyAdmissible(rules.dims.width, w)) return out(belowDocumentedMin(rules.dims.width, w) ? "below_technical_min" : "below_min_undocumented", "largeur");
      if (columns[0] !== first.widthMaxMm) return out("cell_forbidden", "largeur");
      cell = first;
      selection = "first_tranche";
    }
    if (!cell) return out(w > (row[row.length - 1]?.widthMaxMm ?? 0) ? "above_max" : "cell_forbidden", "largeur");
    // largeur ponctuelle supérieure, ou largeur dans l'écart entre deux plages (ex. 2,905 m → plage 2,91–3,50 m)
    if (selection === "exact" && ((cell.widthMinMm === cell.widthMaxMm && cell.widthMaxMm !== w) || w < cell.widthMinMm)) selection = "round_up";
  }
  const gridWidth = cell.widthMinMm === cell.widthMaxMm ? cell.widthMaxMm : w;
  return {
    ok: true,
    price: {
      amountMinor: cell.amountMinor,
      currency: meta.currency,
      taxBasis: meta.taxBasis,
      variantKey: variant,
      grid: { widthMm: gridWidth, dimMm: gridDim, dimLabel: dimRule?.label ?? (table.dimAKey === "hauteur" ? "Hauteur" : "Projection") },
      roundedUp: gridDim !== dim || gridWidth !== w,
      listVersion: meta.listVersion,
      versionId: meta.versionId,
      dimRule: meta.dimRule,
      vatRateBps: meta.vatRateBps,
      ...(cell.requirement ? { requirement: cell.requirement } : {}),
      requested: { widthMm: w, dimMm: dim },
      cellWidth: { minMm: cell.widthMinMm, maxMm: cell.widthMaxMm },
      selection,
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
  // seulement des cellules d'une configuration complète : aucune variante dont un élément obligatoire reste à chiffrer
  // (moteur d'un store exclusivement motorisé…), aucune cellule assortie d'une exigence non chiffrée
  const cells = table?.cells.filter((c) => fromPriceAllowed(table, c.variantKey) && !c.requirement) ?? [];
  if (!table || !cells.length) return null;
  const total = (c: SystemPriceCell) => c.amountMinor + alwaysFixedMinor(table, c.variantKey);
  const min = cells.reduce((a, b) => (total(b) < total(a) ? b : a));
  const meta = gridMeta(table, min.variantKey);
  return { amountMinor: total(min), currency: meta.currency, taxBasis: meta.taxBasis };
}

const CURRENCY_FR: Record<string, string> = { MAD: "DH", EUR: "€" };

/** « 4 461,29 € HT » : centimes affichés seulement s'ils existent (montant de la grille, jamais arrondi). */
export function formatSystemPrice(amountMinor: number, currency: string, taxBasis?: "HT" | "TTC" | null): string {
  const showCents = amountMinor % 100 !== 0;
  const n = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: showCents ? 2 : 0, maximumFractionDigits: 2 }).format(amountMinor / 100);
  return `${n}\u00a0${CURRENCY_FR[currency] ?? currency}${taxBasis ? `\u00a0${taxBasis}` : ""}`;
}

/* ------------------------------------------------------------------ */
/* Décomposition du prix d'une configuration                            */
/* ------------------------------------------------------------------ */

export interface PriceBreakdownLine { code: string; label: string; amountMinor: number; detail?: string }
export interface PriceBreakdownPending { code: string; label: string; reason: string }

/**
 * Prix d'une configuration à partir de la grille publiée : cellule (structure) + suppléments connus ; les éléments
 * choisis sans prix applicable sont listés « à chiffrer » (le total est alors un sous-total PARTIEL). Montants entiers en
 * unités mineures ; pourcentages appliqués à la cellule (assiette « prix du système »), chacun arrondi au centime
 * (demi supérieur), sans cumul ; TVA ajoutée une fois au total HT (demi supérieur). Pose et livraison : toujours au devis.
 */
export interface PriceBreakdown {
  currency: string;
  taxBasis: "HT" | "TTC" | null;
  vatRateBps: number;
  lines: PriceBreakdownLine[];
  pending: PriceBreakdownPending[];
  /** total des lignes (HT si la grille est HT) */
  totalMinor: number;
  /** total TTC (null si la base fiscale n'est pas établie) */
  totalTtcMinor: number | null;
  partial: boolean;
  listVersion: number;
  /** vente HT calculée avant arrondi commercial (= total sans arrondi) et TTC correspondant */
  computedMinor?: number;
  computedTtcMinor?: number | null;
  /** ajustement commercial d'arrondi : TTC et sa part HT (positif ou négatif ; 0 sans arrondi) */
  roundingTtcMinor?: number;
  roundingMinor?: number;
  /** TVA du total (TTC − HT) et écart de ventilation documenté (0 ou ± 1 centime) */
  vatMinor?: number | null;
  ventilationMinor?: number;
  rounding?: SaleRounding;
  /** arrondi non appliqué : montant sous 99 € TTC (signalé dans l'administration) */
  roundingException?: "below_99" | null;
}

/** a × bps / 10 000, arrondi au demi supérieur (entiers positifs). */
export function applyBpsHalfUp(amountMinor: number, bps: number): number {
  return Math.floor((amountMinor * bps + 5_000) / 10_000);
}

/**
 * Cible d'un supplément : une ou plusieurs conditions reliées par « & » (toutes requises), chacune éventuellement niée
 * par « ! » — ex. « commande:radio_io&exigence:moteur_20nm », « commande:radio_rts&!exigence:moteur_20nm »,
 * « cote:hauteur>2500 ».
 */
function matches(target: string, rules: SystemRules, input: SystemInput, price: SystemPrice): boolean {
  return target.split("&").every((raw) => {
    const neg = raw.startsWith("!");
    const ok = matchesAtom(neg ? raw.slice(1) : raw, rules, input, price);
    return neg ? !ok : ok;
  });
}

function matchesAtom(target: string, rules: SystemRules, input: SystemInput, price: SystemPrice): boolean {
  if (target === "toujours") return true;
  if (target === "non_configurable") return false;
  const [kind, code] = target.split(":") as [string, string | undefined];
  if (!code) return false;
  switch (kind) {
    case "finition": return input.finishCode === code;
    case "tier": {
      const f = rules.finishes.find((x) => x.code === input.finishCode) ?? (rules.customFinish?.code === input.finishCode ? rules.customFinish : undefined);
      return (f?.tier ?? (f && f === rules.customFinish ? "special" : "standard")) === code;
    }
    case "option": {
      const [oc, val] = code.split("=");
      return input.options.some((o) => o.code === oc && (val == null || o.value === val));
    }
    case "commande": return input.controlCode === code;
    case "pose": return input.mounting === code;
    case "toile": return input.fabricCode === code;
    case "exigence": return price.requirement === code;
    case "cote": {
      const m = /^(largeur|avancee|hauteur)(>=|<=|>|<)(\d+)$/.exec(code);
      if (!m) return false;
      const v = m[1] === "largeur" ? input.widthMm : m[1] === "avancee" ? input.depthMm : input.heightMm;
      if (v == null) return false;
      const n = Number(m[3]);
      return m[2] === ">" ? v > n : m[2] === ">=" ? v >= n : m[2] === "<" ? v < n : v <= n;
    }
    default: return false;
  }
}

export function priceBreakdown(table: SystemPriceTable, rules: SystemRules, input: SystemInput, price: SystemPrice, catalogVatRateBps: number, familyName: string): PriceBreakdown {
  const meta = gridMeta(table, price.variantKey);
  const supplements = meta.supplements ?? [];
  let matched = supplements.filter((s) => s.applies.some((t) => matches(t, rules, input, price)));
  // une exigence de la cellule (ex. moteur 20 Nm) remplace les suppléments de même famille (« moteur-… »)
  const required = matched.filter((s) => s.applies.some((t) => t.startsWith("exigence:")));
  for (const r of required) {
    const family = r.code.split("-")[0];
    matched = matched.filter((s) => s === r || s.code.split("-")[0] !== family);
  }
  const lines: PriceBreakdownLine[] = [{ code: "structure", label: `${familyName} — structure (grille v${price.listVersion})`, amountMinor: price.amountMinor }];
  const pending: PriceBreakdownPending[] = [];
  const eur = (m: number) => `${(m / 100).toLocaleString("fr-FR", { minimumFractionDigits: m % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
  for (const s of matched) {
    const qty = s.perOptionQty ? Math.max(1, input.options.find((o) => o.code === s.perOptionQty)?.qty ?? 1) : 1;
    const unit = s.mode === "fixed" ? s.amountMinor ?? null : s.mode === "table" && s.table ? lookupSupplementTable(s.table, input, rules) : null;
    if ((s.mode === "fixed" || s.mode === "table") && unit != null) lines.push({ code: s.code, label: qty > 1 ? `${s.label} × ${qty}` : s.label, amountMinor: unit * qty, ...(qty > 1 ? { detail: `${qty} × ${eur(unit)}` } : {}) });
    else if (s.mode === "percent" && s.percentBps != null) lines.push({ code: s.code, label: s.label, amountMinor: applyBpsHalfUp(price.amountMinor, s.percentBps), detail: `${(s.percentBps / 100).toLocaleString("fr-FR")} % du prix de la structure` });
    else if (s.mode === "table") pending.push({ code: s.code, label: s.label, reason: "cote hors des valeurs du tarif de cet équipement" });
    else pending.push({ code: s.code, label: s.label, reason: `${s.rule ?? "prix non établi"}${s.rangeMinor ? ` (entre ${eur(s.rangeMinor[0])} et ${eur(s.rangeMinor[1])} selon le modèle retenu)` : ""}` });
  }
  const atoms = (t: string) => t.split("&").filter((a) => !a.startsWith("!"));
  const covered = (kind: string, code?: string) => code != null && matched.some((s) => s.applies.some((t) => atoms(t).some((a) => a === `${kind}:${code}` || a.startsWith(`${kind}:${code}=`))));
  // éléments choisis sans supplément applicable : jamais retirés du calcul en silence
  for (const o of input.options) {
    const def = rules.options.find((x) => x.code === o.code);
    if (def && !covered("option", o.code)) pending.push({ code: `option:${o.code}`, label: def.label, reason: def.wish ? "souhait étudié au devis" : "option chiffrée au devis" });
  }
  const finish = rules.finishes.find((x) => x.code === input.finishCode) ?? (rules.customFinish?.code === input.finishCode ? rules.customFinish : undefined);
  const special = finish && ((finish.tier ?? (finish === rules.customFinish ? "special" : "standard")) === "special");
  if (special && !covered("finition", finish.code) && !covered("tier", "special")) pending.push({ code: `finition:${finish.code}`, label: finish.label, reason: "supplément de teinte à chiffrer" });
  for (const [side, slug] of Object.entries(input.sides ?? {})) {
    if (!slug) continue;
    const wish = rules.closureWishes?.find((w) => w.familySlug === slug);
    // fermeture souhaitée : jamais chiffrée ni supposée compatible ; le montant connu reste un sous-total
    pending.push({ code: `cote:${side}`, label: `${wish?.label ?? slug}, côté ${SIDE_FR[side as keyof typeof SIDE_FR] ?? side}`, reason: "à chiffrer, compatibilité à confirmer" });
  }
  if (input.multiModule) pending.push({ code: "modules", label: "Installation en plusieurs modules", reason: "étudiée au devis" });
  // store banne : la grille comprend les supports MURAUX (liste de prix p. 96) ; une pose au plafond (support posé sur le
  // support mural) ou sur chevrons exige des supports supplémentaires (p. 99) — composant obligatoire jamais omis : à
  // chiffrer tant qu'aucun supplément de la grille ne vise cette pose
  if (rules.type === "awning" && input.mounting !== "wall" && !covered("pose", input.mounting)) {
    pending.push({ code: `pose:${input.mounting}`, label: input.mounting === "ceiling" ? "Supports de pose au plafond" : input.mounting === "rafter" ? "Supports de pose sur chevrons" : "Supports de pose", reason: "le prix de la grille comprend les supports muraux ; supports de cette pose chiffrés au devis selon leur nombre" });
  }
  const computedMinor = lines.reduce((a, l) => a + l.amountMinor, 0);
  const vatRateBps = price.vatRateBps ?? catalogVatRateBps;
  // arrondi commercial TTC : une seule fois, sur le total d'une configuration complète (jamais un sous-total partiel,
  // jamais chaque composant), recalculé depuis le HT de la grille ; HT final et TVA déduits du TTC arrondi
  const rounding: SaleRounding = meta.saleRounding ?? "none";
  let totalMinor = computedMinor, roundingMinor = 0, roundingTtcMinor = 0, ventilationMinor = 0, roundingException: "below_99" | null = null;
  let totalTtcMinor = price.taxBasis === "TTC" ? computedMinor : price.taxBasis === "HT" ? computedMinor + applyBpsHalfUp(computedMinor, vatRateBps) : null;
  const computedTtcMinor = totalTtcMinor;
  if (rounding === "nearest_99_ttc" && !pending.length && price.taxBasis === "HT") {
    const r = roundTtcTo99(computedMinor, vatRateBps);
    roundingException = r.exception;
    if (r.adjustmentTtcMinor) {
      roundingTtcMinor = r.adjustmentTtcMinor;
      roundingMinor = r.htMinor - computedMinor;
      ventilationMinor = r.ventilationMinor;
      totalMinor = r.htMinor;
      totalTtcMinor = r.ttcMinor;
      lines.push({ code: ROUNDING_LINE, label: "Arrondi commercial", amountMinor: roundingMinor, detail: `prix calculé ${eur(computedTtcMinor!)} TTC, arrondi à ${eur(r.ttcMinor)} TTC` });
    }
  }
  return { currency: price.currency, taxBasis: price.taxBasis ?? null, vatRateBps, lines, pending, totalMinor, totalTtcMinor, partial: pending.length > 0, listVersion: price.listVersion, computedMinor, computedTtcMinor, roundingTtcMinor, roundingMinor, vatMinor: totalTtcMinor == null ? null : totalTtcMinor - totalMinor, ventilationMinor, rounding, roundingException };
}

/** Une configuration de la grille peut-elle être complète sans élément obligatoire à chiffrer ? (prix « à partir de ») */
/** Codes des suppléments propres à un mode de commande (cible positive « commande:<code> ») d'une variante. */
export function controlSupplementCodes(table: SystemPriceTable, variantKey: string, controlCode: string): Set<string> {
  return new Set((gridMeta(table, variantKey).supplements ?? []).filter((s) => s.applies.some((t) => t.split("&").includes(`commande:${controlCode}`))).map((s) => s.code));
}

export function fromPriceAllowed(table: SystemPriceTable, variantKey: string): boolean {
  return !(gridMeta(table, variantKey).supplements ?? []).some((s) => s.mandatory && s.mode === "pending");
}

/** Montants fixes appliqués à toute configuration de la variante (cible « toujours ») : compris dans le « à partir de ». */
export function alwaysFixedMinor(table: SystemPriceTable, variantKey: string): number {
  return (gridMeta(table, variantKey).supplements ?? []).filter((s) => s.mode === "fixed" && s.amountMinor != null && s.applies.includes("toujours")).reduce((a, s) => a + s.amountMinor!, 0);
}
