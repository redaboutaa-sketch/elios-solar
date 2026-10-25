/**
 * Lectures de l'écran Tarifs (administrateurs) : tableau de bord, liste filtrée, détail d'une version, historique et
 * simulateur. Les montants ne sortent de ce module que vers des pages réservées au rôle ADMIN.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { CATEGORIES, type CategoryKey } from "@/domain/categories";
import { applyBps } from "@/domain/money";
import { defaultSystemInput, type SystemInput, type SystemMounting, type SystemRules } from "@/domain/system";
import { lookupSystemPrice, type SystemPriceTable } from "@/domain/system-pricing";
import { evaluate } from "@/domain/engine";
import { effectiveState, type Clientele, type EffectiveState } from "@/domain/tariffs";
import { loadCatalog } from "@/server/catalog/load";
import { checksFor, getGrid, gridCells, type GridVersion } from "./grids";

export interface FamilyInfo { slug: string; name: string; status: string; category: CategoryKey | null; supplierRef: string | null }

/** Produits avec leur correspondance fournisseur (donnée interne, administrateurs). */
export async function familiesInfo(): Promise<FamilyInfo[]> {
  const fams = await prisma.productFamily.findMany({ where: { kind: { in: ["PERGOLA_SYSTEM", "SCREEN_SYSTEM", "AWNING_SYSTEM", "ROOF_BLIND_SYSTEM", "INSECT_SCREEN_SYSTEM"] } }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, status: true, category: true, supplierRef: true } });
  return fams.map((f) => ({ slug: f.slug, name: f.name, status: f.status, category: (f.category as CategoryKey | null) ?? null, supplierRef: f.supplierRef ?? null }));
}

const listSelect = { id: true, sourceKey: true, version: true, status: true, familySlug: true, variantKey: true, amountRole: true, nature: true, currency: true, taxBasis: true, clientele: true, dimRule: true, validFrom: true, validTo: true, publishedAt: true, publishedBy: true, deactivatedAt: true, verifiedAt: true, createdAt: true, updatedAt: true, label: true, importedBy: true } as const;

export interface LineageRow {
  sourceKey: string;
  familySlug: string;
  variantKey: string;
  amountRole: string | null;
  versions: (Awaited<ReturnType<typeof listVersions>>[number] & { state: EffectiveState; cells: number })[];
  inForce: { version: number; id: string } | null;
  latest: { version: number; id: string; state: EffectiveState };
}

async function listVersions() {
  return prisma.supplierPriceList.findMany({ where: { scope: "GRID" }, orderBy: [{ sourceKey: "asc" }, { version: "desc" }], select: listSelect });
}

export interface GridFilters { category?: string; family?: string; clientele?: string; state?: string; at?: Date | null; nature?: string }

/** Grilles (lignées) avec leurs versions, filtrées. Une lignée est retenue si l'une de ses versions répond aux filtres. */
export async function listLineages(f: GridFilters = {}): Promise<LineageRow[]> {
  const [versions, counts, fams] = await Promise.all([listVersions(), prisma.supplierPriceRow.groupBy({ by: ["listId"], where: { kind: "GRID", list: { scope: "GRID" } }, _count: { _all: true } }), familiesInfo()]);
  const cat = new Map(fams.map((x) => [x.slug, x.category]));
  const now = new Date();
  const byKey = new Map<string, LineageRow>();
  for (const v of versions) {
    const state = effectiveState(v, now);
    const row = { ...v, state, cells: counts.find((c) => c.listId === v.id)?._count._all ?? 0 };
    let l = byKey.get(v.sourceKey);
    if (!l) byKey.set(v.sourceKey, (l = { sourceKey: v.sourceKey, familySlug: v.familySlug ?? "", variantKey: v.variantKey, amountRole: v.amountRole, versions: [], inForce: null, latest: { version: v.version, id: v.id, state } }));
    l.versions.push(row);
    if (state === "in_force" && !l.inForce) l.inForce = { version: v.version, id: v.id };
  }
  const at = f.at ?? null;
  const match = (v: LineageRow["versions"][number]) =>
    (!f.clientele || v.clientele === f.clientele) &&
    (!f.state || v.state === f.state) &&
    (!f.nature || v.nature === f.nature) &&
    (!at || (v.status === "ACTIVE" || v.status === "ARCHIVED") && v.publishedAt != null && (!v.validFrom || v.validFrom <= at) && (!v.validTo || v.validTo > at));
  return [...byKey.values()].filter((l) => (!f.family || l.familySlug === f.family) && (!f.category || cat.get(l.familySlug) === f.category) && l.versions.some(match));
}

export async function dashboard() {
  const [fams, lineages, recent] = await Promise.all([
    familiesInfo(),
    listLineages(),
    prisma.auditLog.findMany({ where: { action: { in: ["tariffs.publish", "tariffs.deactivate", "tariffs.fromImport", "tariffs.uploadImport"] } }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, action: true, actorEmail: true, createdAt: true, after: true } }),
  ]);
  const anomalies: { id: string; sourceKey: string; version: number; blocking: string[] }[] = [];
  for (const l of lineages) {
    const open = l.versions.filter((v) => v.status === "DRAFT" || v.status === "VERIFIED");
    for (const v of open) {
      const checks = await checksFor(await getGrid(v.id));
      const blocking = checks.filter((c) => c.severity === "blocking").map((c) => c.message);
      if (blocking.length) anomalies.push({ id: v.id, sourceKey: v.sourceKey, version: v.version, blocking });
    }
  }
  const sale = (slug: string) => lineages.filter((l) => l.familySlug === slug && l.versions.some((v) => v.nature === "SALE"));
  const products = fams.map((fam) => {
    const inForce = lineages.filter((l) => l.familySlug === fam.slug).flatMap((l) => l.versions.filter((v) => v.state === "in_force"));
    return { ...fam, inForce, scheduled: lineages.filter((l) => l.familySlug === fam.slug).flatMap((l) => l.versions.filter((v) => v.state === "scheduled")), saleLineages: sale(fam.slug).length };
  });
  const all = lineages.flatMap((l) => l.versions);
  return {
    products,
    counts: { draft: all.filter((v) => v.state === "draft").length, verified: all.filter((v) => v.state === "verified").length, inForce: all.filter((v) => v.state === "in_force").length, scheduled: all.filter((v) => v.state === "scheduled").length, lineages: lineages.length },
    anomalies,
    recent,
    expiring: all.filter((v) => v.state === "in_force" && v.validTo).map((v) => ({ id: v.id, sourceKey: v.sourceKey, version: v.version, validTo: v.validTo! })),
  };
}

export interface GridDetail {
  grid: GridVersion;
  state: EffectiveState;
  rows: { id: string; kind: string; code: string; label: string; dimAKey: string | null; dimAmm: number | null; widthMinMm: number | null; widthMaxMm: number | null; amountMinor: number | null; sourceRef: string; status: string; issues: string[]; formula: string | null; origin: string; editedBy: string | null; editedAt: Date | null; conditions: unknown }[];
  versions: { id: string; version: number; status: string; state: EffectiveState; publishedAt: Date | null; validFrom: Date | null; validTo: Date | null; createdAt: Date }[];
  origin: { id: string; sourceKey: string; version: number; sourceFile: string; createdAt: Date; importedBy: string | null; sourceSha256: string } | null;
  basedOn: { id: string; version: number; sourceKey: string } | null;
  family: FamilyInfo | null;
  history: { id: string; action: string; actorEmail: string | null; createdAt: Date; after: unknown; before: unknown }[];
  /** grilles du même produit et de la même variante (base d'un recalcul) */
  siblings: { id: string; sourceKey: string; version: number; amountRole: string | null; nature: string; state: EffectiveState }[];
}

export async function gridDetail(id: string): Promise<GridDetail> {
  const grid = await getGrid(id);
  const [rows, versions, origin, basedOn, fams, history, siblings] = await Promise.all([
    prisma.supplierPriceRow.findMany({ where: { listId: id }, orderBy: [{ kind: "asc" }, { dimAmm: "asc" }, { widthMinMm: "asc" }, { code: "asc" }], select: { id: true, kind: true, code: true, label: true, dimAKey: true, dimAmm: true, widthMinMm: true, widthMaxMm: true, amountMinor: true, sourceRef: true, status: true, issues: true, formula: true, origin: true, editedBy: true, editedAt: true, conditions: true } }),
    prisma.supplierPriceList.findMany({ where: { sourceKey: grid.sourceKey }, orderBy: { version: "desc" }, select: { id: true, version: true, status: true, publishedAt: true, validFrom: true, validTo: true, createdAt: true, deactivatedAt: true } }),
    grid.originListId ? prisma.supplierPriceList.findUnique({ where: { id: grid.originListId }, select: { id: true, sourceKey: true, version: true, sourceFile: true, createdAt: true, importedBy: true, sourceSha256: true } }) : null,
    grid.basedOnId ? prisma.supplierPriceList.findUnique({ where: { id: grid.basedOnId }, select: { id: true, version: true, sourceKey: true } }) : null,
    familiesInfo(),
    prisma.auditLog.findMany({ where: { entity: "SupplierPriceList", entityId: id }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, action: true, actorEmail: true, createdAt: true, after: true, before: true } }),
    prisma.supplierPriceList.findMany({ where: { scope: "GRID", familySlug: grid.familySlug, variantKey: grid.variantKey, sourceKey: { not: grid.sourceKey } }, orderBy: [{ sourceKey: "asc" }, { version: "desc" }], select: { id: true, sourceKey: true, version: true, amountRole: true, nature: true, status: true, validFrom: true, validTo: true, deactivatedAt: true } }),
  ]);
  const now = new Date();
  return {
    grid, state: effectiveState(grid, now), rows,
    versions: versions.map((v) => ({ ...v, state: effectiveState(v, now) })),
    origin, basedOn, family: fams.find((f) => f.slug === grid.familySlug) ?? null, history,
    siblings: siblings.map((s) => ({ id: s.id, sourceKey: s.sourceKey, version: s.version, amountRole: s.amountRole, nature: s.nature, state: effectiveState(s, now) })),
  };
}

/** Version à comparer par défaut : la version publiée précédente de la lignée, sinon la précédente. */
export async function previousVersionOf(g: GridVersion) {
  return (await prisma.supplierPriceList.findFirst({ where: { sourceKey: g.sourceKey, version: { lt: g.version }, publishedAt: { not: null } }, orderBy: { version: "desc" }, select: { id: true, version: true } }))
    ?? (await prisma.supplierPriceList.findFirst({ where: { sourceKey: g.sourceKey, version: { lt: g.version } }, orderBy: { version: "desc" }, select: { id: true, version: true } }));
}

/* ------------------------------------------------------------------ */
/* Simulateur                                                           */
/* ------------------------------------------------------------------ */

export interface SimulationInput {
  familySlug: string;
  mounting: SystemMounting;
  widthMm: number;
  dimMm: number;
  clientele: Clientele;
  at: Date;
  /** version précise (brouillon compris) ; sinon celle qui serait en vigueur */
  versionId?: string | null;
}

/** Table de prix d'un produit à une date, pour une clientèle (mêmes règles que la boutique), ou d'une version précise. */
async function tableFor(familySlug: string, at: Date, clientele: Clientele, versionId?: string | null) {
  const where = versionId
    ? { id: versionId, scope: "GRID" as const, familySlug }
    : { scope: "GRID" as const, status: "ACTIVE" as const, nature: "SALE" as const, familySlug, clientele: { in: clientele === "ALL" ? ["ALL" as const] : [clientele, "ALL" as const] }, AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: at } }] }, { OR: [{ validTo: null }, { validTo: { gt: at } }] }] };
  const lists = await prisma.supplierPriceList.findMany({ where, orderBy: [{ publishedAt: "desc" }, { version: "desc" }], select: { id: true, version: true, sourceKey: true, variantKey: true, clientele: true, nature: true, status: true, currency: true, taxBasis: true, dimRule: true, vatRateBps: true } });
  const chosen = new Map<string, (typeof lists)[number]>();
  for (const l of [...lists].sort((a, b) => (a.clientele === "ALL" ? 1 : 0) - (b.clientele === "ALL" ? 1 : 0))) if (!chosen.has(l.variantKey)) chosen.set(l.variantKey, l);
  const used = [...chosen.values()];
  if (!used.length) return { table: null, used };
  const table: SystemPriceTable = { currency: used[0]!.currency ?? "", taxBasis: used[0]!.taxBasis === "UNKNOWN" ? null : used[0]!.taxBasis, dimAKey: "projection", listVersion: used[0]!.version, variants: {}, cells: [] };
  for (const l of used) {
    table.variants![l.variantKey] = { currency: l.currency ?? "", taxBasis: l.taxBasis === "UNKNOWN" ? null : l.taxBasis, dimRule: l.dimRule === "ROUND_UP" ? "round_up" : "exact", vatRateBps: l.vatRateBps, listVersion: l.version, versionId: l.id };
    const rows = await prisma.supplierPriceRow.findMany({ where: { listId: l.id, kind: "GRID", amountMinor: { not: null } }, select: { dimAKey: true, dimAmm: true, widthMinMm: true, widthMaxMm: true, amountMinor: true } });
    if (rows[0]?.dimAKey === "hauteur") table.dimAKey = "hauteur";
    for (const r of rows) if (r.dimAmm != null && r.widthMaxMm != null) table.cells.push({ variantKey: l.variantKey, dimAmm: r.dimAmm, widthMinMm: r.widthMinMm ?? r.widthMaxMm, widthMaxMm: r.widthMaxMm, amountMinor: r.amountMinor! });
  }
  return { table, used };
}

export async function simulate(s: SimulationInput) {
  const fam = await prisma.productFamily.findUnique({ where: { slug: s.familySlug }, select: { slug: true, name: true, status: true, systemRules: true } });
  if (!fam?.systemRules) return { error: "Produit sans règles de configuration." } as const;
  const rules = fam.systemRules as unknown as SystemRules;
  const input: SystemInput = { ...defaultSystemInput(fam.slug, rules), kind: "system", familySlug: fam.slug, mounting: s.mounting, widthMm: s.widthMm, ...(rules.dims.depth ? { depthMm: s.dimMm } : {}), ...(rules.dims.height && !rules.dims.depth ? { heightMm: s.dimMm } : {}) };
  const { table, used } = await tableFor(fam.slug, s.at, s.clientele, s.versionId);
  const lookup = lookupSystemPrice(table, rules, input);
  const catalog = await loadCatalog();
  const settingsVat = catalog.taxRateBps;
  // moteur de la boutique, avec la table simulée (règles de compatibilité et de commande en ligne inchangées)
  const sim = { ...catalog, families: catalog.families.map((f) => (f.slug === fam.slug ? { ...f, systemPrices: table } : f)) };
  const result = evaluate(sim, input, s.at);
  const price = lookup.ok ? lookup.price : null;
  const vat = price ? (price.vatRateBps ?? settingsVat) : null;
  const ttc = price && vat != null ? (price.taxBasis === "TTC" ? price.amountMinor : price.amountMinor + applyBps(price.amountMinor, vat)) : null;
  return { family: { slug: fam.slug, name: fam.name, status: fam.status }, input, used, lookup, price, vatRateBps: vat, vatFromCatalog: price ? price.vatRateBps == null : false, ttcMinor: ttc, result, table: table ? { dims: [...new Set(table.cells.map((c) => c.dimAmm))].sort((a, b) => a - b), widths: [...new Set(table.cells.map((c) => `${c.widthMinMm}–${c.widthMaxMm}`))] } : null, rules: { dimLabel: rules.dims.depth?.label ?? rules.dims.height?.label ?? "Dimension", mountings: rules.mountings.map((m) => m.code) } } as const;
}

export { gridCells, CATEGORIES };
