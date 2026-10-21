/**
 * Service d'import des tarifs fournisseur : aperçu (aucune écriture), création d'une version
 * en brouillon, activation, retour arrière. Tout est journalisé (AuditLog) sans aucun montant.
 * Seule la colonne « Prix final HELIOSTORES » de la version ACTIVE du classeur est lue par le catalogue public
 * (src/server/pricing/system-prices.ts) ; les autres lignes restent internes.
 */
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { analyseSources, buildReport, discrepancyCounts, issueSummary, type AnalysedSource, type Analysis, type SourceFile } from "./analyse";
import { countRows } from "./normalise";

export interface Actor {
  actorUserId?: string | null;
  actorEmail?: string | null;
}

export class SupplierPriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierPriceError";
  }
}

/** Aperçu d'une source, sans montant (affichable dans un terminal ou un journal). */
export interface SourcePreview {
  fileName: string;
  type: string;
  sourceKey: string;
  sha256: string;
  families: string[];
  currency: string | null;
  currencyNote: string;
  natureNote: string;
  counts: ReturnType<typeof countRows>;
  sheets: { name: string; state: string; familySlug: string | null; blocks: { title: string; variantKey: string; rows: number }[]; dataRows: number; textNumbers: number; formulas: { column: string; count: number; missingCache: number; mismatches: number }[]; notes: string[] }[];
  tables: { index: number; caption: string; kind: string; variantKey: string; rows: number; currency: string | null }[];
  structure: { hiddenSheets: string[]; externalLinks: number; comments: number; definedNames: number; builtInNames: number; mentionsCurrency: number; mentionsTax: number } | null;
  issues: { issue: string; count: number }[];
  duplicates: number;
  gaps: number;
  discrepancies: Record<string, number>;
  notes: string[];
  /** échantillon de lignes SANS montant */
  sample: { sourceRef: string; familySlug: string; variantKey: string; amountRole: string; dimAKey: string | null; dimAmm: number | null; widthMinMm: number | null; widthMaxMm: number | null; status: string; hasAmount: boolean }[];
  /** version existante de même empreinte (ré-import = sans effet) */
  existing: { id: string; version: number; status: string } | null;
}

function toPreview(s: AnalysedSource, existing: SourcePreview["existing"]): SourcePreview {
  return {
    fileName: s.fileName,
    type: s.type,
    sourceKey: s.sourceKey,
    sha256: s.sha256,
    families: s.families,
    currency: s.currency,
    currencyNote: s.currencyNote,
    natureNote: s.natureNote,
    counts: countRows(s.rows),
    sheets: (s.xlsx?.sheets ?? []).map((sh) => ({ name: sh.name, state: sh.state, familySlug: sh.familySlug, blocks: sh.blocks.map((b) => ({ title: b.title, variantKey: b.variantKey, rows: b.rows })), dataRows: sh.dataRows, textNumbers: sh.textNumbers, formulas: sh.formulas.map((f) => ({ column: f.column, count: f.count, missingCache: f.missingCache, mismatches: f.mismatches })), notes: sh.notes })),
    tables: (s.docx?.tables ?? []).map((t) => ({ index: t.index, caption: t.caption, kind: t.kind, variantKey: t.variantKey, rows: t.rows, currency: t.currency })),
    structure: s.xlsx ? { hiddenSheets: s.xlsx.structure.hiddenSheets, externalLinks: s.xlsx.structure.externalLinks, comments: s.xlsx.structure.comments, definedNames: s.xlsx.structure.definedNames, builtInNames: s.xlsx.structure.builtInNames, mentionsCurrency: s.xlsx.structure.mentionsCurrency.length, mentionsTax: s.xlsx.structure.mentionsTax.length } : null,
    issues: issueSummary(s.rows),
    duplicates: s.duplicates.length,
    gaps: s.gaps.length,
    discrepancies: discrepancyCounts(s.discrepancies),
    notes: s.notes,
    sample: s.rows.filter((_, i) => i % Math.max(1, Math.floor(s.rows.length / 6)) === 0).slice(0, 6).map((r) => ({ sourceRef: r.sourceRef, familySlug: r.familySlug, variantKey: r.variantKey, amountRole: r.amountRole, dimAKey: r.dimAKey, dimAmm: r.dimAmm, widthMinMm: r.widthMinMm, widthMaxMm: r.widthMaxMm, status: r.status, hasAmount: r.amountMinor != null })),
    existing,
  };
}

async function findSameSha(s: AnalysedSource) {
  return prisma.supplierPriceList.findFirst({ where: { sourceKey: s.sourceKey, sourceSha256: s.sha256 }, orderBy: { version: "desc" }, select: { id: true, version: true, status: true } });
}

/** Aperçu (« dry-run ») : lecture seule, aucune écriture en base. */
export async function previewSupplierPrices(files: SourceFile[]): Promise<{ analysis: Analysis; previews: SourcePreview[] }> {
  const analysis = await analyseSources(files);
  const previews: SourcePreview[] = [];
  for (const s of analysis.sources) previews.push(toPreview(s, await findSameSha(s)));
  return { analysis, previews };
}

export interface ApplyResult {
  fileName: string;
  sourceKey: string;
  listId: string;
  version: number;
  status: string;
  /** version identique déjà importée : rien n'a été écrit */
  unchanged: boolean;
  rows: number;
}

/** Crée une nouvelle version DRAFT par source ; une empreinte déjà importée ne crée rien. */
export async function applySupplierPrices(files: SourceFile[], actor: Actor, opts: { notes?: string } = {}): Promise<{ analysis: Analysis; results: ApplyResult[] }> {
  const analysis = await analyseSources(files);
  const results: ApplyResult[] = [];
  for (const s of analysis.sources) {
    const same = await findSameSha(s);
    if (same) {
      results.push({ fileName: s.fileName, sourceKey: s.sourceKey, listId: same.id, version: same.version, status: same.status, unchanged: true, rows: await prisma.supplierPriceRow.count({ where: { listId: same.id } }) });
      continue;
    }
    if (!s.rows.length) throw new SupplierPriceError(`${s.fileName} : aucune ligne de tarif reconnue, import refusé.`);
    const report = JSON.parse(JSON.stringify(buildReport(s, analysis.comparison)));
    const list = await prisma.$transaction(async (tx) => {
      const last = await tx.supplierPriceList.findFirst({ where: { sourceKey: s.sourceKey }, orderBy: { version: "desc" }, select: { version: true } });
      const created = await tx.supplierPriceList.create({
        data: {
          sourceKey: s.sourceKey,
          version: (last?.version ?? 0) + 1,
          label: s.label,
          sourceFile: s.fileName,
          sourceSha256: s.sha256,
          status: "DRAFT",
          currency: s.currency,
          currencyNote: s.currencyNote,
          taxBasis: "UNKNOWN",
          nature: "UNKNOWN",
          natureNote: s.natureNote,
          report,
          notes: opts.notes ?? "",
          importedBy: actor.actorEmail ?? null,
        },
      });
      await tx.supplierPriceRow.createMany({
        data: s.rows.map((r) => ({
          listId: created.id,
          familySlug: r.familySlug,
          variantKey: r.variantKey,
          kind: r.kind,
          code: r.code,
          label: r.label,
          dimAKey: r.dimAKey,
          dimAmm: r.dimAmm,
          widthMinMm: r.widthMinMm,
          widthMaxMm: r.widthMaxMm,
          conditions: JSON.parse(JSON.stringify(r.conditions)),
          amountMinor: r.amountMinor,
          currency: r.currency,
          amountRole: r.amountRole,
          formula: r.formula,
          cachedValue: r.cachedValue,
          sourceRef: r.sourceRef,
          status: r.status,
          issues: r.issues,
        })),
      });
      return created;
    }, { timeout: 60_000 });
    const counts = countRows(s.rows);
    await audit({ ...actor, action: "supplierPrices.import", entity: "SupplierPriceList", entityId: list.id, after: { sourceKey: s.sourceKey, version: list.version, sourceFile: s.fileName, sha256: s.sha256, rows: counts.total, byStatus: counts.byStatus, discrepancies: discrepancyCounts(s.discrepancies) } });
    results.push({ fileName: s.fileName, sourceKey: s.sourceKey, listId: list.id, version: list.version, status: list.status, unchanged: false, rows: counts.total });
  }
  return { analysis, results };
}

/** Active une version : l'ancienne version active de la même source est archivée. */
export async function activateSupplierPriceList(id: string, actor: Actor, action = "supplierPrices.activate") {
  const list = await prisma.supplierPriceList.findUnique({ where: { id }, select: { id: true, sourceKey: true, version: true, status: true } });
  if (!list) throw new SupplierPriceError("Version introuvable.");
  if (list.status === "REJECTED") throw new SupplierPriceError("Une version rejetée ne peut pas être activée.");
  if (list.status === "ACTIVE") return { list, previous: null as { id: string; version: number } | null };
  const previous = await prisma.$transaction(async (tx) => {
    const prev = await tx.supplierPriceList.findFirst({ where: { sourceKey: list.sourceKey, status: "ACTIVE", id: { not: id } }, select: { id: true, version: true } });
    await tx.supplierPriceList.updateMany({ where: { sourceKey: list.sourceKey, status: "ACTIVE", id: { not: id } }, data: { status: "ARCHIVED" } });
    await tx.supplierPriceList.update({ where: { id }, data: { status: "ACTIVE", activatedBy: actor.actorEmail ?? null, activatedAt: new Date() } });
    return prev;
  });
  await audit({ ...actor, action, entity: "SupplierPriceList", entityId: id, before: { status: list.status, previousActive: previous ? { id: previous.id, version: previous.version } : null }, after: { status: "ACTIVE", sourceKey: list.sourceKey, version: list.version } });
  return { list: { ...list, status: "ACTIVE" as const }, previous };
}

/** Retour arrière : réactive la version précédemment active (la plus récente archivée après activation). */
export async function rollbackSupplierPrices(sourceKey: string, actor: Actor) {
  const current = await prisma.supplierPriceList.findFirst({ where: { sourceKey, status: "ACTIVE" }, select: { id: true, version: true } });
  const previous = await prisma.supplierPriceList.findFirst({
    where: { sourceKey, status: "ARCHIVED", activatedAt: { not: null }, ...(current ? { id: { not: current.id } } : {}) },
    orderBy: [{ activatedAt: "desc" }, { version: "desc" }],
    select: { id: true, version: true },
  });
  if (!previous) throw new SupplierPriceError(`Aucune version précédemment active pour « ${sourceKey} ».`);
  await activateSupplierPriceList(previous.id, actor, "supplierPrices.rollback");
  return { restored: previous, replaced: current };
}

/** Rejette une version en brouillon (elle reste consultable, jamais activable). */
export async function rejectSupplierPriceList(id: string, actor: Actor) {
  const list = await prisma.supplierPriceList.findUnique({ where: { id }, select: { id: true, status: true, sourceKey: true, version: true } });
  if (!list) throw new SupplierPriceError("Version introuvable.");
  if (list.status !== "DRAFT") throw new SupplierPriceError("Seule une version en brouillon peut être rejetée.");
  await prisma.supplierPriceList.update({ where: { id }, data: { status: "REJECTED" } });
  await audit({ ...actor, action: "supplierPrices.reject", entity: "SupplierPriceList", entityId: id, before: { status: list.status }, after: { status: "REJECTED", sourceKey: list.sourceKey, version: list.version } });
  return list;
}
