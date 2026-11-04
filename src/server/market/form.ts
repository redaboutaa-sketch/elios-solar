/** Paramètres d'URL de la page Comparatif marché → saisie d'étude (partagé par la page, l'export et les actions). */
import { DIRECT_COST_KEYS, SCOPE_KEYS, type DirectCostInput, type ScopeKey } from "@/domain/market";
import type { SystemMounting } from "@/domain/system";
import type { StudyInput } from "./study";

const euros = (s: string | null): number | null => {
  const t = (s ?? "").replace(/[\s  €]/g, "").replace(",", ".");
  return /^\d{1,9}(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : null;
};
const pct = (s: string | null): number | null => {
  const t = (s ?? "").replace(/[\s %]/g, "").replace(",", ".");
  return /^\d{1,2}(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : null;
};

/** Coûts directs saisis pour cette simulation (absents → ceux de la politique). */
export function costsFrom(q: URLSearchParams): DirectCostInput[] | null {
  if (q.get("couts") !== "1") return null;
  return DIRECT_COST_KEYS.map((key) => {
    const status = (["known", "unknown", "na"].includes(q.get(`c_${key}_s`) ?? "") ? q.get(`c_${key}_s`) : "unknown") as DirectCostInput["status"];
    const mode = q.get(`c_${key}_m`) === "percent" ? "percent" : "fixed";
    const base = (["sale_ht", "sale_ttc", "gross_margin"].includes(q.get(`c_${key}_b`) ?? "") ? q.get(`c_${key}_b`) : "sale_ht") as DirectCostInput["base"];
    const v = q.get(`c_${key}_v`);
    const amount = mode === "fixed" ? euros(v) : null;
    const percent = mode === "percent" ? pct(v) : null;
    // une valeur illisible ne devient jamais zéro : coût inconnu
    const known = status === "known" && (mode === "fixed" ? amount != null : percent != null);
    return { key, status: status === "known" && !known ? "unknown" : status, mode, ...(mode === "fixed" ? { amountMinor: amount } : { percentBps: percent, base }), billedToClient: q.get(`c_${key}_f`) === "1" };
  });
}

export function studyInputFrom(q: URLSearchParams): StudyInput | null {
  const familySlug = q.get("produit") ?? "";
  const w = Number(q.get("largeur"));
  const d = Number(q.get("cote"));
  if (!/^[a-z0-9-]{2,64}$/.test(familySlug) || !Number.isInteger(w) || !Number.isInteger(d) || w <= 0 || d <= 0) return null;
  const ours: Partial<Record<ScopeKey, "included" | "extra" | "absent">> = {};
  for (const k of SCOPE_KEYS) { const v = q.get(`p_${k}`); if (v === "included" || v === "extra" || v === "absent") ours[k] = v; }
  return {
    familySlug, mounting: (q.get("pose") || "freestanding") as SystemMounting, widthMm: w, dimMm: d,
    finishCode: q.get("teinte") || null, controlCode: q.get("commande") || null, options: q.getAll("option").filter((o) => /^[\w:.-]{1,80}(=[\w.-]{1,40})?$/.test(o)),
    country: /^[A-Z]{2}$/.test(q.get("pays") ?? "") ? q.get("pays")! : "FR", includeStale: q.get("anciens") === "1",
    costs: costsFrom(q), ours, saleVersionId: /^[\w-]{1,64}$/.test(q.get("version") ?? "") ? q.get("version") : null, simulatedHtMinor: euros(q.get("simule")), premiumJustification: q.get("premium") || null,
  };
}
