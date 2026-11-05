/**
 * Étude d'une configuration réelle : prix actuel (grille de vente en vigueur), coût d'achat net (grille catalogue
 * fournisseur × politique de coût), marges, contribution, comparables et recommandation. Lecture seule : aucune
 * grille, aucun prix public n'est modifié ici.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { contributionOf, evaluateObservation, floorPrice, marginOf, marketStats, netCostOf, recommend, type DirectCostInput, type ObservationEval, type ScopeKey, type StudyContext } from "@/domain/market";
import type { SystemMounting, SystemRules } from "@/domain/system";
import { simulate } from "@/server/tariffs/queries";
import { listObservations, toDomain } from "./observations";
import { policyAt, type PolicyView } from "./policy";

/** TVA validée par marché (FR : 20 %, décision du 2026-11-02) ; un autre marché n'est pas converti. */
export const VALIDATED_VAT_BPS: Record<string, number> = { FR: 2000 };

export interface StudyInput {
  familySlug: string;
  mounting: SystemMounting;
  widthMm: number;
  dimMm: number;
  finishCode?: string | null;
  controlCode?: string | null;
  /** codes d'options ; « code=valeur » pour une option à valeur (ex. modèle de télécommande) */
  options?: string[];
  country: string;
  includeStale?: boolean;
  /** coûts directs de cette simulation (sinon ceux de la politique) */
  costs?: DirectCostInput[] | null;
  /** périmètre de notre panier (sinon déduit de la configuration) */
  ours?: Partial<Record<ScopeKey, "included" | "extra" | "absent">>;
  /** prix HT simulé */
  simulatedHtMinor?: number | null;
  premiumJustification?: string | null;
  /** version de vente précise (brouillon compris) ; sinon celle en vigueur */
  saleVersionId?: string | null;
  at?: Date;
}

/** Périmètre de notre panier, déduit de la configuration (modifiable par l'administrateur). */
export function defaultOurs(rules: SystemRules, input: { controlCode?: string; options: { code: string }[] }): Record<ScopeKey, "included" | "extra" | "absent"> {
  const ctl = rules.controls?.find((c) => c.code === input.controlCode) ?? rules.controls?.[0];
  const chosen = new Set(input.options.map((o) => o.code));
  const incl = (rules.included ?? []) as Array<{ code?: string; label?: string; visual?: string }>;
  const text = [ctl?.label ?? "", ...incl.map((i) => `${i.code ?? ""} ${i.label ?? ""} ${i.visual ?? ""}`)].join(" ").toLowerCase();
  const motorized = ctl ? (ctl as { kind?: string }).kind !== "manual" : /moteur/.test(text);
  return {
    delivery: "extra",
    installation: "extra",
    motor: motorized ? "included" : "absent",
    remote: /t[ée]l[ée]commande|remote/.test(text) || [...chosen].some((c) => c.startsWith("remote")) ? "included" : "absent",
    led: /led/.test(text) || [...chosen].some((c) => c.startsWith("led")) ? "included" : "absent",
    screen: "absent",
    glazing: "absent",
  };
}

export async function study(s: StudyInput) {
  const at = s.at ?? new Date();
  const [sim, policy, fam] = await Promise.all([
    simulate({ familySlug: s.familySlug, mounting: s.mounting, widthMm: s.widthMm, dimMm: s.dimMm, clientele: "PARTICULIER", at, versionId: s.saleVersionId ?? null, finishCode: s.finishCode ?? null, controlCode: s.controlCode ?? null, options: s.options ?? [] }),
    policyAt(at),
    prisma.productFamily.findUnique({ where: { slug: s.familySlug }, select: { systemRules: true } }),
  ]);
  if ("error" in sim) return { error: sim.error } as const;
  const rules = fam!.systemRules as unknown as SystemRules;
  const sale = sim.saleBreakdown ?? null;
  const saleHt = sale && sale.taxBasis === "HT" ? sale.totalMinor : null;
  const vat = VALIDATED_VAT_BPS[s.country] ?? null;
  const usedSale = sim.price ? sim.used.find((u) => u.variantKey === sim.price!.variantKey) ?? null : null;
  const cost = sim.supplierBreakdown && policy ? netCostOf(sim.supplierBreakdown, sim.supplierSupplements, policy) : null;
  const costs = s.costs ?? policy?.directCosts ?? [];
  const evalAt = (ht: number | null) => {
    if (ht == null || !cost || vat == null) return null;
    const ttc = ht + Math.floor((ht * vat + 5_000) / 10_000);
    const known = marginOf(ht, cost.knownNetMinor);
    const prudent = marginOf(ht, cost.prudentNetMinor);
    const contribution = contributionOf(ht, ttc, { netMinor: cost.prudentNetMinor, partial: cost.partial }, costs);
    return { htMinor: ht, ttcMinor: ttc, known, prudent, contribution };
  };
  const ours = { ...defaultOurs(rules, sim.input), ...(s.ours ?? {}) };
  const ctx: StudyContext = { familySlug: s.familySlug, widthMm: s.widthMm, depthMm: s.dimMm, mounting: s.mounting, country: s.country, vatRateBps: vat, ours, now: at, staleDays: policy?.staleDays ?? 120, dimToleranceBps: policy?.dimToleranceBps ?? 1000, includeStale: !!s.includeStale };
  const observations = (await listObservations({ familySlug: s.familySlug, status: "ALL" })).filter((o) => o.status === "ACTIVE");
  const evals: ObservationEval[] = observations.map((o) => evaluateObservation(toDomain(o), ctx));
  const stats = marketStats(evals);
  const floor = cost ? floorPrice({ costMinor: cost.prudentNetMinor, costPartial: cost.partial, costMissing: [...cost.unknown.map((l) => `${l.label} (éligibilité inconnue)`), ...cost.missing.map((l) => `${l.label} (à chiffrer)`)], vatRateBps: vat ?? 2000, costs, marginTargetBps: policy?.marginTargetBps ?? null, contributionTargetBps: policy?.contributionTargetBps ?? null }) : null;
  const reco = floor && vat != null ? recommend({ stats, floor, vatRateBps: vat, rounding: policy!.rounding, premiumJustification: s.premiumJustification ?? null }) : null;
  const position = saleHt != null && stats.medianMinor != null ? { vsMedianBps: Math.round(((saleHt - stats.medianMinor) * 10_000) / stats.medianMinor), below: evals.filter((e) => e.retained && e.comparableHtMinor! < saleHt).length, above: evals.filter((e) => e.retained && e.comparableHtMinor! > saleHt).length } : null;
  return {
    sim, policy, rules, sale, saleHt, vat, usedSale, cost, costs, ours, ctx,
    current: evalAt(saleHt),
    simulated: evalAt(s.simulatedHtMinor ?? null),
    recommended: reco?.recommended ? evalAt(reco.recommended.htMinor) : null,
    evals, stats, floor, reco, position,
  } as const;
}

export type StudyResult = Extract<Awaited<ReturnType<typeof study>>, { sim: unknown }>;
export type { PolicyView };
