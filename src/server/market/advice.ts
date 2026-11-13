/**
 * « Mes prix conseillés » (administrateurs) : une ligne par produit tarifé, sur une configuration de référence réelle
 * (dimensions courantes du marché, validées par le moteur ; à défaut la configuration de départ du prix d'appel).
 *
 * - prix actuel : grille de vente en vigueur ;
 * - prix à la marge cible : chaque ligne du coût net ÷ (1 − marge cible) ; un poste d'éligibilité inconnue garde son
 *   prix de vente (marge non établie, signalée) ;
 * - marché : offres retenues par l'étude (fortement comparables, récentes, prix normal, périmètre normalisé) ;
 * - prix conseillé : la marge cible par défaut ; un prix aligné sur le marché seulement avec au moins trois offres
 *   fortement comparables et indépendantes, jamais sous le plancher, toujours expliqué. Rien n'est publié ici.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { evaluate } from "@/domain/engine";
import { CONFIDENCE_FR, DIRECT_COST_FR, marginOf, SCOPE_FR, type Confidence, type Margin } from "@/domain/market";
import { nearestAllowed, type SystemInput, type SystemMounting, type SystemRules } from "@/domain/system";
import { loadCatalog } from "@/server/catalog/load";
import { entryPriceFor } from "@/server/pricing/entry-prices";
import { policyAt, type PolicyView } from "./policy";
import { study, type StudyInput, type StudyResult } from "./study";

/** Dimensions de référence par produit (offres du marché les plus fréquentes) ; validées par le moteur. */
export const REFERENCE_SIZES: Record<string, { widthMm: number; dimMm: number; mounting?: SystemMounting; electric?: boolean; why: string }> = {
  malaga: { widthMm: 3500, dimMm: 3400, why: "plus petite taille fabriquée" },
  marbella: { widthMm: 4000, dimMm: 4000, mounting: "freestanding", why: "4 × 4 m autoportante : taille la plus proposée par les revendeurs" },
  sevilla: { widthMm: 4000, dimMm: 4000, mounting: "freestanding", why: "4 × 4 m autoportante : taille courante des pergolas à toile" },
  helioscreen: { widthMm: 2700, dimMm: 2400, why: "baie de 2,70 × 2,40 m : taille courante des screens à taille fixe" },
  casablanca: { widthMm: 4000, dimMm: 3000, electric: true, why: "4 × 3 m motorisé : configuration la plus proposée pour les stores bannes" },
  corsica: { widthMm: 4000, dimMm: 3000, electric: true, why: "4 × 3 m motorisé : configuration la plus proposée pour les stores bannes" },
  jamaica: { widthMm: 4000, dimMm: 3000, why: "4 × 3 m : taille la plus proposée pour les stores bannes" },
  madera: { widthMm: 4000, dimMm: 3000, electric: true, why: "4 × 3 m motorisé : configuration la plus proposée pour les stores bannes" },
};

const halfUp = (num: number, den: number) => Math.floor((2 * num + den) / (2 * den));
const ttcOf = (ht: number, vat: number) => ht + Math.floor((ht * vat + 5_000) / 10_000);

export interface AdviceRow {
  familySlug: string;
  name: string;
  image: { path: string; alt: string } | null;
  reference: StudyInput;
  referenceText: string;
  referenceWhy: string;
  /** requête de l'étude détaillée (Comparatif marché) */
  query: string;
  current: { htMinor: number; ttcMinor: number } | null;
  target: { htMinor: number; ttcMinor: number; partial: boolean; unknown: string[]; missing: string[] } | null;
  market: { n: number; independent: number; minTtc: number | null; maxTtc: number | null; medianTtc: number | null; from: Date | null; to: Date | null; excluded: number };
  /** offres apparentées non retenues (même produit, dimensions et pose proches) : information, jamais un prix de marché */
  related: { n: number; min: number | null; max: number | null; reasons: string[] };
  advice: { htMinor: number; ttcMinor: number; kind: "target" | "market"; title: string } | null;
  margin: { known: Margin; prudent: Margin; partial: boolean } | null;
  confidence: Confidence;
  confidenceText: string;
  explanation: string[];
  /** un brouillon peut être préparé (prix conseillé différent du prix en vigueur, au-dessus du plancher) */
  canPrepare: boolean;
  error?: string;
}

function studyQuery(i: StudyInput): string {
  const q = new URLSearchParams({ produit: i.familySlug, pose: i.mounting, largeur: String(i.widthMm), cote: String(i.dimMm), pays: i.country });
  if (i.finishCode) q.set("teinte", i.finishCode);
  if (i.controlCode) q.set("commande", i.controlCode);
  for (const o of i.options ?? []) q.append("option", o);
  return q.toString();
}

/** Configuration de référence : départ du prix d'appel, aux dimensions de référence si le moteur les accepte. */
async function referenceFor(familySlug: string): Promise<{ input: StudyInput; text: string; why: string } | null> {
  const entry = await entryPriceFor(familySlug);
  if (!entry) return null;
  const catalog = await loadCatalog();
  const fam = catalog.families.find((f) => f.slug === familySlug);
  const rules = fam?.systemRules as SystemRules | undefined;
  const ref = REFERENCE_SIZES[familySlug];
  let input = entry.entry.input;
  let why = "configuration de départ du prix d'appel";
  if (ref && rules && !rules.fixedSizes?.length) {
    const byHeight = !rules.dims.depth && !!rules.dims.height;
    // valeurs autorisées les plus proches (certaines cotes sont discrètes, ex. avancées de store banne)
    const dimRule = byHeight ? rules.dims.height! : rules.dims.depth!;
    const w = nearestAllowed(rules.dims.width, ref.widthMm), dv = dimRule ? nearestAllowed(dimRule, ref.dimMm) : ref.dimMm;
    const candidate = { ...input, widthMm: w, ...(byHeight ? { heightMm: dv } : { depthMm: dv }), ...(ref.mounting && rules.mountings.some((m) => m.code === ref.mounting) ? { mounting: ref.mounting } : {}) };
    const ok = (c: SystemInput) => { const r = evaluate(catalog, c); return r.priceBreakdown && !r.issues.some((i) => i.severity === "blocking") ? r.priceBreakdown : null; };
    if (ok(candidate)) { input = candidate; why = ref.why; }
    // motorisation de référence (offres du marché motorisées) : commande électrique entièrement chiffrée la moins chère
    if (ref.electric && rules.controls?.some((c) => c.kind === "electric")) {
      const priced = rules.controls.filter((c) => c.kind === "electric").map((c) => ({ c, b: ok({ ...input, controlCode: c.code }) })).filter((x) => x.b && !x.b.partial).sort((a, b) => a.b!.totalMinor - b.b!.totalMinor);
      if (priced[0]) input = { ...input, controlCode: priced[0].c.code };
    }
  } else if (ref) why = ref.why;
  const dimMm = (rules?.dims.depth ? input.depthMm : input.heightMm) ?? 0;
  const control = rules?.controls?.find((c) => c.code === input.controlCode);
  const opts = input.options.map((o) => { const d = rules?.options.find((x) => x.code === o.code); const v = d?.values?.find((x) => x.code === o.value)?.label; return d ? (v ? `${d.label} (${v})` : d.label) : o.code; });
  const m = (mm: number) => `${(mm / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m`;
  const text = [`${m(input.widthMm)} × ${m(dimMm)}`, rules?.mountings.find((x) => x.code === input.mounting)?.label ?? input.mounting, control?.label, ...opts].filter(Boolean).join(", ");
  return { input: { familySlug, mounting: input.mounting, widthMm: input.widthMm, dimMm, finishCode: input.finishCode, controlCode: input.controlCode ?? null, options: input.options.map((o) => (o.value ? `${o.code}=${o.value}` : o.code)), country: "FR" }, text, why };
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

const eur = (minor: number) => `${(minor / 100).toLocaleString("fr-FR", { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const pct = (bps: number | null) => (bps == null ? "—" : `${(bps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);

async function rowFor(familySlug: string, name: string, image: AdviceRow["image"], policy: PolicyView | null): Promise<AdviceRow> {
  const base = { familySlug, name, image, market: { n: 0, independent: 0, minTtc: null, maxTtc: null, medianTtc: null, from: null, to: null, excluded: 0 }, related: { n: 0, min: null, max: null, reasons: [] as string[] }, confidence: "simulation_interne" as Confidence, confidenceText: CONFIDENCE_FR.simulation_interne, canPrepare: false, current: null, target: null, advice: null, margin: null, explanation: [] as string[] };
  const ref = await referenceFor(familySlug);
  if (!ref) return { ...base, reference: { familySlug, mounting: "freestanding", widthMm: 0, dimMm: 0, country: "FR" }, referenceText: "—", referenceWhy: "", query: "", error: "aucune configuration complète tarifée" };
  const r = await study(ref.input);
  const row: AdviceRow = { ...base, reference: ref.input, referenceText: ref.text, referenceWhy: ref.why, query: studyQuery(ref.input) };
  if ("error" in r) return { ...row, error: r.error ?? "étude impossible" };
  const vat = r.vat ?? 2000;
  if (r.saleHt != null) row.current = { htMinor: r.saleHt, ttcMinor: ttcOf(r.saleHt, vat) };
  const m = policy?.marginTargetBps ?? null;
  const t = m != null ? targetOf(r, m) : null;
  if (t) row.target = { ...t, ttcMinor: ttcOf(t.htMinor, vat) };
  const s = r.stats;
  row.market = { n: s.n, independent: s.independent, minTtc: s.minMinor != null ? ttcOf(s.minMinor, vat) : null, maxTtc: s.maxMinor != null ? ttcOf(s.maxMinor, vat) : null, medianTtc: s.medianMinor != null ? ttcOf(s.medianMinor, vat) : null, from: s.dates.from, to: s.dates.to, excluded: r.evals.filter((e) => !e.retained).length };
  // apparentées : écartées seulement pour le périmètre, la base fiscale, le prix « à partir de » ou la promotion
  const hard = /autre produit|autre marché|devise|dimensions|implantation|archivé/;
  const rel = r.evals.filter((e) => !e.retained && e.dimsMatch !== "no" && !e.reasons.some((x) => hard.test(x)));
  const relPrices = rel.map((e) => e.obs.regularPriceMinor ?? e.obs.priceMinor).filter((x): x is number => x != null).sort((a, b) => a - b);
  row.related = { n: rel.length, min: relPrices[0] ?? null, max: relPrices.at(-1) ?? null, reasons: [...new Set(rel.flatMap((e) => e.reasons))].slice(0, 4) };
  row.confidence = r.reco?.confidence ?? (s.n === 0 ? "simulation_interne" : "indicative");
  row.confidenceText = CONFIDENCE_FR[row.confidence];
  const ex = row.explanation;
  // prix conseillé : marge cible par défaut ; marché seulement avec au moins trois offres fortes et indépendantes
  const aligned = r.reco?.recommended;
  if (t && (s.independent < 3 || !aligned)) {
    row.advice = { htMinor: t.htMinor, ttcMinor: ttcOf(t.htMinor, vat), kind: "target", title: s.n === 0 ? "Prix calculé selon votre marge cible — comparaison marché insuffisante" : `Prix calculé selon votre marge cible — comparaison marché indicative (${s.n} offre${s.n > 1 ? "s" : ""} retenue${s.n > 1 ? "s" : ""})` };
  } else if (aligned) {
    row.advice = { htMinor: aligned.htMinor, ttcMinor: aligned.ttcMinor, kind: aligned.htMinor === t?.htMinor ? "target" : "market", title: `Aligné sur la médiane de ${s.n} offres fortement comparables (${s.independent} indépendantes), jamais sous le plancher` };
  }
  if (row.advice && r.cost) row.margin = { known: marginOf(row.advice.htMinor, r.cost.knownNetMinor), prudent: marginOf(row.advice.htMinor, r.cost.prudentNetMinor), partial: r.cost.partial };
  // explication
  if (m == null) ex.push("Aucune marge cible dans la politique de coût en vigueur : fixez-la dans « Politique de coût ».");
  else ex.push(`Marge brute cible ${pct(m)} du prix de vente HT (politique de coût v${policy!.version}) ; remise revendeur ${pct(policy!.discountBps)} sur les postes éligibles.`);
  if (t?.unknown.length) ex.push(`Marge cible non garantie : éligibilité à la remise inconnue pour ${t.unknown.join(", ")} (prix de vente conservé ; marge prudente ${pct(row.margin?.prudent.onPriceBps ?? null)}).`);
  if (t?.missing.length) ex.push(`Élément(s) à chiffrer, hors prix : ${t.missing.join(", ")}.`);
  if (s.n === 0) ex.push(`Aucune offre fortement comparable retenue (${row.market.excluded} relevé(s) écarté(s) : dimensions, implantation, périmètre, HT/TTC non indiqué, promotion sans prix normal ou ancienneté).`);
  else {
    const at = row.advice ? row.advice.ttcMinor : null;
    const pos = at == null || row.market.medianTtc == null ? "" : at < row.market.minTtc! ? "sous la plus basse" : at > row.market.maxTtc! ? "au-dessus de la plus haute" : at <= row.market.medianTtc ? "entre la plus basse et la médiane" : "entre la médiane et la plus haute";
    ex.push(`Position : prix conseillé ${pos} des ${s.n} offre(s) retenue(s) (${eur(row.market.minTtc!)} à ${eur(row.market.maxTtc!)} TTC, médiane ${eur(row.market.medianTtc!)}), relevées du ${s.dates.from?.toLocaleDateString("fr-FR")} au ${s.dates.to?.toLocaleDateString("fr-FR")}.`);
    const gaps = new Map<string, number>();
    for (const e of r.evals.filter((x) => x.retained)) for (const g of e.gaps) gaps.set(SCOPE_FR[g.key], (gaps.get(SCOPE_FR[g.key]) ?? 0) + 1);
    if (gaps.size) ex.push(`Écarts d'équipement documentés : ${[...gaps].map(([k, n]) => `${k} (${n})`).join(", ")} ; seuls les écarts dont le montant est publié sont normalisés.`);
    ex.push("Qualité : aucune équivalence déduite de l'aspect ; matériaux, garanties et résistances sont détaillés dans l'étude.");
  }
  const unknownCosts = r.costs.filter((c) => c.status === "unknown").map((c) => DIRECT_COST_FR[c.key]);
  if (unknownCosts.length) ex.push(`Coûts directs non renseignés (non comptés, jamais zéro) : ${unknownCosts.join(", ")}. La marge brute n'est pas un bénéfice net.`);
  row.canPrepare = !!row.advice && !!row.current && row.advice.htMinor !== row.current.htMinor && (r.floor?.floorHtMinor == null || row.advice.htMinor >= r.floor.floorHtMinor);
  return row;
}

export async function adviceOverview() {
  const policy = await policyAt();
  const families = await prisma.productFamily.findMany({
    where: { legacy: false, status: { in: ["PUBLISHED", "QUOTE_ONLY"] }, category: { not: null } },
    select: { slug: true, name: true, media: { where: { media: { status: "PUBLISHED", nature: { notIn: ["DOCUMENT", "VIDEO"] } } }, select: { media: { select: { path: true, alt: true } } }, orderBy: { sortOrder: "asc" }, take: 1 } },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
  const priced: AdviceRow[] = [];
  for (const f of families) {
    if (!(await entryPriceFor(f.slug))) continue;
    const m = f.media[0]?.media;
    priced.push(await rowFor(f.slug, f.name, m ? { path: m.path, alt: m.alt } : null, policy));
  }
  const last = await prisma.marketObservation.aggregate({ where: { status: "ACTIVE" }, _max: { observedAt: true }, _count: true });
  const compared = priced.filter((r) => r.market.n > 0).length;
  const summary: string[] = [];
  for (const r of priced) {
    if (!r.current || r.market.medianTtc == null) continue;
    const gap = Math.round(((r.current.ttcMinor - r.market.medianTtc) * 1000) / r.market.medianTtc) / 10;
    summary.push(`${r.name} : prix actuel ${gap >= 0 ? `${gap.toLocaleString("fr-FR")} % au-dessus` : `${(-gap).toLocaleString("fr-FR")} % en dessous`} de la médiane de ${r.market.n} offre(s) retenue(s).`);
  }
  return { policy, rows: priced, lastObservedAt: last._max.observedAt, observations: last._count, compared, summary };
}

/** Recalcule, côté serveur, le prix conseillé d'un produit (jamais un prix transmis par le navigateur). */
export async function adviceFor(familySlug: string): Promise<AdviceRow | null> {
  const policy = await policyAt();
  const f = await prisma.productFamily.findUnique({ where: { slug: familySlug }, select: { slug: true, name: true } });
  if (!f || !(await entryPriceFor(f.slug))) return null;
  return rowFor(f.slug, f.name, null, policy);
}
