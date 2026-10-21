/**
 * Tarifs fournisseur — types partagés (modules purs, sans accès base).
 * Les montants importés restent internes, sauf la colonne « Prix final HELIOSTORES » de la version ACTIVE du classeur
 * (src/server/pricing/system-prices.ts) ; jamais de montant dans les journaux.
 */

export type RowKind = "GRID" | "OPTION";
export type RowStatus = "OK" | "TO_CHECK" | "REJECTED";
export type SourceType = "xlsx" | "docx";

/** Rôle du montant dans la source (colonne d'origine). */
export const AMOUNT_ROLES = {
  /** colonne « Prix » du classeur / « Prix fournisseur » des fiches */
  SOURCE_PRICE: "PRIX_SOURCE",
  /** colonne « Prix final HELIOSTORES » */
  FINAL_PRICE: "PRIX_FINAL",
  /** équipement / supplément */
  OPTION: "OPTION",
} as const;
export type AmountRole = (typeof AMOUNT_ROLES)[keyof typeof AMOUNT_ROLES];

export const AMOUNT_ROLE_FR: Record<string, string> = {
  PRIX_SOURCE: "Prix source (« Prix » / « Prix fournisseur »)",
  PRIX_FINAL: "Prix final HELIOSTORES",
  OPTION: "Option / supplément",
};

export interface ParsedRow {
  familySlug: string;
  variantKey: string;
  kind: RowKind;
  code: string;
  label: string;
  dimAKey: string | null;
  dimAmm: number | null;
  widthMinMm: number | null;
  widthMaxMm: number | null;
  conditions: Record<string, unknown>;
  /** unités mineures (centimes) ; null = cellule vide ou illisible (jamais 0 par défaut) */
  amountMinor: number | null;
  currency: string | null;
  amountRole: AmountRole;
  formula: string | null;
  cachedValue: number | null;
  /** fichier / feuille / cellule ou tableau / ligne */
  sourceRef: string;
  status: RowStatus;
  issues: string[];
}

export interface FormulaCheck {
  /** colonne (D, E, F) */
  column: string;
  count: number;
  missingCache: number;
  mismatches: number;
  /** motifs normalisés (références remplacées par la colonne), ex. « C*k » — valeurs privées */
  patterns: Record<string, number>;
}

export interface BlockReport {
  title: string;
  variantKey: string;
  headerRow: number;
  headers: string[];
  firstRow: number;
  lastRow: number;
  rows: number;
}

export interface SheetReport {
  name: string;
  state: string;
  familySlug: string | null;
  title: string;
  blocks: BlockReport[];
  dataRows: number;
  textNumbers: number;
  formulas: FormulaCheck[];
  /** coefficient(s) de la colonne F (privé : affiché seulement dans l'administration) */
  finalCoefficients: number[];
  notes: string[];
}

export interface WorkbookStructure {
  sheets: { name: string; state: string }[];
  hiddenSheets: string[];
  externalLinks: number;
  comments: number;
  /** noms définis par l'utilisateur */
  definedNames: number;
  /** noms intégrés Excel (zones d'impression…) */
  builtInNames: number;
  mentionsCurrency: string[];
  mentionsTax: string[];
}

export interface DocxTableReport {
  index: number;
  caption: string;
  headers: string[];
  rows: number;
  kind: "grid" | "option" | "ignored";
  variantKey: string;
  currency: string | null;
  /** rapport prix final / prix source majoritaire (privé) */
  finalRatio?: number;
  ratioClusters?: number;
}

export interface ParsedSource {
  type: SourceType;
  fileName: string;
  /** clé stable de la source (une suite de versions par clé) */
  sourceKey: string;
  label: string;
  /** familles couvertes */
  families: string[];
  currency: string | null;
  currencyNote: string;
  natureNote: string;
  rows: ParsedRow[];
  notes: string[];
  xlsx?: { structure: WorkbookStructure; sheets: SheetReport[] };
  docx?: { title: string; tables: DocxTableReport[]; optionLines: number; currencies: string[] };
}

export type DiscrepancyCategory =
  /** même dimension, montants différents */
  | "AMOUNT_MISMATCH"
  /** combinaison présente dans une seule des deux sources */
  | "MISSING_IN_XLSX"
  | "MISSING_IN_DOCX"
  /** variante nommée différemment (mêmes montants) */
  | "VARIANT_LABEL"
  /** grille de la fiche sans aucune correspondance dans le classeur */
  | "NO_MATCHING_CELL"
  /** en-tête de dimension différent (projection / hauteur) */
  | "DIMENSION_LABEL";

export interface Discrepancy {
  category: DiscrepancyCategory;
  /** fichiers rapprochés */
  docxFile: string;
  xlsxFile: string;
  familySlug: string;
  variantKey: string;
  amountRole?: string;
  dimAmm?: number | null;
  widthMinMm?: number | null;
  widthMaxMm?: number | null;
  docxRef?: string;
  xlsxRef?: string;
  /** montants (unités mineures) — privés, jamais imprimés par le script */
  docxAmountMinor?: number | null;
  xlsxAmountMinor?: number | null;
  message: string;
}

export interface GridGap {
  familySlug: string;
  variantKey: string;
  amountRole: string;
  dimAmm: number;
  widthKey: string;
}
