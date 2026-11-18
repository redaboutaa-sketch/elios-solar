/**
 * Import de grille tarifaire sur mesure (JSON complet ou CSV de cellules + en-tête de métadonnées).
 * Validation des unités (mm, centimes), doublons, chevauchements contradictoires et zones sans tarif
 * via le moteur pur `validateGrid`. Une grille importée est créée en BROUILLON (nouvelle version) :
 * elle se teste avant publication et n'écrase jamais une version existante.
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateGrid, type GridValidation } from "@/domain/pricing-grid";
import type { PriceGridSnapshot } from "@/domain/types";
import { parseCsv } from "@/server/catalog/import";

const int = (min: number, max: number) => z.preprocess((v) => (typeof v === "string" ? Number(v.replace(/\s/g, "")) : v), z.number().int().min(min).max(max));
const mmAxis = z.object({ min: int(1, 100_000), max: int(1, 100_000), step: int(1, 10_000) });

export const gridFileSchema = z.object({
  familySlug: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2).max(120),
  unit: z.literal("mm", { error: "unité attendue : mm" }).default("mm"),
  currency: z.literal("EUR").default("EUR"),
  priceUnit: z.enum(["cents", "euros"]).default("cents"),
  validFrom: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  validTo: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  isDemo: z.boolean().default(false),
  dataStatus: z.enum(["DEMO", "SUPPLIER_VERIFIED", "OBSERVED", "UNKNOWN"]).default("UNKNOWN"),
  source: z.string().trim().min(2, "source obligatoire (fournisseur, document, date)").max(300),
  widthMm: mmAxis, lengthMm: mmAxis, heightMm: mmAxis,
  mountings: z.array(z.enum(["freestanding", "wall"])).default([]),
  finishCodes: z.array(z.string().trim().min(1).max(40)).default([]),
  cells: z.array(z.object({ widthMinMm: int(1, 100_000), widthMaxMm: int(1, 100_000), lengthMinMm: int(1, 100_000), lengthMaxMm: int(1, 100_000), mounting: z.enum(["*", "freestanding", "wall"]).default("*"), finishCode: z.string().trim().min(1).max(40).default("*"), price: z.preprocess((v) => (typeof v === "string" ? Number(v.replace(",", ".").replace(/\s/g, "")) : v), z.number().positive()) })).min(1).max(20_000),
  surcharges: z.array(z.object({ code: z.string().trim().min(1).max(60), label: z.string().trim().min(1).max(200), kind: z.enum(["finish", "mounting", "height_above", "side_closure", "option", "percent"]), match: z.string().trim().max(80).default("*"), thresholdMm: int(0, 100_000).nullable().optional(), perStepMm: int(1, 10_000).nullable().optional(), perStep: z.number().nullable().optional(), price: z.number().default(0), percentBps: int(-5000, 10_000).default(0) })).default([]),
});
export type GridFile = z.infer<typeof gridFileSchema>;

/** CSV : lignes `#clé=valeur` pour les métadonnées puis en-tête widthMinMm,widthMaxMm,lengthMinMm,lengthMaxMm,mounting,finishCode,price */
function csvToObject(text: string): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  const body: string[] = [];
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const m = /^#\s*([a-zA-Z]+)\s*=\s*(.*)$/.exec(line);
    if (m) meta[m[1]!] = m[2]!.trim();
    else if (line.trim()) body.push(line);
  }
  const rows = parseCsv(body.join("\n"));
  const header = rows[0]?.map((h) => h.trim()) ?? [];
  for (const c of ["widthMinMm", "widthMaxMm", "lengthMinMm", "lengthMaxMm", "price"]) if (!header.includes(c)) throw new Error(`Colonne manquante : ${c}`);
  const axis = (k: string) => ({ min: meta[`${k}Min`], max: meta[`${k}Max`], step: meta[`${k}Step`] ?? 10 });
  const list = (k: string) => (typeof meta[k] === "string" && meta[k] ? String(meta[k]).split("|").map((s) => s.trim()) : []);
  return {
    familySlug: meta.familySlug, name: meta.name, unit: meta.unit ?? "mm", currency: meta.currency ?? "EUR", priceUnit: meta.priceUnit ?? "cents",
    validFrom: meta.validFrom || null, validTo: meta.validTo || null, isDemo: meta.isDemo === "true", dataStatus: meta.dataStatus ?? "UNKNOWN", source: meta.source,
    widthMm: axis("width"), lengthMm: axis("length"), heightMm: axis("height"), mountings: list("mountings"), finishCodes: list("finishCodes"),
    cells: rows.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] === "" ? undefined : cells[i]]))),
  };
}

export function toSnapshot(f: GridFile, id = "preview", version = 0, status: PriceGridSnapshot["status"] = "draft"): PriceGridSnapshot {
  const toCents = (p: number) => (f.priceUnit === "euros" ? Math.round(p * 100) : Math.round(p));
  return {
    id, familySlug: f.familySlug, name: f.name, version, status, mode: "table",
    validFrom: f.validFrom ? new Date(f.validFrom).toISOString() : null, validTo: f.validTo ? new Date(f.validTo).toISOString() : null,
    dataStatus: f.dataStatus.toLowerCase() as PriceGridSnapshot["dataStatus"], isDemo: f.isDemo,
    widthMm: f.widthMm, lengthMm: f.lengthMm, heightMm: f.heightMm, mountings: f.mountings, finishCodes: f.finishCodes,
    cells: f.cells.map((c) => ({ widthMinMm: c.widthMinMm, widthMaxMm: c.widthMaxMm, lengthMinMm: c.lengthMinMm, lengthMaxMm: c.lengthMaxMm, mounting: c.mounting, finishCode: c.finishCode, priceCents: toCents(c.price) })),
    surcharges: f.surcharges.map((s) => ({ code: s.code, label: s.label, kind: s.kind, match: s.match, thresholdMm: s.thresholdMm ?? null, perStepMm: s.perStepMm ?? null, perStepCents: s.perStep != null ? toCents(s.perStep) : null, priceCents: toCents(s.price), percentBps: s.percentBps })),
  };
}

export function parseGridFile(filename: string, text: string): { file: GridFile; snapshot: PriceGridSnapshot; validation: GridValidation } | { error: string } {
  let raw: unknown;
  try {
    raw = /\.json$/i.test(filename) || text.trim().startsWith("{") ? JSON.parse(text) : csvToObject(text);
  } catch (e) {
    return { error: `Fichier illisible : ${(e as Error).message}` };
  }
  const p = gridFileSchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues.slice(0, 8).map((i) => `${i.path.join(".")} : ${i.message}`).join(" ; ") };
  const snapshot = toSnapshot(p.data);
  return { file: p.data, snapshot, validation: validateGrid(snapshot) };
}

/** Crée une nouvelle version BROUILLON (les cellules sont stockées en centimes). */
export async function createDraftGrid(f: GridFile, filename: string, createdBy: string | null) {
  const last = await prisma.priceGrid.findFirst({ where: { familySlug: f.familySlug }, orderBy: { version: "desc" }, select: { version: true } });
  const snap = toSnapshot(f);
  return prisma.priceGrid.create({
    data: {
      familySlug: f.familySlug, name: f.name, version: (last?.version ?? 0) + 1, status: "DRAFT", mode: "TABLE", unit: "mm", currency: "EUR",
      validFrom: snap.validFrom ? new Date(snap.validFrom) : null, validTo: snap.validTo ? new Date(snap.validTo) : null,
      dataStatus: f.dataStatus, isDemo: f.isDemo, source: f.source, importFilename: filename.slice(0, 200), createdBy,
      widthMinMm: f.widthMm.min, widthMaxMm: f.widthMm.max, widthStepMm: f.widthMm.step, lengthMinMm: f.lengthMm.min, lengthMaxMm: f.lengthMm.max, lengthStepMm: f.lengthMm.step,
      heightMinMm: f.heightMm.min, heightMaxMm: f.heightMm.max, heightStepMm: f.heightMm.step, mountings: f.mountings, finishCodes: f.finishCodes,
      cells: { create: snap.cells.map((c) => ({ ...c, mounting: c.mounting, finishCode: c.finishCode })) },
      surcharges: { create: snap.surcharges.map((s, i) => ({ code: s.code, label: s.label, kind: s.kind, match: s.match, thresholdMm: s.thresholdMm ?? null, perStepMm: s.perStepMm ?? null, perStepCents: s.perStepCents ?? null, priceCents: s.priceCents, percentBps: s.percentBps, sortOrder: i })) },
    },
  });
}
