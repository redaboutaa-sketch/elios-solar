/**
 * Grilles tarifaires administrées : une grille = une famille × une variante × une colonne d'origine, versionnée dans
 * `SupplierPriceList` (scope GRID) ; ses cellules sont des `SupplierPriceRow` avec leur provenance (fichier, feuille,
 * cellule, date d'import). Les versions importées des fichiers (scope IMPORT) restent la trace brute des sources.
 *
 * Cycle : brouillon → vérifiée → publiée (immédiatement ou à une date) → remplacée / désactivée. Une version publiée
 * n'est jamais modifiée : toute modification passe par un nouveau brouillon. Seules les grilles de VENTE publiées,
 * avec devise et base fiscale, alimentent la boutique (src/server/pricing/system-prices.ts).
 *
 * Journal : auteur, date, cellules et paramètres modifiés, publication — jamais de montant (le journal est lisible par
 * les gestionnaires ; les montants ne se consultent que dans l'écran Tarifs, réservé aux administrateurs).
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { checkGrid, clienteleOverlaps, deriveCells, parseAmountInput, periodsOverlap, sameCells, type Clientele, type DeriveMode, type DimRule, type GridCheck, type Nature, type TariffCell, type TaxBasis } from "@/domain/tariffs";

export interface Actor {
  actorUserId?: string | null;
  actorEmail?: string | null;
}

export class TariffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TariffError";
  }
}

type Tx = Prisma.TransactionClient;

/** Lignée d'une grille : les versions successives partagent cette clé. */
export const gridKey = (familySlug: string, variantKey: string, amountRole: string) => `grid:${familySlug}:${variantKey || "_"}:${amountRole}`;

export const COLUMN_FR: Record<string, string> = { PRIX_FINAL: "Prix final HELIOSTORES", PRIX_SOURCE: "Prix (colonne source / « prix fournisseur »)", MANUAL: "Saisie manuelle", DERIVED: "Recalcul", CATALOGUE_FOURNISSEUR: "Prix catalogue fournisseur", ACHAT_NET: "Prix d'achat net", VENTE: "Prix de vente HELIOSTORES" };

export const EDITABLE = new Set(["DRAFT", "VERIFIED"]);

const gridSelect = {
  id: true, sourceKey: true, version: true, label: true, status: true, scope: true, familySlug: true, variantKey: true, amountRole: true,
  nature: true, natureNote: true, currency: true, currencyNote: true, taxBasis: true, vatRateBps: true, clientele: true, dimRule: true, dimRuleNote: true,
  validFrom: true, validTo: true, scopeNote: true, included: true, excluded: true, notes: true, originListId: true, basedOnId: true, baseActiveId: true,
  revision: true, zeroConfirmed: true, verifiedAt: true, verifiedBy: true, publishedAt: true, publishedBy: true, deactivatedAt: true, deactivatedBy: true,
  sourceFile: true, sourceSha256: true, importedBy: true, createdAt: true, updatedAt: true,
} satisfies Prisma.SupplierPriceListSelect;
export type GridVersion = Prisma.SupplierPriceListGetPayload<{ select: typeof gridSelect }>;

export async function getGrid(id: string): Promise<GridVersion> {
  const g = await prisma.supplierPriceList.findUnique({ where: { id }, select: gridSelect });
  if (!g || g.scope !== "GRID") throw new TariffError("Grille introuvable.");
  return g;
}

export async function gridCells(listId: string, db: Tx | typeof prisma = prisma): Promise<TariffCell[]> {
  const rows = await db.supplierPriceRow.findMany({ where: { listId, kind: "GRID" }, select: { dimAmm: true, widthMinMm: true, widthMaxMm: true, amountMinor: true } });
  return rows.filter((r) => r.dimAmm != null && r.widthMaxMm != null).map((r) => ({ dimAmm: r.dimAmm!, widthMinMm: r.widthMinMm ?? r.widthMaxMm!, widthMaxMm: r.widthMaxMm!, amountMinor: r.amountMinor }));
}

/** Version publiée la plus récente de la lignée (en vigueur, programmée ou échue). */
async function lastPublished(db: Tx | typeof prisma, sourceKey: string) {
  return db.supplierPriceList.findFirst({ where: { sourceKey, status: "ACTIVE" }, orderBy: [{ publishedAt: "desc" }, { version: "desc" }], select: { id: true, version: true } });
}

async function nextVersion(tx: Tx, sourceKey: string) {
  const last = await tx.supplierPriceList.findFirst({ where: { sourceKey }, orderBy: { version: "desc" }, select: { version: true } });
  return (last?.version ?? 0) + 1;
}

/** Verrou transactionnel par contexte tarifaire (famille × variante) : publications et créations sérialisées. */
async function lockContext(tx: Tx, familySlug: string, variantKey: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tariff:${familySlug}:${variantKey}`}))`;
}

/** Incrémente la révision si elle n'a pas changé ; sinon refuse (modification concurrente). */
async function bump(tx: Tx, id: string, revision: number, data: Prisma.SupplierPriceListUpdateManyMutationInput = {}) {
  const r = await tx.supplierPriceList.updateMany({ where: { id, revision }, data: { ...data, revision: { increment: 1 } } });
  if (r.count !== 1) throw new TariffError("Cette grille a été modifiée entre-temps (par vous dans un autre onglet ou par un autre administrateur). Rechargez la page.");
}

export interface NewGridData {
  familySlug: string;
  variantKey: string;
  amountRole: string;
  label: string;
  nature: Nature;
  natureNote?: string;
  currency: string | null;
  currencyNote?: string;
  taxBasis: TaxBasis;
  vatRateBps?: number | null;
  clientele?: Clientele;
  dimRule?: DimRule;
  dimRuleNote?: string;
  scopeNote?: string;
  included?: string;
  excluded?: string;
  notes?: string;
  validFrom?: Date | null;
  validTo?: Date | null;
  originListId?: string | null;
  basedOnId?: string | null;
  sourceFile: string;
  sourceSha256: string;
  zeroConfirmed?: boolean;
  createdBy: string | null;
}

type RowInput = Omit<Prisma.SupplierPriceRowCreateManyInput, "listId">;

/** Crée un brouillon dans la lignée (famille, variante, colonne). */
export async function createDraft(tx: Tx, d: NewGridData, rows: RowInput[]) {
  const sourceKey = gridKey(d.familySlug, d.variantKey, d.amountRole);
  const base = await lastPublished(tx, sourceKey);
  const created = await tx.supplierPriceList.create({
    data: {
      scope: "GRID", sourceKey, version: await nextVersion(tx, sourceKey), label: d.label, sourceFile: d.sourceFile, sourceSha256: d.sourceSha256, status: "DRAFT",
      familySlug: d.familySlug, variantKey: d.variantKey, amountRole: d.amountRole, nature: d.nature, natureNote: d.natureNote ?? "", currency: d.currency, currencyNote: d.currencyNote ?? "",
      taxBasis: d.taxBasis, vatRateBps: d.vatRateBps ?? null, clientele: d.clientele ?? "ALL", dimRule: d.dimRule ?? "EXACT", dimRuleNote: d.dimRuleNote ?? "",
      scopeNote: d.scopeNote ?? "", included: d.included ?? "", excluded: d.excluded ?? "", notes: d.notes ?? "", validFrom: d.validFrom ?? null, validTo: d.validTo ?? null,
      originListId: d.originListId ?? null, basedOnId: d.basedOnId ?? null, baseActiveId: base?.id ?? null, zeroConfirmed: d.zeroConfirmed ?? false, importedBy: d.createdBy,
    },
  });
  if (rows.length) await tx.supplierPriceRow.createMany({ data: rows.map((r) => ({ ...r, listId: created.id, familySlug: d.familySlug, variantKey: d.variantKey })) });
  return created;
}

/** Copie des lignes d'une version (cellules et tarifs fixes), provenance comprise. */
async function copyRows(tx: Tx, listId: string): Promise<RowInput[]> {
  const rows = await tx.supplierPriceRow.findMany({ where: { listId }, orderBy: [{ kind: "asc" }, { dimAmm: "asc" }, { widthMinMm: "asc" }, { code: "asc" }] });
  return rows.map((r) => ({
    familySlug: r.familySlug, variantKey: r.variantKey, kind: r.kind, code: r.code, label: r.label, dimAKey: r.dimAKey, dimAmm: r.dimAmm, widthMinMm: r.widthMinMm, widthMaxMm: r.widthMaxMm,
    conditions: r.conditions as Prisma.InputJsonValue, amountMinor: r.amountMinor, currency: r.currency, amountRole: r.amountRole, formula: r.formula, cachedValue: r.cachedValue,
    sourceRef: r.sourceRef, status: r.status, issues: r.issues, origin: r.origin, editedBy: r.editedBy, editedAt: r.editedAt,
  }));
}

const paramsOf = (g: GridVersion): Omit<NewGridData, "createdBy" | "basedOnId"> => ({
  familySlug: g.familySlug!, variantKey: g.variantKey, amountRole: g.amountRole ?? "MANUAL", label: g.label, nature: g.nature, natureNote: g.natureNote, currency: g.currency, currencyNote: g.currencyNote,
  taxBasis: g.taxBasis, vatRateBps: g.vatRateBps, clientele: g.clientele, dimRule: g.dimRule, dimRuleNote: g.dimRuleNote, scopeNote: g.scopeNote, included: g.included, excluded: g.excluded, notes: g.notes,
  originListId: g.originListId, sourceFile: g.sourceFile, sourceSha256: g.sourceSha256, zeroConfirmed: g.zeroConfirmed,
});

/* ------------------------------------------------------------------ */
/* Contrôles                                                            */
/* ------------------------------------------------------------------ */

/** Contrôles d'une version : grille, contexte (famille, TVA du catalogue), obsolescence et chevauchements. */
export async function checksFor(g: GridVersion, opts: { publishAt?: Date } = {}): Promise<GridCheck[]> {
  const [family, settings, cells, published, fixed] = await Promise.all([
    g.familySlug ? prisma.productFamily.findUnique({ where: { slug: g.familySlug }, select: { status: true } }) : null,
    prisma.siteSettings.findUnique({ where: { id: 1 }, select: { defaultTaxRateBps: true } }),
    gridCells(g.id),
    lastPublished(prisma, g.sourceKey),
    prisma.supplierPriceRow.count({ where: { listId: g.id, kind: "FIXED", amountMinor: null } }),
  ]);
  const stale = EDITABLE.has(g.status) && published && published.id !== g.baseActiveId ? { activeVersion: published.version } : null;
  const checks = checkGrid(
    { nature: g.nature, currency: g.currency, taxBasis: g.taxBasis, vatRateBps: g.vatRateBps, catalogVatRateBps: settings?.defaultTaxRateBps ?? 2000, clientele: g.clientele, dimRule: g.dimRule, dimRuleNote: g.dimRuleNote, validFrom: opts.publishAt ?? g.validFrom, validTo: g.validTo, zeroConfirmed: g.zeroConfirmed, family: { known: !!family, status: family?.status ?? null }, stale },
    cells,
  );
  if (fixed) checks.push({ code: "fixed_empty", severity: "blocking", message: `${fixed} tarif(s) fixe(s) sans montant.` });
  if (EDITABLE.has(g.status)) for (const c of await conflictsFor(prisma, g, opts.publishAt ?? g.validFrom ?? new Date())) checks.push(c);
  return checks;
}

/** Versions publiées du même contexte dont la période recouvre celle de la publication envisagée. */
async function conflictsFor(db: Tx | typeof prisma, g: GridVersion, from: Date): Promise<GridCheck[]> {
  const others = await db.supplierPriceList.findMany({ where: { scope: "GRID", status: "ACTIVE", familySlug: g.familySlug, variantKey: g.variantKey, nature: g.nature, id: { not: g.id } }, select: { id: true, version: true, sourceKey: true, clientele: true, validFrom: true, validTo: true } });
  const out: GridCheck[] = [];
  for (const o of others) {
    if (!clienteleOverlaps(o.clientele, g.clientele) || !periodsOverlap({ from, to: g.validTo }, { from: o.validFrom, to: o.validTo })) continue;
    const startsBefore = (o.validFrom?.getTime() ?? -Infinity) < from.getTime();
    out.push(startsBefore
      ? { code: "replaces", severity: "warning", message: `Remplacera la version v${o.version}${o.sourceKey === g.sourceKey ? "" : ` (${o.sourceKey})`} à partir du ${from.toLocaleString("fr-FR")} : sa fin de validité sera fixée à cette date.` }
      : { code: "overlap_scheduled", severity: "blocking", message: `Chevauchement avec la version programmée v${o.version} (${o.validFrom?.toLocaleString("fr-FR")}) : désactivez-la ou fixez une fin de validité antérieure.` });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Modifications d'un brouillon                                         */
/* ------------------------------------------------------------------ */

export type CellEdit = { dimAmm: number; widthMinMm: number; widthMaxMm: number } & ({ action: "set"; value: string } | { action: "clear" } | { action: "remove" });

function assertEditable(g: GridVersion) {
  if (!EDITABLE.has(g.status)) throw new TariffError("Version publiée ou archivée : non modifiable. Reprenez-la en brouillon pour la modifier.");
}

/** Enregistre des modifications de cellules (une ou plusieurs) ; la vérification est à refaire. */
export async function saveCells(id: string, revision: number, edits: CellEdit[], actor: Actor) {
  const g = await getGrid(id);
  assertEditable(g);
  if (!edits.length) throw new TariffError("Aucune modification.");
  if (edits.length > 5000) throw new TariffError("Trop de modifications en une fois.");
  const errors: string[] = [];
  const parsed = edits.map((e) => {
    if (![e.dimAmm, e.widthMinMm, e.widthMaxMm].every((n) => Number.isInteger(n) && n > 0 && n <= 100_000) || e.widthMinMm > e.widthMaxMm) { errors.push(`Dimension invalide (${e.dimAmm} × ${e.widthMinMm}–${e.widthMaxMm} mm)`); return null; }
    if (e.action !== "set") return { ...e, minor: null as number | null };
    const p = parseAmountInput(e.value);
    if (!p.ok) { errors.push(`${e.dimAmm} × ${e.widthMinMm === e.widthMaxMm ? e.widthMaxMm : `${e.widthMinMm}–${e.widthMaxMm}`} mm : ${p.error}`); return null; }
    return { ...e, minor: p.minor };
  });
  if (errors.length) throw new TariffError(errors.slice(0, 5).join(" · ") + (errors.length > 5 ? ` (+${errors.length - 5})` : ""));
  const now = new Date();
  const who = actor.actorEmail ?? null;
  let added = 0, changed = 0, removed = 0, cleared = 0;
  await prisma.$transaction(async (tx) => {
    await bump(tx, id, revision, { status: "DRAFT", verifiedAt: null, verifiedBy: null });
    const dimAKey = (await tx.supplierPriceRow.findFirst({ where: { listId: id, kind: "GRID", dimAKey: { not: null } }, select: { dimAKey: true } }))?.dimAKey ?? "projection";
    for (const e of parsed) {
      if (!e) continue;
      const where = { listId: id, kind: "GRID", dimAmm: e.dimAmm, widthMinMm: e.widthMinMm, widthMaxMm: e.widthMaxMm };
      const row = await tx.supplierPriceRow.findFirst({ where, select: { id: true, amountMinor: true } });
      if (e.action === "remove") {
        if (row) { await tx.supplierPriceRow.delete({ where: { id: row.id } }); removed++; }
        continue;
      }
      if (row) {
        if (row.amountMinor === e.minor) continue;
        await tx.supplierPriceRow.update({ where: { id: row.id }, data: { amountMinor: e.minor, editedBy: who, editedAt: now } });
        if (e.minor == null) cleared++; else changed++;
      } else {
        await tx.supplierPriceRow.create({ data: { ...where, familySlug: g.familySlug!, variantKey: g.variantKey, dimAKey, amountMinor: e.minor, currency: g.currency, amountRole: g.amountRole ?? "MANUAL", sourceRef: `Saisie dans l'administration (${who ?? "?"}, ${now.toISOString().slice(0, 10)})`, status: "OK", origin: "MANUAL", editedBy: who, editedAt: now } });
        added++;
      }
    }
  });
  await audit({ ...actor, action: "tariffs.cells", entity: "SupplierPriceList", entityId: id, after: { sourceKey: g.sourceKey, version: g.version, added, changed, cleared, removed } });
  return { added, changed, cleared, removed };
}

export interface FixedTariff { code: string; label: string; unit: string; value: string }

/** Remplace les tarifs fixes (forfaits, options) du brouillon. Ils sont versionnés avec la grille. */
export async function saveFixedTariffs(id: string, revision: number, items: FixedTariff[], actor: Actor) {
  const g = await getGrid(id);
  assertEditable(g);
  if (items.length > 200) throw new TariffError("200 tarifs fixes au plus.");
  const codes = new Set<string>();
  const rows = items.map((it, i) => {
    const code = it.code.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 60);
    const label = it.label.trim().slice(0, 200);
    if (!code || !label) throw new TariffError(`Tarif fixe n° ${i + 1} : code et libellé obligatoires.`);
    if (codes.has(code)) throw new TariffError(`Code en double : ${code}.`);
    codes.add(code);
    const p = parseAmountInput(it.value);
    if (!p.ok) throw new TariffError(`${label} : ${p.error}`);
    return { code, label, unit: it.unit.trim().slice(0, 40) || "forfait", minor: p.minor };
  });
  const now = new Date();
  const before = await prisma.supplierPriceRow.findMany({ where: { listId: id, kind: "FIXED" }, select: { code: true, amountMinor: true, sourceRef: true, origin: true } });
  await prisma.$transaction(async (tx) => {
    await bump(tx, id, revision, { status: "DRAFT", verifiedAt: null, verifiedBy: null });
    await tx.supplierPriceRow.deleteMany({ where: { listId: id, kind: "FIXED" } });
    if (rows.length) await tx.supplierPriceRow.createMany({ data: rows.map((r) => {
      const prev = before.find((b) => b.code === r.code);
      const same = prev && prev.amountMinor === r.minor;
      return { listId: id, familySlug: g.familySlug!, variantKey: g.variantKey, kind: "FIXED", code: r.code, label: r.label, conditions: { unit: r.unit }, amountMinor: r.minor, currency: g.currency, amountRole: g.amountRole ?? "MANUAL", sourceRef: same && prev ? prev.sourceRef : `Saisie dans l'administration (${actor.actorEmail ?? "?"}, ${now.toISOString().slice(0, 10)})`, status: "OK", origin: same && prev ? prev.origin : "MANUAL", editedBy: same ? null : actor.actorEmail ?? null, editedAt: same ? null : now };
    }) });
  });
  await audit({ ...actor, action: "tariffs.fixed", entity: "SupplierPriceList", entityId: id, after: { sourceKey: g.sourceKey, version: g.version, count: rows.length, codes: [...codes] } });
}

export interface GridParamsInput {
  nature: Nature;
  natureNote: string;
  currency: string | null;
  taxBasis: TaxBasis;
  vatRateBps: number | null;
  clientele: Clientele;
  dimRule: DimRule;
  dimRuleNote: string;
  validFrom: Date | null;
  validTo: Date | null;
  scopeNote: string;
  included: string;
  excluded: string;
  notes: string;
  zeroConfirmed: boolean;
}

/** Paramètres commerciaux du brouillon (nature, devise, fiscalité, clientèle, validité, inclus / exclus). */
export async function updateParams(id: string, revision: number, p: GridParamsInput, actor: Actor) {
  const g = await getGrid(id);
  assertEditable(g);
  const keys = Object.keys(p) as (keyof GridParamsInput)[];
  const changed = keys.filter((k) => String(p[k] instanceof Date ? (p[k] as Date).getTime() : p[k]) !== String(g[k] instanceof Date ? (g[k] as Date).getTime() : g[k]));
  await prisma.$transaction(async (tx) => {
    await bump(tx, id, revision, { ...p, status: "DRAFT", verifiedAt: null, verifiedBy: null });
    if (p.currency !== g.currency) await tx.supplierPriceRow.updateMany({ where: { listId: id }, data: { currency: p.currency } });
  });
  // valeurs non monétaires uniquement
  await audit({ ...actor, action: "tariffs.params", entity: "SupplierPriceList", entityId: id, before: Object.fromEntries(changed.map((k) => [k, g[k]])), after: { sourceKey: g.sourceKey, version: g.version, ...Object.fromEntries(changed.map((k) => [k, p[k]])) } });
  return { changed };
}

/** Vérifie la grille : sans blocage, elle passe « vérifiée » (prête à publier). */
export async function verifyGrid(id: string, revision: number, actor: Actor) {
  const g = await getGrid(id);
  assertEditable(g);
  const checks = await checksFor(g);
  const blocking = checks.filter((c) => c.severity === "blocking");
  if (blocking.length) throw new TariffError(`Vérification refusée : ${blocking.map((b) => b.message).join(" ")}`);
  await prisma.$transaction((tx) => bump(tx, id, revision, { status: "VERIFIED", verifiedAt: new Date(), verifiedBy: actor.actorEmail ?? null }));
  await audit({ ...actor, action: "tariffs.verify", entity: "SupplierPriceList", entityId: id, after: { sourceKey: g.sourceKey, version: g.version, warnings: checks.map((c) => c.code) } });
  return checks;
}

/**
 * Publie une version vérifiée, immédiatement ou à une date future. Les versions publiées du même contexte qui ont
 * commencé avant reçoivent une fin de validité à cette date (pas de chevauchement) ; une version programmée plus tard
 * qui recouvrirait la période bloque la publication.
 */
export async function publishGrid(id: string, revision: number, opts: { at?: Date | null }, actor: Actor) {
  const g0 = await getGrid(id);
  if (g0.status !== "VERIFIED") throw new TariffError("Seule une grille vérifiée peut être publiée : lancez « Vérifier la grille ».");
  const now = new Date();
  const from = opts.at && opts.at > now ? opts.at : now;
  const replaced: { id: string; version: number }[] = [];
  await prisma.$transaction(async (tx) => {
    await lockContext(tx, g0.familySlug!, g0.variantKey);
    const g = await tx.supplierPriceList.findUnique({ where: { id }, select: gridSelect });
    if (!g || g.revision !== revision || g.status !== "VERIFIED") throw new TariffError("Cette grille a été modifiée entre-temps. Rechargez la page.");
    const published = await lastPublished(tx, g.sourceKey);
    if (published && published.id !== g.baseActiveId) throw new TariffError(`Brouillon obsolète : la version v${published.version} a été publiée depuis sa création. Reprenez la version publiée en brouillon et refaites vos modifications.`);
    const conflicts = await conflictsFor(tx, g, from);
    const blocking = conflicts.filter((c) => c.severity === "blocking");
    if (blocking.length) throw new TariffError(blocking.map((b) => b.message).join(" "));
    const others = await tx.supplierPriceList.findMany({ where: { scope: "GRID", status: "ACTIVE", familySlug: g.familySlug, variantKey: g.variantKey, nature: g.nature, id: { not: g.id } }, select: { id: true, version: true, clientele: true, validFrom: true, validTo: true } });
    for (const o of others) {
      if (!clienteleOverlaps(o.clientele, g.clientele) || !periodsOverlap({ from, to: g.validTo }, { from: o.validFrom, to: o.validTo })) continue;
      // fin de validité à la date de début de la nouvelle version ; archivée si cette date est atteinte
      await tx.supplierPriceList.update({ where: { id: o.id }, data: { validTo: from, ...(from <= now ? { status: "ARCHIVED" } : {}) } });
      replaced.push({ id: o.id, version: o.version });
    }
    await bump(tx, id, revision, { status: "ACTIVE", validFrom: from, publishedAt: now, publishedBy: actor.actorEmail ?? null, activatedAt: now, activatedBy: actor.actorEmail ?? null, baseActiveId: g.baseActiveId });
  });
  await audit({ ...actor, action: "tariffs.publish", entity: "SupplierPriceList", entityId: id, after: { sourceKey: g0.sourceKey, version: g0.version, from: from.toISOString(), scheduled: from > now, nature: g0.nature, clientele: g0.clientele, replaced } });
  await refreshCatalog();
  return { from, scheduled: from > now, replaced };
}

/** Désactive une version publiée (en vigueur ou programmée) : le contexte repasse au devis, sans réactivation implicite. */
export async function deactivateGrid(id: string, actor: Actor) {
  const g = await getGrid(id);
  if (g.status !== "ACTIVE") throw new TariffError("Seule une version publiée peut être désactivée.");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await lockContext(tx, g.familySlug!, g.variantKey);
    await bump(tx, id, g.revision, { status: "ARCHIVED", deactivatedAt: now, deactivatedBy: actor.actorEmail ?? null, validTo: g.validFrom && g.validFrom > now ? g.validFrom : now });
  });
  await audit({ ...actor, action: "tariffs.deactivate", entity: "SupplierPriceList", entityId: id, after: { sourceKey: g.sourceKey, version: g.version } });
  await refreshCatalog();
}

/** Reprend une version (publiée, archivée ou brouillon) sous forme de nouveau brouillon. */
export async function restoreAsDraft(id: string, actor: Actor) {
  const g = await getGrid(id);
  const created = await prisma.$transaction(async (tx) => {
    await lockContext(tx, g.familySlug!, g.variantKey);
    return createDraft(tx, { ...paramsOf(g), validFrom: null, validTo: null, basedOnId: g.id, createdBy: actor.actorEmail ?? null, notes: g.notes }, await copyRows(tx, g.id));
  });
  await audit({ ...actor, action: "tariffs.restoreAsDraft", entity: "SupplierPriceList", entityId: created.id, after: { sourceKey: g.sourceKey, version: created.version, basedOn: g.version } });
  return created;
}

/** Rejette un brouillon (conservé, jamais publiable). */
export async function rejectGrid(id: string, actor: Actor) {
  const g = await getGrid(id);
  assertEditable(g);
  await prisma.$transaction((tx) => bump(tx, id, g.revision, { status: "REJECTED" }));
  await audit({ ...actor, action: "tariffs.reject", entity: "SupplierPriceList", entityId: id, after: { sourceKey: g.sourceKey, version: g.version } });
}

/**
 * Nouveau brouillon recalculé depuis une grille de base (ex. colonne source) par une règle explicite, dans la lignée
 * cible (dont les paramètres commerciaux sont repris). La règle et sa valeur sont écrites dans la version.
 */
export async function deriveDraft(baseId: string, targetId: string, mode: DeriveMode, value: string, actor: Actor) {
  const [base, target] = await Promise.all([getGrid(baseId), getGrid(targetId)]);
  if (base.familySlug !== target.familySlug || base.variantKey !== target.variantKey) throw new TariffError("La grille de base doit porter sur le même produit et la même variante.");
  // règles distinctes : la remise fournisseur s'applique au prix catalogue et donne un achat net ; majoration et marge
  // s'appliquent à un coût d'achat (jamais à un prix catalogue pris pour un coût)
  if (mode === "supplier_discount" && (base.nature !== "SUPPLIER_LIST" || target.nature !== "PURCHASE")) throw new TariffError("La remise fournisseur se calcule depuis une grille « prix catalogue fournisseur » vers une grille « achat fournisseur ».");
  if ((mode === "markup_on_cost" || mode === "margin_on_price") && base.nature !== "PURCHASE") throw new TariffError("Majoration et marge se calculent sur un coût d'achat : la grille de base doit être de nature « achat fournisseur ».");
  const r = deriveCells(await gridCells(base.id), mode, value);
  if (!r.ok) throw new TariffError(r.error);
  const now = new Date().toISOString().slice(0, 10);
  const baseRows = await prisma.supplierPriceRow.findMany({ where: { listId: base.id, kind: "GRID" }, select: { dimAmm: true, widthMinMm: true, widthMaxMm: true, dimAKey: true, sourceRef: true } });
  const refOf = (c: TariffCell) => baseRows.find((b) => b.dimAmm === c.dimAmm && (b.widthMinMm ?? b.widthMaxMm) === c.widthMinMm && b.widthMaxMm === c.widthMaxMm);
  const note = `Recalculé le ${now} depuis ${base.sourceKey} v${base.version} : ${r.formula} (arrondi au centime, demi supérieur).`;
  const created = await prisma.$transaction(async (tx) => {
    await lockContext(tx, target.familySlug!, target.variantKey);
    return createDraft(tx, { ...paramsOf(target), validFrom: null, validTo: null, basedOnId: target.id, createdBy: actor.actorEmail ?? null, notes: [note, target.notes].filter(Boolean).join("\n") }, r.cells.map((c) => {
      const b = refOf(c);
      return { familySlug: target.familySlug!, variantKey: target.variantKey, kind: "GRID", dimAKey: b?.dimAKey ?? null, dimAmm: c.dimAmm, widthMinMm: c.widthMinMm, widthMaxMm: c.widthMaxMm, amountMinor: c.amountMinor, currency: target.currency, amountRole: target.amountRole ?? "DERIVED", sourceRef: `Recalcul (${r.formula}) de ${b?.sourceRef ?? "la grille de base"}`, status: "OK" as const, origin: "DERIVED", conditions: { derive: { mode, value, baseId: base.id, baseVersion: base.version } } };
    }));
  });
  await audit({ ...actor, action: "tariffs.derive", entity: "SupplierPriceList", entityId: created.id, after: { sourceKey: target.sourceKey, version: created.version, base: `${base.sourceKey} v${base.version}`, mode } });
  return created;
}

/** Nouvelle grille vide (saisie manuelle), en brouillon. */
export async function createManualGrid(d: { familySlug: string; variantKey: string; label: string; nature: Nature; dimAKey: "projection" | "hauteur" }, actor: Actor) {
  const fam = await prisma.productFamily.findUnique({ where: { slug: d.familySlug }, select: { slug: true } });
  if (!fam) throw new TariffError("Produit inconnu.");
  const created = await prisma.$transaction(async (tx) => {
    await lockContext(tx, d.familySlug, d.variantKey);
    return createDraft(tx, { familySlug: d.familySlug, variantKey: d.variantKey, amountRole: "MANUAL", label: d.label, nature: d.nature, currency: null, taxBasis: "UNKNOWN", sourceFile: "saisie manuelle", sourceSha256: "", notes: `Axe principal : ${d.dimAKey}.`, createdBy: actor.actorEmail ?? null }, []);
  });
  await audit({ ...actor, action: "tariffs.create", entity: "SupplierPriceList", entityId: created.id, after: { sourceKey: created.sourceKey, version: created.version } });
  return created;
}

/* ------------------------------------------------------------------ */
/* Création des grilles depuis un import                                */
/* ------------------------------------------------------------------ */

export interface ColumnSetting {
  /** créer des grilles pour cette colonne */
  enabled: boolean;
  nature: Nature;
  currency: string | null;
  taxBasis: TaxBasis;
}

export interface GroupMapping {
  /** famille cible ; null = ignorer le groupe */
  familySlug: string | null;
  variantKey: string;
  dimAKey: "projection" | "hauteur";
}

export interface DeriveFromImportResult {
  created: { id: string; sourceKey: string; version: number; cells: number }[];
  unchanged: { sourceKey: string; version: number }[];
  keptDrafts: { sourceKey: string; version: number }[];
  skipped: string[];
}

/** Groupe tel que détecté dans l'import (famille|variante). */
export const groupId = (familySlug: string, variantKey: string) => `${familySlug}|${variantKey}`;

/**
 * Crée, pour chaque groupe (famille × variante) et chaque colonne retenue d'une version importée, un brouillon de
 * grille — sauf si la dernière version de la lignée a exactement les mêmes cellules (import répété : aucun doublon).
 * Aucune version existante n'est modifiée : un brouillon déjà retouché à la main reste intact.
 */
export async function deriveGridsFromImport(listId: string, opts: { columns: Record<string, ColumnSetting>; mapping?: Record<string, GroupMapping>; publishAs?: (familySlug: string, amountRole: string) => boolean }, actor: Actor): Promise<DeriveFromImportResult> {
  const list = await prisma.supplierPriceList.findUnique({ where: { id: listId } });
  if (!list || list.scope !== "IMPORT") throw new TariffError("Import introuvable.");
  const rows = await prisma.supplierPriceRow.findMany({ where: { listId, kind: "GRID" }, orderBy: [{ familySlug: "asc" }, { variantKey: "asc" }, { dimAmm: "asc" }, { widthMinMm: "asc" }] });
  const res: DeriveFromImportResult = { created: [], unchanged: [], keptDrafts: [], skipped: [] };
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const col = opts.columns[r.amountRole];
    if (!col?.enabled) continue;
    const m = opts.mapping?.[groupId(r.familySlug, r.variantKey)];
    if (m && !m.familySlug) { if (!res.skipped.includes(groupId(r.familySlug, r.variantKey))) res.skipped.push(groupId(r.familySlug, r.variantKey)); continue; }
    const fam = m?.familySlug ?? r.familySlug, variant = m ? m.variantKey : r.variantKey;
    const k = `${fam}\u0000${variant}\u0000${r.amountRole}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push({ ...r, familySlug: fam, variantKey: variant, dimAKey: m?.dimAKey ?? r.dimAKey });
  }
  const importedAt = list.createdAt.toISOString().slice(0, 10);
  for (const [k, grp] of groups) {
    const [familySlug, variantKey, role] = k.split("\u0000") as [string, string, string];
    const col = opts.columns[role]!;
    const sourceKey = gridKey(familySlug, variantKey, role);
    const cells: TariffCell[] = grp.filter((r) => r.dimAmm != null && r.widthMaxMm != null).map((r) => ({ dimAmm: r.dimAmm!, widthMinMm: r.widthMinMm ?? r.widthMaxMm!, widthMaxMm: r.widthMaxMm!, amountMinor: r.amountMinor }));
    const latest = await prisma.supplierPriceList.findFirst({ where: { sourceKey, status: { not: "REJECTED" } }, orderBy: { version: "desc" }, select: gridSelect });
    if (latest && sameCells(await gridCells(latest.id), cells)) { res.unchanged.push({ sourceKey, version: latest.version }); continue; }
    const drafts = await prisma.supplierPriceList.findMany({ where: { sourceKey, status: { in: ["DRAFT", "VERIFIED"] } }, select: { version: true } });
    res.keptDrafts.push(...drafts.map((d) => ({ sourceKey, version: d.version })));
    const label = `${list.sourceFile} › ${grp[0]!.sourceRef.split("›")[1]?.split("!")[0]?.trim() ?? familySlug}${variantKey ? ` (${variantKey})` : ""} — ${COLUMN_FR[role] ?? role}`;
    const publish = opts.publishAs?.(familySlug, role) ?? false;
    const created = await prisma.$transaction(async (tx) => {
      await lockContext(tx, familySlug, variantKey);
      const d = await createDraft(tx, {
        familySlug, variantKey, amountRole: role, label, nature: col.nature, currency: col.currency, taxBasis: col.taxBasis,
        natureNote: role === "PRIX_SOURCE" ? "Colonne « Prix » du classeur (« Prix fournisseur » dans les fiches) : prix d'achat ou prix public du fournisseur — non établi par la source." : list.natureNote,
        currencyNote: list.currencyNote, originListId: list.id, sourceFile: list.sourceFile, sourceSha256: list.sourceSha256, createdBy: actor.actorEmail ?? null,
        notes: `Créée depuis l'import ${list.sourceKey} v${list.version} du ${importedAt}.`,
      }, grp.map((r) => ({
        familySlug, variantKey, kind: "GRID", code: r.code, label: r.label, dimAKey: r.dimAKey, dimAmm: r.dimAmm, widthMinMm: r.widthMinMm, widthMaxMm: r.widthMaxMm,
        conditions: { ...(r.conditions as object), importedAt: list.createdAt.toISOString(), importListId: list.id }, amountMinor: r.amountMinor, currency: col.currency, amountRole: role,
        formula: r.formula, cachedValue: r.cachedValue, sourceRef: r.sourceRef, status: r.status, issues: r.issues, origin: "IMPORT",
      })));
      return d;
    });
    res.created.push({ id: created.id, sourceKey, version: created.version, cells: cells.length });
    if (publish) {
      // reprise d'une publication existante (décision client) : contrôlée comme toute publication
      const g = await getGrid(created.id);
      const blocking = (await checksFor(g)).filter((c) => c.severity === "blocking");
      if (!blocking.length) {
        await prisma.$transaction((tx) => bump(tx, g.id, g.revision, { status: "VERIFIED", verifiedAt: new Date(), verifiedBy: actor.actorEmail ?? null }));
        await publishGrid(g.id, g.revision + 1, { at: null }, actor);
      }
    }
  }
  await audit({ ...actor, action: "tariffs.fromImport", entity: "SupplierPriceList", entityId: list.id, after: { sourceKey: list.sourceKey, version: list.version, created: res.created.map((c) => `${c.sourceKey} v${c.version}`), unchanged: res.unchanged.length, skipped: res.skipped } });
  return res;
}

async function refreshCatalog() {
  try {
    const { invalidateCatalogCache } = await import("@/server/catalog/load");
    invalidateCatalogCache();
    // aide immédiate du chat : statut de prix (affiché / sur devis) relu à la prochaine question
    const { resetGuideCache } = await import("@/server/chat/guide");
    resetGuideCache();
  } catch {
    // hors serveur Next (scripts) : rien à invalider
  }
}
