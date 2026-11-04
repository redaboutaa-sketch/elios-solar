/**
 * Politique de coût interne (comparatif marché) : versions successives, jamais modifiées. Réservé aux administrateurs ;
 * le journal ne contient ni taux ni montant.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { DEFAULT_ROUNDING, DIRECT_COST_KEYS, type DirectCostInput, type Eligibility, type RoundingRule } from "@/domain/market";
import type { Actor } from "@/server/tariffs/grids";

export interface PolicyView {
  id: string;
  version: number;
  validFrom: Date;
  discountBps: number;
  eligibility: Record<string, Eligibility>;
  directCosts: DirectCostInput[];
  marginTargetBps: number | null;
  contributionTargetBps: number | null;
  staleDays: number;
  dimToleranceBps: number;
  rounding: RoundingRule;
  note: string;
  createdBy: string | null;
  createdAt: Date;
}

export class MarketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketError";
  }
}

/** Coûts directs par défaut : tous inconnus (jamais zéro), sauf la commission, signalée comme hypothèse. */
export const DEFAULT_DIRECT_COSTS: DirectCostInput[] = [
  { key: "transport", status: "unknown", mode: "fixed", billedToClient: true, note: "livraison chiffrée séparément au devis ; coût réel non renseigné" },
  { key: "pose", status: "unknown", mode: "fixed", billedToClient: true, note: "pose chiffrée séparément au devis ; coût réel non renseigné" },
  { key: "paiement", status: "unknown", mode: "percent", base: "sale_ttc", note: "paiement en ligne non activé ; frais du moyen de paiement non renseignés" },
  { key: "acquisition", status: "unknown", mode: "fixed", note: "coût d'acquisition par vente non renseigné" },
  { key: "sav", status: "unknown", mode: "percent", base: "sale_ht", note: "provision SAV non renseignée" },
  { key: "commission", status: "known", mode: "percent", percentBps: 300, base: "sale_ht", note: "commission Beaver Data 3 % — hypothèse : applicable, assiette prix de vente HT du produit" },
];

const view = (p: Prisma.CostPolicyVersionGetPayload<object>): PolicyView => ({
  id: p.id, version: p.version, validFrom: p.validFrom, discountBps: p.discountBps,
  eligibility: (p.eligibility ?? {}) as Record<string, Eligibility>,
  directCosts: normalizeCosts(p.directCosts as unknown as DirectCostInput[] | null),
  marginTargetBps: p.marginTargetBps, contributionTargetBps: p.contributionTargetBps, staleDays: p.staleDays, dimToleranceBps: p.dimToleranceBps,
  rounding: { ...DEFAULT_ROUNDING, ...((p.rounding ?? {}) as Partial<RoundingRule>) }, note: p.note, createdBy: p.createdBy, createdAt: p.createdAt,
});

export function normalizeCosts(list: DirectCostInput[] | null | undefined): DirectCostInput[] {
  return DIRECT_COST_KEYS.map((key) => (Array.isArray(list) ? list.find((c) => c?.key === key) : undefined) ?? DEFAULT_DIRECT_COSTS.find((c) => c.key === key)!);
}

/** Version en vigueur à une date (la plus récente dont la date d'effet est passée) ; null si aucune. */
export async function policyAt(at: Date = new Date()): Promise<PolicyView | null> {
  const p = await prisma.costPolicyVersion.findFirst({ where: { validFrom: { lte: at } }, orderBy: [{ validFrom: "desc" }, { version: "desc" }] });
  return p ? view(p) : null;
}

export async function listPolicies(): Promise<PolicyView[]> {
  return (await prisma.costPolicyVersion.findMany({ orderBy: { version: "desc" } })).map(view);
}

export interface PolicyInput {
  validFrom: Date;
  discountBps: number;
  eligibility: Record<string, Eligibility>;
  directCosts: DirectCostInput[];
  marginTargetBps: number | null;
  contributionTargetBps: number | null;
  staleDays: number;
  dimToleranceBps: number;
  rounding: RoundingRule;
  note: string;
}

export function validatePolicy(p: PolicyInput): string | null {
  if (!Number.isInteger(p.discountBps) || p.discountBps < 0 || p.discountBps >= 10_000) return "Remise invalide (0 à 99,99 %).";
  if (Number.isNaN(p.validFrom.getTime())) return "Date d'effet invalide.";
  for (const t of [p.marginTargetBps, p.contributionTargetBps]) if (t != null && (!Number.isInteger(t) || t < 0 || t >= 10_000)) return "Objectif invalide (0 à 99,99 %).";
  if (!Number.isInteger(p.staleDays) || p.staleDays < 1 || p.staleDays > 3650) return "Seuil d'ancienneté invalide (1 à 3 650 jours).";
  if (!Number.isInteger(p.dimToleranceBps) || p.dimToleranceBps < 0 || p.dimToleranceBps > 5000) return "Tolérance de dimensions invalide (0 à 50 %).";
  if (!Number.isInteger(p.rounding.stepMinor) || p.rounding.stepMinor < 1 || p.rounding.stepMinor > 100_000) return "Pas d'arrondi invalide.";
  for (const [k, v] of Object.entries(p.eligibility)) if (!/^(structure|supplement:[\w:=.-]{1,80})$/.test(k) || !["ELIGIBLE", "NOT_ELIGIBLE", "UNKNOWN"].includes(v)) return `Éligibilité invalide : ${k}`;
  for (const c of p.directCosts) {
    if (c.status === "known" && c.mode === "fixed" && (c.amountMinor == null || !Number.isInteger(c.amountMinor) || c.amountMinor < 0)) return `Montant manquant pour un coût renseigné (${c.key}).`;
    if (c.status === "known" && c.mode === "percent" && (c.percentBps == null || !Number.isInteger(c.percentBps) || c.percentBps < 0 || c.percentBps > 5000)) return `Pourcentage manquant ou invalide pour un coût renseigné (${c.key}).`;
  }
  return null;
}

/** Nouvelle version (aucune version n'est modifiée). */
export async function createPolicyVersion(p: PolicyInput, actor: Actor): Promise<PolicyView> {
  const err = validatePolicy(p);
  if (err) throw new MarketError(err);
  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('market:cost-policy'))`;
    const last = await tx.costPolicyVersion.findFirst({ orderBy: { version: "desc" }, select: { version: true } });
    return tx.costPolicyVersion.create({
      data: {
        version: (last?.version ?? 0) + 1, validFrom: p.validFrom, discountBps: p.discountBps, eligibility: p.eligibility as Prisma.InputJsonValue,
        directCosts: normalizeCosts(p.directCosts) as unknown as Prisma.InputJsonValue, marginTargetBps: p.marginTargetBps, contributionTargetBps: p.contributionTargetBps,
        staleDays: p.staleDays, dimToleranceBps: p.dimToleranceBps, rounding: p.rounding as unknown as Prisma.InputJsonValue, note: p.note.slice(0, 2000), createdBy: actor.actorEmail ?? null,
      },
    });
  });
  // journal : aucune valeur (taux, montants)
  await audit({ ...actor, action: "market.policy", entity: "CostPolicyVersion", entityId: created.id, after: { version: created.version, validFrom: created.validFrom.toISOString() } });
  return view(created);
}
