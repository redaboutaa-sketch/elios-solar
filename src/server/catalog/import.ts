/**
 * Import de variantes (CSV ou JSON) — logique partagée entre l'administration et le CLI
 * (`pnpm catalogue:import`). Deux temps : aperçu validé (CatalogImport PREVIEW), puis
 * application des seules lignes valides (APPLIED). Les commandes existantes ne sont jamais
 * modifiées : seules les variantes le sont (les lignes de commande sont figées).
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { DataStatus, StockMode } from "@/generated/prisma/enums";
import type { FamilyKind } from "@/generated/prisma/enums";

export const IMPORT_COLUMNS = ["sku", "familySlug", "label", "priceCents", "compareAtCents", "purchasable", "stockMode", "stockQty", "leadTimeDays", "dataStatus", "attributes"] as const;
export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/* ------------------------------ Parsing CSV ------------------------------ */

function detectDelimiter(text: string): "," | ";" {
  let inQ = false, commas = 0, semis = 0;
  for (const ch of text) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && (ch === "\n" || ch === "\r")) break;
    else if (!inQ && ch === ",") commas += 1;
    else if (!inQ && ch === ";") semis += 1;
  }
  return semis > commas ? ";" : ",";
}

/** Analyse CSV (RFC 4180) : séparateur `,` ou `;`, guillemets doublés, retours ligne entre guillemets. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const sep = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else inQ = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") inQ = true;
    else if (ch === sep) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (inQ) throw new Error("Guillemet non fermé dans le fichier CSV");
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** Lignes brutes (objets) depuis un fichier CSV ou JSON ; `line` = numéro de ligne d'origine. */
export function readRawRows(filename: string, text: string, required?: readonly string[]): Array<{ line: number; data: Record<string, unknown> }> {
  const trimmed = text.replace(/^﻿/, "").trim();
  if (/\.json$/i.test(filename) || trimmed.startsWith("[")) {
    const parsed: unknown = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : (parsed as { variants?: unknown })?.variants;
    if (!Array.isArray(arr)) throw new Error("JSON attendu : tableau d'objets (ou { variants: [...] })");
    return arr.map((data, i) => ({ line: i + 1, data: (data && typeof data === "object" ? data : {}) as Record<string, unknown> }));
  }
  const rows = parseCsv(text);
  const header = rows[0]?.map((h) => h.trim());
  if (!header) throw new Error("Fichier vide");
  const missing = required ? required.filter((c) => !header.includes(c)) : IMPORT_COLUMNS.filter((c) => !header.includes(c) && c !== "compareAtCents" && c !== "stockQty" && c !== "leadTimeDays");
  if (missing.length) throw new Error(`Colonnes manquantes : ${missing.join(", ")}`);
  return rows.slice(1).map((cells, i) => ({ line: i + 2, data: Object.fromEntries(header.map((h, j) => [h, cells[j] ?? ""])) }));
}

/* ------------------------------ Validation ------------------------------ */

const str = z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string());
const optInt = (max: number) => str.transform((v, ctx) => {
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > max) { ctx.addIssue({ code: "custom", message: `entier entre 0 et ${max} attendu` }); return z.NEVER; }
  return n;
});
const bool = str.transform((v, ctx) => {
  const s = v.toLowerCase();
  if (["true", "1", "oui", "yes", "vrai"].includes(s)) return true;
  if (["false", "0", "non", "no", "faux", ""].includes(s)) return false;
  ctx.addIssue({ code: "custom", message: "booléen attendu (true/false)" });
  return z.NEVER;
});
const upperEnum = <T extends Record<string, string>>(e: T) => str.transform((v) => v.toUpperCase()).pipe(z.enum(e));
const mounting = z.enum(["freestanding", "wall"]);

export const attributesSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pergola_standard"), finishCode: z.string().min(1), dimensionCode: z.string().min(1), mounting }).strict(),
  z.object({ kind: z.literal("side_closure"), sideLengthMm: z.number().int().positive(), colorCode: z.string().min(1), option: z.string().optional(), mounting: mounting.optional() }).strict(),
  z.object({ kind: z.literal("option"), dimensionCode: z.string().optional(), mounting: mounting.optional(), colorCode: z.string().optional(), variantOption: z.string().optional() }).strict(),
  z.object({ kind: z.literal("awning"), widthMm: z.number().int().positive(), projectionMm: z.number().int().positive(), cabinetColor: z.string().min(1), fabricCode: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("service") }).strict(),
]);
export type ImportAttributes = z.infer<typeof attributesSchema>;

export const importRowSchema = z.object({
  sku: str.pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]{1,63}$/, "SKU : majuscules, chiffres, - ou _ (2 à 64)")),
  familySlug: str.pipe(z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/, "slug de famille invalide")),
  label: str.pipe(z.string().min(1, "libellé obligatoire").max(200)),
  priceCents: str.transform((v, ctx) => {
    const n = Number(v);
    if (v === "" || !Number.isInteger(n) || n < 0 || n > 100_000_000) { ctx.addIssue({ code: "custom", message: "centimes entiers attendus" }); return z.NEVER; }
    return n;
  }),
  compareAtCents: optInt(100_000_000),
  purchasable: bool,
  stockMode: upperEnum(StockMode),
  stockQty: optInt(1_000_000),
  leadTimeDays: optInt(3650),
  dataStatus: upperEnum(DataStatus),
  attributes: z.preprocess((v, ctx) => {
    if (v && typeof v === "object") return v;
    try { return JSON.parse(String(v ?? "")); } catch { ctx.addIssue({ code: "custom", message: "JSON invalide" }); return z.NEVER; }
  }, attributesSchema),
}).superRefine((r, ctx) => {
  if (r.compareAtCents !== null && r.compareAtCents <= r.priceCents) ctx.addIssue({ code: "custom", path: ["compareAtCents"], message: "doit être supérieur à priceCents" });
  if (r.stockMode === "STOCK" && r.stockQty === null) ctx.addIssue({ code: "custom", path: ["stockQty"], message: "obligatoire en mode STOCK" });
});
export type ImportRow = z.infer<typeof importRowSchema>;

const KIND_FOR_FAMILY: Partial<Record<FamilyKind, ImportAttributes["kind"]>> = { PERGOLA_STANDARD: "pergola_standard", SIDE_CLOSURE: "side_closure", OPTION: "option", AWNING: "awning", SERVICE: "service" };

export interface ImportIssue { line: number; sku?: string; message: string }
export type PreviewRow = ImportRow & { line: number; action: "create" | "update" | "unchanged"; oldPriceCents?: number | null; priceChanged: boolean };
export interface ImportSummary { total: number; valid: number; invalid: number; create: number; update: number; unchanged: number; priceChanged: number; rows: PreviewRow[]; appliedAt?: string; applied?: { created: number; updated: number } }

function sameAttributes(a: unknown, b: unknown): boolean {
  const norm = (o: unknown) => JSON.stringify(Object.fromEntries(Object.entries((o ?? {}) as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y))));
  return norm(a) === norm(b);
}

/** Valide les lignes et calcule les changements par rapport à la base (aucune écriture). */
export async function buildPreview(filename: string, text: string): Promise<{ summary: ImportSummary; errors: ImportIssue[] }> {
  const errors: ImportIssue[] = [];
  let raw: Array<{ line: number; data: Record<string, unknown> }>;
  try {
    raw = readRawRows(filename, text);
  } catch (e) {
    return { summary: { total: 0, valid: 0, invalid: 0, create: 0, update: 0, unchanged: 0, priceChanged: 0, rows: [] }, errors: [{ line: 0, message: (e as Error).message }] };
  }
  if (raw.length > MAX_IMPORT_ROWS) errors.push({ line: 0, message: `Trop de lignes (${raw.length} > ${MAX_IMPORT_ROWS}) : seules les ${MAX_IMPORT_ROWS} premières sont analysées` });
  raw = raw.slice(0, MAX_IMPORT_ROWS);

  const [families, finishes, dimensions] = await Promise.all([
    prisma.productFamily.findMany({ select: { id: true, slug: true, kind: true } }),
    prisma.finish.findMany({ select: { code: true } }),
    prisma.dimensionPreset.findMany({ select: { code: true } }),
  ]);
  const famBySlug = new Map(families.map((f) => [f.slug, f]));
  const finishSet = new Set(finishes.map((f) => f.code));
  const dimSet = new Set(dimensions.map((d) => d.code));

  const valid: Array<ImportRow & { line: number }> = [];
  const seen = new Set<string>();
  for (const { line, data } of raw) {
    const sku = typeof data.sku === "string" ? data.sku.trim() : undefined;
    const parsed = importRowSchema.safeParse(data);
    if (!parsed.success) {
      errors.push({ line, sku, message: parsed.error.issues.map((i) => `${i.path.join(".") || "ligne"} : ${i.message}`).join(" ; ") });
      continue;
    }
    const r = parsed.data;
    const msgs: string[] = [];
    if (seen.has(r.sku)) msgs.push("SKU en double dans le fichier");
    const fam = famBySlug.get(r.familySlug);
    if (!fam) msgs.push(`famille inconnue « ${r.familySlug} »`);
    else {
      const expected = KIND_FOR_FAMILY[fam.kind];
      if (expected && expected !== r.attributes.kind) msgs.push(`attributes.kind « ${r.attributes.kind} » incompatible avec la famille (${expected} attendu)`);
    }
    if (r.attributes.kind === "pergola_standard") {
      if (!finishSet.has(r.attributes.finishCode)) msgs.push(`finition inconnue « ${r.attributes.finishCode} »`);
      if (!dimSet.has(r.attributes.dimensionCode)) msgs.push(`dimension inconnue « ${r.attributes.dimensionCode} »`);
    }
    if (msgs.length) { errors.push({ line, sku: r.sku, message: msgs.join(" ; ") }); continue; }
    seen.add(r.sku);
    valid.push({ ...r, line });
  }

  const existing = await prisma.variant.findMany({ where: { sku: { in: valid.map((v) => v.sku) } }, include: { family: { select: { slug: true } } } });
  const bySku = new Map(existing.map((v) => [v.sku, v]));
  const rows: PreviewRow[] = valid.map((r) => {
    const e = bySku.get(r.sku);
    if (!e) return { ...r, action: "create", priceChanged: false };
    const changed = e.family.slug !== r.familySlug || e.label !== r.label || e.priceCents !== r.priceCents || e.compareAtCents !== r.compareAtCents || e.purchasable !== r.purchasable || e.stockMode !== r.stockMode || e.stockQty !== r.stockQty || e.leadTimeDays !== r.leadTimeDays || e.dataStatus !== r.dataStatus || !sameAttributes(e.attributes, r.attributes);
    return { ...r, action: changed ? "update" : "unchanged", oldPriceCents: e.priceCents, priceChanged: e.priceCents !== r.priceCents };
  });
  const invalidLines = new Set(errors.filter((e) => e.line > 0).map((e) => e.line)).size;
  return {
    summary: {
      total: raw.length, valid: rows.length, invalid: invalidLines,
      create: rows.filter((r) => r.action === "create").length,
      update: rows.filter((r) => r.action === "update").length,
      unchanged: rows.filter((r) => r.action === "unchanged").length,
      priceChanged: rows.filter((r) => r.priceChanged).length,
      rows,
    },
    errors,
  };
}

/** Étape 1 : enregistre l'aperçu (statut PREVIEW). */
export async function createImportPreview(filename: string, text: string, createdBy: string | null) {
  const { summary, errors } = await buildPreview(filename, text);
  return prisma.catalogImport.create({ data: { filename: filename.slice(0, 200), status: "PREVIEW", summary: summary as never, errors: errors as never, createdBy } });
}

export class CatalogImportError extends Error {}

/** Étape 2 : applique les lignes valides d'un aperçu (upsert par SKU), une seule fois. */
export async function applyImport(importId: string, actor: { actorUserId?: string | null; actorEmail?: string | null }) {
  const claimed = await prisma.catalogImport.updateMany({ where: { id: importId, status: "PREVIEW" }, data: { status: "APPLYING" } });
  if (claimed.count === 0) throw new CatalogImportError("Import introuvable ou déjà appliqué");
  const record = await prisma.catalogImport.findUniqueOrThrow({ where: { id: importId } });
  const summary = record.summary as unknown as ImportSummary;
  const rows = (summary.rows ?? []).filter((r) => r.action !== "unchanged");
  try {
    const result = await prisma.$transaction(async (tx) => {
      const families = await tx.productFamily.findMany({ where: { slug: { in: [...new Set(rows.map((r) => r.familySlug))] } }, select: { id: true, slug: true } });
      const famId = new Map(families.map((f) => [f.slug, f.id]));
      const existing = await tx.variant.findMany({ where: { sku: { in: rows.map((r) => r.sku) } }, select: { sku: true, priceCents: true } });
      const before = new Map(existing.map((v) => [v.sku, v.priceCents]));
      let created = 0, updated = 0;
      const priceChanges: Array<{ sku: string; from: number; to: number }> = [];
      for (const r of rows) {
        const familyId = famId.get(r.familySlug);
        if (!familyId) throw new CatalogImportError(`Famille supprimée depuis l'aperçu : ${r.familySlug}`);
        const data = { familyId, label: r.label, priceCents: r.priceCents, compareAtCents: r.compareAtCents, purchasable: r.purchasable, stockMode: r.stockMode, stockQty: r.stockQty, leadTimeDays: r.leadTimeDays, dataStatus: r.dataStatus, attributes: r.attributes as never };
        await tx.variant.upsert({ where: { sku: r.sku }, create: { sku: r.sku, ...data }, update: data });
        const old = before.get(r.sku);
        if (old === undefined) created += 1;
        else { updated += 1; if (old !== r.priceCents) priceChanges.push({ sku: r.sku, from: old, to: r.priceCents }); }
      }
      await tx.catalogImport.update({ where: { id: importId }, data: { status: "APPLIED", summary: { ...summary, appliedAt: new Date().toISOString(), applied: { created, updated } } as never } });
      return { created, updated, priceChanges };
    }, { timeout: 60_000 });
    await audit({ ...actor, action: "catalog.import.apply", entity: "CatalogImport", entityId: importId, before: { status: "PREVIEW" }, after: { status: "APPLIED", filename: record.filename, created: result.created, updated: result.updated, priceChanges: result.priceChanges.slice(0, 200) } });
    return result;
  } catch (e) {
    await prisma.catalogImport.update({ where: { id: importId }, data: { status: "PREVIEW" } });
    throw e;
  }
}
