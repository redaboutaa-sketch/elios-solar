/**
 * Référence tarifaire PRIVÉE extraite du PDF (scripts/recette/audit-tarifs/reference.py) et calculs ATTENDUS écrits ici,
 * indépendants du moteur et de la base : sélection de la cellule, politique de vente, TVA, arrondi commercial.
 * Sans référence (CI, dépôt public) : les parcours qui en dépendent sont marqués « non testé » (test.skip motivé).
 */
import { existsSync, readFileSync } from "node:fs";

export type RefCell = { dim: number; dimMm: number; widthMinMm: number; widthMaxMm: number; catalogueEur: number | null };
export type RefGrid = { id: string; familySlug: string; variantKey: string; kind: "matrix" | "awning"; pagePrinted: number; cells: RefCell[] };
export type Reference = { policy: { discountBps: number; marginBps: number; vatBps: number }; grids: RefGrid[]; document: { sha256Checked: string } };

export const MODE = (process.env.RECETTE_MODE ?? "isolated") as "isolated" | "production";
export const READ_ONLY = MODE === "production";

export function loadReference(): Reference | null {
  const p = process.env.RECETTE_REFERENCE;
  return p && existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Reference) : null;
}

/** Cellule retenue : plus petite tranche ≥ cote (première tranche si la cote est sous la grille). */
export function cellFor(ref: Reference, gridId: string, widthMm: number, dimMm: number): RefCell {
  const g = ref.grids.find((x) => x.id === gridId);
  if (!g) throw new Error(`grille ${gridId} absente de la référence`);
  const cells = g.cells.filter((c) => c.catalogueEur != null);
  const dims = [...new Set(cells.map((c) => c.dimMm))].sort((a, b) => a - b);
  const d = dims.find((x) => x >= dimMm) ?? null;
  if (d == null) throw new Error("cote au-delà de la grille");
  const row = cells.filter((c) => c.dimMm === d).sort((a, b) => a.widthMaxMm - b.widthMaxMm);
  const c = g.kind === "matrix" ? row.find((x) => x.widthMaxMm >= widthMm) : row.find((x) => widthMm >= x.widthMinMm && widthMm <= x.widthMaxMm);
  if (!c) throw new Error("largeur hors grille");
  return c;
}

export const saleHt = (ref: Reference, c: RefCell) => Math.round((c.catalogueEur! * 100 * (10000 - ref.policy.discountBps)) / (10000 - ref.policy.marginBps));
export const ttcOf = (ref: Reference, ht: number) => ht + Math.round((ht * ref.policy.vatBps) / 10000);
export const round99 = (t: number) => {
  if (t < 9900) return t;
  const lower = Math.floor((t - 9900) / 10000) * 10000 + 9900;
  return t - lower >= lower + 10000 - t ? lower + 10000 : lower;
};

const fmt = (minor: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(minor / 100);
/** Montant TTC tel qu'affiché par le configurateur (« 6 799 € TTC »). */
export const ttcText = (minor: number) => new RegExp(`^${fmt(minor).replace(/\s/g, "\\s")}\\s?€\\s?TTC$`);
