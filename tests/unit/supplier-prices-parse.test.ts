/**
 * Tarifs fournisseur — lecture XLSX / DOCX sur des fichiers SYNTHÉTIQUES générés pendant le test
 * (montants et coefficients inventés ; aucune donnée client).
 */
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { strToU8, zipSync } from "fflate";
import { parseXlsx, parseCoefficientFormula } from "@/server/supplier-prices/xlsx";
import { parseDocx } from "@/server/supplier-prices/docx";
import { compareSources } from "@/server/supplier-prices/compare";
import { analyseSources } from "@/server/supplier-prices/analyse";
import { findGridGaps, markDuplicates, parseBand, parseNumber, toMinor, variantFromText } from "@/server/supplier-prices/normalise";
import type { ParsedRow } from "@/server/supplier-prices/types";

const K = 0.8; // coefficient fictif

type Line = [a: number | string, b: number | string, c: number | null, f?: "ok" | "wrong" | "nocache" | "plain"];

function block(ws: ExcelJS.Worksheet, start: number, title: string, lines: Line[], opts: { surface?: boolean } = {}) {
  ws.getCell(`A${start}`).value = title;
  const h = start + 2;
  ["Projection (cm)", "Largeur (cm)", "Prix ", "Surface m2", "Prix/m2", "Prix final HELIOSTORES "].forEach((t, i) => (ws.getRow(h).getCell(i + 1).value = t));
  lines.forEach(([a, b, c, f = "ok"], i) => {
    const r = h + 1 + i;
    ws.getCell(`A${r}`).value = a;
    ws.getCell(`B${r}`).value = b;
    if (c != null) ws.getCell(`C${r}`).value = c;
    if (opts.surface !== false && typeof b === "number") {
      const s = (Number(a) * b) / 10000;
      ws.getCell(`D${r}`).value = { formula: `A${r}*B${r}/10000`, result: s };
      if (c != null) ws.getCell(`E${r}`).value = { formula: `C${r}/D${r}`, result: c / s };
    }
    const cv = c ?? 0;
    if (f === "ok") ws.getCell(`F${r}`).value = { formula: `C${r}*${K}`, result: cv * K };
    if (f === "wrong") ws.getCell(`F${r}`).value = { formula: `C${r}*${K}`, result: cv * K + 7 };
    if (f === "nocache") ws.getCell(`F${r}`).value = { formula: `C${r}*${K}` } as ExcelJS.CellFormulaValue;
    if (f === "plain") ws.getCell(`F${r}`).value = cv * K;
  });
  return h + lines.length + 1;
}

async function syntheticXlsx(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet("SB400");
  a.mergeCells("A1:F2");
  a.getCell("A1").value = "PERGOLA SB400 (MURALE / AUTOPORTANTE)";
  let next = block(a, 5, "PERGOLA SB400 AUTOPORTANTE ", [
    [300, 200, 1000],
    [300, 250, 1100],
    ["350", 200, 1210], // projection stockée en texte
    ["350", 250, 1300, "wrong"], // cache ≠ C × coefficient
  ]);
  block(a, next + 2, "PERGOLA SB400 MURALE", [
    [300, 200, 900, "nocache"], // formule sans cache
    [300, 250, null], // prix vide
    [300, 250, 950], // doublon de la ligne précédente
    [350, 200, 990, "plain"],
    // 350 × 250 manquant : grille incomplète
  ]);
  const c = wb.addWorksheet("STORE BANNE CASA");
  c.mergeCells("A1:F2");
  c.getCell("A1").value = "STORE BANNE CASABLANCA";
  next = block(c, 4, "", [
    [160, "200-290", 500],
    [160, "291-350", 520],
    [210, "291-350", 560],
  ], { surface: false });
  const r = wb.addWorksheet("REFLEKSOL 120 ZIP");
  r.mergeCells("A1:F2");
  r.getCell("A1").value = "REFLEKSOL 120 ZIIP";
  block(r, 4, "", [[100, 100, 300], [100, 125, 310]]);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const p = (...lines: string[]) => `<w:p><w:r>${lines.map((l, i) => `${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${esc(l)}</w:t>`).join("")}</w:r></w:p>`;
const tbl = (rows: string[][]) => `<w:tbl>${rows.map((r) => `<w:tr>${r.map((c) => `<w:tc><w:p><w:r><w:t>${esc(c)}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;

function syntheticDocx(body: string): Uint8Array {
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
  return zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "word/document.xml": strToU8(doc) });
}

const GRID_HEAD = ["Projection (cm)", "Largeur (cm)", "Prix fournisseur (DH)", "Prix final HELIOSTORES (DH)"];

function sb400Docx() {
  return syntheticDocx(
    p("Fiche Technique & Tarification — PERGOLA SB400 (MURALE / AUTOPORTANTE)") +
      p("- Largeur minimale : 1000 mm", "- Révision moteur possible : +12 DH par révision supplémentaire (la première est incluse)") +
      p("- Éclairage LED test (non remisé) : 321 €", "- Spots selon tableau") +
      p("💡 Tarification des spots d'éclairage") +
      tbl([["Projection (cm)", "Largeur (cm)", "Nb de Spots", "Prix (€)"], ["100 – 199", "100 – 200", "4 points", "111"], ["200 – 300", "100 – 200", "6 points", "222"]]) +
      p("Autonome") +
      tbl([GRID_HEAD, ["300.0", "200.0", "1000.0", "800.0"], ["300.0", "250.0", "1100.0", "880.0"], ["350.0", "200.0", "1234.0", "987.2"], ["350.0", "250.0", "1300.0", ""]]) +
      p("Murale") +
      tbl([GRID_HEAD, ["300.0", "200.0", "900.0", "720.0"], ["400.0", "200.0", "999.0", "799.2"]]),
  );
}

describe("normalisation", () => {
  it("nombres texte, décimales, devises ; vide ⇒ null (jamais 0)", () => {
    expect(parseNumber("310")).toBe(310);
    expect(parseNumber("310.0")).toBe(310);
    expect(parseNumber("1 234,50")).toBe(1234.5);
    expect(parseNumber("123 €")).toBe(123);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("  ")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber(null)).toBeNull();
  });
  it("bandes de largeur en mm", () => {
    expect(parseBand("200-290")).toEqual({ minMm: 2000, maxMm: 2900 });
    expect(parseBand("140 – 274")).toEqual({ minMm: 1400, maxMm: 2740 });
    expect(parseBand("290-200")).toBeNull();
    expect(parseBand("300")).toBeNull();
  });
  it("unités mineures : fraction de centime arrondie et signalée", () => {
    expect(toMinor(12.345)).toEqual({ minor: 1235, subCent: true });
    expect(toMinor(12.344)).toEqual({ minor: 1234, subCent: true });
    // bruit flottant d'une valeur en cache (x,xx5 stocké 0,…4999…) neutralisé
    expect(toMinor(0.1 * 3 + 12.045)).toEqual({ minor: 1235, subCent: true });
    expect(toMinor(10)).toEqual({ minor: 1000, subCent: false });
    expect(toMinor(null)).toEqual({ minor: null, subCent: false });
  });
  it("variantes", () => {
    expect(variantFromText("PERGOLA SB400 AUTOPORTANTE ")).toBe("autoportante");
    expect(variantFromText("Autonome")).toBe("autoportante");
    expect(variantFromText("PERGOLA SB500 MURALE")).toBe("murale");
    expect(variantFromText("Premier module")).toBe("premier-module");
    expect(variantFromText("Module suivant (extension)")).toBe("module-suivant");
    expect(variantFromText("PERGOLA SB400 (MURALE / AUTOPORTANTE)")).toBe("");
  });
  it("formule de coefficient", () => {
    expect(parseCoefficientFormula("C8*0.8*2", 8)).toEqual({ coefficient: 1.6 });
    expect(parseCoefficientFormula("=$C$8*0.8", 8)).toEqual({ coefficient: 0.8 });
    expect(parseCoefficientFormula("C9*0.8", 8)).toHaveProperty("error");
    expect(parseCoefficientFormula("C8+3", 8)).toHaveProperty("error");
  });
});

describe("lecture XLSX synthétique", async () => {
  const src = await parseXlsx(await syntheticXlsx(), { fileName: "synthetique.xlsx" });
  const rows = src.rows;
  const at = (ref: string) => rows.find((r) => r.sourceRef.endsWith(ref));

  it("structure, blocs, familles et variantes", () => {
    expect(src.families).toEqual(["helio-horizon", "helio-riviera", "helio-ombra"]);
    const sb = src.xlsx!.sheets.find((s) => s.name === "SB400")!;
    expect(sb.blocks.map((b) => [b.variantKey, b.rows])).toEqual([["autoportante", 4], ["murale", 4]]);
    expect(src.xlsx!.structure.hiddenSheets).toEqual([]);
    expect(src.xlsx!.structure.externalLinks).toBe(0);
    expect(src.currency).toBeNull();
    expect(src.notes).toContain("Aucune devise indiquée dans le classeur.");
  });

  it("nombre stocké en texte converti et signalé", () => {
    const r = at("SB400!C10")!;
    expect(r.dimAmm).toBe(3500);
    expect(r.conditions.dimAStoredAsText).toBe(true);
    expect(src.xlsx!.sheets[0]!.textNumbers).toBe(2);
  });

  it("colonnes C et F conservées séparément, formule et cache gardés, coefficient vérifié", () => {
    const c = at("SB400!C8")!;
    const f = at("SB400!F8")!;
    expect(c.amountRole).toBe("PRIX_SOURCE");
    expect(c.amountMinor).toBe(100000);
    expect(f.amountRole).toBe("PRIX_FINAL");
    expect(f.formula).toBe("C8*0.8");
    expect(f.cachedValue).toBeCloseTo(800);
    expect(f.amountMinor).toBe(80000);
    expect(f.status).toBe("OK");
    expect(src.xlsx!.sheets[0]!.finalCoefficients).toEqual([0.8]);
  });

  it("cache incohérent avec C × coefficient ⇒ à vérifier", () => {
    const f = at("SB400!F11")!;
    expect(f.status).toBe("TO_CHECK");
    expect(f.issues.join()).toMatch(/≠ Prix × coefficient/);
  });

  it("formule sans cache ⇒ montant null (jamais recalculé), à vérifier", () => {
    const murale = rows.filter((r) => r.variantKey === "murale" && r.amountRole === "PRIX_FINAL");
    const f = murale.find((r) => r.formula && r.cachedValue == null && r.issues.some((i) => /sans valeur en cache/.test(i)))!;
    expect(f).toBeDefined();
    expect(f.amountMinor).toBeNull();
    expect(f.status).toBe("TO_CHECK");
  });

  it("cellule vide ⇒ null et non 0", () => {
    const empty = rows.find((r) => r.variantKey === "murale" && r.amountRole === "PRIX_SOURCE" && r.amountMinor == null)!;
    expect(empty).toBeDefined();
    expect(empty.amountMinor).not.toBe(0);
    expect(empty.issues.join()).toMatch(/Cellule vide/);
  });

  it("valeur saisie sans formule en F signalée", () => {
    expect(rows.some((r) => r.amountRole === "PRIX_FINAL" && r.formula == null && r.issues.some((i) => /sans formule/.test(i)))).toBe(true);
  });

  it("bandes de largeur (store banne)", () => {
    const casa = rows.filter((r) => r.familySlug === "helio-riviera" && r.amountRole === "PRIX_SOURCE");
    expect(casa.map((r) => [r.dimAmm, r.widthMinMm, r.widthMaxMm])).toEqual([[1600, 2000, 2900], [1600, 2910, 3500], [2100, 2910, 3500]]);
    expect(casa[0]!.conditions.widthBand).toBe("200-290");
  });

  it("REFLEKSOL : « Projection » interprétée comme hauteur, signalée", () => {
    const r = rows.filter((x) => x.familySlug === "helio-ombra");
    expect(r.every((x) => x.dimAKey === "hauteur" && x.status === "TO_CHECK" && x.issues.some((i) => /interprétée comme HAUTEUR/.test(i)))).toBe(true);
  });

  it("doublons et grilles incomplètes", () => {
    const copy = rows.map((r) => ({ ...r, issues: [...r.issues] }));
    const dups = markDuplicates(copy);
    expect(dups.length).toBeGreaterThanOrEqual(1);
    expect(copy.filter((r) => r.issues.some((i) => /Doublon/.test(i))).length).toBeGreaterThanOrEqual(2);
    const gaps = findGridGaps(copy);
    expect(gaps).toContainEqual({ familySlug: "helio-horizon", variantKey: "murale", amountRole: "PRIX_SOURCE", dimAmm: 3500, widthKey: "2500" });
    expect(gaps).toContainEqual({ familySlug: "helio-riviera", variantKey: "", amountRole: "PRIX_SOURCE", dimAmm: 2100, widthKey: "2000-2900" });
  });
});

describe("lecture DOCX synthétique", () => {
  const src = parseDocx(sb400Docx(), { fileName: "fiche.docx" });

  it("grilles : devise DH ⇒ MAD, variantes, cellule vide ⇒ null", () => {
    expect(src.families).toEqual(["helio-horizon"]);
    expect(src.currency).toBe("MAD");
    expect(src.currencyNote).toMatch(/DH/);
    const grid = src.rows.filter((r) => r.kind === "GRID");
    expect(new Set(grid.map((r) => r.variantKey))).toEqual(new Set(["autoportante", "murale"]));
    const empty = grid.find((r) => r.amountRole === "PRIX_FINAL" && r.dimAmm === 3500 && r.widthMinMm === 2500)!;
    expect(empty.amountMinor).toBeNull();
    expect(empty.status).toBe("TO_CHECK");
    expect(grid.find((r) => r.amountRole === "PRIX_SOURCE" && r.dimAmm === 3000 && r.widthMinMm === 2000 && r.variantKey === "autoportante")!.amountMinor).toBe(100000);
  });

  it("options : lignes € et DH, tableau des spots par plages", () => {
    const opts = src.rows.filter((r) => r.kind === "OPTION");
    const led = opts.find((r) => r.code === "eclairage-led-test")!;
    expect(led.currency).toBe("EUR");
    expect(led.amountMinor).toBe(32100);
    expect(led.conditions.nonRemise).toBe(true);
    const rev = opts.find((r) => r.code === "revision-moteur")!;
    expect(rev.currency).toBe("MAD");
    expect(rev.conditions.firstIncluded).toBe(true);
    const spots = opts.filter((r) => r.code === "spots-d-eclairage");
    expect(spots).toHaveLength(2);
    expect(spots[0]!.conditions.match).toEqual({ projectionMinMm: 1000, projectionMaxMm: 1990, widthMinMm: 1000, widthMaxMm: 2000 });
    expect(spots[0]!.currency).toBe("EUR");
  });
});

describe("rapprochement DOCX ↔ XLSX", async () => {
  const xlsxBytes = await syntheticXlsx();
  const docxBytes = sb400Docx();

  it("écarts de montant, combinaisons absentes, synonyme de variante", async () => {
    const a = await analyseSources([{ fileName: "synthetique.xlsx", bytes: xlsxBytes }, { fileName: "fiche.docx", bytes: docxBytes }]);
    const d = a.sources.find((s) => s.type === "docx")!;
    const cats = d.discrepancies.map((x) => x.category);
    // 350×200 autoportante : 1234 (fiche) vs 1210 (classeur)
    const mismatch = d.discrepancies.find((x) => x.category === "AMOUNT_MISMATCH" && x.amountRole === "PRIX_SOURCE" && x.dimAmm === 3500 && x.widthMinMm === 2000)!;
    expect(mismatch.docxRef).toMatch(/fiche\.docx › tableau 2 \(« Autonome »\)/);
    expect(mismatch.xlsxRef).toMatch(/SB400!C10$/);
    expect(cats).toContain("MISSING_IN_XLSX"); // 400×200 murale
    expect(cats).toContain("MISSING_IN_DOCX");
    expect(a.comparison.notes.join()).toMatch(/Autonome/);
    // la ligne en écart est marquée à vérifier des deux côtés
    expect(d.rows.find((r) => r.sourceRef === mismatch.docxRef)!.status).toBe("TO_CHECK");
    const x = a.sources.find((s) => s.type === "xlsx")!;
    expect(x.rows.find((r) => r.sourceRef === mismatch.xlsxRef)!.issues.join()).toMatch(/Écart DOCX↔XLSX/);
    expect(x.currencyNote).toMatch(/fiches DOCX/);
  });

  it("libellé de variante contradictoire (premier module ↔ autoportante)", async () => {
    const x = await parseXlsx(xlsxBytes, { fileName: "synthetique.xlsx" });
    const sb500x = { ...x, families: ["helio-panorama"], rows: x.rows.filter((r) => r.familySlug === "helio-horizon").map((r) => ({ ...r, familySlug: "helio-panorama" })) as ParsedRow[] };
    const doc = parseDocx(
      syntheticDocx(p("Fiche Technique — PERGOLA SB500") + p("Premier module") + tbl([GRID_HEAD, ["300", "200", "1000", "800"], ["300", "250", "1100", "880"]])),
      { fileName: "sb500.docx" },
    );
    const cmp = compareSources([sb500x, doc]);
    const v = cmp.discrepancies.find((d) => d.category === "VARIANT_LABEL")!;
    expect(v.variantKey).toBe("autoportante");
    expect(v.message).toMatch(/Premier module/);
  });

  it("grille de fiche sans aucune cellule commune", () => {
    const x = { type: "xlsx" as const, fileName: "x.xlsx", sourceKey: "x", label: "", families: ["helio-verriere"], currency: null, currencyNote: "", natureNote: "", notes: [], rows: [] as ParsedRow[] };
    const row = (role: "PRIX_SOURCE" | "PRIX_FINAL", w: number, amt: number, ref: string): ParsedRow => ({ familySlug: "helio-verriere", variantKey: "", kind: "GRID", code: "", label: "", dimAKey: "hauteur", dimAmm: 1500, widthMinMm: w, widthMaxMm: w, conditions: { dimAHeader: "Projection (cm)" }, amountMinor: amt, currency: null, amountRole: role, formula: null, cachedValue: null, sourceRef: ref, status: "OK", issues: [] });
    x.rows.push(row("PRIX_SOURCE", 1000, 5000, "x.xlsx › V!C7"), row("PRIX_SOURCE", 1250, 5100, "x.xlsx › V!C8"));
    const doc = parseDocx(syntheticDocx(p("Fiche Technique — VERANDA FTS") + tbl([["Hauteur (cm)", "Largeur (cm)", "Prix fournisseur (DH)", "Prix final HELIOSTORES (DH)"], ["150", "100", "4000", "3000"], ["150", "125", "4010", "3010"]])), { fileName: "fts.docx" });
    const cmp = compareSources([x, doc]);
    expect(cmp.summary.byCategory.NO_MATCHING_CELL).toBe(1);
    expect(cmp.summary.byCategory.DIMENSION_LABEL).toBe(1);
    expect(cmp.summary.byCategory.AMOUNT_MISMATCH).toBe(2);
  });
});
