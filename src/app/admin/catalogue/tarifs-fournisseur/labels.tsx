import { StatusBadge } from "@/components/admin/ui";

export const LIST_STATUS_FR: Record<string, string> = { DRAFT: "Brouillon", ACTIVE: "Active", ARCHIVED: "Archivée", REJECTED: "Rejetée" };
export const ROW_STATUS_FR: Record<string, string> = { OK: "OK", TO_CHECK: "À vérifier", REJECTED: "Rejetée" };
export const NATURE_FR: Record<string, string> = { UNKNOWN: "Nature non établie", PURCHASE: "Achat", SALE: "Vente", RECOMMENDED: "Prix conseillé", SUPPLIER_LIST: "Prix catalogue fournisseur", EXAMPLE: "Exemple" };
export const TAX_FR: Record<string, string> = { UNKNOWN: "HT/TTC inconnu", HT: "HT", TTC: "TTC" };
export const DISCREPANCY_FR: Record<string, string> = {
  AMOUNT_MISMATCH: "Montants différents",
  MISSING_IN_XLSX: "Absent du classeur",
  MISSING_IN_DOCX: "Absent de la fiche",
  VARIANT_LABEL: "Libellé de variante contradictoire",
  NO_MATCHING_CELL: "Aucune cellule correspondante",
  DIMENSION_LABEL: "Intitulé de dimension différent",
};

export function ListStatusBadge({ status }: { status: string }) {
  const tone = status === "ACTIVE" ? "ok" : status === "REJECTED" ? "err" : status === "DRAFT" ? "warn" : "neutral";
  return <StatusBadge tone={tone}>{LIST_STATUS_FR[status] ?? status}</StatusBadge>;
}

export function RowStatusBadge({ status }: { status: string }) {
  return <StatusBadge tone={status === "OK" ? "ok" : status === "REJECTED" ? "err" : "warn"}>{ROW_STATUS_FR[status] ?? status}</StatusBadge>;
}

export function InterpretationBadges({ nature, taxBasis, currency }: { nature: string; taxBasis: string; currency: string | null }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <StatusBadge tone={nature === "UNKNOWN" ? "warn" : "neutral"}>{NATURE_FR[nature] ?? nature}</StatusBadge>
      <StatusBadge tone={taxBasis === "UNKNOWN" ? "warn" : "neutral"}>{TAX_FR[taxBasis] ?? taxBasis}</StatusBadge>
      <StatusBadge tone={currency ? "neutral" : "warn"}>{currency ?? "Devise non indiquée"}</StatusBadge>
    </span>
  );
}

/** Montant interne : affiché uniquement dans le détail d'une version (administrateurs). */
export function fmtMinor(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor == null) return "— (vide)";
  const n = (minor / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n} ${currency ?? "(devise ?)"}`;
}
