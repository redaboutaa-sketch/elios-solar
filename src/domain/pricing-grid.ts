/**
 * Moteur de grille tarifaire sur mesure — pur, déterministe.
 * Le mode de calcul suit la grille importée (cellules largeur × longueur ou tranches) :
 * aucun prix au m² n'est supposé. Une cellule est choisie par appariement exact des bornes ;
 * la plus spécifique (implantation / finition explicites) l'emporte ; deux cellules de même
 * spécificité ⇒ ambiguïté (la grille est alors invalide pour cette zone).
 */
import type { Cents } from "./money";
import { applyBps } from "./money";
import type { Mounting, PriceGridCell, PriceGridSnapshot, PriceGridSurcharge } from "./types";

export interface GridQuery {
  widthMm: number;
  lengthMm: number;
  heightMm: number;
  mounting: Mounting;
  finishCode: string;
  /** fermetures souhaitées par côté (slugs) */
  closureSlugs?: string[];
  /** options (slug, quantité) */
  options?: Array<{ familySlug: string; qty: number }>;
  now?: Date;
}

export interface GridPriceLine {
  code: string;
  label: string;
  cents: Cents;
  qty: number;
}

export type GridPriceResult =
  | { status: "priced"; baseCents: Cents; lines: GridPriceLine[]; totalCents: Cents; cell: PriceGridCell; unpriced: string[] }
  | { status: "out_of_bounds" | "no_cell" | "ambiguous" | "not_valid_yet" | "expired" | "mounting_unavailable" | "finish_unavailable"; message: string };

function inRange(v: number, min: number, max: number) {
  return v >= min && v <= max;
}

function specificity(c: PriceGridCell): number {
  return (c.mounting !== "*" ? 1 : 0) + (c.finishCode !== "*" ? 1 : 0);
}

export function findCell(grid: PriceGridSnapshot, q: { widthMm: number; lengthMm: number; mounting: Mounting; finishCode: string }): { status: "ok"; cell: PriceGridCell } | { status: "none" } | { status: "ambiguous"; cells: PriceGridCell[] } {
  const matches = grid.cells.filter((c) => inRange(q.widthMm, c.widthMinMm, c.widthMaxMm) && inRange(q.lengthMm, c.lengthMinMm, c.lengthMaxMm) && (c.mounting === "*" || c.mounting === q.mounting) && (c.finishCode === "*" || c.finishCode === q.finishCode));
  if (matches.length === 0) return { status: "none" };
  const best = Math.max(...matches.map(specificity));
  const top = matches.filter((c) => specificity(c) === best);
  if (top.length > 1 && new Set(top.map((c) => c.priceCents)).size > 1) return { status: "ambiguous", cells: top };
  return { status: "ok", cell: top[0]! };
}

export function isGridActive(grid: PriceGridSnapshot, now: Date): "active" | "not_valid_yet" | "expired" | "inactive" {
  if (grid.status !== "published") return "inactive";
  if (grid.validFrom && new Date(grid.validFrom) > now) return "not_valid_yet";
  if (grid.validTo && new Date(grid.validTo) < now) return "expired";
  return "active";
}

/** Supplément applicable à une requête ; renvoie le montant (centimes) ou null si non applicable. */
export function applySurcharge(s: PriceGridSurcharge, q: GridQuery, baseCents: Cents): { cents: Cents; qty: number } | null {
  switch (s.kind) {
    case "finish":
      return s.match === "*" || s.match === q.finishCode ? { cents: s.priceCents + applyBps(baseCents, s.percentBps), qty: 1 } : null;
    case "mounting":
      return s.match === "*" || s.match === q.mounting ? { cents: s.priceCents + applyBps(baseCents, s.percentBps), qty: 1 } : null;
    case "height_above": {
      const threshold = s.thresholdMm ?? 0;
      if (q.heightMm <= threshold) return null;
      if (s.perStepMm && s.perStepCents != null) {
        const steps = Math.ceil((q.heightMm - threshold) / s.perStepMm);
        return { cents: s.priceCents + steps * s.perStepCents, qty: 1 };
      }
      return { cents: s.priceCents + applyBps(baseCents, s.percentBps), qty: 1 };
    }
    case "side_closure": {
      const n = (q.closureSlugs ?? []).filter((slug) => s.match === "*" || s.match === slug).length;
      return n > 0 ? { cents: s.priceCents, qty: n } : null;
    }
    case "option": {
      const n = (q.options ?? []).filter((o) => s.match === "*" || s.match === o.familySlug).reduce((sum, o) => sum + Math.max(1, o.qty), 0);
      return n > 0 ? { cents: s.priceCents, qty: n } : null;
    }
    case "percent":
      return s.percentBps !== 0 ? { cents: applyBps(baseCents, s.percentBps), qty: 1 } : null;
    default:
      return null;
  }
}

/** Prix d'une configuration sur mesure à partir d'une grille ; ne renvoie jamais un prix hors grille. */
export function priceFromGrid(grid: PriceGridSnapshot, q: GridQuery): GridPriceResult {
  const now = q.now ?? new Date();
  const active = isGridActive(grid, now);
  if (active === "not_valid_yet") return { status: "not_valid_yet", message: `La grille « ${grid.name} » (v${grid.version}) n'est pas encore en vigueur.` };
  if (active === "expired") return { status: "expired", message: `La grille « ${grid.name} » (v${grid.version}) a expiré.` };
  const axes: Array<[string, number, { min: number; max: number; step: number }]> = [["Largeur", q.widthMm, grid.widthMm], ["Longueur", q.lengthMm, grid.lengthMm], ["Hauteur", q.heightMm, grid.heightMm]];
  for (const [label, v, r] of axes) {
    if (!Number.isInteger(v) || v < r.min || v > r.max) return { status: "out_of_bounds", message: `${label} ${v} mm hors grille (${r.min}–${r.max} mm).` };
    if (r.step > 0 && (v - r.min) % r.step !== 0) return { status: "out_of_bounds", message: `${label} : pas de ${r.step} mm à partir de ${r.min} mm.` };
  }
  if (grid.mountings.length > 0 && !grid.mountings.includes(q.mounting)) return { status: "mounting_unavailable", message: "Implantation non couverte par la grille." };
  if (grid.finishCodes.length > 0 && !grid.finishCodes.includes(q.finishCode)) return { status: "finish_unavailable", message: "Finition non couverte par la grille." };
  const found = findCell(grid, q);
  if (found.status === "none") return { status: "no_cell", message: `Aucun tarif dans la grille pour ${q.widthMm} × ${q.lengthMm} mm (${q.mounting === "wall" ? "adossée" : "autoportée"}, ${q.finishCode}).` };
  if (found.status === "ambiguous") return { status: "ambiguous", message: "Plusieurs tarifs contradictoires couvrent cette dimension : grille à corriger." };
  const baseCents = found.cell.priceCents;
  const lines: GridPriceLine[] = [];
  for (const s of grid.surcharges) {
    const a = applySurcharge(s, q, baseCents);
    if (a && (a.cents !== 0 || s.kind === "side_closure" || s.kind === "option")) lines.push({ code: s.code, label: s.label, cents: a.cents, qty: a.qty });
  }
  // fermetures / options demandées sans supplément défini : hors grille (à chiffrer)
  const unpriced: string[] = [];
  for (const slug of q.closureSlugs ?? []) if (!grid.surcharges.some((s) => s.kind === "side_closure" && (s.match === "*" || s.match === slug))) unpriced.push(`closure:${slug}`);
  for (const o of q.options ?? []) if (!grid.surcharges.some((s) => s.kind === "option" && (s.match === "*" || s.match === o.familySlug))) unpriced.push(`option:${o.familySlug}`);
  const totalCents = baseCents + lines.reduce((sum, l) => sum + l.cents * l.qty, 0);
  return { status: "priced", baseCents, lines, totalCents, cell: found.cell, unpriced };
}

/* ------------------------------------------------------------------ */
/* Validation d'une grille                                              */
/* ------------------------------------------------------------------ */

export interface GridValidation {
  errors: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  /** zones sans tarif (par implantation × finition) */
  gaps: Array<{ mounting: string; finishCode: string; widthMm: [number, number]; lengthMm: [number, number] }>;
  /** zones ambiguës */
  overlaps: Array<{ mounting: string; finishCode: string; widthMm: [number, number]; lengthMm: [number, number]; prices: Cents[] }>;
  coverage: number; // 0..1
}

function breakpoints(values: number[], min: number, max: number): Array<[number, number]> {
  const pts = [...new Set([min, max + 1, ...values.filter((v) => v >= min && v <= max + 1)])].sort((a, b) => a - b);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pts.length - 1; i += 1) out.push([pts[i]!, pts[i + 1]! - 1]);
  return out;
}

export function validateGrid(grid: PriceGridSnapshot): GridValidation {
  const errors: GridValidation["errors"] = [];
  const warnings: GridValidation["warnings"] = [];
  for (const [label, r] of [["largeur", grid.widthMm], ["longueur", grid.lengthMm], ["hauteur", grid.heightMm]] as const) {
    if (!(r.step > 0)) errors.push({ code: "step_invalid", message: `Pas de ${label} invalide (${r.step}).` });
    if (!(r.min < r.max)) errors.push({ code: "bounds_invalid", message: `Bornes de ${label} invalides (${r.min}–${r.max}).` });
    if (r.min <= 0) errors.push({ code: "unit_suspect", message: `${label} minimale ${r.min} : unité attendue en millimètres.` });
    if (r.max < 500) warnings.push({ code: "unit_suspect", message: `${label} maximale ${r.max} mm : valeur suspecte (unité en cm ou m ?).` });
  }
  if (grid.cells.length === 0) errors.push({ code: "no_cells", message: "La grille ne contient aucune cellule de prix." });
  const seen = new Set<string>();
  grid.cells.forEach((c, i) => {
    const key = `${c.widthMinMm}-${c.widthMaxMm}-${c.lengthMinMm}-${c.lengthMaxMm}-${c.mounting}-${c.finishCode}`;
    if (seen.has(key)) errors.push({ code: "duplicate", message: `Cellule ${i + 1} en double (${key}).` });
    seen.add(key);
    if (c.widthMinMm > c.widthMaxMm || c.lengthMinMm > c.lengthMaxMm) errors.push({ code: "cell_bounds", message: `Cellule ${i + 1} : bornes inversées.` });
    if (c.priceCents <= 0) errors.push({ code: "price_invalid", message: `Cellule ${i + 1} : prix nul ou négatif.` });
    if (c.priceCents < 10_000) warnings.push({ code: "price_suspect", message: `Cellule ${i + 1} : prix ${c.priceCents} centimes — saisie en euros plutôt qu'en centimes ?` });
    if (c.widthMinMm < grid.widthMm.min || c.widthMaxMm > grid.widthMm.max || c.lengthMinMm < grid.lengthMm.min || c.lengthMaxMm > grid.lengthMm.max) warnings.push({ code: "cell_outside_bounds", message: `Cellule ${i + 1} dépasse les bornes de la grille.` });
    if (c.mounting !== "*" && grid.mountings.length && !grid.mountings.includes(c.mounting)) warnings.push({ code: "cell_mounting", message: `Cellule ${i + 1} : implantation ${c.mounting} non listée.` });
    if (c.finishCode !== "*" && grid.finishCodes.length && !grid.finishCodes.includes(c.finishCode)) warnings.push({ code: "cell_finish", message: `Cellule ${i + 1} : finition ${c.finishCode} non listée.` });
  });
  const gaps: GridValidation["gaps"] = [];
  const overlaps: GridValidation["overlaps"] = [];
  const mountings: Mounting[] = grid.mountings.length ? grid.mountings : ["freestanding", "wall"];
  const finishes = grid.finishCodes.length ? grid.finishCodes : ["*"];
  const wRanges = breakpoints(grid.cells.flatMap((c) => [c.widthMinMm, c.widthMaxMm + 1]), grid.widthMm.min, grid.widthMm.max);
  const lRanges = breakpoints(grid.cells.flatMap((c) => [c.lengthMinMm, c.lengthMaxMm + 1]), grid.lengthMm.min, grid.lengthMm.max);
  let covered = 0, total = 0;
  for (const m of mountings) for (const f of finishes) for (const w of wRanges) for (const l of lRanges) {
    total += 1;
    const r = findCell(grid, { widthMm: w[0], lengthMm: l[0], mounting: m, finishCode: f });
    if (r.status === "none") gaps.push({ mounting: m, finishCode: f, widthMm: w, lengthMm: l });
    else if (r.status === "ambiguous") overlaps.push({ mounting: m, finishCode: f, widthMm: w, lengthMm: l, prices: r.cells.map((c) => c.priceCents) });
    else covered += 1;
  }
  if (overlaps.length) errors.push({ code: "overlap", message: `${overlaps.length} zone(s) couverte(s) par des tarifs contradictoires.` });
  if (gaps.length) warnings.push({ code: "gaps", message: `${gaps.length} zone(s) sans tarif : ces dimensions passeront en devis.` });
  for (const s of grid.surcharges) {
    if (!s.code || !s.label) errors.push({ code: "surcharge_invalid", message: "Supplément sans code ou libellé." });
    if (s.kind === "height_above" && (s.thresholdMm == null || s.thresholdMm <= 0)) errors.push({ code: "surcharge_threshold", message: `Supplément ${s.code} : seuil de hauteur manquant.` });
    if (s.kind === "percent" && (s.percentBps < -5000 || s.percentBps > 10000)) errors.push({ code: "surcharge_percent", message: `Supplément ${s.code} : pourcentage hors limites.` });
  }
  return { errors, warnings, gaps, overlaps, coverage: total ? covered / total : 0 };
}

/** Grille publiée et active pour une famille. */
export function activeGridFor(grids: PriceGridSnapshot[] | undefined, familySlug: string, now: Date): PriceGridSnapshot | undefined {
  return (grids ?? []).filter((g) => g.familySlug === familySlug && isGridActive(g, now) === "active").sort((a, b) => b.version - a.version)[0];
}
