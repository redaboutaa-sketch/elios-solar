/**
 * Mesure commerciale par origine — pur, sans accès base.
 *
 * Chaîne suivie : origine (utm, référent, page d'entrée) → demande enregistrée côté serveur → qualification → devis
 * accepté (gagné) ou refusé/expiré (perdu) → montant HT encaissé. Un montant absent reste « non renseigné » : il n'est
 * jamais compté comme 0. Aucune marge n'est calculée (aucun coût de revient fiable).
 */
import type { Attribution } from "./attribution";

export interface AcquisitionQuote {
  attribution: unknown;
  qualification: string;
  status: string;
  cashedNetCents: number | null;
}

export interface AcquisitionRow {
  key: string;
  requests: number;
  qualified: number;
  notQualified: number;
  won: number;
  lost: number;
  /** devis gagnés dont le montant encaissé est saisi */
  cashedKnown: number;
  /** somme des montants saisis ; null si aucun n'est saisi */
  cashedNetCents: number | null;
}

const WON = new Set(["ACCEPTED"]);
const LOST = new Set(["DECLINED", "EXPIRED"]);

const asAttribution = (a: unknown): Attribution | null => (a && typeof a === "object" ? (a as Attribution) : null);

/** Origine lisible : « source / support » si des utm existent, sinon le référent, sinon « direct ou non renseigné ». */
export function sourceOf(raw: unknown): string {
  const a = asAttribution(raw);
  const p = a?.params ?? {};
  if (p.utm_source || p.utm_medium) return [p.utm_source ?? "?", p.utm_medium ?? "?"].join(" / ");
  if (p.gclid) return "google / cpc (gclid)";
  if (p.fbclid) return "facebook / (fbclid)";
  if (a?.referrerHost) return `${a.referrerHost} / référent`;
  return "direct ou non renseigné";
}

export const campaignOf = (raw: unknown): string => asAttribution(raw)?.params?.utm_campaign ?? "non renseignée";
export const landingOf = (raw: unknown): string => asAttribution(raw)?.landingPath ?? "non renseignée";

export function aggregate(quotes: AcquisitionQuote[], keyOf: (q: AcquisitionQuote) => string): AcquisitionRow[] {
  const rows = new Map<string, AcquisitionRow>();
  for (const q of quotes) {
    const key = keyOf(q);
    const r = rows.get(key) ?? { key, requests: 0, qualified: 0, notQualified: 0, won: 0, lost: 0, cashedKnown: 0, cashedNetCents: null };
    r.requests += 1;
    if (q.qualification === "QUALIFIED") r.qualified += 1;
    if (q.qualification === "NOT_QUALIFIED") r.notQualified += 1;
    if (WON.has(q.status)) {
      r.won += 1;
      if (q.cashedNetCents != null) { r.cashedKnown += 1; r.cashedNetCents = (r.cashedNetCents ?? 0) + q.cashedNetCents; }
    }
    if (LOST.has(q.status)) r.lost += 1;
    rows.set(key, r);
  }
  return [...rows.values()].sort((a, b) => b.requests - a.requests || a.key.localeCompare(b.key));
}

/** Taux en pourcentage, ou null si le dénominateur est nul (affiché « non calculable »). */
export const rate = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

/** Ligne CSV (séparateur « ; », guillemets doublés) ; protège contre l'injection de formule dans un tableur. */
export function csvLine(cells: Array<string | number | null>): string {
  return cells.map((c) => {
    if (c == null) return "";
    let s = String(c);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(";");
}
