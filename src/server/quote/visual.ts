import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { buildSceneModel, representedItems, VISUAL_DISCLAIMER } from "@/domain/scene-model";
import type { CatalogSnapshot, ConfigurationInput, EvaluationResult, Layout } from "@/domain/types";
import { mediaDir } from "@/server/media/storage";

/**
 * Visualisation jointe à un devis.
 * - l'image reçue du navigateur n'est jamais stockée telle quelle : signature binaire, poids et
 *   dimensions vérifiés, puis ré-encodage par sharp (métadonnées supprimées) ;
 * - stockage privé (sous-répertoire `quotes/` jamais servi par /api/media), lecture via les routes
 *   de devis contrôlées (propriétaire ou administration) ;
 * - créée une seule fois à la création du devis : une modification ultérieure du projet ne la remplace pas ;
 * - si l'image manque ou est refusée, un plan 2D est dessiné depuis le layout ; à défaut, rien (le PDF l'indique).
 */
export const MAX_VISUAL_BYTES = 2 * 1024 * 1024;
export const MAX_VISUAL_DIM = 4096;
export const MIN_VISUAL_DIM = 64;

export type VisualMime = "image/png" | "image/jpeg";
export type DecodedVisual = { ok: true; buf: Buffer; mime: VisualMime; width: number; height: number } | { ok: false; reason: string };

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);

function sniff(buf: Buffer): VisualMime | null {
  if (buf.subarray(0, 8).equals(PNG_SIG)) return "image/png";
  if (buf.subarray(0, 3).equals(JPEG_SIG)) return "image/jpeg";
  return null;
}

/** Décode et vérifie un dataURL d'image ; renvoie l'image ré-encodée (sans métadonnées). */
export async function decodeVisual(dataUrl: unknown): Promise<DecodedVisual> {
  if (typeof dataUrl !== "string" || !dataUrl) return { ok: false, reason: "absente" };
  if (dataUrl.length > Math.ceil((MAX_VISUAL_BYTES * 4) / 3) + 64) return { ok: false, reason: "trop lourde" };
  const m = /^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m) return { ok: false, reason: "format non accepté (PNG ou JPEG attendu)" };
  const declared = m[1] as VisualMime;
  const raw = Buffer.from(m[2]!, "base64");
  if (raw.length > MAX_VISUAL_BYTES) return { ok: false, reason: "trop lourde" };
  const real = sniff(raw);
  if (!real || real !== declared) return { ok: false, reason: "signature binaire invalide" };
  try {
    const meta = await sharp(raw, { limitInputPixels: MAX_VISUAL_DIM * MAX_VISUAL_DIM, failOn: "error" }).metadata();
    const fmt = meta.format === "png" ? "image/png" : meta.format === "jpeg" ? "image/jpeg" : null;
    if (fmt !== real) return { ok: false, reason: "contenu incohérent" };
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width > MAX_VISUAL_DIM || height > MAX_VISUAL_DIM) return { ok: false, reason: "dimensions trop grandes" };
    if (width < MIN_VISUAL_DIM || height < MIN_VISUAL_DIM) return { ok: false, reason: "dimensions trop petites" };
    const pipeline = sharp(raw, { limitInputPixels: MAX_VISUAL_DIM * MAX_VISUAL_DIM });
    const buf = real === "image/png" ? await pipeline.png({ compressionLevel: 9 }).toBuffer() : await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    return { ok: true, buf, mime: real, width, height };
  } catch {
    return { ok: false, reason: "image illisible" };
  }
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object).filter((k) => (value as Record<string, unknown>)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Empreinte canonique d'une configuration (ordre des clés indifférent). */
export function inputHash(input: unknown): string {
  return createHash("sha256").update(stable(input)).digest("hex");
}

const KEY_RE = /^quotes\/[a-f0-9]{32}\.(png|jpg)$/;

function quoteVisualDir() {
  return path.join(mediaDir(), "quotes");
}

export function resolveQuoteVisual(storageKey: string): string | null {
  if (!KEY_RE.test(storageKey)) return null;
  const full = path.resolve(mediaDir(), storageKey);
  if (path.dirname(full) !== path.resolve(quoteVisualDir())) return null;
  return full;
}

async function storeQuoteVisual(buf: Buffer, mime: VisualMime): Promise<string> {
  await mkdir(quoteVisualDir(), { recursive: true });
  const key = `quotes/${randomBytes(16).toString("hex")}.${mime === "image/png" ? "png" : "jpg"}`;
  await writeFile(resolveQuoteVisual(key)!, buf, { flag: "wx" });
  return key;
}

export async function readQuoteVisual(storageKey: string): Promise<Buffer | null> {
  const full = resolveQuoteVisual(storageKey);
  if (!full) return null;
  return readFile(full).catch(() => null);
}

const CLOSURE_COLOR: Record<string, string> = { glass: "#7fb3d5", slats: "#8a6d4b", screen: "#9a9a94" };

/** Plan 2D (vue de dessus) dessiné depuis le layout, sans texte (la légende figure dans le PDF). */
export async function planPng(layout: Layout, closures: Record<string, string>, structure = "#3a3d41"): Promise<{ buf: Buffer; width: number; height: number }> {
  const W = 1200;
  const H = 800;
  const pad = 90;
  const scale = Math.min((W - pad * 2) / layout.lengthMm, (H - pad * 2) / layout.widthMm);
  const w = layout.lengthMm * scale;
  const h = layout.widthMm * scale;
  const x0 = (W - w) / 2;
  const y0 = (H - h) / 2;
  const parts: string[] = [`<rect width="${W}" height="${H}" fill="#faf8f4"/>`, `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#efe9df" stroke="${structure}" stroke-width="4"/>`];
  const ends = (key: string): [number, number, number, number] => {
    switch (key) {
      case "back": return [x0, y0, x0 + w, y0];
      case "front": return [x0, y0 + h, x0 + w, y0 + h];
      case "left": return [x0, y0, x0, y0 + h];
      default: return [x0 + w, y0, x0 + w, y0 + h];
    }
  };
  for (const side of layout.sides) {
    const [ax, ay, bx, by] = ends(side.key);
    if (side.isWall) {
      parts.push(`<rect x="${x0 - 20}" y="${y0 - 34}" width="${w + 40}" height="22" fill="#b9b2a6"/>`);
      continue;
    }
    let acc = 0;
    for (const seg of side.segments) {
      const t0 = acc / side.lengthMm;
      acc += seg.lengthMm;
      const t1 = acc / side.lengthMm;
      const sx = ax + (bx - ax) * t0, sy = ay + (by - ay) * t0, ex = ax + (bx - ax) * t1, ey = ay + (by - ay) * t1;
      const c = closures[seg.id];
      parts.push(c ? `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${CLOSURE_COLOR[c] ?? "#9a9a94"}" stroke-width="14"/>` : `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#c9bca6" stroke-width="4" stroke-dasharray="12 10"/>`);
      if (seg.hasDividerPost) parts.push(`<rect x="${ex - 12}" y="${ey - 12}" width="24" height="24" fill="${structure}"/>`);
    }
  }
  const corners: Array<[number, number]> = layout.mounting === "wall" ? [[x0, y0 + h], [x0 + w, y0 + h]] : [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]];
  for (const [cx, cy] of corners) parts.push(`<rect x="${cx - 14}" y="${cy - 14}" width="28" height="28" fill="${structure}"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
  const buf = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  return { buf, width: W, height: H };
}

export type AttachedVisual = "SCENE_3D" | "PLAN_2D" | "NONE";

/**
 * Crée (une seule fois) la visualisation d'un devis. Ne lève jamais : un échec n'empêche pas le devis.
 * `configurationVersion` n'est renseignée que si la configuration enregistrée correspond exactement
 * à l'entrée du devis (même empreinte).
 */
export async function attachQuoteVisual(opts: { quoteId: string; dataUrl?: unknown; input: ConfigurationInput | null; result: EvaluationResult | null; catalog: CatalogSnapshot; configurationId?: string | null }): Promise<{ kind: AttachedVisual; reason?: string }> {
  const { quoteId, input, result, catalog } = opts;
  if (!input) return { kind: "NONE", reason: "aucune configuration" };
  try {
    const existing = await prisma.quoteVisual.count({ where: { quoteId } });
    if (existing > 0) return { kind: "NONE", reason: "déjà jointe" };
    const model = buildSceneModel(catalog, input, result);
    const represented = model ? representedItems(catalog, model) : [];
    const hash = inputHash(input);
    let configurationId: string | null = null;
    let configurationVersion: number | null = null;
    if (opts.configurationId) {
      const cfg = await prisma.configuration.findUnique({ where: { id: opts.configurationId }, select: { id: true, version: true, input: true } });
      if (cfg) {
        configurationId = cfg.id;
        configurationVersion = inputHash(cfg.input) === hash ? cfg.version : null;
      }
    }
    const base = { quoteId, configurationId, configurationVersion, inputHash: hash, represented: represented as never, disclaimer: VISUAL_DISCLAIMER };

    let refused: string | undefined;
    if (opts.dataUrl && model) {
      const d = await decodeVisual(opts.dataUrl);
      if (d.ok) {
        const storageKey = await storeQuoteVisual(d.buf, d.mime);
        await prisma.quoteVisual.create({ data: { ...base, kind: "SCENE_3D", storageKey, mime: d.mime, bytes: d.buf.length, width: d.width, height: d.height } });
        return { kind: "SCENE_3D" };
      }
      refused = d.reason;
    }
    const layout = result?.layout;
    if (layout && (input.kind === "pergola_standard" || input.kind === "pergola_custom")) {
      const closures: Record<string, string> = {};
      if (model?.kind === "pergola") for (const c of model.closures) closures[c.id] = c.type;
      const plan = await planPng(layout, closures, model?.kind === "pergola" ? model.colors.structure : undefined);
      const storageKey = await storeQuoteVisual(plan.buf, "image/png");
      await prisma.quoteVisual.create({ data: { ...base, kind: "PLAN_2D", storageKey, mime: "image/png", bytes: plan.buf.length, width: plan.width, height: plan.height } });
      return { kind: "PLAN_2D", reason: refused };
    }
    return { kind: "NONE", reason: refused ?? "aucune géométrie représentable" };
  } catch (e) {
    console.error("[quote-visual] échec de la visualisation du devis", quoteId, (e as Error).message);
    return { kind: "NONE", reason: "erreur" };
  }
}

export type QuoteViewer = { userId: string | null; role?: string | null } | null;

/** Le visuel et le PDF d'un devis sont réservés à son titulaire connecté et à l'administration. */
export async function quoteForViewer(quoteId: string, viewer: QuoteViewer) {
  if (!viewer?.userId) return null;
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { visuals: { orderBy: { createdAt: "asc" } } } });
  if (!quote) return null;
  const staff = viewer.role === "ADMIN" || viewer.role === "MANAGER";
  if (!staff && quote.userId !== viewer.userId) return null;
  return quote;
}

/** Légende textuelle du plan 2D (le PNG n'a pas de texte). */
export const PLAN_LEGEND = "Plan 2D vu de dessus (indicatif) : carrés foncés = poteaux ; bande grise = mur ; trait bleu = paroi vitrée ; trait brun = persienne ; trait gris = store ZIP ; pointillés = côté ouvert.";

