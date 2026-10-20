/**
 * Lecture des fiches techniques DOCX (archive zip, word/document.xml) : tableaux de grille,
 * tableaux d'options et lignes d'options chiffrées. Module pur : aucune écriture, aucun montant journalisé.
 */
import { strFromU8, unzipSync } from "fflate";
import { addIssue, cleanText, cmToMm, currencyFromLabel, familyFromText, parseBand, parseNumber, slugify, stripAccents, toMinor, variantFromText } from "./normalise";
import { AMOUNT_ROLES, type DocxTableReport, type ParsedRow, type ParsedSource } from "./types";

export type DocxBlock = { type: "p"; text: string } | { type: "table"; rows: string[][] };

function decodeXml(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");
}

function runText(xml: string): string {
  const parts = xml.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>|<w:t\/>|<w:tab\/>|<w:br\/>|<w:br\s[^>]*\/>|<\/w:p>/g) ?? [];
  return parts
    .map((t) => (t.startsWith("<w:t>") || t.startsWith("<w:t ") ? decodeXml(t.replace(/<[^>]+>/g, "")) : t.startsWith("<w:tab") ? " " : t.startsWith("<w:br") || t === "</w:p>" ? "\n" : ""))
    .join("")
    .replace(/\n+$/, "");
}

/** Corps du document dans l'ordre : paragraphes et tableaux (cellules en texte). */
export function docxBlocks(buf: Uint8Array): DocxBlock[] {
  const files = unzipSync(buf, { filter: (f) => f.name === "word/document.xml" });
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("Fichier DOCX invalide : word/document.xml absent");
  const xml = strFromU8(doc);
  const body = xml.slice(Math.max(0, xml.indexOf("<w:body")));
  const out: DocxBlock[] = [];
  const re = /<w:tbl[ >][\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const s = m[0];
    if (s.startsWith("<w:tbl")) {
      const rows = (s.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []).map((tr) => (tr.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) ?? []).map((tc) => cleanText(runText(tc).replace(/\n/g, " "))));
      out.push({ type: "table", rows });
    } else {
      const text = runText(s);
      if (text.trim()) out.push({ type: "p", text });
    }
  }
  return out;
}

interface GridCols { dimA: number; width: number; price: number | null; final: number | null }

function gridColumns(h: string[]): GridCols | null {
  const n = h.map((x) => stripAccents(x).toLowerCase());
  const dimA = n.findIndex((x) => /^(projection|hauteur|avancee)/.test(x));
  const width = n.findIndex((x) => /^largeur/.test(x));
  if (dimA < 0 || width < 0) return null;
  const final = n.findIndex((x) => /prix\s*final/.test(x));
  const price = n.findIndex((x, i) => i !== final && /^prix/.test(x) && !/nb/.test(x));
  if (final < 0 && price < 0) return null;
  // tableau des spots : « Nb de spots » ⇒ option, pas grille
  if (n.some((x) => /^nb\b|nombre/.test(x))) return null;
  return { dimA, width, price: price < 0 ? null : price, final: final < 0 ? null : final };
}

const MONEY_LINE = /^(?:[-•–]\s*)?(.+?)\s*:\s*(\d[\d\s .,]*?)\s*(€|DHS?|MAD|EUR)(?![A-Za-z])(.*)$/i;
const PLUS_LINE = /^(?:[-•–]\s*)?(.+?)\s*:?\s*\+\s*(\d[\d\s .,]*?)\s*(€|DHS?|MAD|EUR)(?![A-Za-z])\s*(.*)$/i;

/** Libellé de paragraphe sans pictogramme de tête. */
function cleanCaption(s: string): string {
  return cleanText(s).replace(/^[^\p{L}\p{N}(]+/u, "").trim();
}

function isoCurrency(s: string): string | null {
  return currencyFromLabel(s.replace(/^(DHS?|MAD)$/i, "DH"));
}

function optionCode(label: string): string {
  return slugify(label.replace(/\([^)]*\)/g, "")).slice(0, 60);
}

export interface DocxOptions {
  fileName: string;
  sourceKey?: string;
}

export function parseDocx(buf: Uint8Array, opts: DocxOptions): ParsedSource {
  const blocks = docxBlocks(buf);
  const paragraphs = blocks.filter((b): b is { type: "p"; text: string } => b.type === "p");
  const title = cleanText(paragraphs.find((p) => /fiche\s+technique|tarification/i.test(p.text))?.text ?? paragraphs[0]?.text ?? opts.fileName);
  const familySlug = familyFromText(`${title} ${opts.fileName}`);
  const rows: ParsedRow[] = [];
  const tables: DocxTableReport[] = [];
  const notes: string[] = [];
  const currencies = new Set<string>();
  const currencyWhere: string[] = [];
  let optionLines = 0;
  let caption = "";
  let tableIndex = 0;
  const ref = (s: string) => `${opts.fileName} › ${s}`;
  const base = (over: Partial<ParsedRow>): ParsedRow => ({
    familySlug: familySlug ?? "non-reconnu",
    variantKey: "",
    kind: "GRID",
    code: "",
    label: "",
    dimAKey: null,
    dimAmm: null,
    widthMinMm: null,
    widthMaxMm: null,
    conditions: {},
    amountMinor: null,
    currency: null,
    amountRole: AMOUNT_ROLES.SOURCE_PRICE,
    formula: null,
    cachedValue: null,
    sourceRef: "",
    status: familySlug ? "OK" : "REJECTED",
    issues: familySlug ? [] : ["Famille non reconnue"],
    ...over,
  });
  const amountRow = (over: Partial<ParsedRow>, raw: string, where: string) => {
    const n = parseNumber(raw);
    const { minor, subCent } = toMinor(n);
    const r = base({ ...over, amountMinor: minor, sourceRef: ref(where) });
    if (subCent) r.conditions = { ...r.conditions, subCentRounded: true };
    if (!raw.trim()) addIssue(r, "Cellule vide : montant laissé vide (non mis à zéro)");
    else if (n == null) addIssue(r, "Valeur non numérique");
    if (!r.currency) addIssue(r, "Devise non indiquée");
    return r;
  };

  for (const b of blocks) {
    if (b.type === "p") {
      const lines = b.text.split("\n").map(cleanText).filter(Boolean);
      for (const line of lines) {
        const plus = line.match(PLUS_LINE);
        const money = plus ? null : line.match(MONEY_LINE);
        if (plus) {
          const cur = isoCurrency(plus[3]!);
          if (cur) currencies.add(cur);
          optionLines++;
          const label = cleanText(plus[1]!.replace(/\s*possible\s*$/i, ""));
          const rest = cleanText(plus[4]!);
          rows.push(amountRow({ kind: "OPTION", amountRole: AMOUNT_ROLES.OPTION, code: optionCode(label), label, currency: cur, conditions: { unit: rest, increment: true, firstIncluded: /premi[eè]re\s+est\s+incluse/i.test(rest), sourceText: line } }, plus[2]!, `paragraphe « ${label.slice(0, 60)} »`));
        } else if (money) {
          const cur = isoCurrency(money[3]!);
          if (cur) currencies.add(cur);
          optionLines++;
          const label = cleanText(money[1]!);
          rows.push(amountRow({ kind: "OPTION", amountRole: AMOUNT_ROLES.OPTION, code: optionCode(label), label, currency: cur, conditions: { nonRemise: /non\s+remis/i.test(label), sourceText: line } }, money[2]!, `paragraphe « ${label.slice(0, 60)} »`));
        }
      }
      caption = cleanCaption(lines[lines.length - 1] ?? "");
      continue;
    }
    tableIndex++;
    const [header = [], ...body] = b.rows;
    const where = (i: number) => `tableau ${tableIndex}${caption ? ` (« ${caption.slice(0, 40)} »)` : ""} ligne ${i + 2}`;
    const grid = gridColumns(header);
    const rep: DocxTableReport = { index: tableIndex, caption, headers: header, rows: body.length, kind: "ignored", variantKey: "", currency: null };
    tables.push(rep);
    if (grid) {
      rep.kind = "grid";
      const variantKey = variantFromText(caption);
      rep.variantKey = variantKey;
      const dimAKey = /hauteur/i.test(header[grid.dimA] ?? "") ? "hauteur" : "projection";
      const curOf = (i: number | null) => (i == null ? null : currencyFromLabel(header[i] ?? ""));
      rep.currency = curOf(grid.price) ?? curOf(grid.final);
      for (const c of [curOf(grid.price), curOf(grid.final)]) if (c) {
        currencies.add(c);
        currencyWhere.push(`en-tête du tableau ${tableIndex} « ${(header[grid.price ?? grid.final ?? 0] ?? "").slice(0, 60)} »`);
      }
      const ratios: number[] = [];
      body.forEach((cells, i) => {
        const dimA = parseNumber(cells[grid.dimA] ?? "");
        const wRaw = cells[grid.width] ?? "";
        const band = parseBand(wRaw);
        const width = band ? null : parseNumber(wRaw);
        if (dimA == null) {
          if (cells.some((c) => c.trim())) notes.push(`Ligne ignorée (${where(i)}) : dimension illisible.`);
          return;
        }
        const common: Partial<ParsedRow> = {
          variantKey,
          kind: "GRID",
          label: caption || title,
          dimAKey,
          dimAmm: cmToMm(dimA),
          widthMinMm: band ? band.minMm : width != null ? cmToMm(width) : null,
          widthMaxMm: band ? band.maxMm : width != null ? cmToMm(width) : null,
        };
        const cond = { table: tableIndex, caption, dimAHeader: header[grid.dimA] ?? "", ...(band ? { widthBand: cleanText(wRaw) } : {}), ...(caption ? { sourceVariantLabel: caption } : {}) };
        const made: ParsedRow[] = [];
        if (grid.price != null) made.push(amountRow({ ...common, amountRole: AMOUNT_ROLES.SOURCE_PRICE, currency: curOf(grid.price), conditions: { ...cond, header: header[grid.price] } }, cells[grid.price] ?? "", where(i)));
        if (grid.final != null) made.push(amountRow({ ...common, amountRole: AMOUNT_ROLES.FINAL_PRICE, currency: curOf(grid.final), conditions: { ...cond, header: header[grid.final] } }, cells[grid.final] ?? "", where(i)));
        for (const r of made) if (r.widthMinMm == null) addIssue(r, "Largeur illisible");
        const [p, f] = made;
        if (p && f && p.amountMinor != null && f.amountMinor != null) {
          if (f.amountMinor >= p.amountMinor) addIssue(f, "Prix final ≥ prix fournisseur");
          ratios.push(f.amountMinor / p.amountMinor);
        }
        rows.push(...made);
      });
      // rapport constant prix final / prix fournisseur (contrôle de cohérence interne à la fiche)
      if (ratios.length) {
        const clusters = new Map<string, number[]>();
        for (const r of ratios) {
          const k = r.toFixed(3);
          const g = clusters.get(k);
          if (g) g.push(r);
          else clusters.set(k, [r]);
        }
        const best = [...clusters.values()].sort((a, b) => b.length - a.length)[0]!.sort((a, b) => a - b);
        const major = best[Math.floor(best.length / 2)]!;
        const tableRows = rows.filter((r) => r.conditions.table === tableIndex);
        for (const f of tableRows.filter((r) => r.amountRole === AMOUNT_ROLES.FINAL_PRICE)) {
          const p = tableRows.find((x) => x.amountRole === AMOUNT_ROLES.SOURCE_PRICE && x.dimAmm === f.dimAmm && x.widthMinMm === f.widthMinMm && x.widthMaxMm === f.widthMaxMm);
          if (p?.amountMinor != null && f.amountMinor != null && Math.abs(p.amountMinor * major - f.amountMinor) > 2) addIssue(f, "Rapport prix final / prix fournisseur différent du reste du tableau");
        }
        rep.finalRatio = Number(major.toFixed(4));
        rep.ratioClusters = clusters.size;
      }
      continue;
    }
    // tableaux d'options
    const n = header.map((h) => stripAccents(h).toLowerCase());
    const priceIdx = n.findIndex((h) => /^prix|plus-?value/.test(h));
    if (priceIdx < 0) {
      notes.push(`Tableau ${tableIndex} ignoré : aucune colonne de prix.`);
      continue;
    }
    rep.kind = "option";
    const cur = currencyFromLabel(header[priceIdx] ?? "");
    rep.currency = cur;
    if (cur) currencies.add(cur);
    const capCode = optionCode(caption.replace(/tarification\s+des\s+/i, "").replace(/\s*\(option\)\s*/i, "")) || `tableau-${tableIndex}`;
    body.forEach((cells, i) => {
      const cond: Record<string, unknown> = { table: tableIndex, caption, header: header[priceIdx] };
      const match: Record<string, unknown> = {};
      let code = capCode;
      let label = caption;
      let dimAKey: string | null = null;
      let dimAmm: number | null = null;
      let widthMinMm: number | null = null;
      let widthMaxMm: number | null = null;
      header.forEach((h, j) => {
        if (j === priceIdx) return;
        const v = cells[j] ?? "";
        const hn = n[j]!;
        const band = parseBand(v);
        if (/^projection|^hauteur/.test(hn)) {
          if (band) Object.assign(match, { [`${hn.startsWith("h") ? "hauteur" : "projection"}MinMm`]: band.minMm, [`${hn.startsWith("h") ? "hauteur" : "projection"}MaxMm`]: band.maxMm });
          dimAKey = hn.startsWith("h") ? "hauteur" : "projection";
        } else if (/^largeur\s*min/.test(hn)) {
          const w = parseNumber(v.replace(/cm$/i, ""));
          cond.minSystemWidthMm = w != null ? cmToMm(w) : null;
          cond.minSystemWidthText = v;
        } else if (/^largeur/.test(hn)) {
          if (band) {
            widthMinMm = band.minMm;
            widthMaxMm = band.maxMm;
            Object.assign(match, { widthMinMm, widthMaxMm });
          }
        } else if (/^longueur\s*\(cm\)|^longueur$/.test(hn)) {
          const l = parseNumber(v);
          dimAKey = "longueur";
          dimAmm = l != null ? cmToMm(l) : null;
          match.longueurMm = dimAmm;
        } else if (/^mod[eè]le/.test(hn)) {
          code = `moteur-${optionCode(v)}`.slice(0, 80);
          label = v;
          match.model = v;
        } else if (/^nb/.test(hn)) {
          const pts = parseNumber(v.replace(/points?/i, ""));
          cond.points = pts;
          cond.pointsText = v;
        } else cond[slugify(h) || `col${j}`] = v;
      });
      cond.match = match;
      rows.push(amountRow({ kind: "OPTION", amountRole: AMOUNT_ROLES.OPTION, code, label: label || code, currency: cur, dimAKey, dimAmm, widthMinMm, widthMaxMm, conditions: cond }, cells[priceIdx] ?? "", where(i)));
    });
  }

  const gridCurrencies = [...new Set(tables.filter((t) => t.kind === "grid").map((t) => t.currency).filter((c): c is string => !!c))];
  const listCurrency = gridCurrencies.length === 1 ? gridCurrencies[0]! : null;
  const others = [...currencies].filter((c) => c !== listCurrency);
  const currencyNote = [
    listCurrency ? `Devise ${listCurrency === "MAD" ? "« DH »" : listCurrency} indiquée par la source : ${[...new Set(currencyWhere)].slice(0, 3).join(" ; ")}.` : "Aucune devise unique indiquée pour les grilles.",
    others.length ? `Options libellées en ${others.join(", ")} (devise conservée ligne à ligne, aucune conversion).` : "",
  ].filter(Boolean).join(" ");
  if (!familySlug) notes.push("Famille non reconnue : lignes rejetées.");
  if (!/\bHT\b|\bTTC\b|TVA|hors\s+taxe/i.test(blocks.map((b) => (b.type === "p" ? b.text : b.rows.flat().join(" "))).join(" "))) notes.push("Aucune mention HT / TTC / TVA dans la fiche.");
  const fileBase = opts.fileName.replace(/\.[^.]+$/, "");
  return {
    type: "docx",
    fileName: opts.fileName,
    sourceKey: opts.sourceKey ?? `docx-${slugify(fileBase)}`,
    label: title.slice(0, 200),
    families: familySlug ? [familySlug] : [],
    currency: listCurrency,
    currencyNote,
    natureNote: "Nature non établie : « Prix fournisseur » et « Prix final HELIOSTORES » sans indication d'achat, de vente publique ni de base HT/TTC.",
    rows,
    notes,
    docx: { title, tables, optionLines, currencies: [...currencies] },
  };
}
