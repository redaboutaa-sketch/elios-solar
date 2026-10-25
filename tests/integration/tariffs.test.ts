/**
 * Écran Tarifs — service des grilles administrées sur la base de test, avec des fichiers et montants SYNTHÉTIQUES :
 * import → brouillons (sans doublon), saisie, contrôles, publication immédiate ou programmée, chevauchements,
 * brouillon obsolète, désactivation, devis déjà émis inchangé, téléversement.
 */
import { afterAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { applySupplierPrices } from "@/server/supplier-prices/import";
import { checksFor, deactivateGrid, deriveGridsFromImport, getGrid, gridCells, groupId, publishGrid, restoreAsDraft, saveCells, TariffError, updateParams, verifyGrid, type GridParamsInput } from "@/server/tariffs/grids";
import { createUpload, importUpload, previewUpload } from "@/server/tariffs/upload";
import { loadPublicSystemPrices } from "@/server/pricing/system-prices";
import { invalidateCatalogCache, loadCatalog } from "@/server/catalog/load";
import { ensureCatalogSnapshot } from "@/server/catalog/public-snapshot";
import { evaluateInput } from "@/server/configuration/service";
import { createQuote } from "@/server/quote/service";
import { defaultSystemInput, type SystemInput, type SystemRules } from "@/domain/system";
import { publishTestGrids } from "./helpers";

const TAG = randomBytes(4).toString("hex");
const KEY = `test-tarifs-${TAG}`;
const VARIANT = `test-${TAG}`;
const ACTOR = { actorUserId: null, actorEmail: "test:tarifs" };
// montants fictifs atypiques
const AMOUNTS = [48_211.37, 51_903.71, 60_417.13];

async function xlsx(amounts: number[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("VERANDA FTS");
  ws.mergeCells("A1:F2");
  ws.getCell("A1").value = "VERANDA FTS";
  ["Projection (cm)", "Largeur (cm)", "Prix ", "Surface m2", "Prix/m2", "Prix final HELIOSTORES "].forEach((t, i) => (ws.getRow(4).getCell(i + 1).value = t));
  amounts.forEach((c, i) => {
    const r = 5 + i;
    ws.getCell(`A${r}`).value = 150;
    ws.getCell(`B${r}`).value = 100 + 25 * i;
    ws.getCell(`C${r}`).value = c;
    ws.getCell(`F${r}`).value = { formula: `C${r}*0.7`, result: Math.round(c * 70) / 100 };
  });
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

const unknown = { enabled: true, nature: "UNKNOWN" as const, currency: null, taxBasis: "UNKNOWN" as const };
// le bloc détecté (« VERANDA FTS », produit en brouillon) est rattaché à une variante de test de Marbella
const mapping = { [groupId("helio-verriere", "")]: { familySlug: "marbella", variantKey: VARIANT, dimAKey: "projection" as const } };
const saleParams = (over: Partial<GridParamsInput> = {}): GridParamsInput => ({ nature: "SALE", natureNote: "test", currency: "EUR", taxBasis: "HT", vatRateBps: 2000, clientele: "ALL", dimRule: "EXACT", dimRuleNote: "", validFrom: null, validTo: null, scopeNote: "", included: "", excluded: "", notes: "", zeroConfirmed: false, ...over });
const rev = async (id: string) => (await getGrid(id)).revision;

let importId = "";
let IMPORT_SHA = "-";
let saleId = "";
const quotes: string[] = [];
const uploads: string[] = [];

afterAll(async () => {
  await prisma.emailOutbox.deleteMany({ where: { dedupeKey: { in: quotes.map((q) => `quote-ack:${q}`) } } });
  await prisma.quoteVisual.deleteMany({ where: { quoteId: { in: quotes } } });
  await prisma.quote.deleteMany({ where: { id: { in: quotes } } });
  await prisma.supplierPriceList.deleteMany({ where: { OR: [{ sourceKey: KEY }, { sourceSha256: IMPORT_SHA }, { scope: "GRID", variantKey: { startsWith: VARIANT } }] } });
  await prisma.priceImportUpload.deleteMany({ where: { id: { in: uploads } } });
  invalidateCatalogCache();
});

describe("grilles depuis un import", () => {
  it("import → un brouillon par colonne, nature non établie ; import répété : aucun doublon", async () => {
    const bytes = await xlsx(AMOUNTS);
    const { results } = await applySupplierPrices([{ fileName: "synthetique.xlsx", bytes, sourceKey: KEY }], ACTOR);
    importId = results[0]!.listId;
    IMPORT_SHA = (await prisma.supplierPriceList.findUniqueOrThrow({ where: { id: importId } })).sourceSha256;
    const r1 = await deriveGridsFromImport(importId, { columns: { PRIX_FINAL: unknown, PRIX_SOURCE: unknown }, mapping }, ACTOR);
    expect(r1.created).toHaveLength(2);
    const sale = r1.created.find((c) => c.sourceKey.endsWith(":PRIX_FINAL"))!;
    saleId = sale.id;
    const g = await getGrid(saleId);
    expect(g).toMatchObject({ scope: "GRID", status: "DRAFT", familySlug: "marbella", variantKey: VARIANT, nature: "UNKNOWN", currency: null, taxBasis: "UNKNOWN", dimRule: "EXACT", originListId: importId });
    const rows = await prisma.supplierPriceRow.findMany({ where: { listId: saleId }, orderBy: { widthMinMm: "asc" } });
    expect(rows.map((r) => [r.dimAmm, r.widthMaxMm, r.dimAKey])).toEqual([[1500, 1000, "projection"], [1500, 1250, "projection"], [1500, 1500, "projection"]]);
    expect(rows[0]!.sourceRef).toMatch(/synthetique\.xlsx › VERANDA FTS!F5/);
    // même fichier : version de fichier réutilisée, grilles inchangées
    const again = await applySupplierPrices([{ fileName: "copie.xlsx", bytes }], ACTOR);
    expect(again.results[0]).toMatchObject({ unchanged: true, listId: importId });
    const r2 = await deriveGridsFromImport(importId, { columns: { PRIX_FINAL: unknown, PRIX_SOURCE: unknown }, mapping }, ACTOR);
    expect(r2.created).toHaveLength(0);
    expect(r2.unchanged).toHaveLength(2);
    expect(await prisma.supplierPriceList.count({ where: { scope: "GRID", variantKey: VARIANT } })).toBe(2);
  });

  it("publication refusée tant que nature, devise et base fiscale ne sont pas établies", async () => {
    const checks = await checksFor(await getGrid(saleId));
    expect(checks.filter((c) => c.severity === "blocking").map((c) => c.code)).toEqual(expect.arrayContaining(["nature_unknown", "currency_missing", "tax_unknown"]));
    await expect(verifyGrid(saleId, await rev(saleId), ACTOR)).rejects.toBeInstanceOf(TariffError);
    await expect(publishGrid(saleId, await rev(saleId), {}, ACTOR)).rejects.toThrow(/vérifiée/);
  });

  it("saisie : valeur invalide refusée, cellule vidée bloquante, prix nul à confirmer, modification concurrente refusée", async () => {
    const cell = { dimAmm: 1500, widthMinMm: 1000, widthMaxMm: 1000 };
    await expect(saveCells(saleId, await rev(saleId), [{ ...cell, action: "set", value: "12,345" }], ACTOR)).rejects.toThrow(/Montant invalide/);
    const r0 = await rev(saleId);
    await updateParams(saleId, r0, saleParams(), ACTOR);
    await expect(updateParams(saleId, r0, saleParams(), ACTOR)).rejects.toThrow(/modifiée entre-temps/);
    await saveCells(saleId, await rev(saleId), [{ ...cell, action: "clear" }], ACTOR);
    expect((await checksFor(await getGrid(saleId))).map((c) => c.code)).toContain("empty_cells");
    await saveCells(saleId, await rev(saleId), [{ ...cell, action: "set", value: "0" }], ACTOR);
    expect((await checksFor(await getGrid(saleId))).filter((c) => c.severity === "blocking").map((c) => c.code)).toEqual(["zero_cells"]);
    await saveCells(saleId, await rev(saleId), [{ ...cell, action: "set", value: "33 712,45" }, { dimAmm: 1750, widthMinMm: 1000, widthMaxMm: 1000, action: "set", value: "35000" }], ACTOR);
    const rows = await prisma.supplierPriceRow.findMany({ where: { listId: saleId, dimAmm: { in: [1500, 1750] }, widthMaxMm: 1000 }, orderBy: { dimAmm: "asc" } });
    expect(rows.map((r) => [r.amountMinor, r.origin, r.editedBy])).toEqual([[3_371_245, "IMPORT", "test:tarifs"], [3_500_000, "MANUAL", "test:tarifs"]]);
    // le journal ne contient aucun montant
    const log = await prisma.auditLog.findMany({ where: { entityId: saleId } });
    expect(JSON.stringify(log)).not.toMatch(/3371245|3500000|4821137/);
  });

  it("grille complète : vérifiée puis publiée ; alimente les grilles publiques de la boutique (devise, base, règle)", async () => {
    await verifyGrid(saleId, await rev(saleId), ACTOR);
    const p = await publishGrid(saleId, await rev(saleId), {}, ACTOR);
    expect(p.scheduled).toBe(false);
    const { tables } = await loadPublicSystemPrices();
    const t = tables.get("marbella")!;
    expect(t.variants?.[VARIANT]).toMatchObject({ currency: "EUR", taxBasis: "HT", dimRule: "exact", vatRateBps: 2000, versionId: saleId });
    expect(t.cells.filter((c) => c.variantKey === VARIANT)).toHaveLength(4);
    // la colonne source (coût) du même import n'est jamais chargée
    const json = JSON.stringify([...tables.values()]);
    expect(json).not.toContain(String(Math.round(AMOUNTS[1]! * 100)));
    invalidateCatalogCache();
    const snap = JSON.stringify(await ensureCatalogSnapshot());
    for (const a of AMOUNTS) expect(snap).not.toContain(String(Math.round(a * 100)));
  });

  it("brouillon obsolète refusé ; publication programmée sans effet avant sa date ; chevauchement refusé ; désactivation", async () => {
    const a = await restoreAsDraft(saleId, ACTOR);
    const b = await restoreAsDraft(saleId, ACTOR);
    await saveCells(a.id, await rev(a.id), [{ dimAmm: 1500, widthMinMm: 1000, widthMaxMm: 1000, action: "set", value: "33800" }], ACTOR);
    await verifyGrid(a.id, await rev(a.id), ACTOR);
    await verifyGrid(b.id, await rev(b.id), ACTOR);
    const future = new Date(Date.now() + 3 * 24 * 3600_000);
    await publishGrid(a.id, await rev(a.id), { at: future }, ACTOR);
    // b a été créé avant la publication de a : obsolète
    await expect(publishGrid(b.id, await rev(b.id), {}, ACTOR)).rejects.toThrow(/obsolète/);
    // avant la date : la version précédente reste en vigueur ; à la date : la nouvelle (la précédente a reçu une fin de validité)
    const priceAt = async (d: Date) => (await loadPublicSystemPrices(d)).tables.get("marbella")?.cells.find((c) => c.variantKey === VARIANT && c.dimAmm === 1500 && c.widthMaxMm === 1000)?.amountMinor;
    expect(await priceAt(new Date())).toBe(3_371_245);
    expect(await priceAt(new Date(future.getTime() + 60_000))).toBe(3_380_000);
    expect((await getGrid(saleId)).validTo?.getTime()).toBe(future.getTime());
    // nouvelle version immédiate sans fin : chevaucherait la version programmée
    const c = await restoreAsDraft(saleId, ACTOR);
    await expect(verifyGrid(c.id, await rev(c.id), ACTOR)).rejects.toThrow(/Chevauchement/);
    // désactivation de la version programmée : la version en vigueur reste seule, sans reprise implicite
    await deactivateGrid(a.id, ACTOR);
    expect(await priceAt(new Date(future.getTime() + 60_000))).toBeUndefined();
    expect(await priceAt(new Date())).toBe(3_371_245);
  });
});

describe("devis déjà émis", () => {
  it("une nouvelle version publiée ne modifie pas un devis émis ; une nouvelle évaluation prend le nouveau prix", async () => {
    const grid = await publishTestGrids([{ familySlug: "marbella", variantKey: "murale", dimAmm: 5000, widthMinMm: 4000, widthMaxMm: 4000, amountMinor: 1_111_111 }]);
    try {
      invalidateCatalogCache();
      const fam = (await loadCatalog({ fresh: true })).families.find((f) => f.slug === "marbella")!;
      const input: SystemInput = { ...defaultSystemInput("marbella", fam.systemRules as SystemRules), widthMm: 4000, depthMm: 5000, mounting: "wall" };
      const r1 = await evaluateInput(input);
      expect(r1.systemPrice?.amountMinor).toBe(1_111_111);
      const q = await createQuote({ kind: "system", firstName: "Test", lastName: "Tarifs", email: `tarifs-${TAG}@test.invalid`, input, result: r1 }, { userId: null, guestKey: TAG });
      quotes.push(q.id);
      const before = JSON.stringify((await prisma.quote.findUniqueOrThrow({ where: { id: q.id } })).snapshot);
      const d = await restoreAsDraft(grid.ids[0]!, ACTOR);
      await saveCells(d.id, await rev(d.id), [{ dimAmm: 5000, widthMinMm: 4000, widthMaxMm: 4000, action: "set", value: "12222,22" }], ACTOR);
      await verifyGrid(d.id, await rev(d.id), ACTOR);
      await publishGrid(d.id, await rev(d.id), {}, ACTOR);
      expect(JSON.stringify((await prisma.quote.findUniqueOrThrow({ where: { id: q.id } })).snapshot)).toBe(before);
      expect(before).toContain("1111111");
      invalidateCatalogCache();
      expect((await evaluateInput(input)).systemPrice?.amountMinor).toBe(1_222_222);
    } finally {
      await grid.restore();
      invalidateCatalogCache();
    }
  });
});

describe("téléversement depuis l'administration", () => {
  it("fichier refusé s'il n'est pas une archive Office ; analyse, import en brouillon, fichiers effacés, ré-import sans doublon", async () => {
    await expect(createUpload([{ name: "tarifs.xlsx", bytes: new TextEncoder().encode("pas une archive") }], ACTOR)).rejects.toThrow(/archive Office/);
    await expect(createUpload([{ name: "macro.xlsm", bytes: new Uint8Array([0x50, 0x4b, 3, 4]) }], ACTOR)).rejects.toThrow(/\.xlsx/);
    const bytes = await xlsx([12_345.67, 23_456.78, 34_567.89]);
    const up = await createUpload([{ name: "nouveau.xlsx", bytes }], ACTOR);
    uploads.push(up.id);
    await prisma.priceImportUpload.update({ where: { id: up.id }, data: { mapping: { groups: { [groupId("helio-verriere", "")]: { familySlug: "marbella", variantKey: `${VARIANT}-b`, dimAKey: "projection" } }, columns: { PRIX_FINAL: unknown, PRIX_SOURCE: { ...unknown, enabled: false } } } } });
    const p = await previewUpload(up.id);
    expect(p.groups).toHaveLength(1);
    expect(p.changes.find((c) => c.role === "PRIX_FINAL")).toMatchObject({ previous: null, added: 3 });
    expect(p.blockers.join(" ")).toMatch(/non établi/);
    const r = await importUpload(up.id, ACTOR);
    expect(r.grids[0]!.created).toHaveLength(1);
    expect((await prisma.priceImportFile.findFirstOrThrow({ where: { uploadId: up.id } })).bytes).toBeNull();
    const created = await getGrid(r.grids[0]!.created[0]!.id);
    expect(created).toMatchObject({ status: "DRAFT", variantKey: `${VARIANT}-b`, nature: "UNKNOWN" });
    expect((await gridCells(created.id)).length).toBe(3);
    // même fichier téléversé de nouveau : version réutilisée, aucune grille créée
    const up2 = await createUpload([{ name: "nouveau-copie.xlsx", bytes }], ACTOR);
    uploads.push(up2.id);
    await prisma.priceImportUpload.update({ where: { id: up2.id }, data: { mapping: (await prisma.priceImportUpload.findUniqueOrThrow({ where: { id: up.id } })).mapping as object } });
    const r2 = await importUpload(up2.id, ACTOR);
    expect(r2.imports[0]!.reused).toBe(true);
    expect(r2.grids[0]!.created).toHaveLength(0);
    await prisma.supplierPriceList.deleteMany({ where: { scope: "GRID", variantKey: `${VARIANT}-b` } });
    await prisma.supplierPriceList.deleteMany({ where: { scope: "IMPORT", id: r.imports[0]!.listId } });
  });
});
