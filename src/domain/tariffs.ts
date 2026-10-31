/**
 * Grilles tarifaires administrées (module pur, sans accès base) : saisie des montants, contrôles avant publication,
 * comparaison de versions et recalcul explicite depuis une grille de base.
 *
 * Représentation monétaire : entiers en unités mineures (centimes), jamais de nombre à virgule flottante. Un recalcul
 * arrondit au centime, au demi supérieur (0,005 → 0,01), une seule fois par cellule.
 *
 * États d'une cellule : montant > 0 (tarifée) ; 0 (prix nul : à confirmer explicitement) ; null (vide : à renseigner,
 * bloque la publication). Une combinaison absente de la grille est « non tarifée » : la configuration passe au devis.
 */

export interface TariffCell {
  /** dimension principale (projection, avancée ou hauteur), mm */
  dimAmm: number;
  widthMinMm: number;
  widthMaxMm: number;
  /** unités mineures ; null = cellule vide */
  amountMinor: number | null;
}

export type Nature = "UNKNOWN" | "PURCHASE" | "SALE" | "RECOMMENDED" | "EXAMPLE" | "SUPPLIER_LIST";
export type TaxBasis = "UNKNOWN" | "HT" | "TTC";
export type Clientele = "ALL" | "PARTICULIER" | "PROFESSIONNEL";
export type DimRule = "EXACT" | "ROUND_UP";

export const NATURE_LABEL: Record<Nature, string> = { UNKNOWN: "Nature non établie", PURCHASE: "Achat fournisseur", SALE: "Vente", RECOMMENDED: "Prix public conseillé", EXAMPLE: "Exemple", SUPPLIER_LIST: "Prix catalogue fournisseur" };
export const CLIENTELE_LABEL: Record<Clientele, string> = { ALL: "Toutes clientèles", PARTICULIER: "Particuliers", PROFESSIONNEL: "Professionnels" };
export const DIM_RULE_LABEL: Record<DimRule, string> = { EXACT: "Cote exacte de la grille (sinon devis)", ROUND_UP: "Dimension de grille immédiatement supérieure" };

export const MAX_AMOUNT_MINOR = 10_000_000_00; // 10 millions (garde-fou de saisie)

export const cellKey = (c: Pick<TariffCell, "dimAmm" | "widthMinMm" | "widthMaxMm">) => `${c.dimAmm}|${c.widthMinMm}|${c.widthMaxMm}`;

/**
 * Saisie d'un montant (« 1 234,56 », « 1234.5 », « 0 ») → unités mineures. Chaîne vide → null (cellule vide).
 * Refuse les signes, les exposants, plus de deux décimales et les séparateurs ambigus (« 1.234,5 »).
 */
export function parseAmountInput(input: string): { ok: true; minor: number | null } | { ok: false; error: string } {
  const s = input.replace(/[\s  €]/g, "");
  if (s === "") return { ok: true, minor: null };
  const m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(s);
  if (!m) return { ok: false, error: `Montant invalide : « ${input.trim().slice(0, 30)} » (nombre positif, deux décimales au plus)` };
  const minor = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (minor > MAX_AMOUNT_MINOR) return { ok: false, error: "Montant trop élevé" };
  return { ok: true, minor };
}

/** Montant pour un champ de saisie : « 1234,56 ». */
export function formatAmountInput(minor: number | null | undefined): string {
  if (minor == null) return "";
  return `${Math.trunc(minor / 100)},${String(minor % 100).padStart(2, "0")}`;
}

/** Montant affiché : « 1 234,56 EUR ». */
export function formatAmount(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor == null) return "vide";
  return `${(minor / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency ?? "(devise ?)"}`;
}

/** Axes d'une grille : dimensions principales et largeurs (points ou plages), triés. */
export function axesOf(cells: Pick<TariffCell, "dimAmm" | "widthMinMm" | "widthMaxMm">[]): { dims: number[]; widths: { min: number; max: number }[] } {
  const dims = [...new Set(cells.map((c) => c.dimAmm))].sort((a, b) => a - b);
  const wk = new Map<string, { min: number; max: number }>();
  for (const c of cells) wk.set(`${c.widthMinMm}|${c.widthMaxMm}`, { min: c.widthMinMm, max: c.widthMaxMm });
  return { dims, widths: [...wk.values()].sort((a, b) => a.min - b.min || a.max - b.max) };
}

export interface GridCheckInput {
  nature: Nature;
  currency: string | null;
  taxBasis: TaxBasis;
  vatRateBps: number | null;
  /** taux du catalogue, appliqué quand la grille n'en fixe pas */
  catalogVatRateBps: number;
  clientele: Clientele;
  dimRule: DimRule;
  dimRuleNote: string;
  validFrom: Date | null;
  validTo: Date | null;
  zeroConfirmed: boolean;
  family: { known: boolean; status: string | null };
  /** version en vigueur du contexte a changé depuis la création du brouillon */
  stale?: { activeVersion: number } | null;
  now?: Date;
}

export interface GridCheck {
  code: string;
  severity: "blocking" | "warning";
  message: string;
}

/**
 * Contrôles d'une grille avant publication. Bloquant : nature, devise ou base fiscale non établies, cellule vide,
 * doublon, chevauchement de plages, prix nul non confirmé, règle d'arrondi non justifiée, période incohérente.
 */
export function checkGrid(p: GridCheckInput, cells: TariffCell[]): GridCheck[] {
  const out: GridCheck[] = [];
  const block = (code: string, message: string) => out.push({ code, severity: "blocking", message });
  const warn = (code: string, message: string) => out.push({ code, severity: "warning", message });
  const now = p.now ?? new Date();

  if (p.nature === "UNKNOWN") block("nature_unknown", "Nature du prix non établie (achat fournisseur ou vente).");
  else if (p.nature === "RECOMMENDED" || p.nature === "EXAMPLE") block("nature_not_publishable", `« ${NATURE_LABEL[p.nature]} » : ni un prix de vente, ni un coût d'achat — non publiable.`);
  if (!p.currency) block("currency_missing", "Devise non renseignée.");
  else if (!/^[A-Z]{3}$/.test(p.currency)) block("currency_invalid", `Devise « ${p.currency} » invalide (code ISO à trois lettres).`);
  if (p.taxBasis === "UNKNOWN") block("tax_unknown", "Montants HT ou TTC : non établi.");
  if (p.vatRateBps != null && (p.vatRateBps < 0 || p.vatRateBps > 10_000)) block("vat_invalid", "Taux de TVA invalide.");
  if (p.nature === "SALE") {
    if (p.vatRateBps == null) warn("vat_default", `Taux de TVA non fixé par la grille : taux du catalogue appliqué (${fmtBps(p.catalogVatRateBps)}).`);
    if (p.currency && p.currency !== "EUR") warn("currency_not_eur", "La boutique n'encaisse qu'en euros : sans prix en EUR, la commande en ligne reste fermée (devis).");
    if (p.clientele === "PROFESSIONNEL") warn("clientele_pro", "Grille professionnelle : utilisée par le simulateur et les devis, pas par la boutique (aucun compte professionnel).");
    if (p.family.known && p.family.status !== "PUBLISHED" && p.family.status !== "QUOTE_ONLY") warn("family_not_public", "Produit non publié : la grille ne rend pas le produit visible ; aucun prix n'est affiché.");
  }
  if (p.nature === "PURCHASE") warn("purchase_internal", "Coût d'achat : référence interne, jamais affichée sur le site ni dans les documents clients.");
  if (p.nature === "SUPPLIER_LIST") warn("supplier_list_internal", "Prix catalogue du fournisseur : référence interne, ni un prix d'achat net ni un prix de vente. Le prix de vente se dérive par une règle explicite (remise fournisseur puis coefficient, majoration ou marge) validée par l'administrateur.");
  if (!p.family.known) block("family_unknown", "Produit inconnu du catalogue.");
  if (p.dimRule === "ROUND_UP" && p.dimRuleNote.trim().length < 5) block("dim_rule_unconfirmed", "Lecture à la dimension supérieure : indiquez qui l'a confirmée (règle non établie par la source).");
  if (p.validFrom && p.validTo && p.validTo <= p.validFrom) block("validity_inverted", "La fin de validité précède le début.");
  if (p.validTo && p.validTo <= now) block("validity_past", "Fin de validité déjà passée.");
  if (p.stale) block("stale_draft", `Brouillon obsolète : la version v${p.stale.activeVersion} a été publiée depuis sa création. Reprenez-la en brouillon.`);

  if (!cells.length) block("no_cells", "Aucune cellule tarifée.");
  const empty = cells.filter((c) => c.amountMinor == null).length;
  if (empty) block("empty_cells", `${empty} cellule(s) vide(s) : renseignez un prix ou retirez la combinaison (non tarifée, devis).`);
  if (cells.some((c) => c.amountMinor != null && (c.amountMinor < 0 || !Number.isInteger(c.amountMinor)))) block("invalid_amount", "Montant négatif ou non entier en centimes.");
  const zero = cells.filter((c) => c.amountMinor === 0).length;
  if (zero) (p.zeroConfirmed ? warn : block)("zero_cells", `${zero} prix nul(s)${p.zeroConfirmed ? " confirmé(s)" : " : confirmez-les ou corrigez-les"}.`);
  const seen = new Map<string, number>();
  for (const c of cells) seen.set(cellKey(c), (seen.get(cellKey(c)) ?? 0) + 1);
  const dup = [...seen.values()].filter((n) => n > 1).length;
  if (dup) block("duplicate_cells", `${dup} combinaison(s) en double.`);
  if (cells.some((c) => c.widthMinMm > c.widthMaxMm || c.dimAmm <= 0 || c.widthMinMm <= 0)) block("invalid_axis", "Dimension invalide (largeur minimale supérieure à la maximale, ou cote nulle).");
  for (const d of new Set(cells.map((c) => c.dimAmm))) {
    const row = cells.filter((c) => c.dimAmm === d).sort((a, b) => a.widthMinMm - b.widthMinMm);
    for (let i = 1; i < row.length; i++) if (row[i]!.widthMinMm <= row[i - 1]!.widthMaxMm && cellKey(row[i]!) !== cellKey(row[i - 1]!)) { block("overlapping_widths", `Plages de largeur qui se chevauchent à ${d} mm.`); break; }
    if (out.some((o) => o.code === "overlapping_widths")) break;
  }
  return out;
}

export const isPublishable = (checks: GridCheck[]) => !checks.some((c) => c.severity === "blocking");

const fmtBps = (bps: number) => `${(bps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;

export interface CellChange {
  dimAmm: number;
  widthMinMm: number;
  widthMaxMm: number;
  before: number | null;
  after: number | null;
}

/** Différences entre deux versions : cellules ajoutées, retirées (non tarifées), modifiées. */
export function diffCells(before: TariffCell[], after: TariffCell[]): { added: CellChange[]; removed: CellChange[]; changed: CellChange[]; unchanged: number } {
  const b = new Map(before.map((c) => [cellKey(c), c]));
  const a = new Map(after.map((c) => [cellKey(c), c]));
  const added: CellChange[] = [], removed: CellChange[] = [], changed: CellChange[] = [];
  let unchanged = 0;
  for (const [k, c] of a) {
    const p = b.get(k);
    if (!p) added.push({ dimAmm: c.dimAmm, widthMinMm: c.widthMinMm, widthMaxMm: c.widthMaxMm, before: null, after: c.amountMinor });
    else if (p.amountMinor !== c.amountMinor) changed.push({ dimAmm: c.dimAmm, widthMinMm: c.widthMinMm, widthMaxMm: c.widthMaxMm, before: p.amountMinor, after: c.amountMinor });
    else unchanged++;
  }
  for (const [k, c] of b) if (!a.has(k)) removed.push({ dimAmm: c.dimAmm, widthMinMm: c.widthMinMm, widthMaxMm: c.widthMaxMm, before: c.amountMinor, after: null });
  const order = (x: CellChange, y: CellChange) => x.dimAmm - y.dimAmm || x.widthMinMm - y.widthMinMm;
  return { added: added.sort(order), removed: removed.sort(order), changed: changed.sort(order), unchanged };
}

/** Deux grilles ont exactement les mêmes cellules et montants. */
export const sameCells = (a: TariffCell[], b: TariffCell[]) => { const d = diffCells(a, b); return !d.added.length && !d.removed.length && !d.changed.length; };

/**
 * Règle de recalcul d'une grille de vente depuis une grille de base. Trois règles distinctes, jamais confondues :
 * - coefficient : prix = base × k ;
 * - majoration sur coût : prix = coût × (1 + m) — m exprimé en % du coût d'achat ;
 * - marge sur prix de vente : prix = coût ÷ (1 − t) — t exprimé en % du prix de vente (taux de marque).
 * Aucune valeur par défaut : l'administrateur saisit la valeur, qui est enregistrée avec la version.
 */
export type DeriveMode = "coefficient" | "markup_on_cost" | "margin_on_price" | "supplier_discount";
export const DERIVE_LABEL: Record<DeriveMode, string> = {
  coefficient: "Coefficient multiplicateur (prix = base × k)",
  markup_on_cost: "Majoration sur coût d'achat (prix = coût × (1 + m %))",
  margin_on_price: "Marge sur prix de vente (prix = coût ÷ (1 − t %))",
  supplier_discount: "Remise fournisseur (achat net = prix catalogue × (1 − r %))",
};

/** Décimal positif « 1,2345 » → [numérateur, dénominateur] exacts (6 décimales au plus). */
function parseDecimal(input: string): [bigint, bigint] | null {
  const m = /^(\d{1,6})(?:[.,](\d{1,6}))?$/.exec(input.trim());
  if (!m) return null;
  const frac = m[2] ?? "";
  return [BigInt(m[1]! + frac), 10n ** BigInt(frac.length)];
}

/** Ratio exact appliqué à chaque cellule pour une règle, ou une erreur. */
export function deriveRatio(mode: DeriveMode, value: string): { ok: true; num: bigint; den: bigint; formula: string } | { ok: false; error: string } {
  const d = parseDecimal(value);
  if (!d) return { ok: false, error: "Valeur invalide (nombre positif, 6 décimales au plus)." };
  const [n, q] = d;
  if (mode === "coefficient") {
    if (n === 0n) return { ok: false, error: "Un coefficient nul donnerait des prix nuls." };
    return { ok: true, num: n, den: q, formula: `base × ${value.trim()}` };
  }
  if (mode === "markup_on_cost") return { ok: true, num: 100n * q + n, den: 100n * q, formula: `coût × (1 + ${value.trim()} %)` };
  if (mode === "supplier_discount") {
    if (n >= 100n * q) return { ok: false, error: "Une remise fournisseur doit être inférieure à 100 %." };
    return { ok: true, num: 100n * q - n, den: 100n * q, formula: `prix catalogue × (1 − ${value.trim()} %)` };
  }
  if (n >= 100n * q) return { ok: false, error: "Une marge sur prix de vente doit être inférieure à 100 %." };
  return { ok: true, num: 100n * q, den: 100n * q - n, formula: `coût ÷ (1 − ${value.trim()} %)` };
}

/** Arrondi au centime, demi supérieur, d'un produit exact. */
export function roundHalfUp(amountMinor: number, num: bigint, den: bigint): number {
  const x = BigInt(amountMinor) * num;
  return Number((2n * x + den) / (2n * den));
}

export function deriveCells(base: TariffCell[], mode: DeriveMode, value: string): { ok: true; cells: TariffCell[]; formula: string } | { ok: false; error: string } {
  const r = deriveRatio(mode, value);
  if (!r.ok) return r;
  return { ok: true, formula: r.formula, cells: base.map((c) => ({ ...c, amountMinor: c.amountMinor == null ? null : roundHalfUp(c.amountMinor, r.num, r.den) })) };
}

/** Statut affiché d'une version (une version publiée peut être programmée, en vigueur ou échue). */
export type EffectiveState = "draft" | "verified" | "scheduled" | "in_force" | "expired" | "deactivated" | "archived" | "rejected";
export const EFFECTIVE_LABEL: Record<EffectiveState, string> = { draft: "Brouillon", verified: "Vérifiée", scheduled: "Programmée", in_force: "En vigueur", expired: "Échue", deactivated: "Désactivée", archived: "Remplacée", rejected: "Rejetée" };

export function effectiveState(v: { status: string; validFrom: Date | null; validTo: Date | null; deactivatedAt: Date | null }, now = new Date()): EffectiveState {
  if (v.status === "DRAFT") return "draft";
  if (v.status === "VERIFIED") return "verified";
  if (v.status === "REJECTED") return "rejected";
  if (v.status === "ARCHIVED") return v.deactivatedAt ? "deactivated" : "archived";
  if (v.validFrom && v.validFrom > now) return "scheduled";
  if (v.validTo && v.validTo <= now) return "expired";
  return "in_force";
}

/** Deux clientèles se recouvrent (ALL recouvre les deux autres). */
export const clienteleOverlaps = (a: Clientele, b: Clientele) => a === b || a === "ALL" || b === "ALL";

/** Deux périodes [début, fin[ se recouvrent (null = illimitée). */
export function periodsOverlap(a: { from: Date | null; to: Date | null }, b: { from: Date | null; to: Date | null }): boolean {
  const aFrom = a.from?.getTime() ?? -Infinity, aTo = a.to?.getTime() ?? Infinity;
  const bFrom = b.from?.getTime() ?? -Infinity, bTo = b.to?.getTime() ?? Infinity;
  return aFrom < bTo && bFrom < aTo;
}
