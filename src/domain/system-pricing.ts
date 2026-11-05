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
 * Lecture d'un tableau de supplément : valeur dans une plage, sinon valeur immédiatement supérieure si la cote est
 * située entre deux valeurs du tableau (même décision que les grilles) ; hors du tableau : null.
 */
export function lookupSupplementTable(t: SupplementTable, input: SystemInput): number | null {
  const v = t.axis === "largeur" ? input.widthMm : t.axis === "avancee" ? input.depthMm : input.heightMm;
  if (v == null) return null;
  const pick = (cells: SupplementTable["cells"], x: number) => {
    const sorted = [...cells].sort((a, b) => a.dimMin - b.dimMin);
    if (!sorted.length || x < sorted[0]!.dimMin || x > sorted[sorted.length - 1]!.dimMax) return [];
    const inRange = sorted.filter((c) => c.dimMin <= x && x <= c.dimMax);
    if (inRange.length) return inRange;
    const next = sorted.find((c) => c.dimMin >= x);
    return next ? sorted.filter((c) => c.dimMin === next.dimMin) : [];
  };
  const row = pick(t.cells, v);
  if (!row.length) return null;
  if (row.every((c) => c.widthMin == null)) return row[0]!.amountMinor;
  const w = input.widthMm;
  const byWidth = row.map((c) => ({ ...c, dimMin: c.widthMin!, dimMax: c.widthMax! }));
  return pick(byWidth, w)[0]?.amountMinor ?? null;
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
  const roundUp = meta.dimRule === "round_up";
  if (!dims.length) return { ok: false, reason: "out_of_grid" };
  // lecture exacte : la cote doit figurer dans la grille ; dimension supérieure (décision écrite du 2026-11-02, « cote
  // située entre deux valeurs de la grille ») : valeur de grille immédiatement supérieure. Une cote sous la première
  // valeur ou au-delà de la dernière n'est pas « entre deux valeurs » : hors grille (devis).
  if (dim < dims[0]! || input.widthMm < Math.min(...cells.map((c) => c.widthMinMm))) return { ok: false, reason: "out_of_grid" };
  const gridDim = roundUp ? dims.find((d) => d >= dim) : dims.find((d) => d === dim);
  if (gridDim == null) return { ok: false, reason: "out_of_grid" };
  const row = cells.filter((c) => c.dimAmm === gridDim).sort((a, b) => a.widthMaxMm - b.widthMaxMm);
  // plage de largeur (store banne) : la cote doit y tomber ; largeur ponctuelle : cote exacte, ou supérieure si la règle l'autorise.
  // Une largeur inférieure au début de la première plage d'une ligne n'est pas proposée pour cette cote (largeur minimale
  // selon l'avancée) : elle n'est jamais « arrondie » vers le haut.
  let cell = roundUp ? row.find((c) => c.widthMaxMm >= input.widthMm) : row.find((c) => c.widthMinMm <= input.widthMm && input.widthMm <= c.widthMaxMm);
  if (cell && roundUp && cell === row[0] && cell.widthMinMm < cell.widthMaxMm && input.widthMm < cell.widthMinMm) cell = undefined;
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
      ...(cell.requirement ? { requirement: cell.requirement } : {}),
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
    const unit = s.mode === "fixed" ? s.amountMinor ?? null : s.mode === "table" && s.table ? lookupSupplementTable(s.table, input) : null;
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
    pending.push({ code: `cote:${side}`, label: wish?.label ?? slug, reason: "fermeture souhaitée, étudiée au devis" });
  }
  if (input.multiModule) pending.push({ code: "modules", label: "Installation en plusieurs modules", reason: "étudiée au devis" });
  const totalMinor = lines.reduce((a, l) => a + l.amountMinor, 0);
  const vatRateBps = price.vatRateBps ?? catalogVatRateBps;
  const totalTtcMinor = price.taxBasis === "TTC" ? totalMinor : price.taxBasis === "HT" ? totalMinor + applyBpsHalfUp(totalMinor, vatRateBps) : null;
  return { currency: price.currency, taxBasis: price.taxBasis ?? null, vatRateBps, lines, pending, totalMinor, totalTtcMinor, partial: pending.length > 0, listVersion: price.listVersion };
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
