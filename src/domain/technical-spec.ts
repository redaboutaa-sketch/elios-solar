/**
 * Données techniques sourcées — pur, sans dépendance serveur.
 *
 * Une même caractéristique (ex. longueur du câble fourni) peut avoir plusieurs valeurs de provenance différente :
 * - `demo_seed` : valeur fictive du jeu de démonstration ;
 * - `observed_reference` : relevée sur la fiche d'un site de référence (indice, pas une spécification) ;
 * - `supplier_confirmed` : confirmée par un document ou un écrit fournisseur.
 * Seule une valeur `supplier_confirmed` est présentée publiquement comme certaine.
 */
export type SpecSource = "demo_seed" | "observed_reference" | "supplier_confirmed";

export interface TechnicalSpecValue {
  key: string;
  label: string;
  valueNum?: number | null;
  unit?: string | null;
  valueText?: string | null;
  source: SpecSource;
  sourceRef?: string;
  observedAt?: string | null;
  variantSku?: string | null;
}

export const SPEC_KEYS = { includedCableLength: "included_cable_length" } as const;

export const SPEC_SOURCE_FR: Record<SpecSource, string> = {
  demo_seed: "Donnée fictive (démonstration)",
  observed_reference: "Observation sur la référence",
  supplier_confirmed: "Spécification fournisseur confirmée",
};

export function formatSpecValue(s: Pick<TechnicalSpecValue, "valueNum" | "unit" | "valueText">): string {
  if (s.valueNum == null) return s.valueText ?? "—";
  if (s.unit === "mm" && s.valueNum >= 1000) return `${(s.valueNum / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m`;
  return `${s.valueNum.toLocaleString("fr-FR")}${s.unit ? ` ${s.unit}` : ""}`;
}

function sameValue(a: TechnicalSpecValue, b: TechnicalSpecValue) {
  return (a.valueNum ?? null) === (b.valueNum ?? null) && (a.unit ?? null) === (b.unit ?? null) && (a.valueText ?? null) === (b.valueText ?? null);
}

/** La caractéristique existe-t-elle sous une forme quelconque (même non confirmée) ? */
export function hasSpec(specs: TechnicalSpecValue[] | undefined, key: string): boolean {
  return (specs ?? []).some((s) => s.key === key);
}

/** Valeur confirmée par le fournisseur, ou null. Deux confirmations divergentes = non confirmée. */
export function confirmedSpec(specs: TechnicalSpecValue[] | undefined, key: string): TechnicalSpecValue | null {
  const confirmed = (specs ?? []).filter((s) => s.key === key && s.source === "supplier_confirmed");
  if (!confirmed.length) return null;
  return confirmed.every((c) => sameValue(c, confirmed[0]!)) ? confirmed[0]! : null;
}

export interface SpecReview {
  key: string;
  label: string;
  confirmed: TechnicalSpecValue | null;
  candidates: TechnicalSpecValue[];
  /** valeurs différentes selon les sources */
  conflict: boolean;
  /** texte public : valeur confirmée, sinon « … à confirmer » */
  publicText: string;
}

export function reviewSpec(specs: TechnicalSpecValue[] | undefined, key: string, toConfirmText = "à confirmer"): SpecReview | null {
  const rows = (specs ?? []).filter((s) => s.key === key);
  if (!rows.length) return null;
  const confirmed = confirmedSpec(rows, key);
  const conflict = rows.some((r) => !sameValue(r, rows[0]!));
  return { key, label: rows[0]!.label, confirmed, candidates: rows, conflict, publicText: confirmed ? formatSpecValue(confirmed) : toConfirmText };
}

/** Libellé public de la longueur du câble fourni : jamais une valeur non confirmée. */
export function includedCablePublicText(specs: TechnicalSpecValue[] | undefined): string | null {
  const r = reviewSpec(specs, SPEC_KEYS.includedCableLength, "longueur à confirmer");
  return r ? r.publicText : null;
}
