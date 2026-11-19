/**
 * « Mes prix conseillés » (administrateurs) : par produit tarifé, plusieurs configurations PRÉCISES (configuration
 * d'appel et tailles courantes réellement disponibles, validées par le moteur), chacune avec :
 *
 * A. prix à la marge cible (politique de coût : achat net ÷ (1 − marge), postes d'éligibilité inconnue au prix de vente) ;
 * B. positionnement marché : offres classées A / B / C / D (src/domain/market-benchmark.ts), un point par vendeur
 *    indépendant, atypiques signalés ;
 * C. prix conseillé (aligné sur au moins trois vendeurs directs, jamais sous le plancher) ou fourchette indicative ;
 * D. marge brute estimée à ce prix, avant et après l'arrondi commercial TTC, et ses limites.
 *
 * Lecture seule : aucune collecte au chargement, aucune grille ni prix public modifié. « Préparer un brouillon »
 * cible la seule cellule de la configuration (actions/admin/advice.ts).
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { evaluate } from "@/domain/engine";
import { DIRECT_COST_FR, marginOf, type Margin } from "@/domain/market";
import { advise, classify, position, BENCH_SCOPE_KEYS, type Advice, type BenchConfig, type BenchEval, type ControlKind, type MarketPosition } from "@/domain/market-benchmark";
import { nearestAllowed, type SystemInput, type SystemMounting, type SystemRules } from "@/domain/system";
import { loadCatalog } from "@/server/catalog/load";
import { roundTtcTo99 } from "@/domain/system-pricing";
import { entryPriceFor } from "@/server/pricing/entry-prices";
import { listObservations, toBench, type ObservationRow } from "./observations";
import { policyAt, type PolicyView } from "./policy";
import { study, type StudyInput, type StudyResult } from "./study";

/**
 * Transcodification interne confirmée (produit HELIOSTORES → système fournisseur). Jamais affichée aux visiteurs :
 * sert uniquement à reconnaître un revendeur du même système (niveau A).
 */
export const SUPPLIER_SYSTEMS: Record<string, string[]> = {
  malaga: ["SB350", "SB 350"],
  marbella: ["SB450", "SB 450"],
  sevilla: ["SOLID", "SEVILLA", "SEVILLIA"],
  helioscreen: ["R120 ZIIIP", "R 120 ZIIIP", "R120ZIP", "ZIIIP 120"],
  "helioroof-screen": ["VERANDA V ZIIIP", "VERANDA V"],
  casablanca: ["CASABLANCA"],
  corsica: ["CORSICA"],
  jamaica: ["JAMAICA"],
  madera: ["MADERA", "MADEIRA"],
};

type ControlPref = "radio" | "wired" | "manual" | "entry";
interface ConfSpec { key: string; widthMm: number; dimMm: number; mounting?: SystemMounting; control: ControlPref; why: string }

/** Configurations courantes étudiées (ramenées aux valeurs autorisées ; écartées si le moteur les refuse). */
export const BENCH_SIZES: Record<string, ConfSpec[]> = {
  marbella: [
    { key: "3x3-auto", widthMm: 3000, dimMm: 3000, mounting: "freestanding", control: "entry", why: "≈ 3 × 3 m autoportante" },
    { key: "4x4-auto", widthMm: 4000, dimMm: 4000, mounting: "freestanding", control: "entry", why: "4 × 4 m autoportante : taille la plus proposée par les revendeurs" },
    { key: "3x3-adossee", widthMm: 3000, dimMm: 3000, mounting: "wall", control: "entry", why: "≈ 3 × 3 m adossée" },
    { key: "4x4-adossee", widthMm: 4000, dimMm: 4000, mounting: "wall", control: "entry", why: "4 × 4 m adossée" },
  ],
  malaga: [
    { key: "3_5x3_85", widthMm: 3500, dimMm: 3850, control: "entry", why: "taille fixe 3,5 × 3,85 m" },
    { key: "3_5x4_3", widthMm: 3500, dimMm: 4300, control: "entry", why: "taille fixe 3,5 × 4,3 m" },
    { key: "3_5x4_75", widthMm: 3500, dimMm: 4750, control: "entry", why: "taille fixe 3,5 × 4,75 m" },
  ],
  sevilla: [
    { key: "3x3-auto", widthMm: 3000, dimMm: 3000, mounting: "freestanding", control: "entry", why: "≈ 3 × 3 m autoportante" },
    { key: "4x4-auto", widthMm: 4000, dimMm: 4000, mounting: "freestanding", control: "entry", why: "4 × 4 m autoportante : taille courante des pergolas à toile" },
    { key: "4x4-adossee", widthMm: 4000, dimMm: 4000, mounting: "wall", control: "entry", why: "4 × 4 m adossée" },
  ],
  helioscreen: [
    { key: "2x2", widthMm: 2000, dimMm: 2000, control: "radio", why: "2 × 2 m, radio" },
    { key: "2_7x2_4", widthMm: 2700, dimMm: 2400, control: "radio", why: "baie de 2,70 × 2,40 m : taille fixe courante" },
    { key: "3x2_5", widthMm: 3000, dimMm: 2500, control: "radio", why: "3 × 2,5 m, radio" },
    { key: "4x2_5", widthMm: 4000, dimMm: 2500, control: "radio", why: "4 × 2,5 m, radio" },
  ],
  "helioroof-screen": [
    { key: "3x3", widthMm: 3000, dimMm: 3000, control: "radio", why: "≈ 3 × 3 m, radio" },
    { key: "4x4", widthMm: 4000, dimMm: 4000, control: "radio", why: "4 × 4 m, radio" },
  ],
  casablanca: [
    { key: "3x2_6-motorise", widthMm: 3000, dimMm: 2600, control: "radio", why: "3 × 2,6 m motorisé radio" },
    { key: "4x3_1-motorise", widthMm: 4000, dimMm: 3100, control: "radio", why: "4 × 3 m motorisé radio : configuration la plus proposée" },
    { key: "5x3_1-motorise", widthMm: 5000, dimMm: 3100, control: "radio", why: "5 × 3 m motorisé radio" },
    { key: "4x3_1-manuel", widthMm: 4000, dimMm: 3100, control: "manual", why: "4 × 3 m manuel" },
  ],
  corsica: [
    { key: "4x3_1-motorise", widthMm: 4000, dimMm: 3100, control: "radio", why: "4 × 3 m motorisé radio" },
    { key: "5x3_1-motorise", widthMm: 5000, dimMm: 3100, control: "radio", why: "5 × 3 m motorisé radio" },
  ],
  jamaica: [
    { key: "4x3_1-manuel", widthMm: 4000, dimMm: 3100, control: "manual", why: "4 × 3 m manuel : taille la plus proposée" },
    { key: "4x3_1-motorise", widthMm: 4000, dimMm: 3100, control: "radio", why: "4 × 3 m motorisé radio" },
  ],
  madera: [
    { key: "4x3_1", widthMm: 4000, dimMm: 3100, control: "entry", why: "4 × 3 m motorisé" },
    { key: "5x3_1", widthMm: 5000, dimMm: 3100, control: "entry", why: "5 × 3 m motorisé" },
  ],
};

const eur = (minor: number) => `${(minor / 100).toLocaleString("fr-FR", { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const pct = (bps: number | null) => (bps == null ? "—" : `${(bps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);
const halfUp = (num: number, den: number) => Math.floor((2 * num + den) / (2 * den));

export interface ResolvedConfig { key: string; input: StudyInput; text: string; why: string; bench: Omit<BenchConfig, "ours"> }

function controlKindOf(rules: SystemRules, code: string | null | undefined): ControlKind {
  const c = rules.controls?.find((x) => x.code === code);
  if (!c) return rules.controls?.length ? "unknown" : "motor";
  if (c.kind === "manual") return "manual";
  if (/filaire|interrupteur|wired/i.test(c.label)) return "wired";
  if (/radio|\bio\b|rts|télécommande/i.test(c.label)) return "radio";
  return "motor";
}

/** Configurations étudiées d'un produit : configuration d'appel, puis tailles courantes acceptées par le moteur. */
export async function configsFor(familySlug: string): Promise<{ configs: ResolvedConfig[]; skipped: string[] }> {
  const entry = await entryPriceFor(familySlug);
  if (!entry) return { configs: [], skipped: [] };
  const catalog = await loadCatalog();
  const fam = catalog.families.find((f) => f.slug === familySlug);
  const rules = fam?.systemRules as SystemRules | undefined;
  if (!rules) return { configs: [], skipped: [] };
  const byHeight = !rules.dims.depth && !!rules.dims.height;
  const ok = (c: SystemInput) => { const r = evaluate(catalog, c); return r.priceBreakdown && !r.issues.some((i) => i.severity === "blocking" && i.code !== "fabric_missing") ? r.priceBreakdown : null; };
  const m = (mm: number) => `${(mm / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m`;
  const resolve = (key: string, input: SystemInput, why: string): ResolvedConfig => {
    const dimMm = (byHeight ? input.heightMm : input.depthMm) ?? 0;
    const control = rules.controls?.find((c) => c.code === input.controlCode);
    const opts = input.options.map((o) => { const d = rules.options.find((x) => x.code === o.code); const v = d?.values?.find((x) => x.code === o.value)?.label; return d ? (v ? `${d.label} (${v})` : d.label) : o.code; });
    const text = [`${m(input.widthMm)} × ${m(dimMm)}`, rules.mountings.find((x) => x.code === input.mounting)?.label ?? input.mounting, control?.label, ...opts].filter(Boolean).join(", ");
    const codes = new Set(rules.mountings.map((x) => x.code));
    return {
      key, text, why,
      input: { familySlug, mounting: input.mounting, widthMm: input.widthMm, dimMm, finishCode: input.finishCode, controlCode: input.controlCode ?? null, options: input.options.map((o) => (o.value ? `${o.code}=${o.value}` : o.code)), country: "FR" },
      bench: { familySlug, key, widthMm: input.widthMm, dimMm, dimAxis: byHeight ? "height" : "depth", mounting: input.mounting, mountingMatters: codes.has("freestanding") && codes.has("wall"), controlKind: controlKindOf(rules, input.controlCode), supplierSystems: SUPPLIER_SYSTEMS[familySlug] ?? [], allowSwap: fam?.category === "PERGOLAS" },
    };
  };
  const configs: ResolvedConfig[] = [resolve("appel", entry.entry.input, "configuration d'appel (prix « à partir de » du site)")];
  const skipped: string[] = [];
  const seen = new Set([JSON.stringify(configs[0]!.input)]);
  for (const spec of BENCH_SIZES[familySlug] ?? []) {
    if (rules.fixedSizes?.length) {
      // modèle fabriqué en tailles définies : la taille fixe correspondante, sinon aucune
      const fs = rules.fixedSizes.find((x) => x.widthMm === spec.widthMm && (x.depthMm ?? x.heightMm) === spec.dimMm);
      if (!fs) { skipped.push(`${spec.why} : taille non fabriquée`); continue; }
      const input: SystemInput = { ...entry.entry.input, sizeCode: fs.code, widthMm: fs.widthMm, ...(fs.depthMm ? { depthMm: fs.depthMm } : {}), ...(fs.heightMm ? { heightMm: fs.heightMm } : {}) };
      if (!ok(input)) { skipped.push(`${spec.why} : configuration refusée par le moteur`); continue; }
      configs.push(resolve(spec.key, input, spec.why));
      continue;
    }
    const dimRule = byHeight ? rules.dims.height! : rules.dims.depth!;
    const w = nearestAllowed(rules.dims.width, spec.widthMm), dv = dimRule ? nearestAllowed(dimRule, spec.dimMm) : spec.dimMm;
    if (Math.abs(w - spec.widthMm) * 10 > spec.widthMm || Math.abs(dv - spec.dimMm) * 10 > spec.dimMm) { skipped.push(`${spec.why} : dimensions non disponibles`); continue; }
    let input: SystemInput = { ...entry.entry.input, widthMm: w, ...(byHeight ? { heightMm: dv } : { depthMm: dv }) };
    let why = spec.why;
    if (spec.mounting) { if (!rules.mountings.some((x) => x.code === spec.mounting)) { skipped.push(`${spec.why} : implantation non proposée`); continue; } input = { ...input, mounting: spec.mounting }; }
    if (spec.control !== "entry") {
      // commande demandée entièrement chiffrée la moins chère (options d'appel conservées)
      const pick = (want: (k: ControlKind) => boolean) => (rules.controls ?? []).filter((c) => want(controlKindOf(rules, c.code))).map((c) => ({ c, b: ok({ ...input, controlCode: c.code }) })).filter((x) => x.b && !x.b.partial).sort((a, b) => a.b!.totalMinor - b.b!.totalMinor)[0];
      let chosen = pick((k) => k === spec.control || (spec.control === "radio" && k === "motor"));
      // radio « à chiffrer » chez nous : la commande motorisée entièrement chiffrée est étudiée, l'écart est documenté
      if (!chosen && spec.control === "radio") { chosen = pick((k) => k !== "manual" && k !== "unknown"); if (chosen) why = `${spec.why.replace(/ radio$/, "")} — radio à chiffrer au devis chez nous : ${chosen.c.label.toLowerCase()} étudiée`; }
      if (!chosen) { skipped.push(`${spec.why} : commande ${spec.control === "manual" ? "manuelle" : spec.control} non chiffrée`); continue; }
      input = { ...input, controlCode: chosen.c.code };
    }
    if (!ok(input)) { skipped.push(`${spec.why} : configuration refusée par le moteur`); continue; }
    const k = JSON.stringify(resolve(spec.key, input, why).input);
    if (seen.has(k)) continue;
    seen.add(k);
    configs.push(resolve(spec.key, input, why));
  }
  return { configs, skipped };
}

/** Prix HT à la marge cible, ligne par ligne du coût net (postes inconnus : prix de vente conservé). */
function targetOf(r: StudyResult, marginBps: number) {
  if (!r.cost || !r.sale) return null;
  const den = 10_000 - marginBps;
  const saleLine = new Map(r.sale.lines.map((l) => [l.code, l.amountMinor]));
  let ht = 0;
  const unknown: string[] = [], missing: string[] = [];
  for (const l of r.cost.lines) {
    if ((l.basis === "eligible" || l.basis === "percent_after_discount") && l.netMinor != null) ht += halfUp(l.netMinor * 10_000, den);
    else if (l.basis === "not_eligible" && l.catalogueMinor != null) ht += halfUp(l.catalogueMinor * 10_000, den);
    else if (l.basis === "unknown") { ht += saleLine.get(l.code) ?? l.catalogueMinor ?? 0; unknown.push(l.label); }
    else missing.push(l.label);
  }
  return { htMinor: ht, unknown, missing, partial: unknown.length > 0 || missing.length > 0 };
}

export interface ConfigRow {
  key: string;
  text: string;
  why: string;
  input: StudyInput;
  query: string;
  /** cellule de la grille de vente visée par un brouillon */
  cell: { dimAmm: number; widthMinMm: number; widthMaxMm: number } | null;
  current: { htMinor: number; ttcMinor: number } | null;
  target: { htMinor: number; ttcMinor: number; computedHtMinor: number; partial: boolean; unknown: string[]; missing: string[] } | null;
  position: MarketPosition;
  advice: Advice | null;
  /** marge brute au prix conseillé (établie et prudente) et effet de l'arrondi commercial */
  margin: { known: Margin; prudent: Margin; partial: boolean; beforeRounding: Margin | null } | null;
  evals: BenchEval[];
  /** relevés du produit hors de cette configuration (autres dimensions) */
  otherDims: number;
  canPrepare: boolean;
  limits: string[];
  error?: string;
}

export interface ProductAdvice {
  familySlug: string;
  name: string;
  image: { path: string; alt: string } | null;
  configs: ConfigRow[];
  skipped: string[];
  observations: number;
  levels: Record<"A" | "B" | "C" | "D", number>;
}

function studyQuery(i: StudyInput): string {
  const q = new URLSearchParams({ produit: i.familySlug, pose: i.mounting, largeur: String(i.widthMm), cote: String(i.dimMm), pays: i.country });
  if (i.finishCode) q.set("teinte", i.finishCode);
  if (i.controlCode) q.set("commande", i.controlCode);
  for (const o of i.options ?? []) q.append("option", o);
  return q.toString();
}

async function configRow(c: ResolvedConfig, policy: PolicyView | null, observations: ObservationRow[], now: Date): Promise<ConfigRow> {
  const emptyPos = position([]);
  const row: ConfigRow = { key: c.key, text: c.text, why: c.why, input: c.input, query: studyQuery(c.input), cell: null, current: null, target: null, position: emptyPos, advice: null, margin: null, evals: [], otherDims: 0, canPrepare: false, limits: [] };
  const r = await study({ ...c.input, observations, at: now });
  if ("error" in r) return { ...row, error: r.error ?? "étude impossible" };
  const vat = r.vat ?? 2000;
  row.cell = r.sim.saleCell ?? null;
  if (r.saleHt != null) row.current = { htMinor: r.saleHt, ttcMinor: r.current?.ttcMinor ?? r.saleHt };
  const m = policy?.marginTargetBps ?? null;
  const t0 = m != null ? targetOf(r, m) : null;
  const round99 = policy?.saleRounding === "NEAREST_99_TTC";
  const rt = t0 && round99 && !t0.missing.length ? roundTtcTo99(t0.htMinor, vat) : null;
  if (t0) row.target = { ...t0, computedHtMinor: t0.htMinor, htMinor: rt?.htMinor ?? t0.htMinor, ttcMinor: rt?.ttcMinor ?? t0.htMinor + Math.floor((t0.htMinor * vat + 5_000) / 10_000) };
  // classement des offres pour CETTE configuration
  const bench: BenchConfig = { ...c.bench, ours: Object.fromEntries(BENCH_SCOPE_KEYS.map((k) => [k, r.ours[k] ?? "absent"])) as BenchConfig["ours"] };
  const ctx = { now, staleDays: policy?.staleDays ?? 120, dimToleranceBps: policy?.dimToleranceBps ?? 1000, vatBps: vat };
  const all = observations.filter((o) => o.status === "ACTIVE" && o.familySlug === c.input.familySlug).map((o) => classify(toBench(o), bench, ctx));
  row.evals = all.filter((e) => e.dims !== "far").sort((a, b) => a.level.localeCompare(b.level) || (a.comparableHtMinor ?? 0) - (b.comparableHtMinor ?? 0));
  row.otherDims = all.length - row.evals.length;
  row.position = position(row.evals.filter((e) => e.dims !== "unknown"));
  row.advice = advise({ position: row.position, targetHtMinor: t0?.htMinor ?? null, floorHtMinor: r.floor?.floorHtMinor ?? null, vatBps: vat, round99, complete: !(r.sale?.partial ?? true) && !t0?.missing.length });
  if (row.advice.htMinor != null && r.cost) row.margin = { known: marginOf(row.advice.htMinor, r.cost.knownNetMinor), prudent: marginOf(row.advice.htMinor, r.cost.prudentNetMinor), partial: r.cost.partial, beforeRounding: t0 && row.advice.kind !== "market" ? marginOf(t0.htMinor, r.cost.prudentNetMinor) : null };
  const L = row.limits;
  if (m == null) L.push("Aucune marge cible dans la politique de coût en vigueur.");
  else L.push(`Marge brute cible ${pct(m)} du prix de vente HT (politique v${policy!.version}), avant arrondi ; remise revendeur ${pct(policy!.discountBps)} sur les seuls postes éligibles confirmés.`);
  if (t0?.unknown.length) L.push(`Marge non garantie : éligibilité à la remise inconnue pour ${t0.unknown.join(", ")} (prix de vente conservé, jamais × 0,84).`);
  if (t0?.missing.length) L.push(`Élément(s) à chiffrer, hors prix : ${t0.missing.join(", ")} — sous-total, aucun arrondi.`);
  const unknownCosts = r.costs.filter((x) => x.status === "unknown").map((x) => DIRECT_COST_FR[x.key]);
  if (unknownCosts.length) L.push(`Coûts non renseignés (jamais comptés comme zéro) : ${unknownCosts.join(", ")}. La marge brute n'est pas un bénéfice net.`);
  row.canPrepare = row.advice.htMinor != null && !!row.current && row.advice.htMinor !== row.current.htMinor && (r.floor?.floorHtMinor == null || row.advice.htMinor >= r.floor.floorHtMinor) && !!row.cell;
  return row;
}

export async function adviceOverview(opts: { now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const policy = await policyAt(now);
  const families = await prisma.productFamily.findMany({
    where: { legacy: false, status: { in: ["PUBLISHED", "QUOTE_ONLY"] }, category: { not: null } },
    select: { slug: true, name: true, media: { where: { media: { status: "PUBLISHED", nature: { notIn: ["DOCUMENT", "VIDEO"] } } }, select: { media: { select: { path: true, alt: true } } }, orderBy: { sortOrder: "asc" }, take: 1 } },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
  const observations = await listObservations({ status: "ACTIVE" });
  const products: ProductAdvice[] = [];
  for (const f of families) {
    const { configs, skipped } = await configsFor(f.slug);
    if (!configs.length) continue;
    const obs = observations.filter((o) => o.familySlug === f.slug);
    const rows: ConfigRow[] = [];
    for (const c of configs) rows.push(await configRow(c, policy, obs, now));
    const levels = { A: 0, B: 0, C: 0, D: 0 };
    // niveau le plus favorable de chaque relevé sur l'ensemble des configurations du produit
    const best = new Map<string, "A" | "B" | "C" | "D">();
    for (const r of rows) for (const e of r.evals) { const b = best.get(e.obs.id); if (!b || e.level < b) best.set(e.obs.id, e.level); }
    for (const o of obs) levels[best.get(o.id) ?? "D"]++;
    const m = f.media[0]?.media;
    products.push({ familySlug: f.slug, name: f.name, image: m ? { path: m.path, alt: m.alt } : null, configs: rows, skipped, observations: obs.length, levels });
  }
  const last = await prisma.marketObservation.aggregate({ where: { status: "ACTIVE" }, _max: { observedAt: true }, _count: true });
  const comparedDirect = products.filter((p) => p.configs.some((c) => c.position.sellers.direct > 0 && c.position.range)).length;
  const comparedIndicative = products.filter((p) => p.configs.some((c) => c.position.range)).length;
  return { policy, products, lastObservedAt: last._max.observedAt, observations: last._count, compared: { direct: comparedDirect, any: comparedIndicative, total: products.length } };
}

/** Recalcule côté serveur la ligne d'une configuration (jamais un prix transmis par le navigateur). */
export async function adviceFor(familySlug: string, key: string): Promise<ConfigRow | null> {
  const policy = await policyAt();
  const { configs } = await configsFor(familySlug);
  const c = configs.find((x) => x.key === key);
  if (!c) return null;
  const obs = await listObservations({ familySlug, status: "ACTIVE" });
  return configRow(c, policy, obs, new Date());
}

export { eur as eurText };

export interface RoundingPreviewRow {
  familySlug: string;
  name: string;
  config: string;
  partial: boolean;
  /** vente calculée avant arrondi (HT, TTC), TTC arrondi, écart, HT final et TVA */
  computedHtMinor: number;
  computedTtcMinor: number;
  ttcMinor: number;
  adjustmentTtcMinor: number;
  htMinor: number;
  vatMinor: number;
  ventilationMinor: number;
  /** marge réelle après arrondi (établie, prudente si le coût est incomplet) */
  margin: { known: Margin; prudent: Margin; partial: boolean } | null;
  flags: string[];
}

/**
 * Aperçu de l'arrondi commercial TTC sur chaque configuration d'appel : toujours recalculé depuis le HT de la grille
 * (jamais depuis un prix déjà arrondi) ; valable avant comme après l'activation.
 */
export async function roundingPreview(): Promise<{ active: boolean; rows: RoundingPreviewRow[] }> {
  const policy = await policyAt();
  const active = policy?.saleRounding === "NEAREST_99_TTC";
  const families = await prisma.productFamily.findMany({ where: { legacy: false, status: { in: ["PUBLISHED", "QUOTE_ONLY"] }, category: { not: null } }, select: { slug: true, name: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  const rows: RoundingPreviewRow[] = [];
  for (const f of families) {
    const e = await entryPriceFor(f.slug);
    if (!e) continue;
    const b = e.entry.breakdown;
    const computedHt = b.computedMinor ?? b.totalMinor;
    const vat = b.vatRateBps;
    const r = active && !b.partial ? roundTtcTo99(computedHt, vat) : null;
    const computedTtc = computedHt + Math.floor((computedHt * vat + 5_000) / 10_000);
    const ht = r?.htMinor ?? computedHt, ttc = r?.ttcMinor ?? computedTtc;
    const i = e.entry.input;
    const s = await study({ familySlug: f.slug, mounting: i.mounting, widthMm: i.widthMm, dimMm: (i.depthMm ?? i.heightMm) ?? 0, finishCode: i.finishCode, controlCode: i.controlCode ?? null, options: i.options.map((o) => (o.value ? `${o.code}=${o.value}` : o.code)), country: "FR" });
    const cost = "error" in s ? null : s.cost;
    const flags: string[] = [];
    if (b.partial) flags.push("sous-total partiel : aucun arrondi");
    if (r?.exception) flags.push("moins de 99 € TTC : prix calculé conservé");
    if (cost?.partial) flags.push("marge non garantie (coût incomplet)");
    if (cost && ht < cost.knownNetMinor) flags.push("sous le coût d'achat connu : validation requise");
    rows.push({ familySlug: f.slug, name: f.name, config: [e.summary.dims, e.summary.mounting, ...e.summary.equipment].join(", "), partial: b.partial, computedHtMinor: computedHt, computedTtcMinor: computedTtc, ttcMinor: ttc, adjustmentTtcMinor: ttc - computedTtc, htMinor: ht, vatMinor: ttc - ht, ventilationMinor: r?.ventilationMinor ?? 0, margin: cost ? { known: marginOf(ht, cost.knownNetMinor), prudent: marginOf(ht, cost.prudentNetMinor), partial: cost.partial } : null, flags });
  }
  return { active, rows };
}

