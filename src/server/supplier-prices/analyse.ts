/**
 * Analyse complète d'un lot de sources (sans écriture) : lecture, contrôles, doublons,
 * grilles incomplètes, rapprochement DOCX↔XLSX et rapport par source.
 */
import { createHash } from "node:crypto";
import { compareSources, type CompareResult } from "./compare";
import { parseDocx } from "./docx";
import { addIssue, countRows, findGridGaps, markDuplicates } from "./normalise";
import type { Discrepancy, GridGap, ParsedRow, ParsedSource } from "./types";
import { parseXlsx } from "./xlsx";

export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

export interface SourceFile {
  fileName: string;
  bytes: Uint8Array;
  /** clé de source imposée (sinon dérivée du nom de fichier) */
  sourceKey?: string;
}

export interface AnalysedSource extends ParsedSource {
  sha256: string;
  bytes: number;
  duplicates: { key: string; refs: string[] }[];
  gaps: GridGap[];
  discrepancies: Discrepancy[];
}

export interface Analysis {
  sources: AnalysedSource[];
  comparison: CompareResult["summary"];
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export class SourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceError";
  }
}

export async function parseSource(f: SourceFile): Promise<ParsedSource> {
  if (f.bytes.byteLength > MAX_SOURCE_BYTES) throw new SourceError(`${f.fileName} : fichier trop volumineux (20 Mo maximum)`);
  const ext = f.fileName.toLowerCase().split(".").pop();
  const isZip = f.bytes[0] === 0x50 && f.bytes[1] === 0x4b;
  if (!isZip) throw new SourceError(`${f.fileName} : format non reconnu (archive Office attendue)`);
  try {
    if (ext === "xlsx") return await parseXlsx(f.bytes, { fileName: f.fileName, sourceKey: f.sourceKey });
    if (ext === "docx") return parseDocx(f.bytes, { fileName: f.fileName, sourceKey: f.sourceKey });
  } catch (e) {
    throw new SourceError(`${f.fileName} : lecture impossible (${(e as Error).message})`);
  }
  throw new SourceError(`${f.fileName} : extension non prise en charge (.xlsx ou .docx)`);
}

/** Analyse un lot : les fiches DOCX sont rapprochées des classeurs XLSX fournis dans le même lot. */
export async function analyseSources(files: SourceFile[]): Promise<Analysis> {
  const parsed: { src: ParsedSource; sha: string; size: number }[] = [];
  for (const f of files) parsed.push({ src: await parseSource(f), sha: sha256(f.bytes), size: f.bytes.byteLength });
  const cmp = compareSources(parsed.map((p) => p.src));
  const sources: AnalysedSource[] = parsed.map(({ src, sha, size }) => {
    for (const r of src.rows) for (const issue of cmp.rowIssues[r.sourceRef] ?? []) addIssue(r, issue);
    const duplicates = markDuplicates(src.rows);
    const gaps = findGridGaps(src.rows);
    const discrepancies = cmp.discrepancies.filter((d) => (src.type === "docx" ? d.docxFile : d.xlsxFile) === src.fileName);
    let currencyNote = src.currencyNote;
    if (src.type === "xlsx") {
      const hints = parsed.filter((p) => p.src.type === "docx" && p.src.currency && p.src.families.some((f) => src.families.includes(f))).map((p) => `${p.src.fileName} (${p.src.families.join(", ")}) : ${p.src.currency === "MAD" ? "« DH »" : p.src.currency}`);
      if (hints.length) currencyNote += ` Pour information, les fiches DOCX des mêmes produits indiquent une devise dans leurs en-têtes — ${hints.join(" ; ")} — non reportée sur le classeur.`;
    }
    return { ...src, currencyNote, sha256: sha, bytes: size, duplicates, gaps, discrepancies };
  });
  return { sources, comparison: cmp.summary };
}

/** Synthèse des anomalies : message → nombre de lignes (sans montant). */
export function issueSummary(rows: ParsedRow[]): { issue: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) for (const i of r.issues) {
    // regroupe les messages qui ne diffèrent que par leurs références
    const k = i.replace(/\(([^()]*›[^()]*)\)/g, "(…)").replace(/ : .*›.*$/, " : …");
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([issue, count]) => ({ issue, count })).sort((a, b) => b.count - a.count);
}

export function discrepancyCounts(ds: Discrepancy[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of ds) out[d.category] = (out[d.category] ?? 0) + 1;
  return out;
}

/** Rapport JSON enregistré avec la version (privé : contient les références et les écarts chiffrés). */
export function buildReport(s: AnalysedSource, comparison: Analysis["comparison"]) {
  return {
    generatedAt: new Date().toISOString(),
    type: s.type,
    fileName: s.fileName,
    sha256: s.sha256,
    bytes: s.bytes,
    families: s.families,
    counts: countRows(s.rows),
    issues: issueSummary(s.rows),
    notes: s.notes,
    xlsx: s.xlsx ?? null,
    docx: s.docx ?? null,
    duplicates: s.duplicates,
    gaps: s.gaps,
    discrepancyCounts: discrepancyCounts(s.discrepancies),
    discrepancies: s.discrepancies,
    comparison: { pairs: comparison.pairs.filter((p) => p.docx === s.fileName || p.xlsx === s.fileName), roundingOnly: comparison.roundingOnly, notes: comparison.notes },
    interpretation: {
      nature: "UNKNOWN",
      taxBasis: "UNKNOWN",
      currency: s.currency,
      currencyNote: s.currencyNote,
      natureNote: s.natureNote,
    },
  };
}
export type SupplierPriceReport = ReturnType<typeof buildReport>;
