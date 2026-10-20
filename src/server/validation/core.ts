/**
 * Validation des références — règles pures (sans base de données), testables unitairement.
 *
 * Un dossier de validation porte sur une VERSION PRÉCISE des données d'une cible :
 * `baseHash` = empreinte canonique des données actuelles au moment de la proposition.
 * À la validation, l'empreinte est recalculée : si les données ont changé entre-temps, la validation est refusée.
 *
 * Garde-fous :
 * - une validation ne modifie JAMAIS `purchasable` (la mise en vente reste une décision séparée) ;
 * - une source « observation sur la référence » ne peut produire au mieux qu'un statut OBSERVED ;
 * - « vérifié fournisseur » exige un document ou un écrit fournisseur.
 */
import { createHash } from "node:crypto";

export type TargetType = "VARIANT" | "FAMILY_SPEC" | "CLOSURE_RULE" | "OPTION_RULE";
export type ValidationStatus = "DRAFT" | "TO_REVIEW" | "VALIDATED" | "REJECTED";
export type SourceKind = "SUPPLIER_DOCUMENT" | "SUPPLIER_WRITTEN" | "OBSERVED_REFERENCE" | "OTHER";
export type DbDataStatus = "DEMO" | "SUPPLIER_VERIFIED" | "OBSERVED" | "UNKNOWN";

export const TARGET_FR: Record<TargetType, string> = {
  VARIANT: "Référence (variante)",
  FAMILY_SPEC: "Donnée technique",
  CLOSURE_RULE: "Règle de fermeture",
  OPTION_RULE: "Règle d'option",
};
export const VALIDATION_STATUS_FR: Record<ValidationStatus, string> = { DRAFT: "Brouillon", TO_REVIEW: "À vérifier", VALIDATED: "Validé", REJECTED: "Rejeté" };
export const SOURCE_KIND_FR: Record<SourceKind, string> = {
  SUPPLIER_DOCUMENT: "Document fournisseur (médiathèque)",
  SUPPLIER_WRITTEN: "Écrit fournisseur (e-mail, devis, courrier)",
  OBSERVED_REFERENCE: "Observation sur la référence",
  OTHER: "Autre (insuffisant pour valider)",
};

/** Champs qu'un dossier peut proposer, par type de cible (tout autre champ est ignoré). */
export const PROPOSABLE: Record<TargetType, Record<string, "int" | "text" | "enum" | "bool" | "json">> = {
  VARIANT: { label: "text", priceCents: "int", availability: "enum", leadMinDays: "int", leadMaxDays: "int", leadUnit: "enum", attributes: "json" },
  FAMILY_SPEC: { valueNum: "int", unit: "text", valueText: "text" },
  CLOSURE_RULE: { status: "enum", reason: "text" },
  OPTION_RULE: { status: "enum", reason: "text", includedInBase: "bool", maxQty: "int" },
};
export const ENUM_VALUES: Record<string, readonly string[]> = {
  availability: ["AVAILABLE", "ON_ORDER", "OUT_OF_STOCK", "TO_CONFIRM"],
  leadUnit: ["BUSINESS_DAYS", "CALENDAR_DAYS", "WEEKS"],
  status: ["ALLOWED", "FORBIDDEN", "UNKNOWN"],
};
export const FIELD_FR: Record<string, string> = {
  label: "Libellé", priceCents: "Prix TTC (centimes)", availability: "Disponibilité", leadMinDays: "Délai minimum", leadMaxDays: "Délai maximum", leadUnit: "Unité de délai",
  attributes: "Attributs", valueNum: "Valeur numérique", unit: "Unité", valueText: "Valeur texte", status: "Statut de compatibilité", reason: "Motif", includedInBase: "Inclus dans la gamme", maxQty: "Quantité max.",
  dataStatus: "Fiabilité", purchasable: "Achetable", compareAtCents: "Prix barré", taxRateBps: "TVA (pb)", leadSource: "Fiabilité du délai", specs: "Valeurs par source",
};

/** JSON canonique : clés triées récursivement, `undefined` omis. */
export function canonicalJson(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${canonicalJson(x)}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export function dataHash(v: unknown): string {
  return createHash("sha256").update(canonicalJson(v)).digest("hex");
}

export interface DiffRow {
  field: string;
  current: unknown;
  proposed: unknown;
  changed: boolean;
}

function flatten(prefix: string, v: unknown, out: Record<string, unknown>) {
  if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) flatten(prefix ? `${prefix}.${k}` : k, x, out);
  } else out[prefix] = v;
}

/** Diff champ par champ des seules valeurs proposées (les objets sont comparés clé par clé). */
export function diffProposal(current: Record<string, unknown>, proposed: Record<string, unknown>): DiffRow[] {
  const cur: Record<string, unknown> = {};
  const prop: Record<string, unknown> = {};
  flatten("", current, cur);
  flatten("", proposed, prop);
  return Object.keys(prop).sort().map((field) => ({ field, current: cur[field] ?? null, proposed: prop[field], changed: canonicalJson(cur[field] ?? null) !== canonicalJson(prop[field]) }));
}

const TRANSITIONS: Record<ValidationStatus, ValidationStatus[]> = {
  DRAFT: ["TO_REVIEW", "REJECTED"],
  TO_REVIEW: ["DRAFT", "VALIDATED", "REJECTED"],
  VALIDATED: [],
  REJECTED: [],
};

export function canTransition(from: ValidationStatus, to: ValidationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: ValidationStatus): ValidationStatus[] {
  return TRANSITIONS[from];
}

/** Fiabilité obtenue après validation selon la nature de la source (null = validation impossible). */
export function resultingDataStatus(kind: SourceKind | null | undefined): DbDataStatus | null {
  if (kind === "SUPPLIER_DOCUMENT" || kind === "SUPPLIER_WRITTEN") return "SUPPLIER_VERIFIED";
  if (kind === "OBSERVED_REFERENCE") return "OBSERVED";
  return null;
}

export interface DecisionInput {
  status: ValidationStatus;
  sourceKind: SourceKind | null;
  documentId: string | null;
  documentPublished?: boolean;
  sourceUrl: string | null;
  sourceNote: string;
  baseHash: string;
  currentHash: string;
  targetType: TargetType;
  proposed: Record<string, unknown>;
}

/** Erreurs bloquant la validation (liste vide = validable). */
export function validationBlockers(d: DecisionInput): string[] {
  const errs: string[] = [];
  if (d.status !== "TO_REVIEW") errs.push("Seul un dossier « à vérifier » peut être validé.");
  if (d.baseHash !== d.currentHash) errs.push("Les données ont changé depuis la proposition : remettez le dossier en brouillon pour l'actualiser.");
  const status = resultingDataStatus(d.sourceKind);
  if (!status) errs.push("Source manquante ou insuffisante : un document ou un écrit fournisseur (ou, à défaut, une observation) est requis.");
  if (d.sourceKind === "SUPPLIER_DOCUMENT" && !d.documentId) errs.push("Source « document fournisseur » sans document rattaché.");
  if (d.sourceKind === "SUPPLIER_DOCUMENT" && d.documentId && d.documentPublished === false) errs.push("Le document justificatif n'est pas publié.");
  if (d.sourceKind === "SUPPLIER_WRITTEN" && !d.sourceUrl && d.sourceNote.trim().length < 10) errs.push("Écrit fournisseur : précisez la référence de l'écrit (lien ou description).");
  if (d.sourceKind === "OBSERVED_REFERENCE" && !d.sourceUrl && d.sourceNote.trim().length < 10) errs.push("Observation : précisez où et quand la valeur a été relevée.");
  if (d.targetType === "FAMILY_SPEC" && d.proposed.valueNum == null && !d.proposed.valueText) errs.push("Donnée technique : aucune valeur proposée.");
  if ("purchasable" in d.proposed) errs.push("Une validation ne peut pas modifier « achetable ».");
  return errs;
}

/** Retire tout champ non proposable (dont `purchasable`) et normalise les types. */
export function sanitizeProposal(type: TargetType, raw: Record<string, unknown>): { proposed: Record<string, unknown>; errors: string[] } {
  const allowed = PROPOSABLE[type];
  const proposed: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const [k, kind] of Object.entries(allowed)) {
    const v = raw[k];
    if (v === undefined || v === null || v === "") continue;
    if (kind === "int") {
      const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, ""));
      if (!Number.isInteger(n) || n < 0 || n > 100_000_000) errors.push(`${FIELD_FR[k] ?? k} : entier positif attendu.`);
      else proposed[k] = n;
    } else if (kind === "enum") {
      if (!ENUM_VALUES[k]?.includes(String(v))) errors.push(`${FIELD_FR[k] ?? k} : valeur inconnue.`);
      else proposed[k] = String(v);
    } else if (kind === "bool") proposed[k] = v === true || v === "true" || v === "on";
    else if (kind === "json") {
      try {
        const o = typeof v === "string" ? JSON.parse(v) : v;
        if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error();
        if (Object.keys(o).length) proposed[k] = o;
      } catch {
        errors.push(`${FIELD_FR[k] ?? k} : objet JSON attendu.`);
      }
    } else proposed[k] = String(v).trim().slice(0, 500);
  }
  return { proposed, errors };
}

export interface CommercialChecklist {
  items: Array<{ key: string; label: string; ok: boolean; detail?: string }>;
  ready: boolean;
}

/** Ce qu'il faut pour vendre réellement une référence ; une validation seule ne suffit jamais. */
export function commercialChecklist(v: { dataStatus: DbDataStatus; availability: string; leadSource: DbDataStatus; leadMinDays: number | null; leadMaxDays: number | null; purchasable: boolean }, unknownRules: number): CommercialChecklist {
  const items = [
    { key: "price", label: "Prix validé par le fournisseur", ok: v.dataStatus === "SUPPLIER_VERIFIED" },
    { key: "availability", label: "Disponibilité et délai validés", ok: v.availability !== "TO_CONFIRM" && v.leadSource === "SUPPLIER_VERIFIED" && v.leadMinDays != null && v.leadMaxDays != null },
    { key: "compat", label: "Compatibilités de la gamme confirmées", ok: unknownRules === 0, detail: unknownRules ? `${unknownRules} règle(s) au statut inconnu` : undefined },
    { key: "notDemo", label: "Référence réelle (pas une donnée de démonstration)", ok: v.dataStatus !== "DEMO" },
    { key: "purchasable", label: "Mise en vente activée (décision séparée, jamais automatique)", ok: v.purchasable },
  ];
  return { items, ready: items.every((i) => i.ok) };
}

export function shortHash(h: string | null | undefined): string {
  return h ? h.slice(0, 12) : "—";
}
