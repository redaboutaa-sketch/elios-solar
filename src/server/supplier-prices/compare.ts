/**
 * Rapprochement fiches DOCX ↔ classeur XLSX : écarts de montants, couverture, libellés de variantes.
 * Module pur. Les montants des écarts restent dans le rapport privé (jamais imprimés par le script).
 */
import { stripAccents, widthKey } from "./normalise";
import { AMOUNT_ROLES, type Discrepancy, type ParsedRow, type ParsedSource } from "./types";

/** Écart toléré (unités mineures) : arrondi au centime d'une valeur en cache à fraction de centime. */
const ROUNDING_TOLERANCE = 1;

export interface CompareResult {
  discrepancies: Discrepancy[];
  /** issues à ajouter aux lignes, par sourceRef */
  rowIssues: Record<string, string[]>;
  summary: {
    pairs: { docx: string; xlsx: string; familySlug: string }[];
    byCategory: Record<string, number>;
    roundingOnly: number;
    matchedCells: number;
    notes: string[];
  };
}

const cellKey = (r: ParsedRow) => `${r.dimAmm}|${widthKey(r)}`;

function index(rows: ParsedRow[]) {
  const m = new Map<string, ParsedRow>();
  for (const r of rows) if (!m.has(cellKey(r))) m.set(cellKey(r), r);
  return m;
}

export function compareSources(sources: ParsedSource[]): CompareResult {
  const discrepancies: Discrepancy[] = [];
  const rowIssues: Record<string, string[]> = {};
  const notes: string[] = [];
  const pairs: CompareResult["summary"]["pairs"] = [];
  let roundingOnly = 0;
  let matchedCells = 0;
  let current = { docxFile: "", xlsxFile: "" };
  const push = (d: Omit<Discrepancy, "docxFile" | "xlsxFile">) => discrepancies.push({ ...d, ...current });
  const flag = (r: ParsedRow | undefined, issue: string) => {
    if (!r) return;
    const l = (rowIssues[r.sourceRef] ??= []);
    if (!l.includes(issue)) l.push(issue);
  };
  const xlsxSources = sources.filter((s) => s.type === "xlsx");
  for (const d of sources.filter((s) => s.type === "docx")) {
    for (const familySlug of d.families) {
      const x = xlsxSources.find((s) => s.families.includes(familySlug));
      if (!x) {
        notes.push(`${d.fileName} : aucun classeur fourni pour ${familySlug} — rapprochement non effectué.`);
        continue;
      }
      pairs.push({ docx: d.fileName, xlsx: x.fileName, familySlug });
      current = { docxFile: d.fileName, xlsxFile: x.fileName };
      const xGrid = x.rows.filter((r) => r.familySlug === familySlug && r.kind === "GRID");
      const dGrid = d.rows.filter((r) => r.familySlug === familySlug && r.kind === "GRID");
      const xVariants = [...new Set(xGrid.map((r) => r.variantKey))];
      const dTables = [...new Set(dGrid.map((r) => Number(r.conditions.table)))];
      const usedX = new Set<string>();
      for (const t of dTables) {
        const tRows = dGrid.filter((r) => Number(r.conditions.table) === t);
        const dVariant = tRows[0]?.variantKey ?? "";
        const caption = String(tRows[0]?.conditions.caption ?? "");
        const dSrc = tRows.filter((r) => r.amountRole === AMOUNT_ROLES.SOURCE_PRICE);
        // variante du classeur la plus proche (cellules identiques sur le prix source)
        const scores = xVariants.map((v) => {
          const xi = index(xGrid.filter((r) => r.variantKey === v && r.amountRole === AMOUNT_ROLES.SOURCE_PRICE));
          const same = dSrc.filter((r) => {
            const o = xi.get(cellKey(r));
            return o && o.amountMinor != null && o.amountMinor === r.amountMinor;
          }).length;
          return { v, same };
        });
        const best = scores.sort((a, b) => b.same - a.same)[0];
        const sameKey = xVariants.includes(dVariant) ? dVariant : null;
        let target: string | null = sameKey;
        if (best && best.same > 0 && best.v !== dVariant && best.same >= dSrc.length / 2) {
          target = best.v;
          const msg = `Variante nommée « ${caption || dVariant || "—"} » dans la fiche et « ${best.v || "—"} » dans le classeur pour les mêmes montants (${best.same}/${dSrc.length} cellules identiques) : contradiction de libellé à lever`;
          push({ category: "VARIANT_LABEL", familySlug, variantKey: best.v, docxRef: `${d.fileName} › tableau ${t}`, xlsxRef: `${x.fileName} › variante ${best.v}`, message: msg });
          for (const r of tRows) flag(r, msg);
          for (const r of xGrid.filter((r) => r.variantKey === best.v)) flag(r, msg);
        } else if (best && best.same === 0 && dSrc.length > 0) {
          const msg = `La grille de la fiche (tableau ${t}) ne correspond à AUCUNE cellule du classeur`;
          push({ category: "NO_MATCHING_CELL", familySlug, variantKey: dVariant, docxRef: `${d.fileName} › tableau ${t}`, xlsxRef: x.fileName, message: msg });
          for (const r of tRows) flag(r, msg);
        }
        if (caption && sameKey && target === sameKey && !stripAccents(caption).toLowerCase().includes(sameKey.split("-")[0]!)) {
          notes.push(`${familySlug} : libellé « ${caption} » de la fiche rapproché de la variante « ${sameKey} » du classeur (synonyme).`);
        }
        if (target == null) {
          const msg = `Variante « ${caption || dVariant || "—"} » absente du classeur`;
          for (const r of tRows) {
            push({ category: "MISSING_IN_XLSX", familySlug, variantKey: dVariant, amountRole: r.amountRole, dimAmm: r.dimAmm, widthMinMm: r.widthMinMm, widthMaxMm: r.widthMaxMm, docxRef: r.sourceRef, docxAmountMinor: r.amountMinor, message: msg });
            flag(r, msg);
          }
          continue;
        }
        usedX.add(target);
        // en-tête de dimension
        const dHead = String(tRows[0]?.conditions.dimAHeader ?? "");
        const xHead = String(xGrid.find((r) => r.variantKey === target)?.conditions.dimAHeader ?? "");
        if (dHead && xHead && dHead.split(/\s|\(/)[0]!.toLowerCase() !== xHead.split(/\s|\(/)[0]!.toLowerCase()) {
          push({ category: "DIMENSION_LABEL", familySlug, variantKey: target, docxRef: `${d.fileName} › tableau ${t}`, xlsxRef: x.fileName, message: `Dimension A intitulée « ${dHead} » dans la fiche et « ${xHead} » dans le classeur` });
        }
        for (const role of [AMOUNT_ROLES.SOURCE_PRICE, AMOUNT_ROLES.FINAL_PRICE]) {
          const di = index(tRows.filter((r) => r.amountRole === role));
          const xi = index(xGrid.filter((r) => r.variantKey === target && r.amountRole === role));
          if (!di.size) continue;
          for (const [k, dr] of di) {
            const xr = xi.get(k);
            if (!xr) {
              const msg = "Combinaison présente dans la fiche mais absente du classeur";
              push({ category: "MISSING_IN_XLSX", familySlug, variantKey: target, amountRole: role, dimAmm: dr.dimAmm, widthMinMm: dr.widthMinMm, widthMaxMm: dr.widthMaxMm, docxRef: dr.sourceRef, docxAmountMinor: dr.amountMinor, message: msg });
              flag(dr, msg);
              continue;
            }
            matchedCells++;
            if (dr.amountMinor == null || xr.amountMinor == null) continue;
            const diff = Math.abs(dr.amountMinor - xr.amountMinor);
            if (diff === 0) continue;
            if (role === AMOUNT_ROLES.FINAL_PRICE && diff <= ROUNDING_TOLERANCE) {
              roundingOnly++;
              continue;
            }
            const msg = `Écart DOCX↔XLSX (${role === AMOUNT_ROLES.SOURCE_PRICE ? "prix source" : "prix final"}) : ${dr.sourceRef} ≠ ${xr.sourceRef}`;
            push({ category: "AMOUNT_MISMATCH", familySlug, variantKey: target, amountRole: role, dimAmm: dr.dimAmm, widthMinMm: dr.widthMinMm, widthMaxMm: dr.widthMaxMm, docxRef: dr.sourceRef, xlsxRef: xr.sourceRef, docxAmountMinor: dr.amountMinor, xlsxAmountMinor: xr.amountMinor, message: msg });
            flag(dr, msg);
            flag(xr, msg);
          }
          for (const [k, xr] of xi) {
            if (di.has(k)) continue;
            const msg = "Combinaison présente dans le classeur mais absente de la fiche";
            push({ category: "MISSING_IN_DOCX", familySlug, variantKey: target, amountRole: role, dimAmm: xr.dimAmm, widthMinMm: xr.widthMinMm, widthMaxMm: xr.widthMaxMm, xlsxRef: xr.sourceRef, xlsxAmountMinor: xr.amountMinor, message: msg });
            flag(xr, msg);
          }
        }
      }
      for (const v of xVariants) if (!usedX.has(v)) notes.push(`${familySlug} : variante « ${v || "—"} » du classeur sans tableau correspondant dans ${d.fileName}.`);
    }
  }
  const byCategory: Record<string, number> = {};
  for (const d of discrepancies) byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
  return { discrepancies, rowIssues, summary: { pairs, byCategory, roundingOnly, matchedCells, notes } };
}
