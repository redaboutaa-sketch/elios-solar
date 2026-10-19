/**
 * Import contrôlé des stocks et délais par référence (CSV ou JSON), et adaptateur fournisseur.
 * Deux temps : aperçu validé (aucune écriture), puis application des seules lignes valides avec
 * journal de mouvements. Sans source fournisseur connectée, aucun stock n'est présenté comme réel :
 * `source` est obligatoire et la fiabilité (`leadSource`) est déclarée par ligne.
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { readRawRows } from "@/server/catalog/import";

export const STOCK_COLUMNS = ["sku", "availability", "stockQty", "leadMinDays", "leadMaxDays", "leadUnit", "supplierDays", "preparationDays", "productionDays", "transportDays", "preorderAllowed", "partialShipAllowed", "leadSource", "source"] as const;

const optInt = (max = 100_000) => z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).max(max).nullable());
const optBool = z.preprocess((v) => (v === "" || v == null ? undefined : ["1", "true", "oui", "yes", true].includes(typeof v === "string" ? v.toLowerCase() : (v as boolean))), z.boolean().optional());

export const stockRowSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  availability: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() : v), z.enum(["AVAILABLE", "ON_ORDER", "OUT_OF_STOCK", "TO_CONFIRM"])),
  stockQty: optInt(1_000_000),
  leadMinDays: optInt(730),
  leadMaxDays: optInt(730),
  leadUnit: z.preprocess((v) => (v === "" || v == null ? "BUSINESS_DAYS" : String(v).trim().toUpperCase()), z.enum(["BUSINESS_DAYS", "CALENDAR_DAYS", "WEEKS"])),
  supplierDays: optInt(365),
  preparationDays: optInt(365),
  productionDays: optInt(365),
  transportDays: optInt(365),
  preorderAllowed: optBool,
  partialShipAllowed: optBool,
  leadSource: z.preprocess((v) => (v === "" || v == null ? "UNKNOWN" : String(v).trim().toUpperCase()), z.enum(["DEMO", "SUPPLIER_VERIFIED", "OBSERVED", "UNKNOWN"])),
  source: z.string().trim().min(2, "source de l'information obligatoire").max(200),
}).superRefine((r, ctx) => {
  if (r.leadMinDays != null && r.leadMaxDays != null && r.leadMinDays > r.leadMaxDays) ctx.addIssue({ code: "custom", message: "délai minimum supérieur au maximum", path: ["leadMinDays"] });
  if ((r.leadMinDays == null) !== (r.leadMaxDays == null)) ctx.addIssue({ code: "custom", message: "renseigner délai minimum ET maximum (ou aucun)", path: ["leadMaxDays"] });
  if (r.availability === "AVAILABLE" && r.stockQty === 0) ctx.addIssue({ code: "custom", message: "« disponible » avec un stock nul : utiliser OUT_OF_STOCK ou ON_ORDER", path: ["availability"] });
});
export type StockRow = z.infer<typeof stockRowSchema>;

export interface StockPreviewRow { line: number; row: StockRow; current: { availability: string; stockQty: number | null; reservedQty: number; leadMinDays: number | null; leadMaxDays: number | null }; changes: string[]; warnings: string[] }
export interface StockPreview { rows: StockPreviewRow[]; errors: Array<{ line: number; sku?: string; message: string }>; duplicates: string[] }

export async function previewStockImport(filename: string, text: string): Promise<StockPreview> {
  const raw = readRawRows(filename, text, ["sku", "availability", "source"]);
  const errors: StockPreview["errors"] = [];
  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  const parsed: Array<{ line: number; row: StockRow }> = [];
  for (const r of raw) {
    const p = stockRowSchema.safeParse(r.data);
    if (!p.success) { errors.push({ line: r.line, sku: typeof r.data.sku === "string" ? r.data.sku : undefined, message: p.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`).join(" ; ") }); continue; }
    if (seen.has(p.data.sku)) { duplicates.push(p.data.sku); errors.push({ line: r.line, sku: p.data.sku, message: `référence en double (déjà ligne ${seen.get(p.data.sku)})` }); continue; }
    seen.set(p.data.sku, r.line);
    parsed.push({ line: r.line, row: p.data });
  }
  const existing = await prisma.variant.findMany({ where: { sku: { in: parsed.map((p) => p.row.sku) } }, select: { sku: true, availability: true, stockQty: true, reservedQty: true, stockMode: true, leadMinDays: true, leadMaxDays: true } });
  const bySku = new Map(existing.map((e) => [e.sku, e]));
  const rows: StockPreviewRow[] = [];
  for (const p of parsed) {
    const cur = bySku.get(p.row.sku);
    if (!cur) { errors.push({ line: p.line, sku: p.row.sku, message: "référence inconnue du catalogue (créez-la d'abord via l'import catalogue)" }); continue; }
    const changes: string[] = [];
    const warnings: string[] = [];
    if (cur.availability !== p.row.availability) changes.push(`disponibilité ${cur.availability} → ${p.row.availability}`);
    if (p.row.stockQty !== null && p.row.stockQty !== cur.stockQty) changes.push(`stock ${cur.stockQty ?? "non suivi"} → ${p.row.stockQty}`);
    if (p.row.stockQty !== null && p.row.stockQty < cur.reservedQty) warnings.push(`stock ${p.row.stockQty} inférieur aux ${cur.reservedQty} unité(s) réservée(s) par des commandes en attente`);
    if (p.row.leadMinDays !== cur.leadMinDays || p.row.leadMaxDays !== cur.leadMaxDays) changes.push(`délai ${cur.leadMinDays ?? "?"}–${cur.leadMaxDays ?? "?"} → ${p.row.leadMinDays ?? "?"}–${p.row.leadMaxDays ?? "?"}`);
    if (p.row.leadSource === "SUPPLIER_VERIFIED" && !/fournisseur|supplier|edi|api/i.test(p.row.source)) warnings.push("fiabilité « vérifié fournisseur » : la source doit nommer le fournisseur ou le flux");
    rows.push({ line: p.line, row: p.row, current: { availability: cur.availability, stockQty: cur.stockQty, reservedQty: cur.reservedQty, leadMinDays: cur.leadMinDays, leadMaxDays: cur.leadMaxDays }, changes, warnings });
  }
  return { rows, errors, duplicates };
}

/** Applique les lignes valides ; journalise un mouvement par variation de stock. */
export async function applyStockRows(rows: StockRow[], actor: { actorUserId?: string | null; actorEmail?: string | null }, reference: string) {
  let updated = 0;
  for (const r of rows) {
    await prisma.$transaction(async (tx) => {
      const v = await tx.variant.findUnique({ where: { sku: r.sku } });
      if (!v) return;
      const now = new Date();
      await tx.variant.update({
        where: { sku: r.sku },
        data: {
          availability: r.availability,
          ...(r.stockQty !== null ? { stockMode: "STOCK", stockQty: r.stockQty, stockSource: r.source, stockUpdatedAt: now } : {}),
          leadMinDays: r.leadMinDays, leadMaxDays: r.leadMaxDays, leadUnit: r.leadUnit, leadSource: r.leadSource, leadUpdatedAt: now,
          supplierDays: r.supplierDays, preparationDays: r.preparationDays, productionDays: r.productionDays, transportDays: r.transportDays,
          ...(r.preorderAllowed !== undefined ? { preorderAllowed: r.preorderAllowed } : {}),
          ...(r.partialShipAllowed !== undefined ? { partialShipAllowed: r.partialShipAllowed } : {}),
        },
      });
      if (r.stockQty !== null && r.stockQty !== (v.stockQty ?? 0)) {
        await tx.stockMovement.create({ data: { variantId: v.id, delta: r.stockQty - (v.stockQty ?? 0), reason: "import", reference, actor: actor.actorEmail ?? null } });
      }
      updated += 1;
    });
  }
  await audit({ ...actor, action: "stock.import", entity: "Variant", after: { reference, rows: rows.length, updated } });
  return { updated };
}

/* ------------------------------------------------------------------ */
/* Adaptateur fournisseur                                              */
/* ------------------------------------------------------------------ */

/** Source de stock/délais fournisseur. Aucune implémentation réseau n'est fournie tant qu'aucun flux n'est contractualisé. */
export interface SupplierStockAdapter {
  readonly name: string;
  /** true seulement pour un flux réellement connecté au fournisseur */
  readonly live: boolean;
  fetchRows(): Promise<Array<Record<string, unknown>>>;
}

/** Adaptateur fichier (export fournisseur déposé manuellement) : passe par la même validation que l'import. */
export function fileAdapter(name: string, filename: string, text: string): SupplierStockAdapter {
  return { name, live: false, fetchRows: async () => readRawRows(filename, text, ["sku", "availability", "source"]).map((r) => r.data) };
}

/** Synchronisation : aperçu puis application ; les lignes d'un adaptateur non connecté ne peuvent pas être marquées vérifiées. */
export async function syncFromAdapter(adapter: SupplierStockAdapter, actor: { actorUserId?: string | null; actorEmail?: string | null }, apply: boolean) {
  const rows = await adapter.fetchRows();
  const json = JSON.stringify(rows.map((r) => (adapter.live ? r : { ...r, leadSource: r.leadSource === "SUPPLIER_VERIFIED" ? "OBSERVED" : r.leadSource })));
  const preview = await previewStockImport(`${adapter.name}.json`, json);
  if (apply && preview.rows.length) await applyStockRows(preview.rows.map((r) => r.row), actor, `adaptateur:${adapter.name}`);
  return preview;
}
