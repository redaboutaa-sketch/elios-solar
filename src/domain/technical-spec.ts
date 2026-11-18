/**
 * Données techniques sourcées — pur, sans dépendance serveur.
 *
 * Une même caractéristique (ex. longueur du câble fourni) peut avoir plusieurs valeurs de provenance différente :
 * - `demo_seed` : valeur fictive du jeu de démonstration ;
 * - `observed_reference` : relevée sur la fiche d'un site de référence (indice, pas une spécification) ;
 * - `supplier_confirmed` : confirmée par un document ou un écrit fournisseur ;
 * - `client_sheet` : fiche technique du modèle exact transmise par le client ;
 * - `supplier_document` : catalogue ou document technique du fournisseur / fabricant ;
 * - `manufacturer_website` : page officielle du fabricant.
 * Les quatre dernières font autorité ; une valeur n'est présentée comme établie que si toutes les sources
 * qui font autorité concordent. Démonstration et observation ne sont jamais présentées comme certaines.
 */
export type SpecSource = "demo_seed" | "observed_reference" | "supplier_confirmed" | "client_sheet" | "supplier_document" | "manufacturer_website";

/** Sources faisant autorité pour une caractéristique publique. */
export const AUTHORITATIVE_SOURCES: readonly SpecSource[] = ["supplier_confirmed", "client_sheet", "supplier_document", "manufacturer_website"];

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
  /** remarque publiable (contradiction, portée de la source) */
  note?: string | null;
}

export const SPEC_KEYS = { includedCableLength: "included_cable_length" } as const;

export const SPEC_SOURCE_FR: Record<SpecSource, string> = {
  demo_seed: "Donnée fictive (démonstration)",
  observed_reference: "Observation sur la référence",
  supplier_confirmed: "Spécification fournisseur confirmée",
  client_sheet: "Fiche du modèle (client)",
  supplier_document: "Document fournisseur",
  manufacturer_website: "Site du fabricant",
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

/** Valeur établie par les sources qui font autorité, ou null. Deux valeurs divergentes = non établie. */
export function confirmedSpec(specs: TechnicalSpecValue[] | undefined, key: string): TechnicalSpecValue | null {
  const confirmed = (specs ?? []).filter((s) => s.key === key && AUTHORITATIVE_SOURCES.includes(s.source));
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
