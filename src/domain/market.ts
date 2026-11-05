/**
 * Comparatif marché (administration, interne) : coût d'achat net, marges, contribution, comparables et
 * recommandation de prix. Fonctions pures, montants en centimes entiers. Aucun de ces calculs n'alimente le site :
 * le prix public reste lu dans la grille de vente publiée (src/server/pricing/system-prices.ts).
 *
 * Ordre des calculs (liste de prix 09.2026, § 1 et § 4 de docs/pricing/catalogue-2026-09.md) :
 *   1. structure (cellule de la grille catalogue) éligible → achat net = catalogue × (1 − remise) ;
 *   2. supplément en pourcentage → « % du prix du système après application de la remise » : appliqué au prix NET de
 *      la structure, jamais remisé une seconde fois ;
 *   3. montant fixe ou tableau (moteur, LED, poteau, centrale…) : remise appliquée seulement si le poste est déclaré
 *      éligible ; non éligible → prix catalogue ; éligibilité inconnue → coût non établi (hypothèse prudente : prix
 *      catalogue sans remise, signalée) ;
 *   4. élément « à chiffrer » sans montant → coût manquant.
 */
import { applyBpsHalfUp, type PriceBreakdown, type PriceSupplement } from "./system-pricing";

export type Eligibility = "ELIGIBLE" | "NOT_ELIGIBLE" | "UNKNOWN";

export interface CostPolicy {
  /** remise revendeur sur le prix catalogue éligible, points de base (3700 = 37 %) */
  discountBps: number;
  /** éligibilité par poste : « structure » et « supplement:<code> » ; absent = inconnu (structure : éligible) */
  eligibility: Record<string, Eligibility>;
}

export type CostBasis = "eligible" | "percent_after_discount" | "not_eligible" | "unknown" | "pending";

export interface CostLine {
  code: string;
  label: string;
  /** montant au prix catalogue fournisseur HT */
  catalogueMinor: number | null;
  /** coût d'achat net HT établi ; null = non établi */
  netMinor: number | null;
  /** hypothèse prudente quand le coût n'est pas établi : prix catalogue sans remise */
  prudentMinor: number | null;
  basis: CostBasis;
  note: string;
}

export interface NetCost {
  lines: CostLine[];
  /** somme des coûts établis */
  knownNetMinor: number;
  /** coût prudent : établis + postes inconnus au prix catalogue sans remise (hors éléments sans montant) */
  prudentNetMinor: number;
  catalogueMinor: number;
  /** postes à éligibilité inconnue (coût non établi) */
  unknown: CostLine[];
  /** éléments à chiffrer sans montant (coût manquant) */
  missing: CostLine[];
  partial: boolean;
}

export const BASIS_FR: Record<CostBasis, string> = {
  eligible: "remise revendeur appliquée",
  percent_after_discount: "pourcentage appliqué au prix de la structure après remise (ordre du catalogue)",
  not_eligible: "non remisé (prix catalogue)",
  unknown: "éligibilité à la remise inconnue : coût non établi",
  pending: "à chiffrer : coût manquant",
};

export const discountedMinor = (catalogueMinor: number, discountBps: number) => catalogueMinor - applyBpsHalfUp(catalogueMinor, discountBps);

/**
 * Coût d'achat net d'une configuration, poste par poste, depuis la décomposition au prix catalogue fournisseur (même
 * moteur que la boutique) et les suppléments de la grille catalogue.
 */
export function netCostOf(catalogue: PriceBreakdown, supplements: PriceSupplement[], policy: CostPolicy): NetCost {
  if (!Number.isInteger(policy.discountBps) || policy.discountBps < 0 || policy.discountBps >= 10_000) throw new Error("Remise invalide (0 à 99,99 %).");
  const byCode = new Map(supplements.map((s) => [s.code, s]));
  const structure = catalogue.lines.find((l) => l.code === "structure");
  const structureElig = policy.eligibility.structure ?? "ELIGIBLE";
  const structureNet = structure && structureElig === "ELIGIBLE" ? discountedMinor(structure.amountMinor, policy.discountBps) : structure && structureElig === "NOT_ELIGIBLE" ? structure.amountMinor : null;
  const lines: CostLine[] = catalogue.lines.map((l) => {
    if (l.code === "structure") {
      return structureElig === "ELIGIBLE"
        ? { code: l.code, label: l.label, catalogueMinor: l.amountMinor, netMinor: structureNet, prudentMinor: structureNet, basis: "eligible", note: `catalogue − ${(policy.discountBps / 100).toLocaleString("fr-FR")} %` }
        : structureElig === "NOT_ELIGIBLE"
          ? { code: l.code, label: l.label, catalogueMinor: l.amountMinor, netMinor: l.amountMinor, prudentMinor: l.amountMinor, basis: "not_eligible", note: "structure déclarée non remisée" }
          : { code: l.code, label: l.label, catalogueMinor: l.amountMinor, netMinor: null, prudentMinor: l.amountMinor, basis: "unknown", note: "hypothèse prudente : prix catalogue sans remise" };
    }
    const s = byCode.get(l.code);
    if (s?.mode === "percent" && s.percentBps != null) {
      // assiette documentée : prix du système APRÈS remise ; jamais de seconde remise sur ce montant
      if (structureNet == null) return { code: l.code, label: l.label, catalogueMinor: l.amountMinor, netMinor: null, prudentMinor: l.amountMinor, basis: "unknown", note: "assiette (structure nette) non établie" };
      const net = applyBpsHalfUp(structureNet, s.percentBps);
      return { code: l.code, label: l.label, catalogueMinor: l.amountMinor, netMinor: net, prudentMinor: net, basis: "percent_after_discount", note: `${(s.percentBps / 100).toLocaleString("fr-FR")} % de la structure nette` };
    }
    const e = policy.eligibility[`supplement:${l.code}`] ?? "UNKNOWN";
    if (e === "ELIGIBLE") { const net = discountedMinor(l.amountMinor, policy.discountBps); return { code: l.code, label: l.label, catalogueMinor: l.amountMinor, netMinor: net, prudentMinor: net, basis: "eligible", note: "poste déclaré éligible" }; }
    if (e === "NOT_ELIGIBLE") return { code: l.code, label: l.label, catalogueMinor: l.amountMinor, netMinor: l.amountMinor, prudentMinor: l.amountMinor, basis: "not_eligible", note: "poste déclaré non remisé" };
    return { code: l.code, label: l.label, catalogueMinor: l.amountMinor, netMinor: null, prudentMinor: l.amountMinor, basis: "unknown", note: "éligibilité inconnue : remise non appliquée ; hypothèse prudente au prix catalogue" };
  });
  for (const p of catalogue.pending) lines.push({ code: p.code, label: p.label, catalogueMinor: null, netMinor: null, prudentMinor: null, basis: "pending", note: p.reason });
  const sum = (xs: Array<number | null>) => xs.reduce<number>((a, x) => a + (x ?? 0), 0);
  const unknown = lines.filter((l) => l.basis === "unknown");
  const missing = lines.filter((l) => l.basis === "pending");
  return { lines, knownNetMinor: sum(lines.map((l) => l.netMinor)), prudentNetMinor: sum(lines.map((l) => l.prudentMinor)), catalogueMinor: sum(lines.map((l) => l.catalogueMinor)), unknown, missing, partial: unknown.length > 0 || missing.length > 0 };
}

/* ------------------------------------------------------------------ */
/* Marges                                                               */
/* ------------------------------------------------------------------ */

export interface Margin {
  grossMinor: number;
  /** marge brute / vente HT (points de base) ; null si vente nulle */
  onPriceBps: number | null;
  /** marge brute / achat net HT (taux de marge sur coût) ; null si coût nul */
  onCostBps: number | null;
}

export function marginOf(saleHtMinor: number, costMinor: number): Margin {
  const grossMinor = saleHtMinor - costMinor;
  return { grossMinor, onPriceBps: saleHtMinor > 0 ? Math.round((grossMinor * 10_000) / saleHtMinor) : null, onCostBps: costMinor > 0 ? Math.round((grossMinor * 10_000) / costMinor) : null };
}

/* ------------------------------------------------------------------ */
/* Coûts directs et contribution                                        */
/* ------------------------------------------------------------------ */

export const DIRECT_COST_KEYS = ["transport", "pose", "paiement", "acquisition", "sav", "commission"] as const;
export type DirectCostKey = (typeof DIRECT_COST_KEYS)[number];
export const DIRECT_COST_FR: Record<DirectCostKey, string> = { transport: "Transport / livraison", pose: "Pose", paiement: "Frais de paiement", acquisition: "Acquisition (marketing)", sav: "Provision SAV", commission: "Commission Beaver Data" };

/** Assiette d'un coût en pourcentage. */
export type CostBase = "sale_ht" | "sale_ttc" | "gross_margin";
export const COST_BASE_FR: Record<CostBase, string> = { sale_ht: "prix de vente HT du produit", sale_ttc: "montant TTC encaissé", gross_margin: "marge brute produit" };

export interface DirectCostInput {
  key: DirectCostKey;
  /** unknown = coût inconnu (jamais zéro) ; na = sans objet (ex. commission non applicable) */
  status: "known" | "unknown" | "na";
  mode: "fixed" | "percent";
  amountMinor?: number | null;
  percentBps?: number | null;
  base?: CostBase;
  /** facturé au client (refacturé à part, ex. livraison au devis) : hors contribution du produit, signalé */
  billedToClient?: boolean;
  note?: string;
}

export interface DirectCostLine extends DirectCostInput { label: string; computedMinor: number | null; included: boolean; explanation: string }

export interface Contribution {
  costs: DirectCostLine[];
  /** coûts à notre charge établis */
  chargedMinor: number;
  /** marge brute − coûts à notre charge établis */
  contributionMinor: number;
  onPriceBps: number | null;
  /** au moins un coût inconnu ou un coût d'achat non établi : contribution partielle (jamais un « bénéfice net ») */
  partial: boolean;
  missing: string[];
}

export function costAmount(c: DirectCostInput, saleHtMinor: number, saleTtcMinor: number, grossMinor: number): number | null {
  if (c.status !== "known") return null;
  if (c.mode === "fixed") return c.amountMinor ?? null;
  if (c.percentBps == null) return null;
  const base = c.base === "sale_ttc" ? saleTtcMinor : c.base === "gross_margin" ? Math.max(0, grossMinor) : saleHtMinor;
  return applyBpsHalfUp(base, c.percentBps);
}

export function contributionOf(saleHtMinor: number, saleTtcMinor: number, cost: { netMinor: number; partial: boolean }, costs: DirectCostInput[]): Contribution {
  const gross = saleHtMinor - cost.netMinor;
  const lines: DirectCostLine[] = DIRECT_COST_KEYS.map((key) => {
    const c = costs.find((x) => x.key === key) ?? { key, status: "unknown" as const, mode: "fixed" as const };
    const computed = costAmount(c, saleHtMinor, saleTtcMinor, gross);
    const included = c.status === "known" && !c.billedToClient && computed != null;
    const explanation = c.status === "na" ? "sans objet" : c.status === "unknown" ? "inconnu : non compté comme zéro, contribution partielle" : c.billedToClient ? "facturé au client à part : hors contribution du produit" : c.mode === "percent" ? `${((c.percentBps ?? 0) / 100).toLocaleString("fr-FR")} % du ${COST_BASE_FR[c.base ?? "sale_ht"]}` : "montant fixe à notre charge";
    return { ...c, label: DIRECT_COST_FR[key], computedMinor: computed, included, explanation };
  });
  const charged = lines.filter((l) => l.included).reduce((a, l) => a + l.computedMinor!, 0);
  const missing = [...(cost.partial ? ["coût d'achat non établi pour certains postes"] : []), ...lines.filter((l) => l.status === "unknown").map((l) => l.label)];
  const contribution = gross - charged;
  return { costs: lines, chargedMinor: charged, contributionMinor: contribution, onPriceBps: saleHtMinor > 0 ? Math.round((contribution * 10_000) / saleHtMinor) : null, partial: missing.length > 0, missing };
}

/* ------------------------------------------------------------------ */
/* Plancher                                                             */
/* ------------------------------------------------------------------ */

export interface FloorResult {
  /** prix HT minimal respectant l'objectif ; null si l'objectif n'est pas défini ou inatteignable */
  floorHtMinor: number | null;
  objective: "margin" | "contribution" | null;
  targetBps: number | null;
  reason: string;
  /** coûts pris en compte et coûts manquants */
  counted: string[];
  missing: string[];
}

/**
 * Plancher : plus petit prix HT p tel que l'objectif soit atteint.
 * - objectif de marge brute (% du prix) : (p − coût) / p ≥ t → p = coût / (1 − t) ;
 * - objectif de contribution : (p − coût − fixes − Σ%HT·p − Σ%TTC·p·(1+TVA) − Σ%marge·(p − coût)) / p ≥ t.
 * Le coût retenu est le coût prudent (postes inconnus au prix catalogue, signalés). Arrondi au centime supérieur.
 */
export function floorPrice(p: { costMinor: number; costPartial: boolean; costMissing: string[]; vatRateBps: number; costs: DirectCostInput[]; marginTargetBps: number | null; contributionTargetBps: number | null }): FloorResult {
  const objective = p.contributionTargetBps != null ? "contribution" : p.marginTargetBps != null ? "margin" : null;
  const t = objective === "contribution" ? p.contributionTargetBps! : objective === "margin" ? p.marginTargetBps! : null;
  const counted = ["coût d'achat net (hypothèse prudente pour les postes à éligibilité inconnue)"];
  const missing = [...p.costMissing];
  if (t == null) return { floorHtMinor: null, objective: null, targetBps: null, reason: "Objectif de marge ou de contribution non défini : fixez-le dans la politique de coût", counted, missing };
  if (t < 0 || t >= 10_000) return { floorHtMinor: null, objective, targetBps: t, reason: "Objectif invalide.", counted, missing };
  // coefficients en 1/10 000 du prix HT
  let pct = t;
  let fixed = 0;
  let marginPct = 0;
  if (objective === "contribution") {
    for (const c of p.costs) {
      const label = DIRECT_COST_FR[c.key];
      if (c.status === "unknown") { missing.push(label); continue; }
      if (c.status === "na" || c.billedToClient) continue;
      if (c.mode === "fixed") { if (c.amountMinor != null) { fixed += c.amountMinor; counted.push(label); } else missing.push(label); continue; }
      if (c.percentBps == null) { missing.push(label); continue; }
      counted.push(label);
      if (c.base === "sale_ttc") pct += (c.percentBps * (10_000 + p.vatRateBps)) / 10_000;
      else if (c.base === "gross_margin") marginPct += c.percentBps;
      else pct += c.percentBps;
    }
  }
  // p·(1 − pct) − m·(p − coût) ≥ coût + fixes  →  p·(1 − pct − m) ≥ coût·(1 − m) + fixes
  const den = 10_000 - pct - marginPct;
  if (den <= 0) return { floorHtMinor: null, objective, targetBps: t, reason: "Objectif inatteignable avec ces coûts proportionnels.", counted, missing };
  const num = (p.costMinor * (10_000 - marginPct)) + fixed * 10_000;
  const floor = Math.ceil(num / den);
  return { floorHtMinor: floor, objective, targetBps: t, reason: objective === "margin" ? "marge brute visée sur le prix de vente HT" : "contribution visée après les coûts directs renseignés", counted, missing };
}

/* ------------------------------------------------------------------ */
/* Relevés concurrents                                                  */
/* ------------------------------------------------------------------ */

export const SCOPE_KEYS = ["delivery", "installation", "motor", "remote", "led", "screen", "glazing"] as const;
export type ScopeKey = (typeof SCOPE_KEYS)[number];
export const SCOPE_FR: Record<ScopeKey, string> = { delivery: "Livraison", installation: "Pose", motor: "Moteur", remote: "Télécommande", led: "Éclairage LED", screen: "Screen / store", glazing: "Vitrage / fermeture" };
export type ScopeStatus = "included" | "extra" | "absent" | "unknown";
export const SCOPE_STATUS_FR: Record<ScopeStatus, string> = { included: "inclus", extra: "en supplément", absent: "absent / non proposé", unknown: "inconnu" };
export interface ScopeItem { status: ScopeStatus; /** supplément vérifiable (centimes, même base fiscale que le prix) */ extraAmountMinor?: number | null; note?: string }
export type Scope = Partial<Record<ScopeKey, ScopeItem>>;

export type Comparability = "STRONG" | "PARTIAL" | "INSUFFICIENT";
export const COMPARABILITY_FR: Record<Comparability, string> = { STRONG: "forte", PARTIAL: "partielle", INSUFFICIENT: "insuffisante" };

export interface Observation {
  id: string;
  retailer: string;
  manufacturer: string;
  model: string;
  url: string;
  observedAt: Date;
  country: string;
  currency: string;
  familySlug: string;
  widthMm: number | null;
  depthMm: number | null;
  mounting: "freestanding" | "wall" | "unknown";
  priceMinor: number;
  taxBasis: "HT" | "TTC" | "UNKNOWN";
  priceKind: "configured" | "fixed_size" | "from";
  regularPriceMinor: number | null;
  promoPriceMinor: number | null;
  promoEnd: Date | null;
  scope: Scope;
  comparability: Comparability;
  status: "ACTIVE" | "ARCHIVED";
}

export interface StudyContext {
  familySlug: string;
  widthMm: number;
  depthMm: number;
  mounting: string;
  country: string;
  /** TVA validée du marché étudié (FR : 20 %) ; null = TVA non validée (prix TTC non convertis) */
  vatRateBps: number | null;
  /** périmètre de notre configuration */
  ours: Record<ScopeKey, "included" | "extra" | "absent">;
  now: Date;
  staleDays: number;
  /** tolérance par côté, points de base (1000 = 10 %) */
  dimToleranceBps: number;
  includeStale?: boolean;
}

export interface ObservationEval {
  obs: Observation;
  /** prix de référence HT normalisé au périmètre de notre configuration ; null = non comparable en l'état */
  comparableHtMinor: number | null;
  /** prix retenu avant normalisation (normal si promotion), HT */
  baseHtMinor: number | null;
  retained: boolean;
  stale: boolean;
  gaps: Array<{ key: ScopeKey; ours: string; theirs: ScopeStatus; normalizedMinor: number | null; note: string }>;
  reasons: string[];
  dimsMatch: "exact" | "close" | "swapped" | "no";
}

const within = (a: number, b: number, bps: number) => Math.abs(a - b) * 10_000 <= b * bps;

export function evaluateObservation(o: Observation, ctx: StudyContext): ObservationEval {
  const reasons: string[] = [];
  const ageDays = Math.floor((ctx.now.getTime() - o.observedAt.getTime()) / 86_400_000);
  const stale = ageDays > ctx.staleDays;
  if (o.status !== "ACTIVE") reasons.push("relevé archivé");
  if (o.familySlug !== ctx.familySlug) reasons.push("autre produit de référence");
  if (o.country !== ctx.country) reasons.push(`autre marché (${o.country})`);
  if (o.currency !== "EUR") reasons.push(`devise ${o.currency}`);
  if (stale && !ctx.includeStale) reasons.push(`relevé ancien (${ageDays} j > ${ctx.staleDays} j)`);
  if (o.comparability !== "STRONG") reasons.push(`comparabilité ${COMPARABILITY_FR[o.comparability]}`);
  if (o.priceKind === "from") reasons.push("prix « à partir de » : ne pilote pas la recommandation");
  // dimensions : aucune normalisation au m² (écart non vérifiable)
  let dimsMatch: ObservationEval["dimsMatch"] = "no";
  if (o.widthMm != null && o.depthMm != null) {
    if (o.widthMm === ctx.widthMm && o.depthMm === ctx.depthMm) dimsMatch = "exact";
    else if (within(o.widthMm, ctx.widthMm, ctx.dimToleranceBps) && within(o.depthMm, ctx.depthMm, ctx.dimToleranceBps)) dimsMatch = "close";
    else if (within(o.widthMm, ctx.depthMm, ctx.dimToleranceBps) && within(o.depthMm, ctx.widthMm, ctx.dimToleranceBps)) dimsMatch = "swapped";
  }
  if (dimsMatch === "no") reasons.push("dimensions trop éloignées ou non indiquées (aucune normalisation au m²)");
  if (o.mounting !== "unknown" && ctx.mounting !== o.mounting) reasons.push("implantation différente");
  if (o.mounting === "unknown") reasons.push("implantation non indiquée");
  // prix de base : prix normal si une promotion temporaire est affichée avec son prix normal ; promotion seule écartée
  let base: number | null = o.regularPriceMinor ?? o.priceMinor;
  if (o.promoPriceMinor != null && o.regularPriceMinor == null && o.promoPriceMinor === o.priceMinor) { reasons.push("prix promotionnel sans prix normal vérifiable"); base = null; }
  const toHt = (m: number | null) => (m == null ? null : o.taxBasis === "HT" ? m : o.taxBasis === "TTC" && ctx.vatRateBps != null ? Math.round((m * 10_000) / (10_000 + ctx.vatRateBps)) : null);
  if (o.taxBasis === "UNKNOWN") reasons.push("HT/TTC non établi");
  else if (o.taxBasis === "TTC" && ctx.vatRateBps == null) reasons.push("TVA du marché non validée : prix TTC non converti");
  const baseHt = toHt(base);
  // périmètre : un écart n'est normalisé que si son montant est vérifiable
  const gaps: ObservationEval["gaps"] = [];
  let adjust = 0;
  let gapOpen = false;
  for (const key of SCOPE_KEYS) {
    const ours = ctx.ours[key];
    const it = o.scope[key] ?? { status: "unknown" as const };
    const theirs = it.status;
    const same = (ours === "included" && theirs === "included") || (ours !== "included" && (theirs === "extra" || theirs === "absent"));
    if (same) continue;
    if (ours === "included" && theirs === "extra" && it.extraAmountMinor != null) {
      const add = toHt(it.extraAmountMinor);
      if (add != null) { adjust += add; gaps.push({ key, ours, theirs, normalizedMinor: add, note: "supplément vérifiable ajouté au prix concurrent" }); continue; }
    }
    gapOpen = true;
    gaps.push({ key, ours, theirs, normalizedMinor: null, note: theirs === "unknown" ? "périmètre concurrent inconnu" : ours === "included" ? "compris chez nous, absent ou non chiffré chez le concurrent" : "compris chez le concurrent, montant non vérifiable" });
  }
  if (gapOpen) reasons.push("périmètre différent non normalisable : offre présentée séparément");
  const comparable = baseHt != null && !gapOpen ? baseHt + adjust : null;
  return { obs: o, baseHtMinor: baseHt, comparableHtMinor: comparable, retained: reasons.length === 0 && comparable != null, stale, gaps, reasons, dimsMatch };
}

export interface MarketStats {
  n: number;
  independent: number;
  minMinor: number | null;
  maxMinor: number | null;
  medianMinor: number | null;
  q1Minor: number | null;
  q3Minor: number | null;
  dates: { from: Date | null; to: Date | null };
}

/** Quantile par interpolation linéaire (méthode « type 7 »), arrondi au centime. */
export function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return Math.round(sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo));
}

export function marketStats(evals: ObservationEval[]): MarketStats {
  const kept = evals.filter((e) => e.retained);
  const prices = kept.map((e) => e.comparableHtMinor!).sort((a, b) => a - b);
  // indépendance : un fabricant (ou, à défaut, un revendeur) compte une fois
  const independent = new Set(kept.map((e) => (e.obs.manufacturer || e.obs.retailer).trim().toLowerCase())).size;
  const dates = kept.map((e) => e.obs.observedAt.getTime());
  return { n: prices.length, independent, minMinor: prices[0] ?? null, maxMinor: prices.at(-1) ?? null, medianMinor: quantile(prices, 0.5), q1Minor: quantile(prices, 0.25), q3Minor: quantile(prices, 0.75), dates: { from: dates.length ? new Date(Math.min(...dates)) : null, to: dates.length ? new Date(Math.max(...dates)) : null } };
}

/* ------------------------------------------------------------------ */
/* Recommandation                                                       */
/* ------------------------------------------------------------------ */

export interface RoundingRule {
  /** pas d'arrondi en centimes (1000 = 10 €) */
  stepMinor: number;
  /** base de l'arrondi : prix TTC affiché (par défaut) ou HT */
  basis: "TTC" | "HT";
}
export const DEFAULT_ROUNDING: RoundingRule = { stepMinor: 1000, basis: "TTC" };

export const roundingFr = (r: RoundingRule) => `au multiple de ${(r.stepMinor / 100).toLocaleString("fr-FR")} € ${r.basis} le plus proche, relevé au multiple supérieur s'il passait sous le plancher`;

/** Arrondit un prix HT selon la règle ; renvoie HT et TTC. Ne descend jamais sous le plancher. */
export function roundPrice(htMinor: number, vatRateBps: number, rule: RoundingRule, floorHtMinor: number | null): { htMinor: number; ttcMinor: number } {
  const step = Math.max(1, rule.stepMinor);
  const ttcOf = (ht: number) => ht + applyBpsHalfUp(ht, vatRateBps);
  // HT entier dont le TTC (HT + TVA arrondie) retombe exactement sur le montant visé, sinon le plus petit au-dessus
  const htOfTtc = (ttc: number) => {
    let ht = Math.floor((ttc * 10_000) / (10_000 + vatRateBps));
    while (ttcOf(ht) < ttc) ht++;
    return ht;
  };
  if (rule.basis === "HT") {
    let ht = Math.round(htMinor / step) * step;
    if (floorHtMinor != null && ht < floorHtMinor) ht = Math.ceil(floorHtMinor / step) * step;
    return { htMinor: ht, ttcMinor: ttcOf(ht) };
  }
  let ttc = Math.round(ttcOf(htMinor) / step) * step;
  let ht = htOfTtc(ttc);
  if (floorHtMinor != null && ht < floorHtMinor) { ttc = Math.ceil(ttcOf(floorHtMinor) / step) * step; ht = htOfTtc(ttc); }
  return { htMinor: ht, ttcMinor: ttcOf(ht) };
}

export type Confidence = "elevee" | "moyenne" | "indicative" | "simulation_interne";
export const CONFIDENCE_FR: Record<Confidence, string> = { elevee: "élevée", moyenne: "moyenne", indicative: "indicative (moins de trois offres fortement comparables et indépendantes)", simulation_interne: "simulation interne (aucun comparable exploitable : pas un prix de marché)" };

export interface Scenario {
  key: "competitive" | "aligned" | "premium";
  label: string;
  rule: string;
  htMinor: number | null;
  belowFloor: boolean;
  supported: boolean;
  note: string;
}

export interface Recommendation {
  confidence: Confidence;
  scenarios: Scenario[];
  /** prix conseillé (arrondi) ; null si aucun scénario n'est recommandable */
  recommended: { scenario: Scenario["key"]; htMinor: number; ttcMinor: number } | null;
  messages: string[];
  /** écart entre le marché observé (médiane) et le plancher, si le marché est sous le plancher */
  gapToFloorMinor: number | null;
}

export function recommend(p: { stats: MarketStats; floor: FloorResult; vatRateBps: number; rounding: RoundingRule; premiumJustification?: string | null }): Recommendation {
  const { stats, floor } = p;
  const messages: string[] = [];
  const confidence: Confidence = stats.n === 0 ? "simulation_interne" : stats.independent >= 5 && stats.n >= 5 ? "elevee" : stats.independent >= 3 ? "moyenne" : "indicative";
  const f = floor.floorHtMinor;
  const mk = (key: Scenario["key"], label: string, rule: string, ht: number | null, supported: boolean, note: string): Scenario => ({ key, label, rule, htMinor: ht, belowFloor: ht != null && f != null && ht < f, supported, note });
  const premiumOk = !!p.premiumJustification?.trim();
  const scenarios: Scenario[] = stats.n === 0
    ? [mk("competitive", "Compétitif", "premier quartile des offres retenues", null, false, "aucune offre retenue"), mk("aligned", "Aligné marché", "médiane des offres retenues", null, false, "aucune offre retenue"), mk("premium", "Premium", "troisième quartile des offres retenues", null, false, "aucune offre retenue")]
    : [
        mk("competitive", "Compétitif", "premier quartile des offres retenues", stats.q1Minor, true, ""),
        mk("aligned", "Aligné marché", "médiane des offres retenues", stats.medianMinor, true, ""),
        mk("premium", "Premium", "troisième quartile des offres retenues", stats.q3Minor, premiumOk, premiumOk ? `justification : ${p.premiumJustification!.trim()}` : "non étayé : aucune différence vérifiable renseignée"),
      ];
  for (const s of scenarios) if (s.belowFloor) s.note = [s.note, "sous le plancher : non recommandable"].filter(Boolean).join(" ; ");
  if (stats.n === 0) messages.push("Aucun comparable exploitable : simulation interne seulement, sans prix de marché.");
  if (f == null) messages.push(floor.reason);
  let gap: number | null = null;
  if (f != null && stats.medianMinor != null && stats.medianMinor < f) {
    gap = f - stats.medianMinor;
    messages.push("Le marché observé est sous le plancher : revoir les coûts, le périmètre ou le positionnement plutôt que forcer un prix.");
  }
  // prix conseillé : scénario aligné s'il respecte le plancher, sinon aucun (jamais sous le plancher)
  let recommended: Recommendation["recommended"] = null;
  const aligned = scenarios.find((s) => s.key === "aligned")!;
  if (f != null && aligned.htMinor != null && !aligned.belowFloor) {
    const r = roundPrice(aligned.htMinor, p.vatRateBps, p.rounding, f);
    recommended = { scenario: "aligned", ...r };
  }
  if (confidence === "indicative" && stats.n > 0) messages.push("Moins de trois offres fortement comparables et indépendantes : recommandation indicative.");
  return { confidence, scenarios, recommended, messages, gapToFloorMinor: gap };
}

/**
 * Valeur de cellule (structure) qui donne un total HT visé, les suppléments de la configuration étant inchangés :
 * total = cellule + Σ arrondi(%·cellule) + montants fixes. Recherche du centime le plus proche (sans dépasser si possible).
 */
export function cellForTotal(targetHtMinor: number, fixedMinor: number, percentBps: number[]): number {
  const total = (c: number) => c + percentBps.reduce((a, b) => a + applyBpsHalfUp(c, b), 0) + fixedMinor;
  const sumPct = percentBps.reduce((a, b) => a + b, 0);
  let c = Math.max(0, Math.round(((targetHtMinor - fixedMinor) * 10_000) / (10_000 + sumPct)));
  while (c > 0 && total(c) > targetHtMinor) c--;
  while (total(c + 1) <= targetHtMinor) c++;
  return c;
}
