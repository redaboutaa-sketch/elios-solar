/**
 * Format tarifaire NORMALISÉ (docs/pricing/selt-import.md) : un fichier CSV (UTF-8, séparateur « ; » ou « , ») ou un
 * classeur .xlsx dont la première feuille porte les mêmes en-têtes. Il sert à reporter, ligne à ligne et avec leur
 * localisation exacte, les tarifs des catalogues fournisseur (SELT) une fois reçus ; il n'invente aucune donnée : une
 * valeur absente reste absente et la ligne est signalée.
 *
 * Module pur : aucune écriture, aucun montant dans les messages (les problèmes citent la ligne et la colonne).
 */
import { MAX_AMOUNT_MINOR } from "@/domain/tariffs";
import { addIssue, slugify, stripAccents, variantFromText } from "./normalise";
import type { ParsedRow, ParsedSource } from "./types";

/** Colonnes du format (ordre libre, en-têtes exacts, insensibles à la casse et aux accents). */
export const NORMALIZED_COLUMNS = [
  "ref_fournisseur", "produit", "variante", "type_ligne", "code", "libelle", "dimension_a", "unite", "dim_a", "largeur_min", "largeur_max",
  "montant", "devise", "base", "nature", "remise_fournisseur_pct", "inclus", "regle", "source_document", "source_localisation", "valide_du", "valide_au",
] as const;
type Column = (typeof NORMALIZED_COLUMNS)[number];
export const NORMALIZED_REQUIRED: readonly Column[] = ["ref_fournisseur", "type_ligne", "libelle", "montant", "devise", "base", "nature", "source_document", "source_localisation"];

/** Nature déclarée → rôle de montant (colonne) ; chaque rôle devient une lignée de grilles distincte. */
export const NORMALIZED_ROLES = { catalogue_fournisseur: "CATALOGUE_FOURNISSEUR", achat_net: "ACHAT_NET", vente: "VENTE" } as const;
export const NORMALIZED_ROLE_NATURE: Record<string, "SUPPLIER_LIST" | "PURCHASE" | "SALE"> = { CATALOGUE_FOURNISSEUR: "SUPPLIER_LIST", ACHAT_NET: "PURCHASE", VENTE: "SALE" };

/** Bornes plausibles d'une cote (mm) : au-delà, l'unité déclarée est probablement fausse. */
const DIM_MIN_MM = 200, DIM_MAX_MM = 20_000;

const norm = (s: string) => stripAccents(s).trim().toLowerCase().replace(/[\s-]+/g, "_");

/** Le fichier porte-t-il les en-têtes du format normalisé ? */
export function isNormalizedHeader(cells: string[]): boolean {
  const h = new Set(cells.map(norm));
  return NORMALIZED_REQUIRED.every((c) => h.has(c));
}

/** CSV → lignes de cellules (guillemets « " » et séparateur « ; » ou « , » détecté sur l'en-tête). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const first = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Date « 31/12/2026 » ou « 2026-12-31 » → AAAA-MM-JJ, sinon null. */
export function parseDate(v: string): string | null {
  const s = v.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return null;
}

/** Montant décimal « 1 234,56 » → centimes ; null si vide ; « invalid » si illisible (jamais de valeur supposée). */
function amountOf(v: string): number | null | "invalid" {
  const s = v.replace(/[\s  €]/g, "");
  if (!s) return null;
  const m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(s);
  if (!m) return "invalid";
  const minor = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return minor > MAX_AMOUNT_MINOR ? "invalid" : minor;
}

/** Entier positif (cote) ; null si vide ; NaN si illisible. */
function intOf(v: string): number | null {
  const s = v.replace(/[\s ]/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : Number.NaN;
}

const compact = (s: string) => stripAccents(s).toUpperCase().replace(/[^A-Z0-9]/g, "");

export interface NormalizedOptions {
  fileName: string;
  sourceKey?: string;
  /** références fournisseur → identifiant produit stable (transcodification validée) */
  productOf: (supplierRef: string) => string | null;
  /** identifiants produits existants (une valeur « produit » inconnue est signalée) */
  knownProducts: ReadonlySet<string>;
}

export function parseNormalizedRows(table: string[][], opts: NormalizedOptions): ParsedSource {
  const [header, ...body] = table;
  if (!header || !isNormalizedHeader(header)) throw new Error(`en-têtes du format normalisé absents (obligatoires : ${NORMALIZED_REQUIRED.join(", ")})`);
  const idx = new Map<Column, number>();
  header.forEach((h, i) => { const k = norm(h) as Column; if ((NORMALIZED_COLUMNS as readonly string[]).includes(k) && !idx.has(k)) idx.set(k, i); });
  const unknownHeaders = header.map(norm).filter((h) => h && !(NORMALIZED_COLUMNS as readonly string[]).includes(h));
  const base = opts.fileName.replace(/\.[^.]+$/, "");
  const rows: ParsedRow[] = [];
  const declared = { currency: new Set<string>(), tax: new Set<string>(), validFrom: new Set<string>(), validTo: new Set<string>(), documents: new Set<string>() };
  body.forEach((cells, i) => {
    const line = i + 2;
    const get = (c: Column) => (idx.has(c) ? (cells[idx.get(c)!] ?? "").trim() : "");
    const ref = get("ref_fournisseur");
    const loc = `${opts.fileName} › ligne ${line} (${get("source_document") || "document ?"} : ${get("source_localisation") || "localisation ?"})`;
    const kindRaw = norm(get("type_ligne"));
    const kind: ParsedRow["kind"] = kindRaw === "grille" || kindRaw === "grid" ? "GRID" : "OPTION";
    const natureKey = norm(get("nature")) as keyof typeof NORMALIZED_ROLES;
    const role = NORMALIZED_ROLES[natureKey];
    const unit = norm(get("unite"));
    const factor = unit === "mm" ? 1 : unit === "cm" ? 10 : unit === "m" ? 1000 : null;
    const toMm = (v: number | null): number | null => (v == null ? null : Number.isNaN(v) || factor == null ? Number.NaN : Math.round(v * factor));
    const declaredProduct = get("produit");
    const matched = declaredProduct || (ref ? opts.productOf(ref) : null);
    const familySlug = matched ?? `non-rapproche-${slugify(ref) || "sans-reference"}`;
    const amount = amountOf(get("montant"));
    const dimA = toMm(intOf(get("dim_a")));
    const wMax = toMm(intOf(get("largeur_max")));
    const wMin = toMm(intOf(get("largeur_min"))) ?? wMax;
    const discount = get("remise_fournisseur_pct");
    const r: ParsedRow = {
      familySlug,
      variantKey: get("variante") ? variantFromText(get("variante")) || slugify(get("variante")) : "",
      kind,
      code: get("code") || (kind === "GRID" ? "" : slugify(get("libelle"))),
      label: get("libelle"),
      dimAKey: kind === "GRID" ? (norm(get("dimension_a")) === "hauteur" ? "hauteur" : "projection") : null,
      dimAmm: kind === "GRID" && dimA != null && !Number.isNaN(dimA) ? dimA : null,
      widthMinMm: kind === "GRID" && wMin != null && !Number.isNaN(wMin) ? wMin : null,
      widthMaxMm: kind === "GRID" && wMax != null && !Number.isNaN(wMax) ? wMax : null,
      conditions: {
        supplierRef: ref, // privé : administration seulement
        format: "normalise",
        ...(discount ? { supplierDiscountPct: discount } : {}),
        ...(get("inclus") ? { included: get("inclus") } : {}),
        ...(get("regle") ? { rule: get("regle") } : {}),
        ...(get("valide_du") ? { validFrom: parseDate(get("valide_du")) } : {}),
        ...(get("valide_au") ? { validTo: parseDate(get("valide_au")) } : {}),
        source: { document: get("source_document"), location: get("source_localisation") },
        ...(declaredProduct ? {} : matched ? { matchedBy: "référence fournisseur (transcodification)" } : {}),
      },
      amountMinor: typeof amount === "number" ? amount : null,
      currency: /^[A-Z]{3}$/.test(get("devise").toUpperCase()) ? get("devise").toUpperCase() : null,
      amountRole: (role ?? "NATURE_INCONNUE") as ParsedRow["amountRole"],
      formula: null,
      cachedValue: null,
      sourceRef: loc,
      status: "OK",
      issues: [],
    };
    for (const c of NORMALIZED_REQUIRED) if (!get(c)) addIssue(r, `ligne ${line} : colonne « ${c} » vide`, c === "montant" ? "TO_CHECK" : "REJECTED");
    if (!role) addIssue(r, `ligne ${line} : nature inconnue (catalogue_fournisseur, achat_net ou vente)`, "REJECTED");
    if (!["grille", "grid", "option", "fixe"].includes(kindRaw)) addIssue(r, `ligne ${line} : type_ligne inconnu (grille, option ou fixe)`, "REJECTED");
    if (amount === "invalid") addIssue(r, `ligne ${line} : montant illisible (nombre positif, deux décimales au plus)`, "REJECTED");
    if (amount === 0) addIssue(r, `ligne ${line} : montant nul refusé (une donnée absente reste vide, jamais 0)`, "REJECTED");
    if (get("devise") && !r.currency) addIssue(r, `ligne ${line} : devise invalide (code ISO à trois lettres)`, "REJECTED");
    const tax = get("base").toUpperCase();
    if (get("base") && tax !== "HT" && tax !== "TTC") addIssue(r, `ligne ${line} : base « HT » ou « TTC » attendue`, "REJECTED");
    if (discount && !(/^\d{1,2}([.,]\d{1,4})?$/.test(discount))) addIssue(r, `ligne ${line} : remise fournisseur invalide (pourcentage < 100)`, "REJECTED");
    if (discount && natureKey !== "catalogue_fournisseur") addIssue(r, `ligne ${line} : une remise fournisseur ne s'applique qu'à un prix catalogue fournisseur`);
    if (declaredProduct && !opts.knownProducts.has(declaredProduct)) addIssue(r, `ligne ${line} : produit « ${declaredProduct} » inconnu du catalogue`, "TO_CHECK");
    if (!matched) addIssue(r, `ligne ${line} : produit non rapproché (référence fournisseur absente de la transcodification) — à choisir à l'import`);
    if (kind === "GRID") {
      if (factor == null) addIssue(r, `ligne ${line} : unité des dimensions « mm », « cm » ou « m » attendue`, "REJECTED");
      for (const [c, v] of [["dim_a", dimA], ["largeur_max", wMax]] as const) {
        if (v == null) addIssue(r, `ligne ${line} : ${c} vide (ligne de grille)`, "REJECTED");
        else if (Number.isNaN(v)) addIssue(r, `ligne ${line} : ${c} illisible`, "REJECTED");
        else if (v < DIM_MIN_MM || v > DIM_MAX_MM) addIssue(r, `ligne ${line} : ${c} hors plage plausible (${DIM_MIN_MM}–${DIM_MAX_MM} mm) : unité à vérifier`, "REJECTED");
      }
      if (r.widthMinMm != null && r.widthMaxMm != null && r.widthMinMm > r.widthMaxMm) addIssue(r, `ligne ${line} : largeur_min supérieure à largeur_max`, "REJECTED");
    }
    for (const c of ["valide_du", "valide_au"] as const) if (get(c) && !parseDate(get(c))) addIssue(r, `ligne ${line} : date ${c} illisible (JJ/MM/AAAA ou AAAA-MM-JJ)`, "REJECTED");
    if (r.currency) declared.currency.add(r.currency);
    if (tax === "HT" || tax === "TTC") declared.tax.add(tax);
    if (get("valide_du")) declared.validFrom.add(get("valide_du"));
    if (get("valide_au")) declared.validTo.add(get("valide_au"));
    if (get("source_document")) declared.documents.add(get("source_document"));
    rows.push(r);
  });
  const notes: string[] = [];
  if (unknownHeaders.length) notes.push(`Colonnes ignorées (hors format) : ${unknownHeaders.join(", ")}.`);
  if (declared.currency.size > 1) { notes.push("Plusieurs devises dans le fichier : aucune conversion n'est faite ; chaque grille doit être d'une seule devise."); for (const r of rows) addIssue(r, "fichier à devises multiples"); }
  if (declared.tax.size > 1) { notes.push("Montants HT et TTC mélangés dans le fichier."); for (const r of rows) addIssue(r, "fichier mélangeant HT et TTC"); }
  if (declared.validFrom.size > 1 || declared.validTo.size > 1) notes.push("Plusieurs périodes de validité dans le fichier : la période se règle par grille dans l'administration.");
  const currency = declared.currency.size === 1 ? [...declared.currency][0]! : null;
  const taxBasis = declared.tax.size === 1 ? ([...declared.tax][0] as "HT" | "TTC") : null;
  return {
    type: "normalized",
    fileName: opts.fileName,
    sourceKey: opts.sourceKey ?? `normalise-${slugify(base)}`,
    label: `${base} (format normalisé)`,
    families: [...new Set(rows.map((r) => r.familySlug))],
    currency,
    currencyNote: currency ? `Devise déclarée dans le fichier : ${currency} (aucune conversion).` : "Devise non uniforme ou absente : à établir.",
    natureNote: `Natures déclarées : ${[...new Set(rows.map((r) => r.amountRole))].join(", ")} — validées par l'administrateur à l'import (paramètres de colonne).`,
    taxBasis,
    validity: { from: declared.validFrom.size === 1 ? parseDate([...declared.validFrom][0]!) : null, to: declared.validTo.size === 1 ? parseDate([...declared.validTo][0]!) : null },
    documents: [...declared.documents],
    rows,
    notes,
  };
}

/** Rapprochement par référence fournisseur (comparaison sans espaces, tirets ni casse). */
export function productMatcher(table: ReadonlyArray<{ slug: string; supplierRef: string }>): (ref: string) => string | null {
  const map = new Map(table.map((t) => [compact(t.supplierRef), t.slug]));
  return (ref) => map.get(compact(ref)) ?? null;
}
