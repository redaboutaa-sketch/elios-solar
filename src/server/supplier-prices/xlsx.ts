/**
 * Lecture du classeur de tarifs (exceljs) : formules ET valeurs en cache, sans jamais recalculer
 * ni suivre de lien externe. Module pur : aucune écriture, aucun montant journalisé.
 */
import ExcelJS from "exceljs";
import { strFromU8, unzipSync } from "fflate";
import { addIssue, cleanText, cmToMm, familyFromText, HEIGHT_FAMILIES, parseBand, parseNumber, slugify, toMinor, variantFromText } from "./normalise";
import { AMOUNT_ROLES, type BlockReport, type FormulaCheck, type ParsedRow, type ParsedSource, type SheetReport, type WorkbookStructure } from "./types";

type Col = "dimA" | "width" | "price" | "surface" | "ppm" | "final";

interface CellRead {
  address: string;
  /** valeur affichée (cache pour une formule) */
  value: unknown;
  formula: string | null;
  /** la cellule porte une formule sans valeur en cache */
  missingCache: boolean;
  isText: boolean;
  empty: boolean;
}

function readCell(cell: ExcelJS.Cell): CellRead {
  const address = cell.address;
  if (cell.isMerged && cell.master && cell.master.address !== cell.address) return { address, value: null, formula: null, missingCache: false, isText: false, empty: true };
  const v = cell.value as unknown;
  if (v == null || v === "") return { address, value: null, formula: null, missingCache: false, isText: false, empty: true };
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    if ("formula" in o || "sharedFormula" in o) {
      let formula: string | null = null;
      try {
        formula = cell.formula || (typeof o.formula === "string" ? o.formula : null) || (typeof o.sharedFormula === "string" ? `=${o.sharedFormula}` : null);
      } catch {
        formula = typeof o.sharedFormula === "string" ? `(partagée de ${o.sharedFormula})` : null;
      }
      const res = o.result;
      const missing = res === undefined || res === null || (typeof res === "object" && res !== null && "error" in (res as object));
      return { address, value: missing ? null : res, formula, missingCache: missing, isText: false, empty: false };
    }
    if ("richText" in o && Array.isArray(o.richText)) {
      const t = (o.richText as { text: string }[]).map((x) => x.text).join("");
      return { address, value: t, formula: null, missingCache: false, isText: true, empty: !t.trim() };
    }
    if ("text" in o && typeof o.text === "string") return { address, value: o.text, formula: null, missingCache: false, isText: true, empty: !o.text.trim() };
    if ("error" in o) return { address, value: null, formula: null, missingCache: false, isText: false, empty: false };
  }
  if (typeof v === "string") return { address, value: v, formula: null, missingCache: false, isText: true, empty: !v.trim() };
  return { address, value: v, formula: null, missingCache: false, isText: false, empty: false };
}

function headerColumn(label: string): Col | null {
  const t = cleanText(label).toLowerCase();
  if (/^prix\s*final/.test(t)) return "final";
  if (/^prix\s*\/\s*m/.test(t)) return "ppm";
  if (/^prix/.test(t)) return "price";
  if (/^surface/.test(t)) return "surface";
  if (/^(projection|hauteur|avanc[ée]e)/.test(t)) return "dimA";
  if (/^largeur/.test(t)) return "width";
  return null;
}

/** Structure du classeur lue dans l'archive : feuilles masquées, liens externes, commentaires, noms définis. */
export function workbookStructure(buf: Uint8Array): Omit<WorkbookStructure, "mentionsCurrency" | "mentionsTax"> {
  // noms intégrés (_xlnm.Print_Area…) comptés à part : ce ne sont pas des noms définis par l'utilisateur
  const files = unzipSync(buf, { filter: (f) => f.name === "xl/workbook.xml" || f.name.startsWith("xl/externalLinks/") || /comments\d*\.xml$/.test(f.name) || f.name.startsWith("xl/threadedComments/") });
  const wbXml = files["xl/workbook.xml"] ? strFromU8(files["xl/workbook.xml"]) : "";
  const sheets = [...wbXml.matchAll(/<sheet\b[^>]*>/g)].map((m) => {
    const tag = m[0];
    const name = decodeXml(tag.match(/\bname="([^"]*)"/)?.[1] ?? "");
    const state = tag.match(/\bstate="([^"]*)"/)?.[1] ?? "visible";
    return { name, state };
  });
  const nameTags = [...wbXml.matchAll(/<definedName\b[^>]*\bname="([^"]*)"/g)].map((m) => m[1]!);
  const builtInNames = nameTags.filter((n) => n.startsWith("_xlnm.")).length;
  const externalLinks = Object.keys(files).filter((n) => /^xl\/externalLinks\/externalLink\d+\.xml$/.test(n)).length;
  const comments = Object.keys(files).filter((n) => /comments\d*\.xml$/.test(n) || n.startsWith("xl/threadedComments/")).length;
  return { sheets, hiddenSheets: sheets.filter((s) => s.state !== "visible").map((s) => s.name), externalLinks, comments, definedNames: nameTags.length - builtInNames, builtInNames };
}

function decodeXml(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** Analyse d'une formule « C8*a*b… » : référence de colonne C de la même ligne × constantes. */
export function parseCoefficientFormula(formula: string, row: number): { coefficient: number } | { error: string } {
  const f = formula.replace(/^=/, "").replace(/\$/g, "").replace(/\s+/g, "").toUpperCase();
  const factors = f.split("*");
  let ref: string | null = null;
  let coefficient = 1;
  for (const x of factors) {
    if (/^[A-Z]+\d+$/.test(x)) {
      if (ref) return { error: "plusieurs références" };
      ref = x;
    } else if (/^\d+(\.\d+)?$/.test(x)) coefficient *= Number(x);
    else return { error: "formule non reconnue" };
  }
  if (ref !== `C${row}`) return { error: ref ? `référence ${ref} au lieu de C${row}` : "aucune référence à la colonne Prix" };
  return { coefficient: Number(coefficient.toPrecision(12)) };
}

function patternOf(formula: string): string {
  return formula.replace(/^=/, "").replace(/\$/g, "").replace(/([A-Z]+)\d+/g, "$1").replace(/\d+(\.\d+)?/g, "k");
}

export interface XlsxOptions {
  fileName: string;
  sourceKey?: string;
}

export async function parseXlsx(buf: Uint8Array, opts: XlsxOptions): Promise<ParsedSource> {
  const structure0 = workbookStructure(buf);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const rows: ParsedRow[] = [];
  const sheets: SheetReport[] = [];
  const currencyHits = new Set<string>();
  const taxHits = new Set<string>();
  const notes: string[] = [];

  for (const ws of wb.worksheets) {
    const state = structure0.sheets.find((s) => s.name === ws.name)?.state ?? ws.state ?? "visible";
    const title = cleanText(String(readCell(ws.getCell("A1")).value ?? ""));
    const familySlug = familyFromText(`${ws.name} ${title}`);
    const rep: SheetReport = { name: ws.name, state, familySlug, title, blocks: [], dataRows: 0, textNumbers: 0, formulas: [], finalCoefficients: [], notes: [] };
    sheets.push(rep);
    const checks: Record<string, FormulaCheck> = {};
    const check = (col: string) => (checks[col] ??= { column: col, count: 0, missingCache: 0, mismatches: 0, patterns: {} });
    const coefCounts = new Map<number, number>();
    const finalRows: { row: ParsedRow; coefficient: number | null }[] = [];

    // mentions de devise / taxe n'importe où dans la feuille
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const c = readCell(cell);
        if (!c.isText || typeof c.value !== "string") return;
        const t = c.value;
        if (/€|\bEUR\b|\bDH\b|\bDHS\b|\bMAD\b|dirham/i.test(t)) currencyHits.add(`${ws.name}!${c.address}`);
        if (/\bHT\b|\bTTC\b|\bTVA\b|hors\s+taxe/i.test(t)) taxHits.add(`${ws.name}!${c.address}`);
      });
    });

    if (!familySlug) {
      rep.notes.push("Feuille non rattachée à une famille connue : aucune ligne importée.");
      continue;
    }
    if (state !== "visible") rep.notes.push(`Feuille ${state} : importée mais signalée.`);

    let blockTitle = "";
    let map: Partial<Record<Col, number>> | null = null;
    let headers: string[] = [];
    let block: BlockReport | null = null;
    const merges = (ws.model as { merges?: string[] }).merges ?? [];
    const inTitleMerge = (r: number) => merges.some((m) => /^A1:/.test(m) && r <= Number(m.split(":")[1]!.replace(/[A-Z]+/, "")));

    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cells: CellRead[] = [];
      for (let c = 1; c <= Math.max(ws.columnCount, 8); c++) cells.push(readCell(row.getCell(c)));
      const nonEmpty = cells.filter((c) => !c.empty);
      if (!nonEmpty.length) continue;
      const a = cells[0]!;
      const aText = a.isText ? cleanText(String(a.value)) : "";
      // en-tête de bloc
      if (aText && headerColumn(aText) === "dimA" && cells[1] && headerColumn(String(cells[1].value ?? "")) === "width") {
        map = {};
        headers = [];
        cells.forEach((c, i) => {
          if (c.empty || !c.isText) return;
          const label = cleanText(String(c.value));
          const col = headerColumn(label);
          if (col && map![col] == null) map![col] = i;
          headers[i] = label;
        });
        block = { title: blockTitle || title, variantKey: variantFromText(blockTitle), headerRow: r, headers: headers.filter(Boolean), firstRow: 0, lastRow: 0, rows: 0 };
        rep.blocks.push(block);
        continue;
      }
      // titre de bloc (texte seul en colonne A, hors titre fusionné de la feuille)
      if (aText && parseNumber(aText) == null && nonEmpty.length === 1 && !inTitleMerge(r)) {
        blockTitle = aText;
        map = null;
        block = null;
        continue;
      }
      if (!map || !block || map.dimA == null || map.width == null) continue;
      const dimCell = cells[map.dimA]!;
      const dimA = parseNumber(dimCell.value);
      if (dimA == null) continue;
      const wCell = cells[map.width]!;
      const band = parseBand(wCell.value);
      const width = band ? null : parseNumber(wCell.value);
      rep.dataRows++;
      block.rows++;
      block.firstRow ||= r;
      block.lastRow = r;
      const variantKey = block.variantKey;
      const baseIssues: string[] = [];
      const conditions: Record<string, unknown> = { sheet: ws.name, block: block.title, header: "", dimAHeader: headers[map.dimA] ?? "" };
      if (dimCell.isText) {
        rep.textNumbers++;
        conditions.dimAStoredAsText = true;
      }
      if (band) conditions.widthBand = cleanText(String(wCell.value));
      if (wCell.isText && !band && width != null) {
        rep.textNumbers++;
        conditions.widthStoredAsText = true;
      }
      const headerA = headers[map.dimA] ?? "";
      let dimAKey = /hauteur/i.test(headerA) ? "hauteur" : "projection";
      if (HEIGHT_FAMILIES.has(familySlug) && dimAKey === "projection") {
        dimAKey = "hauteur";
        baseIssues.push(`Colonne « ${headerA} » interprétée comme HAUTEUR (store vertical) et « Largeur » comme largeur — interprétation à confirmer`);
      }
      const widthMinMm = band ? band.minMm : width != null ? cmToMm(width) : null;
      const widthMaxMm = band ? band.maxMm : widthMinMm;
      if (widthMinMm == null) baseIssues.push(`Largeur illisible (${wCell.address})`);
      const ref = (addr: string) => `${opts.fileName} › ${ws.name}!${addr}`;
      const mk = (role: ParsedRow["amountRole"], c: CellRead | undefined, header: string): ParsedRow => {
        const num = c && !c.empty ? parseNumber(c.value) : null;
        const { minor, subCent } = toMinor(num);
        const row: ParsedRow = {
          familySlug,
          variantKey,
          kind: "GRID",
          code: "",
          label: `${block!.title}`.slice(0, 200),
          dimAKey,
          dimAmm: cmToMm(dimA),
          widthMinMm,
          widthMaxMm,
          conditions: { ...conditions, header, ...(subCent ? { subCentRounded: true } : {}), ...(c?.isText && num != null ? { amountStoredAsText: true } : {}) },
          amountMinor: minor,
          currency: null,
          amountRole: role,
          formula: c?.formula ?? null,
          cachedValue: c?.formula && typeof c.value === "number" ? c.value : null,
          sourceRef: ref(c?.address ?? `?${r}`),
          status: "OK",
          issues: [],
        };
        for (const i of baseIssues) addIssue(row, i);
        if (!c || c.empty) addIssue(row, "Cellule vide : montant laissé vide (non mis à zéro)");
        else if (c.missingCache) addIssue(row, "Formule sans valeur en cache : montant laissé vide (jamais recalculé)");
        else if (num == null) addIssue(row, `Valeur non numérique (${c.address})`);
        return row;
      };
      const priceCell = map.price != null ? cells[map.price] : undefined;
      const price = mk(AMOUNT_ROLES.SOURCE_PRICE, priceCell, headers[map.price ?? -1] ?? "Prix");
      rows.push(price);
      if (map.final != null) {
        const fc = cells[map.final];
        const fin = mk(AMOUNT_ROLES.FINAL_PRICE, fc, headers[map.final] ?? "Prix final");
        rows.push(fin);
        let coefficient: number | null = null;
        if (fc && !fc.empty) {
          const ck = check("F");
          if (!fc.formula) addIssue(fin, "Valeur saisie sans formule : coefficient non vérifiable");
          else {
            ck.count++;
            ck.patterns[patternOf(fc.formula)] = (ck.patterns[patternOf(fc.formula)] ?? 0) + 1;
            if (fc.missingCache) ck.missingCache++;
            const p = parseCoefficientFormula(fc.formula, r);
            if ("error" in p) {
              addIssue(fin, `Formule non conforme (${p.error})`);
              ck.mismatches++;
            } else {
              coefficient = p.coefficient;
              coefCounts.set(coefficient, (coefCounts.get(coefficient) ?? 0) + 1);
              const c = parseNumber(priceCell?.value);
              const cached = typeof fc.value === "number" ? fc.value : null;
              if (c != null && cached != null && Math.abs(c * coefficient - cached) > 0.005) {
                addIssue(fin, "Valeur en cache ≠ Prix × coefficient de la formule");
                ck.mismatches++;
              }
            }
          }
        }
        finalRows.push({ row: fin, coefficient });
      }
      // contrôles des colonnes calculées D (surface) et E (prix/m²)
      const pv = parseNumber(priceCell?.value);
      for (const [col, expected] of [
        ["surface", width != null ? (dimA * width) / 10000 : null],
        ["ppm", null],
      ] as const) {
        const idx = map[col];
        if (idx == null) continue;
        const cc = cells[idx]!;
        if (cc.empty) continue;
        const letter = cc.address.replace(/\d+/g, "");
        const ck = check(letter);
        if (cc.formula) {
          ck.count++;
          ck.patterns[patternOf(cc.formula)] = (ck.patterns[patternOf(cc.formula)] ?? 0) + 1;
        }
        if (cc.missingCache) ck.missingCache++;
        const got = parseNumber(cc.value);
        let exp: number | null = expected;
        if (col === "ppm") {
          const sIdx = map.surface;
          const s = sIdx != null ? parseNumber(cells[sIdx]!.value) : null;
          exp = pv != null && s ? pv / s : null;
        }
        if (exp != null && got != null && Math.abs(exp - got) > 0.01) {
          ck.mismatches++;
          addIssue(price, `Colonne ${cc.address} (${col === "surface" ? "surface" : "prix/m²"}) incohérente avec les dimensions / le prix`);
        }
      }
    }
    // coefficient majoritaire de la feuille : écarts signalés
    const coefs = [...coefCounts.entries()].sort((x, y) => y[1] - x[1]);
    rep.finalCoefficients = coefs.map(([k]) => k);
    if (coefs.length > 1) {
      const major = coefs[0]![0];
      rep.notes.push(`${coefs.length} coefficients différents dans la colonne « Prix final » de la feuille.`);
      for (const f of finalRows) if (f.coefficient != null && f.coefficient !== major) addIssue(f.row, "Coefficient différent du reste de la feuille");
    }
    rep.formulas = Object.values(checks);
    if (HEIGHT_FAMILIES.has(familySlug)) rep.notes.push("Colonne A intitulée « Projection » interprétée comme hauteur ; à confirmer auprès du fournisseur.");
  }

  const structure: WorkbookStructure = { ...structure0, mentionsCurrency: [...currencyHits], mentionsTax: [...taxHits] };
  if (!currencyHits.size) notes.push("Aucune devise indiquée dans le classeur.");
  if (!taxHits.size) notes.push("Aucune mention HT / TTC / TVA dans le classeur.");
  if (structure.externalLinks) notes.push(`${structure.externalLinks} lien(s) externe(s) présent(s) : non suivis.`);
  if (structure.hiddenSheets.length) notes.push(`Feuilles masquées : ${structure.hiddenSheets.join(", ")}`);
  const families = [...new Set(rows.map((r) => r.familySlug))];
  const base = opts.fileName.replace(/\.[^.]+$/, "");
  return {
    type: "xlsx",
    fileName: opts.fileName,
    sourceKey: opts.sourceKey ?? `xlsx-${slugify(base)}`,
    label: `Classeur « ${base} »`,
    families,
    currency: null,
    currencyNote: currencyHits.size ? `Mentions de devise trouvées (${[...currencyHits].slice(0, 5).join(", ")}) mais non rattachées aux colonnes : devise non retenue.` : "Aucune devise indiquée dans le classeur.",
    natureNote: "Nature non établie : colonnes « Prix » et « Prix final HELIOSTORES » sans indication d'achat, de vente ni de base HT/TTC.",
    rows,
    notes,
    xlsx: { structure, sheets },
  };
}

/**
 * Première feuille visible d'un classeur, en cellules texte (format normalisé). Une formule donne sa valeur en cache
 * (jamais recalculée) ; une formule sans cache donne une cellule vide, signalée par le lecteur du format.
 */
export async function firstSheetTable(buf: Uint8Array, maxRows = 5000): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets.find((w) => w.state === "visible") ?? wb.worksheets[0];
  if (!ws) return [];
  const out: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    if (out.length >= maxRows) return;
    const cells: string[] = [];
    for (let c = 1; c <= ws.columnCount; c += 1) {
      const r = readCell(row.getCell(c));
      const v = r.value;
      cells.push(v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
    }
    out.push(cells);
  });
  return out;
}
