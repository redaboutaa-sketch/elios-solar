/**
 * Benchmark marché par configuration précise (administration, interne) — fonctions pures, montants en centimes.
 *
 * Remplace le « retenu / non retenu » binaire par des niveaux explicites, gardés SÉPARÉS de la fraîcheur, de la
 * qualité de la preuve et de la complétude du prix :
 *   A — même système fournisseur (cité par la page), configuration comparable, périmètre connu ou ajustable ;
 *   B — équivalent technique : même catégorie et usage, cotes et équipements proches, différences explicites ;
 *   C — alternative commerciale : même besoin, différences importantes (contexte seulement) ;
 *   D — non exploitable : prix introuvable ou « à partir de », configuration non identifiable, données essentielles
 *       absentes, incohérence.
 * Le niveau retenu pour une configuration est le plus prudent entre le niveau proposé par l'analyste et le plafond
 * permis par les données (cotes, implantation, motorisation, périmètre) ; chaque déclassement est expliqué.
 *
 * Usage dans la recommandation :
 *   direct     → niveau A utilisable tel quel : pilote le prix conseillé ;
 *   indicative → niveau B, ou A avec une réserve (livré indissociable, promotion seule, prix local étranger…) :
 *                fourchette indicative ;
 *   context    → niveau C, relevé périmé, Royaume-Uni, pose comprise non chiffrée : affiché, jamais dans le calcul ;
 *   excluded   → niveau D.
 * Aucune normalisation au m², aucune déduction inventée, aucun équipement inconnu considéré inclus ou absent.
 */
import { applyBpsHalfUp, roundTtcTo99 } from "./system-pricing";

export type MatchLevel = "A" | "B" | "C" | "D";
export const LEVEL_FR: Record<MatchLevel, string> = { A: "A — même système", B: "B — équivalent technique", C: "C — alternative commerciale", D: "D — non exploitable" };
export type Usage = "direct" | "indicative" | "context" | "excluded";
export const USAGE_FR: Record<Usage, string> = { direct: "comparaison directe", indicative: "indicatif", context: "contexte seulement", excluded: "exclu" };

export const BENCH_SCOPE_KEYS = ["delivery", "installation", "motor", "remote", "led", "sensors", "screen", "glazing"] as const;
export type BenchScopeKey = (typeof BENCH_SCOPE_KEYS)[number];
export const BENCH_SCOPE_FR: Record<BenchScopeKey, string> = { delivery: "livraison", installation: "pose", motor: "moteur", remote: "télécommande", led: "éclairage LED", sensors: "capteurs", screen: "screen", glazing: "vitrage / fermeture" };
export type ScopeStatus = "included" | "extra" | "absent" | "unknown";
export interface BenchScopeItem { status: ScopeStatus; extraAmountMinor?: number | null; note?: string }

export type ControlKind = "manual" | "wired" | "radio" | "motor" | "unknown";
export const CONTROL_KIND_FR: Record<ControlKind, string> = { manual: "manuelle", wired: "motorisée filaire", radio: "motorisée radio", motor: "motorisée (commande non précisée)", unknown: "inconnue" };
const motorized = (k: ControlKind) => (k === "unknown" ? null : k !== "manual");

/** Taux normaux de TVA des marchés étudiés (points de base) — un TTC étranger est ramené au HT par SON taux. */
export const STANDARD_VAT_BPS: Record<string, number> = { FR: 2000, BE: 2100, DE: 1900, NL: 2100, ES: 2100, GB: 2000, PL: 2300, IT: 2200, LU: 1700, PT: 2300 };
/** Marchés directs (acheteur français ou belge) ; les autres pays de l'UE sont des prix locaux ; GB : groupe à part. */
export const DIRECT_MARKETS = ["FR", "BE"];
export const SEPARATE_MARKETS = ["GB"];

export interface BenchObservation {
  id: string;
  familySlug: string;
  retailer: string;
  sellerGroup: string;
  manufacturer: string;
  model: string;
  url: string;
  country: string;
  currency: string;
  observedAt: Date;
  lastCheckedAt: Date | null;
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
  mounting: string;
  controlKind: ControlKind;
  priceMinor: number;
  taxBasis: "HT" | "TTC" | "UNKNOWN";
  priceKind: "configured" | "fixed_size" | "from";
  regularPriceMinor: number | null;
  promoPriceMinor: number | null;
  promoEnd: Date | null;
  promoConditions: string;
  scope: Partial<Record<BenchScopeKey, BenchScopeItem>>;
  matchLevel: MatchLevel | null;
  matchReason: string;
  supplierSystem: string;
  differences: string[];
  unknownFields: string[];
  deliversTo: Partial<Record<"FR" | "BE", "yes" | "no" | "unknown">>;
  /** conversion datée : `rate` = unités de la devise d'origine pour 1 € (convention BCE, ex. 1 € = 4,4118 PLN) */
  fx: { originalCurrency: string; originalPriceMinor: number; rate: number; date: string; source: string } | null;
  evidence: string;
  capture: string;
  validation: "TO_VALIDATE" | "VALIDATED" | "TO_RECHECK" | "REJECTED";
  status: "ACTIVE" | "ARCHIVED";
  /** ancienne comparabilité (relevés d'avant les niveaux) */
  legacyComparability?: "STRONG" | "PARTIAL" | "INSUFFICIENT";
}

/** Configuration HELIOSTORES étudiée (une cellule réelle, validée par le moteur). */
export interface BenchConfig {
  familySlug: string;
  key: string;
  widthMm: number;
  /** avancée, ou hauteur pour un screen vertical */
  dimMm: number;
  dimAxis: "depth" | "height";
  mounting: string;
  /** l'implantation distingue les offres (pergolas : autoportante / adossée) */
  mountingMatters: boolean;
  controlKind: ControlKind;
  /** notre périmètre : inclus / hors prix (devis séparé ou option) / absent */
  ours: Record<BenchScopeKey, "included" | "extra" | "absent">;
  /** codes de systèmes fournisseur (transcodification interne) ; un niveau A exige l'un d'eux sur la page */
  supplierSystems: string[];
  /** cotes interchangeables (pergola : largeur × avancée parfois inversées par les vendeurs) */
  allowSwap: boolean;
}

export interface BenchContext { now: Date; staleDays: number; dimToleranceBps: number; vatBps: number }

export type Freshness = "fresh" | "recheck" | "stale";
export const FRESHNESS_FR: Record<Freshness, string> = { fresh: "récent", recheck: "à revérifier", stale: "périmé" };
export type EvidenceQuality = "capture" | "excerpt" | "url";
export const EVIDENCE_FR: Record<EvidenceQuality, string> = { capture: "capture et extrait", excerpt: "extrait cité", url: "URL seule" };
export type PriceScope = "product_only" | "product_unknown_delivery" | "delivered" | "installed";
export const PRICE_SCOPE_FR: Record<PriceScope, string> = { product_only: "produit seul", product_unknown_delivery: "produit seul — livraison inconnue", delivered: "livré (montant de livraison indissociable)", installed: "posé (montant de pose indissociable)" };

export interface BenchEval {
  obs: BenchObservation;
  config: string;
  level: MatchLevel;
  /** pourquoi ce niveau (plafonds appliqués) */
  levelWhy: string[];
  usage: Usage;
  usageWhy: string[];
  /** motifs qui ont déclassé le niveau ou l'usage (données manquantes ou écarts), sans les simples informations */
  blockers: string[];
  freshness: Freshness;
  ageDays: number;
  evidence: EvidenceQuality;
  priceScope: PriceScope;
  tax: "HT" | "TTC" | "UNKNOWN";
  /** marché : direct (FR/BE), local (autre pays UE, accessibilité connue ou non), séparé (GB) */
  market: "direct" | "local_accessible" | "local_unknown" | "separate";
  dims: "exact" | "close" | "swapped" | "near" | "far" | "unknown";
  /** prix normal et promotionnel tels qu'observés (devise et base fiscale d'origine) */
  observedMinor: number;
  regularMinor: number | null;
  promoMinor: number | null;
  /** prix comparable HT en euros, au périmètre de notre configuration (suppléments documentés ajoutés) ; null si
   *  la base fiscale ou la devise ne permet pas de l'établir */
  comparableHtMinor: number | null;
  adjustments: Array<{ key: BenchScopeKey; amountMinor: number; note: string }>;
  differences: string[];
  unknown: string[];
}

const within = (a: number, b: number, bps: number) => Math.abs(a - b) * 10_000 <= b * bps;
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const RANK: Record<MatchLevel, number> = { A: 0, B: 1, C: 2, D: 3 };

/** Niveau proposé par défaut pour un relevé d'avant les niveaux (comparabilité forte → B, partielle → C). */
export function legacyLevel(c: BenchObservation["legacyComparability"]): MatchLevel {
  return c === "STRONG" ? "B" : c === "PARTIAL" ? "C" : "D";
}

export function freshnessOf(o: Pick<BenchObservation, "observedAt" | "lastCheckedAt">, ctx: Pick<BenchContext, "now" | "staleDays">): { freshness: Freshness; ageDays: number } {
  const ref = o.lastCheckedAt && o.lastCheckedAt > o.observedAt ? o.lastCheckedAt : o.observedAt;
  const ageDays = Math.floor((ctx.now.getTime() - ref.getTime()) / 86_400_000);
  // à revérifier à mi-durée de validité (seuil d'ancienneté de la politique de coût, réglable)
  return { ageDays, freshness: ageDays > ctx.staleDays ? "stale" : ageDays > Math.floor(ctx.staleDays / 2) ? "recheck" : "fresh" };
}

/** Cotes d'un relevé pour l'axe de la configuration (hauteur d'un screen, avancée sinon). */
function dimsOf(o: BenchObservation, c: BenchConfig, tolBps: number): BenchEval["dims"] {
  const d = c.dimAxis === "height" ? o.heightMm : o.depthMm;
  if (o.widthMm == null || d == null) return "unknown";
  if (o.widthMm === c.widthMm && d === c.dimMm) return "exact";
  if (within(o.widthMm, c.widthMm, tolBps) && within(d, c.dimMm, tolBps)) return "close";
  // cotes inversées par le vendeur : seulement si SA largeur ne correspond pas à la nôtre (jamais pour départager un
  // relevé presque carré dont l'avancée est simplement hors tolérance)
  if (c.allowSwap && !within(o.widthMm, c.widthMm, tolBps) && within(o.widthMm, c.dimMm, tolBps) && within(d, c.widthMm, tolBps)) return "swapped";
  // « proche » : jusqu'à 2,5 fois la tolérance — contexte seulement (aucune normalisation au m²)
  if (within(o.widthMm, c.widthMm, tolBps * 2.5) && within(d, c.dimMm, tolBps * 2.5)) return "near";
  return "far";
}

export function classify(o: BenchObservation, c: BenchConfig, ctx: BenchContext): BenchEval {
  const levelWhy: string[] = [];
  const usageWhy: string[] = [];
  const differences = [...o.differences];
  const unknown = [...o.unknownFields];
  const { freshness, ageDays } = freshnessOf(o, ctx);
  const evidence: EvidenceQuality = o.capture ? "capture" : o.evidence.trim().length >= 20 ? "excerpt" : "url";

  // niveau proposé (analyste), sinon déduit de l'ancienne comparabilité
  let level: MatchLevel = o.matchLevel ?? legacyLevel(o.legacyComparability);
  levelWhy.push(o.matchLevel ? `proposé : ${LEVEL_FR[o.matchLevel]}${o.matchReason ? ` (${o.matchReason})` : ""}` : `relevé d'avant les niveaux : ${LEVEL_FR[level]} déduit de la comparabilité enregistrée`);
  const blockers: string[] = [];
  const cap = (l: MatchLevel, why: string) => { if (RANK[l] > RANK[level]) { level = l; levelWhy.push(why); } if (RANK[l] >= RANK["C"]) blockers.push(why); };

  // D : données essentielles
  if (o.status !== "ACTIVE") cap("D", "relevé archivé");
  if (o.validation === "REJECTED") cap("D", "relevé rejeté à la validation");
  if (o.priceKind === "from") cap("D", "prix « à partir de » : configuration non identifiable");
  if (!(o.priceMinor > 0)) cap("D", "prix introuvable");
  if (o.currency !== "EUR" && !o.fx) cap("D", `devise ${o.currency} sans conversion datée`);
  const dims = dimsOf(o, c, ctx.dimToleranceBps);
  if (dims === "unknown") cap("D", "dimensions non indiquées");
  if (o.familySlug !== c.familySlug) cap("D", "autre produit de référence");

  // A exige le système fournisseur cité par la page
  const sameSystem = !!o.supplierSystem && c.supplierSystems.some((s) => norm(o.supplierSystem).includes(norm(s)));
  if (level === "A" && !sameSystem) cap("B", o.supplierSystem ? `système cité (${o.supplierSystem}) différent du nôtre` : "système fournisseur non cité par la page : pas de niveau A");

  // plafonds de configuration
  if (dims === "near") cap("C", "dimensions proches mais hors tolérance (aucune normalisation au m²)");
  if (dims === "far") cap("C", "autres dimensions");
  if (c.mountingMatters) {
    if (o.mounting === "unknown") cap("C", "implantation non indiquée");
    else if (o.mounting !== c.mounting) cap("C", "implantation différente");
  }
  const mo = motorized(o.controlKind), mc = motorized(c.controlKind);
  if (mo == null) { cap("C", "motorisation non établie"); unknown.push("motorisation"); }
  else if (mc != null && mo !== mc) cap("C", mo ? "motorisé chez le concurrent, manuel chez nous" : "manuel chez le concurrent, motorisé chez nous");
  else if (c.controlKind === "radio" && o.controlKind === "wired") differences.push("commande filaire chez le concurrent (radio chez nous)");
  else if (c.controlKind === "wired" && o.controlKind === "radio") differences.push("commande radio chez le concurrent (filaire chez nous)");
  else if (o.controlKind === "motor" && (c.controlKind === "radio" || c.controlKind === "wired")) unknown.push("type de commande (radio ou filaire)");

  // base fiscale, devise et prix comparable
  const regular = o.regularPriceMinor;
  const promo = o.promoPriceMinor;
  // prix comparé : le prix normal seulement pour une promotion DATÉE (temporaire) ; une promotion sans date de fin
  // (ou un « prix conseillé » barré) se compare au prix réellement payé — le prix barré n'est pas un prix pratiqué vérifié
  const datedPromo = promo != null && regular != null && o.promoEnd != null;
  const base = datedPromo ? regular! : promo ?? o.priceMinor;
  const promoOnly = promo != null && regular == null;
  if (promo != null && regular != null && !datedPromo) usageWhy.push("promotion sans date de fin : prix payé comparé, prix barré affiché pour information");
  const eur = (m: number) => (o.currency === "EUR" ? m : o.fx ? Math.round(m / o.fx.rate) : null);
  const vat = STANDARD_VAT_BPS[o.country] ?? null;
  const toHt = (m: number | null): number | null => {
    if (m == null) return null;
    if (o.taxBasis === "HT") return m;
    if (o.taxBasis === "TTC" && vat != null) return Math.round((m * 10_000) / (10_000 + vat));
    return null;
  };
  if (o.taxBasis === "UNKNOWN") { unknown.push("HT ou TTC"); usageWhy.push("HT/TTC non indiqué : montant affiché tel qu'observé, jamais converti"); }
  else if (o.taxBasis === "TTC" && vat == null) usageWhy.push(`TVA du pays ${o.country} non référencée : montant non converti`);

  // périmètre (produit seul / livré / posé) et équipements
  const adjustments: BenchEval["adjustments"] = [];
  let priceScope: PriceScope = "product_only";
  let openGap = false;
  for (const k of BENCH_SCOPE_KEYS) {
    const it = o.scope[k] ?? { status: "unknown" as const };
    const ours = c.ours[k];
    if (k === "delivery") {
      if (it.status === "included") { if (it.extraAmountMinor != null) adjustments.push({ key: k, amountMinor: -it.extraAmountMinor, note: "livraison comprise, montant documenté déduit" }); else priceScope = "delivered"; }
      else if (it.status === "unknown") priceScope = "product_unknown_delivery";
      continue;
    }
    if (k === "installation") {
      if (it.status === "included") { if (it.extraAmountMinor != null) adjustments.push({ key: k, amountMinor: -it.extraAmountMinor, note: "pose comprise, montant documenté déduit" }); else priceScope = "installed"; }
      continue;
    }
    const label = BENCH_SCOPE_FR[k];
    if (it.status === "unknown") {
      if (ours === "included") { unknown.push(label); openGap = true; }
      continue;
    }
    const theirsIn = it.status === "included";
    if (ours === "included" && theirsIn) continue;
    if (ours !== "included" && !theirsIn) continue;
    if (ours === "included" && it.status === "extra" && it.extraAmountMinor != null) { adjustments.push({ key: k, amountMinor: it.extraAmountMinor, note: `${label} en option chez le concurrent : supplément documenté ajouté` }); continue; }
    openGap = true;
    differences.push(ours === "included" ? `${label} compris chez nous, ${it.status === "extra" ? "en option non chiffrée" : "absent"} chez le concurrent` : `${label} compris chez le concurrent, absent ou en option chez nous (non chiffré)`);
  }
  if (openGap) cap("B", "écart d'équipement non chiffrable : différences documentées");
  const observedEur = eur(base);
  const baseHt = toHt(observedEur);
  const adj = adjustments.reduce((a, x) => a + (toHt(eur(x.amountMinor)) ?? 0), 0);
  const comparableHtMinor = baseHt == null ? null : baseHt + adj;

  // marché
  const market: BenchEval["market"] = SEPARATE_MARKETS.includes(o.country) ? "separate" : DIRECT_MARKETS.includes(o.country) ? "direct" : o.deliversTo.FR === "yes" || o.deliversTo.BE === "yes" ? "local_accessible" : "local_unknown";

  // usage
  let usage: Usage = level === "A" ? "direct" : level === "B" ? "indicative" : level === "C" ? "context" : "excluded";
  const down = (u: Usage, why: string) => { const r: Usage[] = ["direct", "indicative", "context", "excluded"]; if (r.indexOf(u) > r.indexOf(usage)) usage = u; usageWhy.push(why); if (u === "context" || u === "excluded") blockers.push(why); };
  if (level === "D" && o.matchLevel === "D") blockers.push(o.matchReason ? `classé D : ${o.matchReason}` : "classé D par l'analyste");
  if (comparableHtMinor == null && usage !== "excluded") down("context", o.taxBasis === "UNKNOWN" ? "mention HT/TTC absente" : "prix HT non établi (devise ou TVA)");
  if (freshness === "stale") down("context", `relevé périmé (${ageDays} j > ${ctx.staleDays} j) : à revérifier avant usage`);
  if (o.validation === "TO_RECHECK") down("context", "marqué « à revérifier »");
  if (market === "separate") down("context", "Royaume-Uni : groupe distinct (importation, TVA et droits)");
  if (market === "local_unknown") down("indicative", `prix local ${o.country} : accessibilité pour un acheteur français ou belge inconnue`);
  if (market === "local_accessible") usageWhy.push(`prix local ${o.country}, livraison vers la France ou la Belgique indiquée`);
  if (priceScope === "installed") down("context", "pose comprise sans montant : comparer séparément");
  if (priceScope === "delivered") down("indicative", "livraison comprise, montant indissociable : périmètre différent");
  if (priceScope === "product_unknown_delivery") usageWhy.push("livraison inconnue : produit seul comparé, aucune conclusion sur le coût livré");
  if (promoOnly) down("indicative", `prix promotionnel${o.promoEnd ? ` jusqu'au ${o.promoEnd.toISOString().slice(0, 10)}` : ""}, prix normal inconnu`);

  return { obs: o, config: c.key, level, levelWhy, usage, usageWhy, blockers: [...new Set(blockers)], freshness, ageDays, evidence, priceScope, tax: o.taxBasis, market, dims, observedMinor: o.priceMinor, regularMinor: regular, promoMinor: promo, comparableHtMinor, adjustments, differences: [...new Set(differences)], unknown: [...new Set(unknown)] };
}

/** Clé d'indépendance : une société vendeuse compte une fois (domaines et annonces multiples). */
export const sellerKey = (o: Pick<BenchObservation, "sellerGroup" | "manufacturer" | "retailer">) => (o.sellerGroup || o.manufacturer || o.retailer).trim().toLowerCase().replace(/\s*\(.*?\)\s*/g, "").replace(/[^a-z0-9]+/g, "-");

/** Doublons : même vendeur, même modèle, mêmes cotes et implantation → seul le relevé le plus récent compte. */
export function dedupe(evals: BenchEval[]): { kept: BenchEval[]; duplicates: BenchEval[] } {
  const by = new Map<string, BenchEval>();
  const duplicates: BenchEval[] = [];
  for (const e of [...evals].sort((a, b) => b.obs.observedAt.getTime() - a.obs.observedAt.getTime())) {
    const o = e.obs;
    const k = [sellerKey(o), o.model.trim().toLowerCase(), o.widthMm, o.depthMm, o.heightMm, o.mounting].join("|");
    if (by.has(k)) duplicates.push(e); else by.set(k, e);
  }
  return { kept: [...by.values()], duplicates };
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2); };

export interface SellerPoint { seller: string; htMinor: number; offers: number; evalIds: string[] }

/** Un point par vendeur indépendant (médiane de ses offres) : plusieurs annonces ne pèsent pas plus qu'une. */
export function perSeller(evals: BenchEval[]): SellerPoint[] {
  const m = new Map<string, BenchEval[]>();
  for (const e of evals) if (e.comparableHtMinor != null) { const k = sellerKey(e.obs); m.set(k, [...(m.get(k) ?? []), e]); }
  return [...m].map(([seller, es]) => ({ seller, htMinor: median(es.map((e) => e.comparableHtMinor!))!, offers: es.length, evalIds: es.map((e) => e.obs.id) })).sort((a, b) => a.htMinor - b.htMinor);
}

/** Offres atypiques : hors de [médiane ÷ 2 ; médiane × 2] — signalées, exclues du calcul (jamais supprimées). */
export function splitOutliers(points: SellerPoint[]): { kept: SellerPoint[]; outliers: SellerPoint[] } {
  if (points.length < 3) return { kept: points, outliers: [] };
  const med = median(points.map((p) => p.htMinor))!;
  const kept = points.filter((p) => p.htMinor * 2 >= med && p.htMinor <= med * 2);
  return { kept, outliers: points.filter((p) => !kept.includes(p)) };
}

export type AdviceStatus = "direct" | "indicative" | "product_only" | "to_refresh" | "insufficient";
export const ADVICE_STATUS_FR: Record<AdviceStatus, string> = {
  direct: "Comparaison directe",
  indicative: "Positionnement indicatif — différences documentées",
  product_only: "Produit seul comparé — livraison inconnue",
  to_refresh: "Données à actualiser",
  insufficient: "Données insuffisantes",
};

export interface MarketPosition {
  status: AdviceStatus;
  /** vendeurs indépendants par usage */
  sellers: { direct: number; indicative: number; context: number };
  /** fourchette HT utilisée (vendeurs du groupe le plus fiable disponible) */
  range: { minHt: number; maxHt: number; medianHt: number; basis: "direct" | "indicative" } | null;
  points: SellerPoint[];
  outliers: SellerPoint[];
  /** champs manquants qui empêchent une comparaison (avec effectifs) */
  missing: Array<{ reason: string; n: number }>;
  lastCheckedAt: Date | null;
}

/**
 * Positionnement marché d'une configuration : vendeurs directs (A) s'il y en a, sinon indicatifs (A avec réserve, B).
 * Aucun minimum de vendeurs n'est imposé pour afficher une fourchette ; le prix conseillé n'est aligné sur le marché
 * qu'avec au moins trois vendeurs directs indépendants (voir `advise`).
 */
export function position(evals: BenchEval[]): MarketPosition {
  const { kept } = dedupe(evals);
  const direct = kept.filter((e) => e.usage === "direct");
  const indicative = kept.filter((e) => e.usage === "direct" || e.usage === "indicative");
  const ctxN = new Set(kept.filter((e) => e.usage === "context").map((e) => sellerKey(e.obs))).size;
  const dP = splitOutliers(perSeller(direct));
  const iP = splitOutliers(perSeller(indicative));
  // fourchette directe dès trois vendeurs directs indépendants ; sinon fourchette indicative (directs + équivalents)
  const use = dP.kept.length >= 3 ? { p: dP, basis: "direct" as const } : iP.kept.length ? { p: iP, basis: "indicative" as const } : dP.kept.length ? { p: dP, basis: "direct" as const } : null;
  const pts = use?.p.kept ?? [];
  const range = use && pts.length ? { minHt: pts[0]!.htMinor, maxHt: pts.at(-1)!.htMinor, medianHt: median(pts.map((p) => p.htMinor))!, basis: use.basis } : null;
  const usedEvals = kept.filter((e) => pts.some((p) => p.evalIds.includes(e.obs.id)));
  const missingMap = new Map<string, number>();
  for (const e of kept.filter((x) => x.usage === "excluded" || x.usage === "context")) for (const w of e.blockers) { const k = w.replace(/\(\d+ j > \d+ j\)/, "").replace(/^classé D : Reclassement automatique[^:]*: /, "classé D : ").trim(); missingMap.set(k, (missingMap.get(k) ?? 0) + 1); }
  const last = kept.length ? new Date(Math.max(...kept.map((e) => (e.obs.lastCheckedAt ?? e.obs.observedAt).getTime()))) : null;
  let status: AdviceStatus;
  const directUsed = usedEvals.filter((e) => e.usage === "direct");
  if (!range) status = kept.some((e) => e.freshness === "stale" && (e.level === "A" || e.level === "B")) ? "to_refresh" : "insufficient";
  else if (usedEvals.every((e) => e.freshness !== "fresh")) status = "to_refresh";
  // au moins un vendeur du même système utilisable tel quel : comparaison directe (le prix ne s'aligne qu'à partir de trois)
  else if (directUsed.length) status = directUsed.every((e) => e.priceScope === "product_unknown_delivery") ? "product_only" : "direct";
  else if (usedEvals.every((e) => e.priceScope === "product_unknown_delivery")) status = "product_only";
  else status = "indicative";
  return { status, sellers: { direct: new Set(direct.map((e) => sellerKey(e.obs))).size, indicative: new Set(indicative.map((e) => sellerKey(e.obs))).size, context: ctxN }, range, points: pts, outliers: use?.p.outliers ?? [], missing: [...missingMap].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n).slice(0, 6), lastCheckedAt: last };
}

export interface AdviceInput {
  position: MarketPosition;
  /** prix HT à la marge cible (politique), avant arrondi */
  targetHtMinor: number | null;
  /** plancher HT (marge cible sur coût prudent) */
  floorHtMinor: number | null;
  vatBps: number;
  /** arrondi commercial TTC 99 € actif */
  round99: boolean;
  /** le prix complet est-il établi (aucun élément à chiffrer) */
  complete: boolean;
}

export interface Advice {
  kind: "market" | "target" | "range";
  htMinor: number | null;
  ttcMinor: number | null;
  /** fourchette indicative TTC (positionnement) */
  rangeTtc: { min: number; max: number } | null;
  title: string;
  /** le marché est sous la marge cible : conflit affiché, jamais masqué */
  conflict: string | null;
  steps: string[];
}

/** TTC au demi-centime supérieur (même règle que les grilles de vente). */
export const ttcOf = (ht: number, vat: number) => ht + applyBpsHalfUp(ht, vat);

/**
 * Prix conseillé : la marge cible par défaut ; aligné sur la médiane des vendeurs DIRECTS indépendants s'ils sont au
 * moins trois (après exclusion des atypiques), jamais sous le plancher ; sinon fourchette indicative à côté du prix à
 * la marge cible. L'arrondi commercial s'applique une fois, au total TTC.
 */
export function advise(p: AdviceInput): Advice {
  const steps: string[] = [];
  const r = p.position.range;
  const fmt = (m: number) => `${(m / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
  // arrondi commercial validé du projet (une fois, sur le total TTC ; jamais sur un sous-total partiel)
  const finish = (ht: number) => {
    if (!p.round99 || !p.complete) return { ht, ttc: ttcOf(ht, p.vatBps) };
    const r99 = roundTtcTo99(ht, p.vatBps);
    return { ht: r99.htMinor, ttc: r99.ttcMinor };
  };
  let conflict: string | null = null;
  const ref = p.targetHtMinor ?? p.floorHtMinor;
  if (r && ref != null && r.medianHt < ref) conflict = `La médiane du marché (${fmt(ttcOf(r.medianHt, p.vatBps))} TTC, ${r.basis === "direct" ? "vendeurs directs" : "indicative"}) est sous le prix à la marge cible (${fmt(ttcOf(ref, p.vatBps))} TTC avant arrondi) : revoir coûts, périmètre ou positionnement plutôt que vendre sous la marge.`;
  const rangeTtc = r ? { min: ttcOf(r.minHt, p.vatBps), max: ttcOf(r.maxHt, p.vatBps) } : null;
  if (r && r.basis === "direct" && p.position.points.length >= 3) {
    const h = Math.max(r.medianHt, p.floorHtMinor ?? 0);
    steps.push(`Médiane de ${p.position.points.length} vendeurs directs indépendants : ${fmt(r.medianHt)} HT.`);
    if (p.floorHtMinor != null && r.medianHt < p.floorHtMinor) steps.push(`Relevé au plancher de marge : ${fmt(p.floorHtMinor)} HT.`);
    const f = finish(h);
    if (f.ttc !== ttcOf(h, p.vatBps)) steps.push(`Arrondi commercial TTC (terminaison 99 €) : ${fmt(ttcOf(h, p.vatBps))} → ${fmt(f.ttc)} TTC.`);
    return { kind: "market", htMinor: f.ht, ttcMinor: f.ttc, rangeTtc, title: `${ADVICE_STATUS_FR.direct} : médiane de ${p.position.points.length} vendeurs indépendants, jamais sous la marge cible`, conflict, steps };
  }
  if (p.targetHtMinor == null) return { kind: "range", htMinor: null, ttcMinor: null, rangeTtc, title: "Marge cible non définie : aucun prix conseillé", conflict, steps };
  const f = finish(p.targetHtMinor);
  steps.push(`Prix à la marge cible : ${fmt(p.targetHtMinor)} HT → ${fmt(ttcOf(p.targetHtMinor, p.vatBps))} TTC${f.ttc !== ttcOf(p.targetHtMinor, p.vatBps) ? ` → arrondi ${fmt(f.ttc)} TTC` : ""}.`);
  if (r) {
    steps.push(`Fourchette ${r.basis === "direct" ? "directe" : "indicative"} de ${p.position.points.length} vendeur(s) : ${fmt(rangeTtc!.min)} à ${fmt(rangeTtc!.max)} TTC (médiane ${fmt(ttcOf(r.medianHt, p.vatBps))}).`);
    if (r.basis === "direct") steps.push("Moins de trois vendeurs directs indépendants : le prix reste celui de la marge cible, la fourchette sert de repère.");
    return { kind: "range", htMinor: f.ht, ttcMinor: f.ttc, rangeTtc, title: `${ADVICE_STATUS_FR[p.position.status]} : prix à la marge cible, fourchette marché en repère`, conflict, steps };
  }
  return { kind: "target", htMinor: f.ht, ttcMinor: f.ttc, rangeTtc: null, title: `${ADVICE_STATUS_FR[p.position.status]} : prix calculé selon la marge cible`, conflict, steps };
}
