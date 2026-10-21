/**
 * Tarifs fournisseur — service d'import sur la base de test, avec des fichiers SYNTHÉTIQUES
 * générés pendant le test (montants inventés) : aperçu sans écriture, version brouillon,
 * ré-import identique sans effet, activation / retour arrière, et étanchéité du catalogue public.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import { strToU8, zipSync } from "fflate";
import { prisma } from "@/lib/prisma";
import { activateSupplierPriceList, applySupplierPrices, previewSupplierPrices, rollbackSupplierPrices, SupplierPriceError } from "@/server/supplier-prices/import";
import { invalidateCatalogCache, loadCatalog } from "@/server/catalog/load";
import { ensureCatalogSnapshot } from "@/server/catalog/public-snapshot";

const KEY = `test-sp-${randomBytes(4).toString("hex")}`;
const ACTOR = { actorUserId: null, actorEmail: "test:supplier-prices" };
// montants fictifs volontairement atypiques, recherchés ensuite dans l'instantané public
const AMOUNTS = [48271.93, 51973.17, 60457.41];
const FACTOR = 0.7;

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
    ws.getCell(`F${r}`).value = { formula: `C${r}*${FACTOR}`, result: c * FACTOR };
  });
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

function docx(): Uint8Array {
  const esc = (s: string) => s.replace(/&/g, "&amp;");
  const cell = (s: string) => `<w:tc><w:p><w:r><w:t>${esc(s)}</w:t></w:r></w:p></w:tc>`;
  const row = (r: string[]) => `<w:tr>${r.map(cell).join("")}</w:tr>`;
  const body = `<w:p><w:r><w:t>Fiche Technique &amp; Tarification — VERANDA FTS</w:t></w:r></w:p><w:tbl>${row(["Hauteur (cm)", "Largeur (cm)", "Prix fournisseur (DH)", "Prix final HELIOSTORES (DH)"])}${row(["150", "100", String(AMOUNTS[0]), (AMOUNTS[0]! * FACTOR).toFixed(2)])}</w:tbl>`;
  const doc = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
  return zipSync({ "word/document.xml": strToU8(doc) });
}

let v1Bytes: Uint8Array;
let v2Bytes: Uint8Array;
const counts = async () => ({ lists: await prisma.supplierPriceList.count(), rows: await prisma.supplierPriceRow.count(), audits: await prisma.auditLog.count() });

beforeAll(async () => {
  v1Bytes = await xlsx(AMOUNTS);
  v2Bytes = await xlsx([...AMOUNTS.slice(0, 2), AMOUNTS[2]! + 1]);
});

afterAll(async () => {
  const lists = await prisma.supplierPriceList.findMany({ where: { sourceKey: { startsWith: "test-sp-" } }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { entity: "SupplierPriceList", entityId: { in: lists.map((l) => l.id) } } });
  await prisma.supplierPriceList.deleteMany({ where: { sourceKey: { startsWith: "test-sp-" } } });
  await prisma.$disconnect();
});

describe("import des tarifs fournisseur", () => {
  let v1Id = "";
  let v2Id = "";

  it("aperçu : n'écrit rien en base", async () => {
    const before = await counts();
    const { previews } = await previewSupplierPrices([{ fileName: "synthetique.xlsx", bytes: v1Bytes, sourceKey: KEY }, { fileName: "fiche.docx", bytes: docx(), sourceKey: `${KEY}-docx` }]);
    expect(await counts()).toEqual(before);
    const x = previews.find((p) => p.type === "xlsx")!;
    expect(x.counts.total).toBe(6);
    expect(x.existing).toBeNull();
    expect(x.sample.every((s) => !("amountMinor" in s))).toBe(true);
    expect(JSON.stringify(previews)).not.toContain("4827193");
  });

  it("application : crée une version brouillon avec lignes, rapport et interprétation prudente", async () => {
    const { results } = await applySupplierPrices([{ fileName: "synthetique.xlsx", bytes: v1Bytes, sourceKey: KEY }], ACTOR);
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.unchanged).toBe(false);
    expect(r.version).toBe(1);
    v1Id = r.listId;
    const list = await prisma.supplierPriceList.findUniqueOrThrow({ where: { id: v1Id }, include: { rows: true } });
    expect(list.status).toBe("DRAFT");
    expect(list.nature).toBe("UNKNOWN");
    expect(list.taxBasis).toBe("UNKNOWN");
    expect(list.currency).toBeNull();
    expect(list.rows).toHaveLength(6);
    const c = list.rows.find((x) => x.amountRole === "PRIX_SOURCE" && x.widthMinMm === 1000)!;
    expect(c.amountMinor).toBe(4827193);
    const f = list.rows.find((x) => x.amountRole === "PRIX_FINAL" && x.widthMinMm === 1000)!;
    expect(f.formula).toBe(`C5*${FACTOR}`);
    expect(f.cachedValue).toBeCloseTo(AMOUNTS[0]! * FACTOR);
    expect((list.report as { counts: { total: number } }).counts.total).toBe(6);
    const log = await prisma.auditLog.findFirst({ where: { entity: "SupplierPriceList", entityId: v1Id, action: "supplierPrices.import" } });
    expect(log).not.toBeNull();
    expect(JSON.stringify(log!.after)).not.toContain("4827193");
  });

  it("ré-import d'un fichier identique : sans effet, renvoie la version existante", async () => {
    const before = await counts();
    const { results } = await applySupplierPrices([{ fileName: "synthetique-copie.xlsx", bytes: v1Bytes, sourceKey: KEY }], ACTOR);
    expect(results[0]!.unchanged).toBe(true);
    expect(results[0]!.listId).toBe(v1Id);
    expect(await counts()).toEqual(before);
    const { previews } = await previewSupplierPrices([{ fileName: "synthetique.xlsx", bytes: v1Bytes, sourceKey: KEY }]);
    expect(previews[0]!.existing?.id).toBe(v1Id);
  });

  it("fichier modifié : nouvelle version ; activation, archivage et retour arrière", async () => {
    const { results } = await applySupplierPrices([{ fileName: "synthetique.xlsx", bytes: v2Bytes, sourceKey: KEY }], ACTOR);
    expect(results[0]!.version).toBe(2);
    v2Id = results[0]!.listId;
    await expect(rollbackSupplierPrices(KEY, ACTOR)).rejects.toBeInstanceOf(SupplierPriceError);

    await activateSupplierPriceList(v1Id, ACTOR);
    expect((await prisma.supplierPriceList.findUniqueOrThrow({ where: { id: v1Id } })).status).toBe("ACTIVE");
    const a2 = await activateSupplierPriceList(v2Id, ACTOR);
    expect(a2.previous?.id).toBe(v1Id);
    const status = async () => Object.fromEntries((await prisma.supplierPriceList.findMany({ where: { sourceKey: KEY }, select: { version: true, status: true } })).map((l) => [l.version, l.status]));
    expect(await status()).toEqual({ 1: "ARCHIVED", 2: "ACTIVE" });
    expect(await prisma.supplierPriceList.count({ where: { sourceKey: KEY, status: "ACTIVE" } })).toBe(1);

    const rb = await rollbackSupplierPrices(KEY, ACTOR);
    expect(rb.restored.id).toBe(v1Id);
    expect(await status()).toEqual({ 1: "ACTIVE", 2: "ARCHIVED" });
    const actions = (await prisma.auditLog.findMany({ where: { entity: "SupplierPriceList", entityId: { in: [v1Id, v2Id] } }, orderBy: { createdAt: "asc" } })).map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(["supplierPrices.import", "supplierPrices.activate", "supplierPrices.rollback"]));
  });

  it("le catalogue public et son instantané n'exposent aucune ligne de tarif fournisseur", async () => {
    invalidateCatalogCache();
    const json = JSON.stringify(await loadCatalog({ fresh: true })) + JSON.stringify(await ensureCatalogSnapshot());
    for (const a of AMOUNTS) {
      expect(json).not.toContain(String(a));
      expect(json).not.toContain(String(Math.round(a * 100)));
      expect(json).not.toContain((a * FACTOR).toFixed(2));
    }
    expect(json).not.toContain(KEY);
  });

  it("aucun module public ne lit les tarifs fournisseur (sauf le chargeur unique de la colonne publique)", () => {
    const root = path.resolve(import.meta.dirname, "../../src");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = path.join(dir, n);
        if (statSync(p).isDirectory()) {
          if (p.includes(`${path.sep}generated`)) continue;
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(n)) continue;
        const rel = path.relative(root, p).split(path.sep).join("/");
        const allowed = rel.startsWith("server/supplier-prices/") || rel === "server/actions/admin/supplier-prices.ts" || rel.startsWith("app/admin/catalogue/tarifs-fournisseur/")
          // seul lecteur public : colonne « Prix final HELIOSTORES » de la version ACTIVE du classeur
          || rel === "server/pricing/system-prices.ts";
        if (allowed) continue;
        const src = readFileSync(p, "utf8");
        // import du module ou accès Prisma aux modèles (les simples mentions en commentaire sont ignorées)
        if (/from\s+["'][^"']*supplier-prices[^"']*["']|import\(\s*["'][^"']*supplier-prices|\.supplierPrice(Row|List)\b/.test(src)) offenders.push(rel);
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });

  it("script : aperçu par défaut, montants et coefficients jamais imprimés, codes de sortie", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "sp-"));
    try {
      const file = path.join(dir, "synthetique.xlsx");
      writeFileSync(file, v2Bytes);
      const run = (args: string[]) => spawnSync("pnpm", ["exec", "tsx", "scripts/import-supplier-prices.ts", ...args], { cwd: path.resolve(import.meta.dirname, "../.."), env: { ...process.env }, encoding: "utf8", timeout: 60_000 });
      const r = run(["--file", file, "--source-key", KEY]);
      expect(r.status).toBe(0);
      const out = r.stdout + r.stderr;
      expect(out).toContain("montants masqués");
      expect(out).toContain("Empreinte déjà importée");
      for (const a of AMOUNTS) {
        expect(out).not.toContain(String(a));
        expect(out).not.toContain(String(Math.round(a * 100)));
      }
      expect(out).not.toContain(String(FACTOR));
      expect(out).not.toMatch(/C\d+\*/);
      expect(run([]).status).toBe(2);
      expect(run(["--file", path.join(dir, "absent.xlsx")]).status).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
