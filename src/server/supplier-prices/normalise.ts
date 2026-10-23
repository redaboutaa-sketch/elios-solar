/**
 * Normalisation des tarifs fournisseur : nombres, bandes de largeur, familles, variantes,
 * doublons et grilles incomplètes. Fonctions pures, sans accès base ni journalisation des montants.
 */
import type { GridGap, ParsedRow, RowStatus } from "./types";

/** Familles du catalogue HELIOSTORES reconnues dans les sources. */
export const FAMILY_RULES: { slug: string; test: RegExp }[] = [
  { slug: "helio-horizon", test: /\bSB\s*400\b/i },
  { slug: "helio-panorama", test: /\bSB\s*500\b/i },
  { slug: "helio-ombra", test: /REFLEKSOL/i },
  { slug: "helio-riviera", test: /CASA(BLANCA)?\b/i },
  { slug: "helio-verriere", test: /\bFTS\b/i },
];

/** Familles dont la dimension A est une hauteur (store vertical / toile de véranda). */
export const HEIGHT_FAMILIES = new Set(["helio-ombra", "helio-verriere"]);

export function familyFromText(text: string): string | null {
  for (const r of FAMILY_RULES) if (r.test.test(text)) return r.slug;
  return null;
}

/** Variante tarifaire normalisée à partir d'un libellé source. */
export function variantFromText(text: string): string {
  const t = stripAccents(text).toLowerCase();
  if (/module\s+suivant|extension/.test(t)) return "module-suivant";
  if (/premier\s+module/.test(t)) return "premier-module";
  // « (MURALE / AUTOPORTANTE) » : titre de feuille, pas une variante
  if (/murale\s*\/\s*autoportante|autoportante\s*\/\s*murale/.test(t)) return "";
  if (/autoportante|autonome/.test(t)) return "autoportante";
  if (/murale/.test(t)) return "murale";
  return "";
}

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function slugify(s: string): string {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function cleanText(s: string): string {
  return s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Nombre lu dans une cellule ou un tableau : accepte « 300 », « 300.0 », « 1 234,50 », « 123 € ».
 * Retourne null si la valeur est vide ou n'est pas un nombre (jamais 0 par défaut).
 */
export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/[\s  ]/g, "").replace(/(€|eur|dh|mad|dhs)$/i, "");
  if (!s) return null;
  if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Bande « 200-290 » / « 140 – 274 » (cm) → bornes en mm. */
export function parseBand(v: unknown): { minMm: number; maxMm: number } | null {
  if (typeof v !== "string") return null;
  const m = cleanText(v).match(/^(\d+(?:[.,]\d+)?)\s*[-–—à]\s*(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const a = parseNumber(m[1]!);
  const b = parseNumber(m[2]!);
  if (a == null || b == null || b < a) return null;
  return { minMm: cmToMm(a), maxMm: cmToMm(b) };
}

export function cmToMm(cm: number): number {
  return Math.round(cm * 10);
}

/**
 * Montant décimal → unités mineures. Les fractions de centime issues d'une formule sont arrondies
 * au centime le plus proche (demi vers le haut) après neutralisation du bruit flottant.
 */
export function toMinor(amount: number | null): { minor: number | null; subCent: boolean } {
  if (amount == null || !Number.isFinite(amount)) return { minor: null, subCent: false };
  const scaled = Number((amount * 100).toFixed(6));
  return { minor: Math.round(scaled), subCent: !Number.isInteger(scaled) };
}

/** Devise déclarée dans un libellé (« Prix (€) », « Prix fournisseur (DH) »). */
export function currencyFromLabel(label: string): string | null {
  if (/€|\beur(os?)?\b/i.test(label)) return "EUR";
  if (/\b(dh|dhs|mad|dirhams?)\b/i.test(label)) return "MAD";
  return null;
}

export function widthKey(r: Pick<ParsedRow, "widthMinMm" | "widthMaxMm">): string {
  return r.widthMinMm === r.widthMaxMm ? String(r.widthMinMm) : `${r.widthMinMm}-${r.widthMaxMm}`;
}

/** Clé d'identité d'une ligne dans une version (doublon = même clé). */
export function rowKey(r: ParsedRow): string {
  return [r.familySlug, r.variantKey, r.kind, r.code, r.amountRole, r.dimAmm ?? "", widthKey(r), JSON.stringify(r.conditions.match ?? null)].join("|");
}

export function addIssue(r: ParsedRow, issue: string, status: RowStatus = "TO_CHECK") {
  if (!r.issues.includes(issue)) r.issues.push(issue);
  if (status === "REJECTED" || (status === "TO_CHECK" && r.status === "OK")) r.status = status;
}

/** Marque les doublons (même famille/variante/dimensions/rôle) ; retourne les groupes trouvés. */
export function markDuplicates(rows: ParsedRow[]): { key: string; refs: string[] }[] {
  const groups = new Map<string, ParsedRow[]>();
  for (const r of rows) {
    const k = rowKey(r);
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  const out: { key: string; refs: string[] }[] = [];
  for (const [key, g] of groups) {
    if (g.length < 2) continue;
    for (const r of g) addIssue(r, `Doublon : ${g.length} lignes pour la même famille, variante, dimension et colonne (${g.map((x) => x.sourceRef).join(", ")})`);
    out.push({ key, refs: g.map((x) => x.sourceRef) });
  }
  return out;
}

/**
 * Grilles incomplètes : combinaisons manquantes dans le rectangle couvert (dimensions A × largeurs)
 * d'une même famille / variante / colonne. Rien n'est complété : la liste est seulement signalée.
 */
export function findGridGaps(rows: ParsedRow[]): GridGap[] {
  const groups = new Map<string, ParsedRow[]>();
  for (const r of rows) {
    if (r.kind !== "GRID" || r.dimAmm == null || r.widthMinMm == null) continue;
    const k = `${r.familySlug}|${r.variantKey}|${r.amountRole}`;
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  const gaps: GridGap[] = [];
  for (const [k, g] of groups) {
    const [familySlug = "", variantKey = "", amountRole = ""] = k.split("|");
    const dims = [...new Set(g.map((r) => r.dimAmm!))].sort((a, b) => a - b);
    const widths = [...new Set(g.map(widthKey))].sort((a, b) => parseInt(a) - parseInt(b));
    const present = new Set(g.map((r) => `${r.dimAmm}|${widthKey(r)}`));
    for (const d of dims) for (const w of widths) if (!present.has(`${d}|${w}`)) gaps.push({ familySlug, variantKey, amountRole, dimAmm: d, widthKey: w });
  }
  return gaps;
}

/** Comptes par statut / famille / variante / rôle, sans montant. */
export function countRows(rows: ParsedRow[]) {
  const byStatus: Record<string, number> = { OK: 0, TO_CHECK: 0, REJECTED: 0 };
  const byFamily: Record<string, Record<string, Record<string, number>>> = {};
  let emptyAmounts = 0;
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    const v = (byFamily[r.familySlug] ??= {});
    const roles = (v[r.variantKey || "—"] ??= {});
    const role = r.kind === "OPTION" ? `OPTION:${r.code || r.label}`.slice(0, 60) : r.amountRole;
    roles[role] = (roles[role] ?? 0) + 1;
    if (r.amountMinor == null) emptyAmounts++;
  }
  return { total: rows.length, byStatus, byFamily, emptyAmounts };
}
