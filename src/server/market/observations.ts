/**
 * Relevés de prix concurrents : saisie, correction, archivage (historique complet dans MarketObservationRevision) et
 * import de fichiers de relevés (CSV de l'export, JSON). Aucune de ces opérations ne touche une grille ni un prix public.
 */
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { csvLine } from "@/domain/acquisition";
import { SCOPE_KEYS, type Observation, type Scope } from "@/domain/market";
import type { Actor } from "@/server/tariffs/grids";
import { MarketError } from "./policy";

const scopeItem = z.object({ status: z.enum(["included", "extra", "absent", "unknown"]), extraAmountMinor: z.number().int().min(0).max(100_000_000).nullable().optional(), note: z.string().max(500).optional() });
const optInt = z.number().int().min(0).max(100_000_000).nullable();

export const observationSchema = z.object({
  retailer: z.string().trim().min(1).max(120),
  manufacturer: z.string().trim().max(120).default(""),
  model: z.string().trim().min(1).max(200),
  url: z.string().trim().max(1000).refine((u) => /^https?:\/\/[^\s]+$/i.test(u), "URL http(s) attendue"),
  observedAt: z.coerce.date(),
  country: z.string().trim().regex(/^[A-Z]{2}$/, "Pays : code ISO à deux lettres"),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, "Devise : code ISO à trois lettres"),
  familySlug: z.string().trim().regex(/^[a-z0-9-]{2,64}$/),
  widthMm: z.number().int().min(100).max(100_000).nullable(),
  depthMm: z.number().int().min(100).max(100_000).nullable(),
  heightMm: z.number().int().min(100).max(100_000).nullable(),
  mounting: z.enum(["freestanding", "wall", "unknown"]),
  roofType: z.string().max(300).default(""),
  control: z.string().max(300).default(""),
  options: z.string().max(1000).default(""),
  priceMinor: z.number().int().min(1).max(100_000_000),
  taxBasis: z.enum(["HT", "TTC", "UNKNOWN"]),
  priceKind: z.enum(["configured", "fixed_size", "from"]),
  regularPriceMinor: optInt,
  promoPriceMinor: optInt,
  promoEnd: z.coerce.date().nullable(),
  scope: z.partialRecord(z.enum(SCOPE_KEYS), scopeItem).default({}),
  warranty: z.string().max(1000).default(""),
  material: z.string().max(500).default(""),
  blades: z.string().max(500).default(""),
  resistance: z.string().max(500).default(""),
  sav: z.string().max(500).default(""),
  comparability: z.enum(["STRONG", "PARTIAL", "INSUFFICIENT"]),
  comparabilityReason: z.string().max(2000).default(""),
  evidence: z.string().max(4000).default(""),
  access: z.string().max(500).default(""),
  notes: z.string().max(4000).default(""),
});
export type ObservationInput = z.infer<typeof observationSchema>;

const FIELDS = Object.keys(observationSchema.shape) as (keyof ObservationInput)[];
const snapshot = (o: Record<string, unknown>) => Object.fromEntries(FIELDS.map((k) => [k, o[k] instanceof Date ? (o[k] as Date).toISOString() : o[k] ?? null]).concat([["status", o.status ?? "ACTIVE"]]));

export interface ObservationFilters { familySlug?: string; country?: string; comparability?: string; from?: Date | null; to?: Date | null; status?: "ACTIVE" | "ARCHIVED" | "ALL"; retailer?: string }

export async function listObservations(f: ObservationFilters = {}) {
  return prisma.marketObservation.findMany({
    where: {
      ...(f.familySlug ? { familySlug: f.familySlug } : {}), ...(f.country ? { country: f.country } : {}),
      ...(f.comparability ? { comparability: f.comparability as "STRONG" } : {}), ...(f.retailer ? { retailer: { contains: f.retailer, mode: "insensitive" as const } } : {}),
      ...(f.status === "ALL" ? {} : { status: f.status ?? "ACTIVE" }),
      ...(f.from || f.to ? { observedAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}),
    },
    orderBy: [{ familySlug: "asc" }, { observedAt: "desc" }, { retailer: "asc" }],
  });
}

export type ObservationRow = Awaited<ReturnType<typeof listObservations>>[number];

export function toDomain(o: ObservationRow): Observation {
  return {
    id: o.id, retailer: o.retailer, manufacturer: o.manufacturer, model: o.model, url: o.url, observedAt: o.observedAt, country: o.country, currency: o.currency, familySlug: o.familySlug,
    widthMm: o.widthMm, depthMm: o.depthMm, mounting: (["freestanding", "wall"].includes(o.mounting) ? o.mounting : "unknown") as Observation["mounting"],
    priceMinor: o.priceMinor, taxBasis: o.taxBasis, priceKind: (["configured", "fixed_size", "from"].includes(o.priceKind) ? o.priceKind : "from") as Observation["priceKind"],
    regularPriceMinor: o.regularPriceMinor, promoPriceMinor: o.promoPriceMinor, promoEnd: o.promoEnd, scope: (o.scope ?? {}) as Scope, comparability: o.comparability, status: o.status,
  };
}

export async function observationDetail(id: string) {
  const o = await prisma.marketObservation.findUnique({ where: { id }, include: { revisions: { orderBy: { revision: "desc" } } } });
  if (!o) throw new MarketError("Relevé introuvable.");
  return o;
}

function parse(input: unknown): ObservationInput {
  const r = observationSchema.safeParse(input);
  if (!r.success) throw new MarketError(r.error.issues.slice(0, 4).map((i) => `${i.path.join(".") || "relevé"} : ${i.message}`).join(" · "));
  if (r.data.promoPriceMinor != null && r.data.regularPriceMinor != null && r.data.promoPriceMinor >= r.data.regularPriceMinor) throw new MarketError("Le prix promotionnel doit être inférieur au prix normal.");
  return r.data;
}

const data = (d: ObservationInput) => ({ ...d, scope: d.scope as Prisma.InputJsonValue });

export async function createObservation(input: unknown, actor: Actor, source = "manual", reason = "") {
  const d = parse(input);
  const o = await prisma.$transaction(async (tx) => {
    const created = await tx.marketObservation.create({ data: { ...data(d), source, createdBy: actor.actorEmail ?? null, updatedBy: actor.actorEmail ?? null } });
    await tx.marketObservationRevision.create({ data: { observationId: created.id, revision: 1, action: "create", data: snapshot(created) as Prisma.InputJsonValue, reason, actorEmail: actor.actorEmail ?? null } });
    return created;
  });
  await audit({ ...actor, action: "market.observation.create", entity: "MarketObservation", entityId: o.id, after: { retailer: o.retailer, familySlug: o.familySlug, source } });
  return o;
}

/** Correction : verrou optimiste sur la révision ; l'état précédent reste dans l'historique. */
export async function updateObservation(id: string, revision: number, input: unknown, reason: string, actor: Actor) {
  const d = parse(input);
  if (!reason.trim()) throw new MarketError("Indiquez le motif de la correction.");
  const o = await prisma.$transaction(async (tx) => {
    const r = await tx.marketObservation.updateMany({ where: { id, revision }, data: { ...data(d), revision: { increment: 1 }, updatedBy: actor.actorEmail ?? null } });
    if (r.count !== 1) throw new MarketError("Ce relevé a été modifié entre-temps. Rechargez la page.");
    const now = await tx.marketObservation.findUniqueOrThrow({ where: { id } });
    await tx.marketObservationRevision.create({ data: { observationId: id, revision: now.revision, action: "update", data: snapshot(now) as Prisma.InputJsonValue, reason: reason.slice(0, 1000), actorEmail: actor.actorEmail ?? null } });
    return now;
  });
  await audit({ ...actor, action: "market.observation.update", entity: "MarketObservation", entityId: id, after: { revision: o.revision } });
  return o;
}

export async function setObservationStatus(id: string, revision: number, status: "ACTIVE" | "ARCHIVED", reason: string, actor: Actor) {
  const o = await prisma.$transaction(async (tx) => {
    const r = await tx.marketObservation.updateMany({ where: { id, revision }, data: { status, revision: { increment: 1 }, updatedBy: actor.actorEmail ?? null, archivedAt: status === "ARCHIVED" ? new Date() : null, archivedBy: status === "ARCHIVED" ? actor.actorEmail ?? null : null } });
    if (r.count !== 1) throw new MarketError("Ce relevé a été modifié entre-temps. Rechargez la page.");
    const now = await tx.marketObservation.findUniqueOrThrow({ where: { id } });
    await tx.marketObservationRevision.create({ data: { observationId: id, revision: now.revision, action: status === "ARCHIVED" ? "archive" : "restore", data: snapshot(now) as Prisma.InputJsonValue, reason: reason.slice(0, 1000), actorEmail: actor.actorEmail ?? null } });
    return now;
  });
  await audit({ ...actor, action: status === "ARCHIVED" ? "market.observation.archive" : "market.observation.restore", entity: "MarketObservation", entityId: id, after: { revision: o.revision } });
  return o;
}

/* ------------------------------------------------------------------ */
/* Import et export (CSV interne)                                        */
/* ------------------------------------------------------------------ */

const SCALAR = FIELDS.filter((k) => k !== "scope");
export const CSV_HEADER = ["id", "statut", "revision", ...SCALAR, ...SCOPE_KEYS.flatMap((k) => [`scope_${k}`, `scope_${k}_montant`, `scope_${k}_note`])];

const minorToStr = (m: number | null | undefined) => (m == null ? "" : (m / 100).toFixed(2));

export function observationCsvRow(o: ObservationRow): string {
  const scope = (o.scope ?? {}) as Scope;
  const cell = (k: keyof ObservationInput) => {
    const v = (o as unknown as Record<string, unknown>)[k];
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (/Minor$/.test(k)) return minorToStr(v as number | null);
    return v == null ? "" : (v as string | number);
  };
  return csvLine([o.id, o.status, o.revision, ...SCALAR.map(cell), ...SCOPE_KEYS.flatMap((k) => [scope[k]?.status ?? "unknown", minorToStr(scope[k]?.extraAmountMinor), scope[k]?.note ?? ""])]);
}

/** Lecture d'un CSV « ; » (format de l'export), guillemets doublés. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (q) { if (c === '"' && s[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; continue; }
    if (c === '"') q = true;
    else if (c === ";") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cur); if (row.some((x) => x !== "")) rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

const euroToMinor = (s: string): number | null => {
  const t = s.replace(/[\s €]/g, "").replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) throw new MarketError(`Montant invalide : ${s.slice(0, 20)}`);
  return Math.round(Number(t) * 100);
};

/** Ligne CSV → saisie d'un relevé (montants en euros, dates AAAA-MM-JJ). */
export function csvRecord(header: string[], cells: string[]): { id: string | null; input: Record<string, unknown> } {
  const get = (k: string) => (cells[header.indexOf(k)] ?? "").replace(/^'(?=[=+\-@])/, "").trim();
  const input: Record<string, unknown> = {};
  for (const k of SCALAR) {
    const v = get(k);
    if (/Minor$/.test(k)) input[k] = euroToMinor(v);
    else if (/Mm$/.test(k)) input[k] = v === "" ? null : Number(v);
    else if (k === "promoEnd") input[k] = v === "" ? null : v;
    else input[k] = v;
  }
  const scope: Scope = {};
  for (const k of SCOPE_KEYS) {
    const st = get(`scope_${k}`) || "unknown";
    scope[k] = { status: st as "unknown", extraAmountMinor: euroToMinor(get(`scope_${k}_montant`)), ...(get(`scope_${k}_note`) ? { note: get(`scope_${k}_note`) } : {}) };
  }
  input.scope = scope;
  return { id: get("id") || null, input };
}

/** Clé d'un relevé (import idempotent) : même offre, même configuration, même date, même prix. */
export const observationKey = (o: { retailer: string; url: string; widthMm: number | null; depthMm: number | null; mounting: string; observedAt: Date; priceMinor: number; model: string }) =>
  [o.retailer.trim().toLowerCase(), o.url.trim(), o.model.trim().toLowerCase(), o.widthMm ?? "", o.depthMm ?? "", o.mounting, o.observedAt.toISOString().slice(0, 10), o.priceMinor].join("|");

export interface ImportReport { created: number; unchanged: number; rejected: { line: number; error: string }[] }

/** Import de relevés : chaque relevé nouveau est créé (historique « create ») ; un relevé identique n'est pas dupliqué. */
export async function importObservations(records: Array<{ line: number; input: unknown }>, source: string, actor: Actor, opts: { dryRun?: boolean } = {}): Promise<ImportReport> {
  const existing = new Set((await prisma.marketObservation.findMany({ select: { retailer: true, url: true, widthMm: true, depthMm: true, mounting: true, observedAt: true, priceMinor: true, model: true } })).map(observationKey));
  const report: ImportReport = { created: 0, unchanged: 0, rejected: [] };
  for (const r of records) {
    let d: ObservationInput;
    try { d = parse(r.input); } catch (e) { report.rejected.push({ line: r.line, error: (e as Error).message }); continue; }
    const key = observationKey(d);
    if (existing.has(key)) { report.unchanged++; continue; }
    existing.add(key);
    if (!opts.dryRun) await createObservation(d, actor, source, `import ${source}`);
    report.created++;
  }
  return report;
}
