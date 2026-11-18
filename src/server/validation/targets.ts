/**
 * Lecture des cibles de validation et de leurs données « versionnées » (sous-ensemble stable, sans horodatage
 * ni compteurs de stock, pour que l'empreinte ne change que si une donnée validable change).
 * Imports relatifs : utilisé aussi par prisma/seed.ts.
 */
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { dataHash, type TargetType } from "./core";

export type Db = PrismaClient | Prisma.TransactionClient;

export interface TargetSnapshot {
  type: TargetType;
  id: string;
  label: string;
  familySlug: string | null;
  data: Record<string, unknown>;
  hash: string;
}

export function specTargetId(familySlug: string, key: string) {
  return `${familySlug}#${key}`;
}

export async function loadTarget(db: Db, type: TargetType, id: string): Promise<TargetSnapshot | null> {
  if (type === "VARIANT") {
    const v = await db.variant.findUnique({ where: { sku: id }, include: { family: { select: { slug: true } } } });
    if (!v) return null;
    const data = {
      sku: v.sku, label: v.label, priceCents: v.priceCents, compareAtCents: v.compareAtCents, taxRateBps: v.taxRateBps, purchasable: v.purchasable, dataStatus: v.dataStatus,
      availability: v.availability, leadMinDays: v.leadMinDays, leadMaxDays: v.leadMaxDays, leadUnit: v.leadUnit, leadSource: v.leadSource, attributes: v.attributes,
      validationSource: v.validationSource, validationDocumentId: v.validationDocumentId,
    };
    return { type, id, label: `${v.sku} — ${v.label}`, familySlug: v.family.slug, data, hash: dataHash(data) };
  }
  if (type === "FAMILY_SPEC") {
    const [slug, key] = id.split("#");
    if (!slug || !key) return null;
    const fam = await db.productFamily.findUnique({ where: { slug }, select: { id: true, name: true, slug: true } });
    if (!fam) return null;
    const rows = await db.technicalSpec.findMany({ where: { familyId: fam.id, key }, orderBy: [{ source: "asc" }, { createdAt: "asc" }] });
    if (!rows.length) return null;
    const specs = rows
      .map((r) => ({ source: r.source, valueNum: r.valueNum, unit: r.unit, valueText: r.valueText, sourceRef: r.sourceRef, observedAt: r.observedAt ? r.observedAt.toISOString().slice(0, 10) : null, variantSku: r.variantSku }))
      .sort((a, b) => (a.source + String(a.valueNum) + a.sourceRef < b.source + String(b.valueNum) + b.sourceRef ? -1 : 1));
    const data = { familySlug: slug, key, label: rows[0]!.label, specs };
    return { type, id, label: `${fam.name} — ${rows[0]!.label}`, familySlug: slug, data, hash: dataHash(data) };
  }
  if (type === "CLOSURE_RULE") {
    const r = await db.closureCompatRule.findUnique({ where: { id } });
    if (!r) return null;
    const data = { closureFamilySlug: r.closureFamilySlug, pergolaFamilySlug: r.pergolaFamilySlug, segmentLengthMm: r.segmentLengthMm, pergolaFinishCode: r.pergolaFinishCode, mounting: r.mounting, status: r.status, reason: r.reason, dataStatus: r.dataStatus };
    const label = `${r.closureFamilySlug} sur ${r.pergolaFamilySlug === "*" ? "toutes gammes" : r.pergolaFamilySlug}${r.segmentLengthMm ? `, ${r.segmentLengthMm / 1000} m` : ""}${r.pergolaFinishCode !== "*" ? `, ${r.pergolaFinishCode}` : ""}${r.mounting !== "*" ? `, ${r.mounting}` : ""}`;
    return { type, id, label, familySlug: r.closureFamilySlug, data, hash: dataHash(data) };
  }
  const r = await db.optionCompatRule.findUnique({ where: { id } });
  if (!r) return null;
  const data = { optionFamilySlug: r.optionFamilySlug, pergolaFamilySlug: r.pergolaFamilySlug, status: r.status, includedInBase: r.includedInBase, maxQty: r.maxQty, reason: r.reason, dataStatus: r.dataStatus };
  return { type, id, label: `${r.optionFamilySlug} sur ${r.pergolaFamilySlug === "*" ? "toutes gammes" : r.pergolaFamilySlug}`, familySlug: r.optionFamilySlug, data, hash: dataHash(data) };
}

/** Cibles proposées dans le sélecteur de création (priorité aux données non vérifiées). */
export async function listTargets(db: Db, type: TargetType, q = ""): Promise<Array<{ id: string; label: string; status: string }>> {
  const take = 60;
  if (type === "VARIANT") {
    const vs = await db.variant.findMany({ where: { dataStatus: { not: "SUPPLIER_VERIFIED" }, ...(q ? { OR: [{ sku: { contains: q, mode: "insensitive" } }, { label: { contains: q, mode: "insensitive" } }] } : {}) }, orderBy: { sku: "asc" }, take, select: { sku: true, label: true, dataStatus: true } });
    return vs.map((v) => ({ id: v.sku, label: `${v.sku} — ${v.label}`, status: v.dataStatus }));
  }
  if (type === "FAMILY_SPEC") {
    const rows = await db.technicalSpec.findMany({ include: { family: { select: { slug: true, name: true } } }, orderBy: { createdAt: "asc" } });
    const seen = new Map<string, { id: string; label: string; status: string }>();
    for (const r of rows) {
      const id = specTargetId(r.family.slug, r.key);
      const prev = seen.get(id);
      const status = r.source === "SUPPLIER_CONFIRMED" ? "SUPPLIER_CONFIRMED" : prev?.status ?? r.source;
      seen.set(id, { id, label: `${r.family.name} — ${r.label}`, status });
    }
    return [...seen.values()].filter((t) => !q || t.label.toLowerCase().includes(q.toLowerCase()));
  }
  if (type === "CLOSURE_RULE") {
    const rs = await db.closureCompatRule.findMany({ where: { dataStatus: { not: "SUPPLIER_VERIFIED" } }, orderBy: [{ closureFamilySlug: "asc" }, { pergolaFamilySlug: "asc" }], take });
    return rs.map((r) => ({ id: r.id, label: `${r.closureFamilySlug} sur ${r.pergolaFamilySlug}${r.segmentLengthMm ? ` (${r.segmentLengthMm / 1000} m)` : ""}${r.pergolaFinishCode !== "*" ? ` ${r.pergolaFinishCode}` : ""} — ${r.status}`, status: r.dataStatus }));
  }
  const rs = await db.optionCompatRule.findMany({ where: { dataStatus: { not: "SUPPLIER_VERIFIED" } }, orderBy: [{ optionFamilySlug: "asc" }, { pergolaFamilySlug: "asc" }], take });
  return rs.map((r) => ({ id: r.id, label: `${r.optionFamilySlug} sur ${r.pergolaFamilySlug} — ${r.status}`, status: r.dataStatus }));
}
