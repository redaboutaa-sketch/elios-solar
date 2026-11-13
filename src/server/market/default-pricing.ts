/**
 * Politique de vente par défaut (administrateurs) : la marge brute cible de la politique de coût en vigueur est
 * appliquée aux grilles de vente publiées, par le moteur des grilles (derivePolicySaleGrid) : aperçu, brouillons, puis
 * publication explicite (vérification + publication de chaque brouillon ; versions antérieures conservées, retour
 * arrière par « reprendre en brouillon »). Aucun montant ni taux n'est écrit dans le journal.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { derivePolicySaleGrid, getGrid, publishGrid, verifyGrid, type Actor, type PolicyDerivation, type SalePolicyRule } from "@/server/tariffs/grids";
import { MarketError, policyAt, type PolicyView } from "./policy";

export function ruleOf(p: PolicyView): SalePolicyRule {
  if (p.marginTargetBps == null) throw new MarketError(`La politique de coût v${p.version} ne définit pas de marge brute cible : renseignez-la dans « Politique de coût ».`);
  return { policyVersion: p.version, discountBps: p.discountBps, marginBps: p.marginTargetBps, eligibility: p.eligibility, saleRounding: p.saleRounding };
}

/** Grilles de vente publiées des produits proposés (hors anciens modèles archivés). */
export async function activeSaleGrids(familySlug?: string) {
  const families = await prisma.productFamily.findMany({ where: { status: { not: "ARCHIVED" }, legacy: false, ...(familySlug ? { slug: familySlug } : {}) }, select: { slug: true } });
  return prisma.supplierPriceList.findMany({
    where: { scope: "GRID", nature: "SALE", status: "ACTIVE", familySlug: { in: families.map((f) => f.slug) } },
    orderBy: [{ familySlug: "asc" }, { variantKey: "asc" }],
    select: { id: true, familySlug: true, variantKey: true, version: true, sourceKey: true },
  });
}

async function policyOrThrow(): Promise<PolicyView> {
  const p = await policyAt();
  if (!p) throw new MarketError("Aucune politique de coût en vigueur.");
  return p;
}

/** Aperçu (aucune écriture) : pour chaque grille, cellules modifiées, suppléments par base de calcul, exemple. */
export async function previewDefaultPricing(familySlug?: string): Promise<{ policy: PolicyView; rows: PolicyDerivation[] }> {
  const policy = await policyOrThrow();
  const rule = ruleOf(policy);
  const rows = [];
  for (const g of await activeSaleGrids(familySlug)) rows.push(await derivePolicySaleGrid(g.id, rule, {}, { dryRun: true }));
  return { policy, rows };
}

/** Brouillons recalculés (idempotent : une version identique n'est jamais recréée). */
export async function prepareDefaultPricing(actor: Actor, familySlug?: string): Promise<{ policy: PolicyView; rows: PolicyDerivation[] }> {
  const policy = await policyOrThrow();
  const rule = ruleOf(policy);
  const rows = [];
  for (const g of await activeSaleGrids(familySlug)) rows.push(await derivePolicySaleGrid(g.id, rule, actor));
  await audit({ ...actor, action: "market.defaultPricing.prepare", entity: "CostPolicyVersion", entityId: policy.id, after: { version: policy.version, drafts: rows.filter((r) => r.draft?.created).length } });
  return { policy, rows };
}

/**
 * Publication explicite des brouillons issus de la politique (vérification puis publication immédiate). Seuls des
 * brouillons recalculés par la politique sont acceptés ; chaque publication remplace la version en vigueur, conservée.
 */
export async function publishDefaultPricing(draftIds: string[], actor: Actor): Promise<Array<{ id: string; sourceKey: string; version: number; ok: boolean; error?: string }>> {
  const out = [];
  for (const id of draftIds) {
    const g = await getGrid(id);
    try {
      if (g.nature !== "SALE" || g.status !== "DRAFT" || !/^Politique de coût v\d+ :/.test(g.notes)) throw new MarketError("brouillon non issu de la politique de vente");
      await verifyGrid(id, g.revision, actor);
      await publishGrid(id, g.revision + 1, { at: null }, actor);
      out.push({ id, sourceKey: g.sourceKey, version: g.version, ok: true });
    } catch (e) {
      out.push({ id, sourceKey: g.sourceKey, version: g.version, ok: false, error: (e as Error).message });
    }
  }
  await audit({ ...actor, action: "market.defaultPricing.publish", entity: "SupplierPriceList", entityId: draftIds.join(",").slice(0, 190), after: { published: out.filter((o) => o.ok).length, failed: out.filter((o) => !o.ok).length } });
  return out;
}
