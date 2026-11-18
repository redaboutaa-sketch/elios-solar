/**
 * Téléversement d'un classeur ou de fiches depuis l'administration : Téléverser → Analyser → Prévisualiser →
 * Corriger les correspondances → Importer. Les fichiers sont gardés en base (jamais dans `public/`, la médiathèque ou
 * le dépôt), le temps de l'analyse, puis effacés ; seules l'empreinte et les métadonnées restent.
 *
 * Lecture : l'analyseur existant (src/server/supplier-prices) — archive Office contrôlée, formules jamais recalculées,
 * liens externes jamais suivis, aucun code exécuté. Un fichier déjà importé (même empreinte) réutilise sa version.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { MAX_SOURCE_BYTES, sha256, type SourceFile } from "@/server/supplier-prices/analyse";
import { applySupplierPrices, previewSupplierPrices } from "@/server/supplier-prices/import";
import { axesOf, diffCells, type Nature, type TariffCell, type TaxBasis } from "@/domain/tariffs";
import { NORMALIZED_ROLE_NATURE } from "@/server/supplier-prices/normalized";
import { COLUMN_FR, deriveGridsFromImport, gridCells, gridKey, groupId, TariffError, type Actor, type ColumnSetting, type DeriveFromImportResult, type GroupMapping } from "./grids";

export const MAX_UPLOAD_FILES = 6;
/** total d'un téléversement (sous la limite des actions serveur, next.config.ts) */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export interface UploadMapping {
  groups: Record<string, GroupMapping>;
  columns: Record<string, ColumnSetting>;
}

/** Vérifie et enregistre les fichiers téléversés (aucune analyse ici). */
export async function createUpload(files: { name: string; bytes: Uint8Array }[], actor: Actor) {
  if (!files.length) throw new TariffError("Aucun fichier.");
  if (files.length > MAX_UPLOAD_FILES) throw new TariffError(`${MAX_UPLOAD_FILES} fichiers au plus.`);
  if (files.reduce((n, f) => n + f.bytes.byteLength, 0) > MAX_UPLOAD_BYTES) throw new TariffError("8 Mo au plus par téléversement.");
  for (const f of files) {
    const name = f.name.split(/[\\/]/).pop() ?? "";
    if (!/^[^\0<>:"|?*]{1,180}\.(xlsx|docx|csv)$/i.test(name)) throw new TariffError(`${name || "fichier"} : seuls les classeurs .xlsx, les fiches .docx et les fichiers .csv au format normalisé sont acceptés.`);
    if (f.bytes.byteLength === 0) throw new TariffError(`${name} : fichier vide.`);
    if (f.bytes.byteLength > Math.min(MAX_SOURCE_BYTES, MAX_UPLOAD_BYTES)) throw new TariffError(`${name} : 8 Mo au plus.`);
    if (/\.csv$/i.test(name)) { if (f.bytes.includes(0)) throw new TariffError(`${name} : fichier texte attendu.`); }
    else if (!(f.bytes[0] === 0x50 && f.bytes[1] === 0x4b)) throw new TariffError(`${name} : ce n'est pas une archive Office.`);
  }
  const up = await prisma.priceImportUpload.create({
    data: { createdBy: actor.actorEmail ?? null, files: { create: files.map((f) => ({ fileName: f.name.split(/[\\/]/).pop()!, sha256: sha256(f.bytes), size: f.bytes.byteLength, bytes: Buffer.from(f.bytes) })) } },
    include: { files: { select: { fileName: true, sha256: true, size: true } } },
  });
  await audit({ ...actor, action: "tariffs.upload", entity: "PriceImportUpload", entityId: up.id, after: { files: up.files.map((f) => ({ name: f.fileName, sha256: f.sha256, size: f.size })) } });
  return up;
}

async function sourceFiles(uploadId: string): Promise<SourceFile[]> {
  const up = await prisma.priceImportUpload.findUnique({ where: { id: uploadId }, include: { files: true } });
  if (!up) throw new TariffError("Téléversement introuvable.");
  if (up.status !== "ANALYSED") throw new TariffError(up.status === "IMPORTED" ? "Ce téléversement a déjà été importé." : "Ce téléversement a été abandonné.");
  return up.files.map((f) => {
    if (!f.bytes) throw new TariffError("Fichier effacé : téléversez-le à nouveau.");
    return { fileName: f.fileName, bytes: new Uint8Array(f.bytes) };
  });
}

export interface PreviewGroup {
  id: string;
  fileName: string;
  sheet: string;
  detectedFamily: string;
  detectedVariant: string;
  dimAKey: string;
  roles: { role: string; label: string; cells: number; empty: number; toCheck: number; minMinor: number | null; maxMinor: number | null; dims: number[]; widths: { min: number; max: number }[] }[];
  issues: { issue: string; count: number }[];
}

export interface UploadPreview {
  upload: { id: string; createdAt: Date; createdBy: string | null; status: string };
  sources: { fileName: string; type: string; sourceKey: string; sha256: string; existing: { id: string; version: number; status: string } | null; currency: string | null; currencyNote: string; natureNote: string; notes: string[]; structure: { hiddenSheets: string[]; externalLinks: number; comments: number; mentionsCurrency: number; mentionsTax: number } | null; counts: { total: number; byStatus: Record<string, number> }; gaps: number; duplicates: number; discrepancies: Record<string, number> }[];
  groups: PreviewGroup[];
  /** cellules sans montant exploitable */
  unusable: { sourceRef: string; issues: string[] }[];
  /** comparaison avec la dernière version de chaque grille */
  changes: { group: string; role: string; sourceKey: string; previous: { version: number; status: string } | null; added: number; removed: number; changed: number; unchanged: number }[];
  /** paramètres de colonne proposés (repris de la grille publiée quand elle existe, sinon non établis) */
  defaults: UploadMapping;
  blockers: string[];
}

/** Analyse (lecture seule) et prévisualisation, avec les correspondances proposées ou corrigées. */
export async function previewUpload(uploadId: string): Promise<UploadPreview> {
  const up = await prisma.priceImportUpload.findUniqueOrThrow({ where: { id: uploadId }, select: { id: true, createdAt: true, createdBy: true, status: true, mapping: true } });
  const { previews, analysis } = await previewSupplierPrices(await sourceFiles(uploadId));
  const saved = (up.mapping ?? {}) as Partial<UploadMapping>;
  const groups: PreviewGroup[] = [];
  const unusable: UploadPreview["unusable"] = [];
  const changes: UploadPreview["changes"] = [];
  const defaults: UploadMapping = { groups: {}, columns: {} };
  for (const s of analysis.sources) {
    const byGroup = new Map<string, typeof s.rows>();
    for (const r of s.rows) {
      if (r.kind !== "GRID") continue;
      const id = groupId(r.familySlug, r.variantKey);
      if (!byGroup.has(id)) byGroup.set(id, []);
      byGroup.get(id)!.push(r);
      if (r.amountMinor == null) unusable.push({ sourceRef: r.sourceRef, issues: r.issues });
    }
    for (const [id, rows] of byGroup) {
      const roles = [...new Set(rows.map((r) => r.amountRole))].map((role) => {
        const rr = rows.filter((r) => r.amountRole === role);
        const amounts = rr.map((r) => r.amountMinor).filter((a): a is number => a != null);
        const ax = axesOf(rr.filter((r) => r.dimAmm != null && r.widthMaxMm != null).map((r) => ({ dimAmm: r.dimAmm!, widthMinMm: r.widthMinMm ?? r.widthMaxMm!, widthMaxMm: r.widthMaxMm! })));
        return { role, label: COLUMN_FR[role] ?? role, cells: rr.length, empty: rr.length - amounts.length, toCheck: rr.filter((r) => r.status !== "OK").length, minMinor: amounts.length ? Math.min(...amounts) : null, maxMinor: amounts.length ? Math.max(...amounts) : null, dims: ax.dims, widths: ax.widths };
      });
      const issueMap = new Map<string, number>();
      for (const r of rows) for (const i of r.issues) { const k = i.replace(/ligne \d+.*$/, "…").slice(0, 160); issueMap.set(k, (issueMap.get(k) ?? 0) + 1); }
      groups.push({ id, fileName: s.fileName, sheet: rows[0]!.sourceRef.split("›")[1]?.split("!")[0]?.trim() ?? "", detectedFamily: rows[0]!.familySlug, detectedVariant: rows[0]!.variantKey, dimAKey: rows[0]!.dimAKey ?? "projection", roles, issues: [...issueMap].map(([issue, count]) => ({ issue, count })).sort((a, b) => b.count - a.count).slice(0, 6) });
      const m = saved.groups?.[id] ?? { familySlug: rows[0]!.familySlug, variantKey: rows[0]!.variantKey, dimAKey: (rows[0]!.dimAKey === "hauteur" ? "hauteur" : "projection") as GroupMapping["dimAKey"] };
      defaults.groups[id] = m;
      for (const role of roles.map((r) => r.role)) {
        const sourceKey = gridKey(m.familySlug ?? rows[0]!.familySlug, m.variantKey, role);
        const prev = await prisma.supplierPriceList.findFirst({ where: { sourceKey, status: { not: "REJECTED" } }, orderBy: { version: "desc" }, select: { id: true, version: true, status: true } });
        const next: TariffCell[] = rows.filter((r) => r.amountRole === role && r.dimAmm != null && r.widthMaxMm != null).map((r) => ({ dimAmm: r.dimAmm!, widthMinMm: r.widthMinMm ?? r.widthMaxMm!, widthMaxMm: r.widthMaxMm!, amountMinor: r.amountMinor }));
        const d = diffCells(prev ? await gridCells(prev.id) : [], next);
        changes.push({ group: id, role, sourceKey, previous: prev ? { version: prev.version, status: prev.status } : null, added: d.added.length, removed: d.removed.length, changed: d.changed.length, unchanged: d.unchanged });
        if (!defaults.columns[role]) {
          const pub = await prisma.supplierPriceList.findFirst({ where: { sourceKey, status: "ACTIVE" }, orderBy: { publishedAt: "desc" }, select: { nature: true, currency: true, taxBasis: true } });
          // format normalisé : nature, devise et base DÉCLARÉES dans le fichier, proposées à l'administrateur qui les valide
          const declared = s.type === "normalized" ? { nature: NORMALIZED_ROLE_NATURE[role] ?? "UNKNOWN", taxBasis: s.taxBasis ?? "UNKNOWN" } : null;
          defaults.columns[role] = saved.columns?.[role] ?? { enabled: true, nature: (pub?.nature ?? declared?.nature ?? "UNKNOWN") as Nature, currency: pub?.currency ?? s.currency, taxBasis: (pub?.taxBasis ?? declared?.taxBasis ?? "UNKNOWN") as TaxBasis };
        }
      }
    }
  }
  const blockers: string[] = [];
  for (const [role, c] of Object.entries(defaults.columns)) {
    if (!c.enabled) continue;
    const missing = [c.nature === "UNKNOWN" && "nature", !c.currency && "devise", c.taxBasis === "UNKNOWN" && "HT/TTC"].filter(Boolean);
    if (missing.length) blockers.push(`${COLUMN_FR[role] ?? role} : ${missing.join(", ")} non établi(e)s — les grilles seront importées en brouillon et ne pourront pas être publiées avant d'être complétées.`);
  }
  if (unusable.length) blockers.push(`${unusable.length} cellule(s) sans montant exploitable : importées vides, elles bloquent la publication de leur grille.`);
  return {
    upload: { id: up.id, createdAt: up.createdAt, createdBy: up.createdBy, status: up.status },
    sources: previews.map((p, i) => ({ fileName: p.fileName, type: p.type, sourceKey: p.sourceKey, sha256: p.sha256, existing: p.existing, currency: p.currency, currencyNote: p.currencyNote, natureNote: p.natureNote, notes: p.notes, structure: p.structure, counts: p.counts, gaps: analysis.sources[i]!.gaps.length, duplicates: p.duplicates, discrepancies: p.discrepancies })),
    groups, unusable: unusable.slice(0, 200), changes, defaults, blockers,
  };
}

/** Enregistre les correspondances corrigées (feuille/bloc → produit/variante, colonnes → nature, devise, fiscalité). */
export async function saveUploadMapping(uploadId: string, mapping: UploadMapping, actor: Actor) {
  const families = new Set((await prisma.productFamily.findMany({ select: { slug: true } })).map((f) => f.slug));
  for (const [g, m] of Object.entries(mapping.groups)) {
    if (m.familySlug && !families.has(m.familySlug)) throw new TariffError(`${g} : produit inconnu.`);
    if (!/^[a-z0-9-]{0,40}$/.test(m.variantKey)) throw new TariffError(`${g} : variante invalide (minuscules, chiffres, tirets).`);
  }
  for (const c of Object.values(mapping.columns)) if (c.currency && !/^[A-Z]{3}$/.test(c.currency)) throw new TariffError("Devise : code ISO à trois lettres (ex. EUR).");
  await prisma.priceImportUpload.update({ where: { id: uploadId }, data: { mapping: mapping as unknown as Prisma.InputJsonValue } });
  await audit({ ...actor, action: "tariffs.uploadMapping", entity: "PriceImportUpload", entityId: uploadId, after: { groups: mapping.groups, columns: mapping.columns } });
}

/**
 * Import : version de fichier (réutilisée si l'empreinte est connue), puis brouillons de grilles selon les
 * correspondances. Rien n'est publié ; les fichiers téléversés sont ensuite effacés.
 */
export async function importUpload(uploadId: string, actor: Actor) {
  const preview = await previewUpload(uploadId);
  const mapping = preview.defaults;
  const files = await sourceFiles(uploadId);
  const { results } = await applySupplierPrices(files, actor, { notes: `Téléversé dans l'administration (${uploadId}).` });
  const grids: (DeriveFromImportResult & { listId: string; fileName: string })[] = [];
  for (const r of results) grids.push({ listId: r.listId, fileName: r.fileName, ...(await deriveGridsFromImport(r.listId, { columns: mapping.columns, mapping: mapping.groups }, actor)) });
  const result = { imports: results.map((r) => ({ fileName: r.fileName, listId: r.listId, version: r.version, reused: r.unchanged, rows: r.rows })), grids: grids.map((g) => ({ fileName: g.fileName, created: g.created, unchanged: g.unchanged, keptDrafts: g.keptDrafts, skipped: g.skipped })) };
  await prisma.$transaction([
    prisma.priceImportFile.updateMany({ where: { uploadId }, data: { bytes: null } }),
    prisma.priceImportUpload.update({ where: { id: uploadId }, data: { status: "IMPORTED", importedAt: new Date(), result: result as unknown as Prisma.InputJsonValue } }),
  ]);
  await audit({ ...actor, action: "tariffs.uploadImport", entity: "PriceImportUpload", entityId: uploadId, after: { imports: result.imports.map((i) => ({ file: i.fileName, version: i.version, reused: i.reused })), created: grids.flatMap((g) => g.created.map((c) => `${c.sourceKey} v${c.version}`)), unchanged: grids.reduce((n, g) => n + g.unchanged.length, 0) } });
  return result;
}

/** Abandon : fichiers effacés, rien n'est importé. */
export async function cancelUpload(uploadId: string, actor: Actor) {
  await prisma.$transaction([
    prisma.priceImportFile.updateMany({ where: { uploadId }, data: { bytes: null } }),
    prisma.priceImportUpload.update({ where: { id: uploadId }, data: { status: "CANCELLED" } }),
  ]);
  await audit({ ...actor, action: "tariffs.uploadCancel", entity: "PriceImportUpload", entityId: uploadId });
}
