"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { invalidateCatalogCache } from "@/server/catalog/load";
import { actorOf, back, fields, firstError, safeReturn, zBool, zOptInt, zReq } from "@/server/admin/form";
import { applyStockRows, previewStockImport, stockRowSchema } from "@/server/stock/import";

const PATH = "/admin/catalogue/stocks";

const editSchema = z.object({
  sku: zReq(64),
  availability: z.enum(["AVAILABLE", "ON_ORDER", "OUT_OF_STOCK", "TO_CONFIRM"]),
  tracked: zBool,
  stockQty: zOptInt(0, 1_000_000),
  leadMinDays: zOptInt(0, 730),
  leadMaxDays: zOptInt(0, 730),
  leadUnit: z.enum(["BUSINESS_DAYS", "CALENDAR_DAYS", "WEEKS"]),
  supplierDays: zOptInt(0, 365),
  preparationDays: zOptInt(0, 365),
  productionDays: zOptInt(0, 365),
  transportDays: zOptInt(0, 365),
  preorderAllowed: zBool,
  partialShipAllowed: zBool,
  leadSource: z.enum(["DEMO", "SUPPLIER_VERIFIED", "OBSERVED", "UNKNOWN"]),
  stockSource: zReq(200),
  returnTo: z.string().optional(),
});

export async function updateStockAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const f = fields(formData);
  const ret = safeReturn(f.returnTo, PATH);
  const p = editSchema.safeParse(f);
  if (!p.success) back(ret, firstError(p.error), "err");
  const d = p.data;
  if ((d.leadMinDays == null) !== (d.leadMaxDays == null)) back(ret, `${d.sku} : renseigner délai minimum et maximum, ou aucun.`, "err");
  if (d.leadMinDays != null && d.leadMaxDays != null && d.leadMinDays > d.leadMaxDays) back(ret, `${d.sku} : délai minimum supérieur au maximum.`, "err");
  if (d.tracked && d.stockQty == null) back(ret, `${d.sku} : quantité obligatoire si le stock est suivi.`, "err");
  const before = await prisma.variant.findUnique({ where: { sku: d.sku } });
  if (!before) back(ret, "Référence introuvable", "err");
  if (d.tracked && d.stockQty != null && d.stockQty < before.reservedQty) back(ret, `${d.sku} : ${before.reservedQty} unité(s) déjà réservée(s) — stock inférieur impossible.`, "err");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.variant.update({
      where: { sku: d.sku },
      data: {
        availability: d.availability,
        stockMode: d.tracked ? "STOCK" : "MADE_TO_ORDER",
        stockQty: d.tracked ? d.stockQty : null,
        leadMinDays: d.leadMinDays, leadMaxDays: d.leadMaxDays, leadUnit: d.leadUnit, leadSource: d.leadSource, leadUpdatedAt: now,
        supplierDays: d.supplierDays, preparationDays: d.preparationDays, productionDays: d.productionDays, transportDays: d.transportDays,
        preorderAllowed: d.preorderAllowed, partialShipAllowed: d.partialShipAllowed, stockSource: d.stockSource, stockUpdatedAt: now,
      },
    });
    const delta = (d.tracked ? (d.stockQty ?? 0) : 0) - (before.stockMode === "STOCK" ? (before.stockQty ?? 0) : 0);
    if (delta !== 0) await tx.stockMovement.create({ data: { variantId: before.id, delta, reason: "saisie administration", actor: session.user.email } });
  });
  invalidateCatalogCache();
  await audit({ ...actorOf(session), action: "stock.update", entity: "Variant", entityId: before.id, before: { availability: before.availability, stockQty: before.stockQty, leadMinDays: before.leadMinDays, leadMaxDays: before.leadMaxDays }, after: { availability: d.availability, stockQty: d.stockQty, leadMinDays: d.leadMinDays, leadMaxDays: d.leadMaxDays, source: d.stockSource } });
  back(ret, `${d.sku} : disponibilité et délais enregistrés.`);
}

export type StockPreviewState = { error: string } | { preview: Awaited<ReturnType<typeof previewStockImport>>; text: string; filename: string };

export async function previewStockImportAction(_prev: unknown, formData: FormData): Promise<StockPreviewState> {
  await assertRole(["ADMIN", "MANAGER"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Aucun fichier reçu." };
  if (file.size > 2 * 1024 * 1024) return { error: "Fichier trop volumineux (2 Mo max.)." };
  try {
    const text = await file.text();
    const preview = await previewStockImport(file.name, text);
    return { preview, text, filename: file.name };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function applyStockImportAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const text = String(formData.get("text") ?? "");
  const filename = String(formData.get("filename") ?? "import.csv").slice(0, 120);
  // revalidation complète côté serveur : le contenu renvoyé par le navigateur n'est pas cru
  const preview = await previewStockImport(filename, text).catch((e: Error) => back(PATH, e.message, "err"));
  const valid = preview.rows.map((r) => stockRowSchema.parse(r.row));
  if (valid.length === 0) back(PATH, "Aucune ligne valide à appliquer.", "err");
  const { updated } = await applyStockRows(valid, actorOf(session), `fichier:${filename}`);
  invalidateCatalogCache();
  back(PATH, `${updated} référence(s) mise(s) à jour ; ${preview.errors.length} ligne(s) rejetée(s).`);
}
