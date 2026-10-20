import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Availability, CatalogSnapshot, DataStatus, Family, FamilyKind, LeadUnit, Mounting, PriceGridSnapshot, SurchargeKind, Variant, VariantAttributes } from "@/domain/types";
import type { DataStatus as DbDataStatus, FamilyKind as DbFamilyKind, FamilyStatus as DbFamilyStatus, Mounting as DbMounting, CompatStatus as DbCompatStatus } from "@/generated/prisma/enums";
import type { SpecSource } from "@/domain/technical-spec";

export function dataStatusFromDb(s: DbDataStatus): DataStatus {
  return s.toLowerCase() as DataStatus;
}
export function dataStatusToDb(s: DataStatus): DbDataStatus {
  return s.toUpperCase() as DbDataStatus;
}
export function kindFromDb(k: DbFamilyKind): FamilyKind {
  return k.toLowerCase() as FamilyKind;
}
export function statusFromDb(s: DbFamilyStatus): Family["status"] {
  return s.toLowerCase() as Family["status"];
}
export function mountingFromDb(m: DbMounting): Mounting {
  return m === "WALL" ? "wall" : "freestanding";
}
export function mountingToDb(m: Mounting): DbMounting {
  return m === "wall" ? "WALL" : "FREESTANDING";
}
function compatFromDb(s: DbCompatStatus) {
  return s.toLowerCase() as "allowed" | "forbidden" | "unknown";
}

let cache: { at: number; snapshot: CatalogSnapshot } | null = null;
const TTL_MS = 10_000;

/** Charge l'instantané du catalogue depuis la base (cache court en mémoire). */
export async function loadCatalog(opts: { fresh?: boolean } = {}): Promise<CatalogSnapshot> {
  if (!opts.fresh && cache && Date.now() - cache.at < TTL_MS) return cache.snapshot;
  const [settings, finishes, dimensions, families, variants, closureCompat, optionCompat, installationRates, shippingRules, promotions, custom, grids] = await Promise.all([
    prisma.siteSettings.findUnique({ where: { id: 1 } }),
    prisma.finish.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.dimensionPreset.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.productFamily.findMany({ where: { status: { not: "ARCHIVED" } }, include: { finishes: true, dimensions: true, technicalSpecs: { orderBy: { createdAt: "asc" } } }, orderBy: { sortOrder: "asc" } }),
    prisma.variant.findMany({ where: { active: true }, include: { family: { select: { slug: true } } } }),
    prisma.closureCompatRule.findMany(),
    prisma.optionCompatRule.findMany(),
    prisma.installationRate.findMany(),
    prisma.shippingRule.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.promotion.findMany(),
    prisma.customPergolaSettings.findUnique({ where: { id: 1 } }),
    prisma.priceGrid.findMany({ where: { status: "PUBLISHED" }, include: { cells: true, surcharges: { orderBy: { sortOrder: "asc" } } } }),
  ]);
  const latest = [...families.map((f) => f.updatedAt.getTime()), ...variants.map((v) => v.updatedAt.getTime()), ...closureCompat.map((r) => r.updatedAt.getTime()), ...optionCompat.map((r) => r.updatedAt.getTime()), ...installationRates.map((r) => r.updatedAt.getTime()), ...shippingRules.map((r) => r.updatedAt.getTime()), ...promotions.map((p) => p.updatedAt.getTime()), custom?.updatedAt.getTime() ?? 0, settings?.updatedAt.getTime() ?? 0, ...grids.map((g) => g.updatedAt.getTime())].reduce((a, b) => Math.max(a, b), 0);
  const version = createHash("sha1").update(`${latest}:${variants.length}:${closureCompat.length}:${optionCompat.length}:${grids.map((g) => `${g.id}@${g.version}`).join(",")}`).digest("hex").slice(0, 12);

  const snapshot: CatalogSnapshot = {
    version,
    generatedAt: new Date().toISOString(),
    taxRateBps: settings?.defaultTaxRateBps ?? 2000,
    finishes: finishes.map((f) => ({ code: f.code, label: f.label, structureColor: f.structureColor, bladeColor: f.bladeColor, swatch: f.swatch })),
    dimensions: dimensions.map((d) => ({ code: d.code, label: d.label, widthMm: d.widthMm, lengthMm: d.lengthMm })),
    families: families.map((f) => ({
      slug: f.slug,
      name: f.name,
      kind: kindFromDb(f.kind),
      status: statusFromDb(f.status),
      generation: f.generation ?? undefined,
      shortDescription: f.shortDescription,
      roof: (f.roof as Family["roof"]) ?? undefined,
      lightingIncluded: (f.lightingIncluded as Family["lightingIncluded"]) ?? undefined,
      accessoryRails: f.accessoryRails ?? undefined,
      dividerThresholdMm: f.dividerThresholdMm ?? undefined,
      finishCodes: f.finishes.map((x) => x.finishCode),
      dimensionCodes: f.dimensions.map((x) => x.dimensionCode),
      mountings: f.mountings.map(mountingFromDb),
      specs: (f.specs as Family["specs"]) ?? [],
      technicalSpecs: f.technicalSpecs.map((s) => ({ key: s.key, label: s.label, valueNum: s.valueNum, unit: s.unit, valueText: s.valueText, source: s.source.toLowerCase() as SpecSource, sourceRef: s.sourceRef, observedAt: s.observedAt?.toISOString().slice(0, 10) ?? null, variantSku: s.variantSku })),
      dataStatus: dataStatusFromDb(f.dataStatus),
    })),
    variants: variants.map(
      (v): Variant => ({
        sku: v.sku,
        familySlug: v.family.slug,
        label: v.label,
        priceCents: v.priceCents,
        compareAtCents: v.compareAtCents,
        taxRateBps: v.taxRateBps,
        purchasable: v.purchasable,
        dataStatus: dataStatusFromDb(v.dataStatus),
        stockMode: v.stockMode === "STOCK" ? "stock" : "made_to_order",
        stockQty: v.stockQty,
        leadTimeDays: v.leadTimeDays,
        weightGrams: v.weightGrams,
        availability: v.availability.toLowerCase() as Availability,
        leadMinDays: v.leadMinDays,
        leadMaxDays: v.leadMaxDays,
        leadUnit: v.leadUnit.toLowerCase() as LeadUnit,
        leadSource: dataStatusFromDb(v.leadSource),
        leadUpdatedAt: v.leadUpdatedAt?.toISOString() ?? null,
        leadComponents: { supplier: v.supplierDays, preparation: v.preparationDays, production: v.productionDays, transport: v.transportDays },
        preorderAllowed: v.preorderAllowed,
        partialShipAllowed: v.partialShipAllowed,
        attributes: v.attributes as VariantAttributes,
      }),
    ),
    closureCompat: closureCompat.map((r) => ({
      closureFamilySlug: r.closureFamilySlug,
      pergolaFamilySlug: r.pergolaFamilySlug,
      segmentLengthMm: r.segmentLengthMm ?? "*",
      pergolaFinishCode: r.pergolaFinishCode,
      mounting: r.mounting === "*" ? "*" : (r.mounting as Mounting),
      status: compatFromDb(r.status),
      reason: r.reason ?? undefined,
      dataStatus: dataStatusFromDb(r.dataStatus),
    })),
    optionCompat: optionCompat.map((r) => ({
      optionFamilySlug: r.optionFamilySlug,
      pergolaFamilySlug: r.pergolaFamilySlug,
      status: compatFromDb(r.status),
      includedInBase: r.includedInBase,
      maxQty: r.maxQty ?? undefined,
      reason: r.reason ?? undefined,
      dataStatus: dataStatusFromDb(r.dataStatus),
    })),
    installationRates: installationRates.map((r) => ({ familySlug: r.familySlug, dimensionCode: r.dimensionCode ?? undefined, priceCents: r.priceCents, dataStatus: dataStatusFromDb(r.dataStatus) })),
    shippingRules: shippingRules.map((r) => ({ countryCode: r.countryCode, postalPrefixes: r.postalPrefixes, priceCents: r.priceCents, label: r.label, quoteRequired: r.quoteRequired })),
    promotions: promotions.map((p) => ({ code: p.code ?? "", label: p.label, familySlugs: p.allFamilies ? "*" : p.familySlugs, percentBps: p.percentBps, startsAt: p.startsAt?.toISOString(), endsAt: p.endsAt?.toISOString(), active: p.active })),
    custom: {
      quoteOnly: custom?.quoteOnly ?? true,
      widthMm: { min: custom?.widthMinMm ?? 2000, max: custom?.widthMaxMm ?? 4000, step: custom?.widthStepMm ?? 10 },
      lengthMm: { min: custom?.lengthMinMm ?? 2000, max: custom?.lengthMaxMm ?? 6000, step: custom?.lengthStepMm ?? 10 },
      heightMm: { min: custom?.heightMinMm ?? 2200, max: custom?.heightMaxMm ?? 3000, step: custom?.heightStepMm ?? 10 },
      dataStatus: custom ? dataStatusFromDb(custom.dataStatus) : "unknown",
      grids: grids.map(gridFromDb),
    },
    shipmentPolicy: settings?.shipmentPolicy === "SEPARATE" ? "SEPARATE" : "GROUPED",
  };
  cache = { at: Date.now(), snapshot };
  return snapshot;
}

type DbGrid = Awaited<ReturnType<typeof prisma.priceGrid.findMany<{ include: { cells: true; surcharges: true } }>>>[number];

/** Conversion d'une grille stockée vers l'instantané du moteur (aussi utilisée pour tester une grille en brouillon). */
export function gridFromDb(g: DbGrid): PriceGridSnapshot {
  return {
    id: g.id,
    familySlug: g.familySlug,
    name: g.name,
    version: g.version,
    status: g.status.toLowerCase() as PriceGridSnapshot["status"],
    mode: g.mode === "BANDS" ? "bands" : "table",
    validFrom: g.validFrom?.toISOString() ?? null,
    validTo: g.validTo?.toISOString() ?? null,
    dataStatus: dataStatusFromDb(g.dataStatus),
    isDemo: g.isDemo,
    widthMm: { min: g.widthMinMm, max: g.widthMaxMm, step: g.widthStepMm },
    lengthMm: { min: g.lengthMinMm, max: g.lengthMaxMm, step: g.lengthStepMm },
    heightMm: { min: g.heightMinMm, max: g.heightMaxMm, step: g.heightStepMm },
    mountings: g.mountings.filter((m): m is Mounting => m === "wall" || m === "freestanding"),
    finishCodes: g.finishCodes,
    cells: g.cells.map((c) => ({ widthMinMm: c.widthMinMm, widthMaxMm: c.widthMaxMm, lengthMinMm: c.lengthMinMm, lengthMaxMm: c.lengthMaxMm, mounting: (c.mounting === "wall" || c.mounting === "freestanding" ? c.mounting : "*") as Mounting | "*", finishCode: c.finishCode, priceCents: c.priceCents })),
    surcharges: g.surcharges.map((x) => ({ code: x.code, label: x.label, kind: x.kind as SurchargeKind, match: x.match, thresholdMm: x.thresholdMm, perStepMm: x.perStepMm, perStepCents: x.perStepCents, priceCents: x.priceCents, percentBps: x.percentBps })),
  };
}

export function invalidateCatalogCache() {
  cache = null;
}
