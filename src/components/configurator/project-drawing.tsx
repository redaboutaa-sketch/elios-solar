"use client";
/**
 * « Visualisation de mon projet » en dessin paramétrique 2D (SVG), construite depuis le même modèle de scène que la
 * vue 3D (`buildSystemSceneModel`, lui-même issu de l'entrée évaluée par le serveur). Elle sert de vue par défaut,
 * de repli sans WebGL et d'image jointe au devis.
 *
 * Échelle : fixe pour un produit (enveloppe des dimensions documentées), pour que la géométrie change réellement de
 * taille avec les cotes ; les cotes saisies sont reportées sur le dessin. Projection : face, trois quarts (isométrie)
 * ou dessus. Les éléments mobiles (lames, toile) suivent un réglage d'affichage qui ne modifie jamais la configuration.
 */
import { forwardRef, type ReactNode } from "react";
import type { InsectSceneModel, SceneModel } from "@/domain/scene-model";

export type DrawingView = "front" | "three_quarter" | "top";
export const DRAWING_VIEWS: Array<{ id: DrawingView; label: string }> = [
  { id: "front", label: "Face" },
  { id: "three_quarter", label: "Trois quarts" },
  { id: "top", label: "Dessus" },
];

type V3 = readonly [number, number, number];
interface Prim { d: string; fill: string; stroke?: string; sw?: number; opacity?: number; depth: number; dash?: string; glow?: boolean; key?: string }
interface Label { x: number; y: number; text: string; anchor?: "start" | "middle" | "end" }

const W_BOX = 800, H_BOX = 520, PAD = 28;
const INK = "#1a201c", WALL = "#e7ebe6", WALL_LINE = "#b9c2ba", GLASS = "#cfe3ee", LED = "#f6b73c", GROUND = "#eef1ec";
const C30 = Math.cos(Math.PI / 6);

function rawProject(view: DrawingView, [x, y, z]: V3): [number, number] {
  if (view === "front") return [x, -y];
  if (view === "top") return [x, z];
  return [(x - z) * C30, (x + z) * 0.5 - y];
}
/** profondeur d'affichage : grand = devant */
function depthOf(view: DrawingView, [x, y, z]: V3): number {
  if (view === "front") return z;
  if (view === "top") return y;
  return x + z + y * 0.01;
}

/** Boîte englobante (mètres) d'un produit, pour une échelle fixe. */
interface Envelope { w: number; d: number; h: number }

class Canvas {
  prims: Prim[] = [];
  labels: Label[] = [];
  constructor(private view: DrawingView) {}
  poly(pts: readonly V3[], fill: string, o: Partial<Prim> = {}) {
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length] as [number, number, number], [0, 0, 0]);
    this.prims.push({ d: pts.map((p) => rawProject(this.view, p).join(",")).join(" "), fill, stroke: INK, sw: 1.1, depth: depthOf(this.view, c), ...o });
  }
  line(a: V3, b: V3, stroke: string, o: Partial<Prim> = {}) {
    const c: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    this.prims.push({ d: [a, b].map((p) => rawProject(this.view, p).join(",")).join(" "), fill: "none", stroke, sw: 1.2, depth: depthOf(this.view, c), ...o });
  }
  /** boîte alignée sur les axes */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, fill: string, o: Partial<Prim> = {}) {
    const f = (pts: V3[], shade: number) => this.poly(pts, shade === 0 ? fill : shadeHex(fill, shade), o);
    f([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], 0.12); // dessus
    f([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 0); // devant
    f([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], -0.12); // côté droit
    if (this.view !== "three_quarter") f([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], -0.12);
  }
  label(p: V3, text: string, anchor: Label["anchor"] = "middle") {
    const [x, y] = rawProject(this.view, p);
    this.labels.push({ x, y, text, anchor });
  }
}

function shadeHex(hex: string, k: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)));
  return `#${ch.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
}

const m = (mm: number) => mm / 1000;
const fmt = (mm: number) => `${(mm / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m`;

/** Cote : trait d'attache + valeur. */
function dimension(c: Canvas, a: V3, b: V3, off: V3, text: string) {
  const a2: V3 = [a[0] + off[0], a[1] + off[1], a[2] + off[2]];
  const b2: V3 = [b[0] + off[0], b[1] + off[1], b[2] + off[2]];
  c.line(a, a2, "#7d8580", { sw: 0.7, depth: 1e6 });
  c.line(b, b2, "#7d8580", { sw: 0.7, depth: 1e6 });
  c.line(a2, b2, "#3d6f63", { sw: 1, depth: 1e6, key: "dim" });
  c.label([(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2, (a2[2] + b2[2]) / 2], text);
}

function drawPergola(c: Canvas, s: Extract<SceneModel, { kind: "pergola" }>, view: DrawingView, blade: number) {
  const L = m(s.lengthMm), D = m(s.widthMm), H = m(s.heightMm);
  const post = s.sections ? m(s.sections.postAcrossMm) : 0.12;
  const beamH = s.sections ? m(s.sections.beamHeightMm) : 0.2;
  const col = s.colors.structure;
  if (s.wall) {
    const wallTop = H + 0.7 + (s.roof === "fabric" ? m(s.widthMm) * Math.tan((10 * Math.PI) / 180) : 0);
    c.poly([[-0.5, 0, -0.02], [L + 0.5, 0, -0.02], [L + 0.5, wallTop, -0.02], [-0.5, wallTop, -0.02]], WALL, { stroke: WALL_LINE, depth: -1e6 });
  }
  c.poly([[-0.2, 0, -0.01], [L + 0.2, 0, -0.01], [L + 0.2, 0, D + 0.2], [-0.2, 0, D + 0.2]], GROUND, { stroke: "none", depth: -1e5 });
  for (const p of s.posts) {
    const x = m(p.xMm), z = m(p.zMm);
    const x0 = Math.min(Math.max(x - post / 2, 0), L - post), z0 = Math.min(Math.max(z - post / 2, 0), D - post);
    c.box(x0, x0 + post, 0, H, z0, z0 + post, col);
  }
  // fermetures latérales (souhaits représentés)
  for (const cl of s.closures) {
    const a: V3 = [m(cl.from.xMm), 0.02, m(cl.from.zMm)], b: V3 = [m(cl.to.xMm), 0.02, m(cl.to.zMm)];
    const top = H - beamH;
    const glass = cl.type === "glass";
    c.poly([a, b, [b[0], top, b[2]], [a[0], top, a[2]]], glass ? GLASS : s.roofFabricColor ?? "#8d8f8c", { opacity: glass ? 0.55 : 0.78, stroke: shadeHex(col, 0.2), sw: 0.8 });
    if (glass) {
      const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.9));
      for (let i = 1; i < n; i += 1) {
        const t = i / n;
        c.line([a[0] + (b[0] - a[0]) * t, 0.02, a[2] + (b[2] - a[2]) * t], [a[0] + (b[0] - a[0]) * t, top, a[2] + (b[2] - a[2]) * t], shadeHex(col, 0.35), { sw: 0.8 });
      }
    }
  }
  // poutres périphériques ; toiture toile : rails inclinés du mur (haut) vers la poutre avant (pente indicative 10°)
  const fabricRoof = s.roof === "fabric";
  const rise = fabricRoof ? D * Math.tan((10 * Math.PI) / 180) : 0;
  c.box(0, L, H - beamH, H, D - post, D, col);
  if (fabricRoof) {
    for (const x0 of [0, L - post]) {
      c.poly([[x0, H + rise, 0], [x0 + post, H + rise, 0], [x0 + post, H, D], [x0, H, D]], shadeHex(col, 0.12));
      c.poly([[x0 + post, H + rise, 0], [x0 + post, H + rise - beamH, 0], [x0 + post, H - beamH, D], [x0 + post, H, D]], col);
    }
    c.box(0, L, H + rise - 0.2, H + rise + 0.05, 0, 0.25, col);
  } else {
    c.box(0, post, H - beamH, H, 0, D, col);
    c.box(L - post, L, H - beamH, H, 0, D, col);
    c.box(0, L, H - beamH, H, 0, post, col);
  }
  if (s.lighting.gutter) {
    const y = H - beamH - 0.01;
    for (const [a, b] of [[[post, y, D - post], [L - post, y, D - post]], [[post, y, post], [post, y, D - post]], [[L - post, y, post], [L - post, y, D - post]], [[post, y, post], [L - post, y, post]]] as Array<[V3, V3]>) c.line(a, b, LED, { sw: 3, glow: true, depth: depthOf(view, a) + 0.01, key: "led" });
  }
  if (s.roof === "fabric") {
    const yAt = (z: number) => H + rise * (1 - z / D) + 0.02;
    c.poly([[post, yAt(0.2), 0.2], [L - post, yAt(0.2), 0.2], [L - post, yAt(D - post), D - post], [post, yAt(D - post), D - post]], s.roofFabricColor ?? "#8d8f8c", { opacity: 0.92, sw: 0.8, key: "roof-fabric", depth: depthOf(view, [L / 2, H + rise, D / 2]) + 0.5 });
    const n = Math.max(2, Math.round(D / 0.8));
    for (let i = 1; i < n; i += 1) { const z = 0.2 + ((D - post - 0.2) * i) / n; c.line([post, yAt(z), z], [L - post, yAt(z), z], shadeHex(s.roofFabricColor ?? "#8d8f8c", -0.25), { sw: 0.6, depth: depthOf(view, [L / 2, H + rise, D / 2]) + 0.51 }); }
  } else {
    const n = s.blades.count, inner = D - 2 * post, pitch = inner / n, bw = pitch * 0.96;
    const a = (Math.min(blade, s.blades.maxAngleDeg ?? 90) * Math.PI) / 180;
    for (let i = 0; i < n; i += 1) {
      const zc = post + pitch * (i + 0.5), y = H - beamH * 0.45;
      const dz = (bw / 2) * Math.cos(a), dy = (bw / 2) * Math.sin(a);
      c.poly([[post, y + dy, zc - dz], [L - post, y + dy, zc - dz], [L - post, y - dy, zc + dz], [post, y - dy, zc + dz]], shadeHex(s.colors.blades, 0.08), { sw: 0.6, key: "blade" });
    }
  }
  if (s.lighting.spots) {
    const n = s.lighting.spots, cols = n >= 9 ? 3 : 2, rows = Math.ceil(n / cols);
    for (let r = 0; r < rows; r += 1) for (let k = 0; k < cols && r * cols + k < n; k += 1) {
      const x = post + ((L - 2 * post) * (k + 0.5)) / cols, z = post + ((D - 2 * post) * (r + 0.5)) / rows, y = H - beamH;
      c.poly([[x - 0.05, y, z - 0.05], [x + 0.05, y, z - 0.05], [x + 0.05, y, z + 0.05], [x - 0.05, y, z + 0.05]], LED, { stroke: "#b07a10", sw: 0.5, glow: true, key: "spot", depth: view === "top" ? 1e5 : depthOf(view, [x, y, z]) });
    }
  }
  // cotes : largeur devant, projection sur le côté gauche, hauteur au poteau avant droit (pas de chevauchement)
  if (view !== "top") dimension(c, [0, 0, D], [L, 0, D], [0, 0, 0.5], `largeur ${fmt(s.lengthMm)}`);
  else dimension(c, [0, H, D], [L, H, D], [0, 0, 0.45], `largeur ${fmt(s.lengthMm)}`);
  if (view !== "front") dimension(c, [0, view === "top" ? H : 0, 0], [0, view === "top" ? H : 0, D], [-0.5, 0, 0], `projection ${fmt(s.widthMm)}`);
  if (view !== "top") dimension(c, [L, 0, D], [L, H, D], [0.45, 0, 0.45], `hauteur ${fmt(s.heightMm)}`);
}

function drawScreen(c: Canvas, s: Extract<SceneModel, { kind: "screen" }>, view: DrawingView, deploy: number) {
  const Wd = m(s.widthMm), H = m(s.heightMm), cas = m(s.cassette.heightMm), rail = 0.05;
  const niche = s.mounting === "niche";
  // baie (pose) : tableau représenté au trait, sans prétendre décrire le bâtiment
  const zWall = niche ? -0.12 : -0.02;
  c.poly([[-0.45, 0, zWall], [Wd + 0.45, 0, zWall], [Wd + 0.45, H + cas + 0.5, zWall], [-0.45, H + cas + 0.5, zWall]], WALL, { stroke: WALL_LINE, depth: -1e6 });
  const bx0 = niche ? 0 : 0.08, bx1 = niche ? Wd : Wd - 0.08, by1 = niche ? H + cas : H - 0.05;
  c.poly([[bx0, 0, zWall + 0.001], [bx1, 0, zWall + 0.001], [bx1, by1, zWall + 0.001], [bx0, by1, zWall + 0.001]], GLASS, { stroke: WALL_LINE, opacity: 0.8, depth: -9e5 });
  const z0 = niche ? -0.1 : 0, z1 = z0 + m(s.cassette.widthMm);
  const drop = Math.max(0, (H - 0.02) * deploy);
  if (drop > 0.01) c.poly([[rail, H - drop, z0 + 0.04], [Wd - rail, H - drop, z0 + 0.04], [Wd - rail, H, z0 + 0.04], [rail, H, z0 + 0.04]], s.fabric.color, { opacity: 0.88, sw: 0.8, key: "fabric" });
  c.box(rail, Wd - rail, H - drop - 0.04, H - drop, z0 + 0.02, z0 + 0.06, s.cassette.color);
  c.box(0, rail, 0, H, z0, z1 * 0.6, s.guides.color);
  c.box(Wd - rail, Wd, 0, H, z0, z1 * 0.6, s.guides.color);
  c.box(0, Wd, H, H + cas, z0, z1, s.cassette.color);
  dimension(c, [0, 0, z1], [Wd, 0, z1], [0, -0.3, view === "top" ? 0.3 : 0], `largeur ${fmt(s.widthMm)}`);
  if (view !== "top") dimension(c, [Wd, 0, z1], [Wd, H + cas, z1], [0.35, 0, 0], `hauteur ${fmt(s.heightMm)}`);
}

function drawAwning(c: Canvas, s: Extract<SceneModel, { kind: "awning" }>, view: DrawingView, deploy: number) {
  const Wd = m(s.widthMm), P = m(s.projectionMm) * deploy, H = m(s.heightMm);
  const cabH = m(s.cabinet.heightMm), cabD = m(s.cabinet.depthMm);
  const tilt = ((s.tiltDeg ?? 14) * Math.PI) / 180;
  c.poly([[-0.5, 0, -0.01], [Wd + 0.5, 0, -0.01], [Wd + 0.5, H + 0.6, -0.01], [-0.5, H + 0.6, -0.01]], WALL, { stroke: WALL_LINE, depth: -1e6 });
  const yTop = H - cabH * 0.55, zTop = cabD * 0.7;
  const endZ = zTop + P * Math.cos(tilt), endY = yTop - P * Math.sin(tilt);
  if (P > 0.02) {
    c.poly([[0.04, yTop, zTop], [Wd - 0.04, yTop, zTop], [Wd - 0.04, endY, endZ], [0.04, endY, endZ]], s.fabric.color, { opacity: 0.95, sw: 0.8, key: "fabric", depth: depthOf(view, [Wd / 2, (yTop + endY) / 2, (zTop + endZ) / 2]) + 0.3 });
    c.poly([[0.04, endY, endZ], [Wd - 0.04, endY, endZ], [Wd - 0.04, endY - 0.2, endZ], [0.04, endY - 0.2, endZ]], shadeHex(s.fabric.color, -0.12), { sw: 0.8, depth: depthOf(view, [Wd / 2, endY, endZ]) + 0.31 });
    // bras (sous la toile) : épaule au coffre, coude, barre de charge
    for (let i = 0; i < s.bracketCount; i += 1) {
      const x = s.bracketCount === 1 ? Wd / 2 : 0.2 + ((Wd - 0.4) * i) / (s.bracketCount - 1);
      const elbow: V3 = [x + (i % 2 ? -0.35 : 0.35) * Math.min(1, P), (yTop + endY) / 2 - 0.08, (zTop + endZ) / 2];
      c.line([x, yTop - 0.05, zTop], elbow, shadeHex(s.cabinet.color, 0.1), { sw: 2.2, key: "arm", depth: depthOf(view, elbow) + 0.2 });
      c.line(elbow, [x, endY - 0.04, endZ], shadeHex(s.cabinet.color, 0.1), { sw: 2.2, key: "arm", depth: depthOf(view, elbow) + 0.2 });
      if (s.ledArms) c.line([x, yTop - 0.07, zTop], [x, endY - 0.06, endZ], LED, { sw: 2.4, glow: true, key: "led", depth: depthOf(view, elbow) + 0.21 });
    }
  }
  c.box(0, Wd, endY - 0.06, endY, endZ - 0.04, endZ + 0.02, s.cabinet.color, { depth: depthOf(view, [Wd / 2, endY, endZ]) + 0.32 } as Partial<Prim>);
  c.box(0, Wd, H - cabH, H, 0, cabD, s.cabinet.color);
  for (let i = 0; i < s.bracketCount; i += 1) {
    const x = s.bracketCount === 1 ? Wd / 2 : 0.2 + ((Wd - 0.4) * i) / (s.bracketCount - 1);
    c.box(x - 0.05, x + 0.05, H - cabH - 0.08, H + 0.04, 0, 0.06, shadeHex(s.cabinet.color, -0.2));
  }
  if (s.led) c.line([0.1, H - cabH - 0.01, cabD * 0.8], [Wd - 0.1, H - cabH - 0.01, cabD * 0.8], LED, { sw: 3, glow: true, key: "led", depth: 1e5 });
  if (s.anemometer) {
    c.box(Wd + 0.15, Wd + 0.3, H + 0.15, H + 0.3, 0, 0.12, "#5b5f63", { key: "sensor" } as Partial<Prim>);
    c.label([Wd + 0.22, H + 0.42, 0.06], "capteur", "middle");
  }
  dimension(c, [0, H, cabD], [Wd, H, cabD], [0, 0.35, 0], `largeur ${fmt(s.widthMm)}`);
  if (view !== "front") dimension(c, [Wd, endY, 0], [Wd, endY, endZ], [0.4, 0, 0], `avancée ${fmt(s.projectionMm)}`);
}

function drawRoof(c: Canvas, s: Extract<SceneModel, { kind: "roof_screen" }>, view: DrawingView, deploy: number) {
  const Wd = m(s.widthMm), P = m(s.projectionMm), H = m(s.heightMm);
  const t = (s.tiltDeg * Math.PI) / 180, rise = P * Math.tan(t);
  c.poly([[-0.4, 0, -0.01], [Wd + 0.4, 0, -0.01], [Wd + 0.4, H + rise + 0.7, -0.01], [-0.4, H + rise + 0.7, -0.01]], WALL, { stroke: WALL_LINE, depth: -1e6 });
  // structure porteuse (véranda / pergola) au trait léger : support du screen, non fournie
  for (const x of [0.05, Wd - 0.05]) c.line([x, 0, P], [x, H, P], WALL_LINE, { sw: 1.4, dash: "5 4" });
  c.line([0, H, P], [Wd, H, P], WALL_LINE, { sw: 1.4, dash: "5 4" });
  c.poly([[0, H + rise, 0], [Wd, H + rise, 0], [Wd, H, P], [0, H, P]], GLASS, { opacity: 0.45, stroke: WALL_LINE, sw: 0.8, dash: "5 4", depth: -5e5 });
  const lift = 0.12, d = P * deploy;
  if (d > 0.02) c.poly([[0.06, H + rise + lift, 0.1], [Wd - 0.06, H + rise + lift, 0.1], [Wd - 0.06, H + rise + lift - d * Math.tan(t), d], [0.06, H + rise + lift - d * Math.tan(t), d]], s.fabric.color, { opacity: 0.9, sw: 0.8, key: "fabric" });
  for (const x0 of [0, Wd - 0.06]) c.poly([[x0, H + rise + lift, 0], [x0 + 0.06, H + rise + lift, 0], [x0 + 0.06, H + lift, P], [x0, H + lift, P]], s.frameColor, { sw: 0.8 });
  c.box(0, Wd, H + rise + lift - 0.06, H + rise + lift + 0.12, 0, 0.18, s.frameColor);
  c.box(0.06, Wd - 0.06, H + rise + lift - d * Math.tan(t) - 0.03, H + rise + lift - d * Math.tan(t) + 0.03, d - 0.03, d + 0.03, s.frameColor);
  dimension(c, [0, H + lift, P], [Wd, H + lift, P], [0, 0, 0.4], `largeur ${fmt(s.widthMm)}`);
  if (view !== "front") dimension(c, [Wd, H + rise + lift, 0], [Wd, H + lift, P], [0.4, 0, 0], `projection ${fmt(s.projectionMm)}`);
}

function drawInsect(c: Canvas, s: InsectSceneModel, view: DrawingView, deploy: number) {
  const Wd = m(s.widthMm), H = m(s.heightMm), f = 0.035;
  const reveal = /embrasure/.test(s.mounting);
  c.poly([[-0.35, 0, -0.06], [Wd + 0.35, 0, -0.06], [Wd + 0.35, H + 0.35, -0.06], [-0.35, H + 0.35, -0.06]], WALL, { stroke: WALL_LINE, depth: -1e6 });
  c.poly([[0, 0, -0.059], [Wd, 0, -0.059], [Wd, H, -0.059], [0, H, -0.059]], GLASS, { stroke: WALL_LINE, opacity: 0.7, depth: -9e5 });
  const z = reveal ? -0.03 : 0.0;
  const mesh = (x0: number, x1: number, y0: number, y1: number, key = "mesh") => c.poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], s.meshColor, { opacity: 0.32, sw: 0.5, key });
  const frame = (x0: number, x1: number, y0: number, y1: number) => {
    c.box(x0, x1, y1 - f, y1, z, z + 0.04, s.frameColor);
    c.box(x0, x1, y0, y0 + f, z, z + 0.04, s.frameColor);
    c.box(x0, x0 + f, y0, y1, z, z + 0.04, s.frameColor);
    c.box(x1 - f, x1, y0, y1, z, z + 0.04, s.frameColor);
  };
  switch (s.opening) {
    case "roller_vertical": {
      const low = H - (H - 0.12) * deploy;
      if (deploy > 0.01) mesh(f, Wd - f, low, H - 0.1);
      c.box(0, Wd, H - 0.1, H, z, z + 0.08, s.frameColor);
      c.box(f, Wd - f, low - 0.03, low, z, z + 0.04, s.frameColor);
      c.box(0, f, 0, H - 0.1, z, z + 0.04, s.frameColor);
      c.box(Wd - f, Wd, 0, H - 0.1, z, z + 0.04, s.frameColor);
      break;
    }
    case "roller_lateral": {
      const right = 0.1 + (Wd - 0.12) * deploy;
      if (deploy > 0.01) mesh(0.1, right, f, H - f);
      c.box(0, 0.1, 0, H, z, z + 0.08, s.frameColor);
      c.box(right - 0.03, right, f, H - f, z, z + 0.04, s.frameColor);
      c.box(0, Wd, H - f, H, z, z + 0.04, s.frameColor);
      c.box(0, Wd, 0, f * 0.5, z, z + 0.02, s.frameColor);
      break;
    }
    case "pleated": {
      const leaves = s.leaves;
      frame(0, Wd, 0, H);
      const span = (Wd - 2 * f) / leaves;
      for (let k = 0; k < leaves; k += 1) {
        const from = leaves === 2 ? (k === 0 ? f : Wd - f) : f;
        const to = leaves === 2 ? (k === 0 ? f + span * deploy : Wd - f - span * deploy) : f + span * deploy;
        const [a, b] = from < to ? [from, to] : [to, from];
        if (b - a > 0.02) {
          mesh(a, b, f, H - f);
          const folds = Math.max(2, Math.round((b - a) / 0.045));
          for (let i = 1; i < folds; i += 1) c.line([a + ((b - a) * i) / folds, f, z + 0.005], [a + ((b - a) * i) / folds, H - f, z + 0.005], shadeHex(s.meshColor, 0.2), { sw: 0.4, opacity: 0.7 });
        }
        const bar = leaves === 2 ? (k === 0 ? b : a) : b;
        c.box(bar - 0.02, bar + 0.02, f, H - f, z, z + 0.05, s.frameColor);
      }
      break;
    }
    case "sliding": {
      frame(0, Wd, 0, H);
      const pw = Wd / 2 + 0.05, x0 = f + (Wd - pw - 2 * f) * (1 - deploy);
      mesh(x0, x0 + pw, f, H - f);
      c.box(x0, x0 + 0.03, f, H - f, z + 0.01, z + 0.05, s.frameColor);
      c.box(x0 + pw - 0.03, x0 + pw, f, H - f, z + 0.01, z + 0.05, s.frameColor);
      break;
    }
    case "hinged": {
      frame(0, Wd, 0, H);
      mesh(f, Wd - f, f, H - f);
      for (const y of [0.25, H - 0.25]) c.box(0, 0.05, y - 0.05, y + 0.05, z + 0.04, z + 0.07, shadeHex(s.frameColor, -0.3));
      c.box(Wd - 0.12, Wd - 0.07, H / 2 - 0.08, H / 2 + 0.08, z + 0.04, z + 0.07, shadeHex(s.frameColor, -0.3));
      break;
    }
    default:
      frame(0, Wd, 0, H);
      mesh(f, Wd - f, f, H - f);
  }
  dimension(c, [0, 0, 0.05], [Wd, 0, 0.05], [0, -0.25, view === "top" ? 0.25 : 0], `largeur ${fmt(s.widthMm)}`);
  if (view !== "top") dimension(c, [Wd, 0, 0.05], [Wd, H, 0.05], [0.3, 0, 0], `hauteur ${fmt(s.heightMm)}`);
}

/** Enveloppe de l'échelle : un produit garde la même échelle quelle que soit la cote saisie. */
export function envelopeOf(model: SceneModel, max: { widthMm: number; depthMm?: number; heightMm?: number }): Envelope {
  const w = Math.max(m(max.widthMm), m(model.widthMm));
  if (model.kind === "pergola") return { w: Math.max(w, m(model.lengthMm)), d: Math.max(m(max.depthMm ?? model.widthMm), m(model.widthMm)), h: Math.max(m(max.heightMm ?? model.heightMm), m(model.heightMm)) };
  if (model.kind === "awning") return { w, d: Math.max(m(max.depthMm ?? model.projectionMm), m(model.projectionMm)), h: m(model.heightMm) };
  if (model.kind === "roof_screen") return { w, d: Math.max(m(max.depthMm ?? model.projectionMm), m(model.projectionMm)), h: m(model.heightMm) + 0.8 };
  return { w, d: 0.3, h: Math.max(m(max.heightMm ?? model.heightMm), m(model.heightMm)) };
}

export interface ProjectDrawingProps {
  model: SceneModel;
  view: DrawingView;
  /** position des éléments mobiles (0–1) : déploiement de la toile, ouverture */
  deployment: number;
  /** angle des lames (pergola à lames), degrés */
  bladeAngle: number;
  envelope: Envelope;
  caption?: ReactNode;
}

/** Dessin SVG du projet. `ref` donne accès au SVG (export, image jointe au devis). */
export const ProjectDrawing = forwardRef<SVGSVGElement, ProjectDrawingProps>(function ProjectDrawing({ model, view, deployment, bladeAngle, envelope }, ref) {
  const c = new Canvas(view);
  if (model.kind === "pergola") drawPergola(c, model, view, bladeAngle);
  else if (model.kind === "screen") drawScreen(c, model, view, deployment);
  else if (model.kind === "awning") drawAwning(c, model, view, deployment);
  else if (model.kind === "roof_screen") drawRoof(c, model, view, deployment);
  else drawInsect(c, model, view, deployment);

  // échelle fixe : enveloppe documentée du produit (marges pour les cotes)
  const env = new Canvas(view);
  env.box(-0.45, envelope.w + 0.5, -0.3, envelope.h + 0.4, -0.1, envelope.d + 0.5, "#000");
  const pts = env.prims.flatMap((p) => p.d.split(" ").map((xy) => xy.split(",").map(Number) as [number, number]));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const ex0 = Math.min(...xs), ex1 = Math.max(...xs), ey0 = Math.min(...ys), ey1 = Math.max(...ys);
  const k = Math.min((W_BOX - 2 * PAD) / (ex1 - ex0), (H_BOX - 2 * PAD) / (ey1 - ey0));
  // centrage sur le dessin réel (la taille, elle, suit l'échelle fixe)
  const own = c.prims.filter((p) => p.depth > -9e5 || p.fill === GROUND).flatMap((p) => p.d.split(" ").map((xy) => xy.split(",").map(Number) as [number, number]));
  const ox = own.length ? (Math.min(...own.map((p) => p[0])) + Math.max(...own.map((p) => p[0]))) / 2 : (ex0 + ex1) / 2;
  const oy = own.length ? (Math.min(...own.map((p) => p[1])) + Math.max(...own.map((p) => p[1]))) / 2 : (ey0 + ey1) / 2;
  const tx = (x: number) => W_BOX / 2 + (x - ox) * k;
  const ty = (y: number) => H_BOX / 2 + (y - oy) * k;
  const toPts = (d: string) => d.split(" ").map((xy) => { const [x, y] = xy.split(",").map(Number); return `${tx(x!).toFixed(1)},${ty(y!).toFixed(1)}`; }).join(" ");
  const sorted = [...c.prims].sort((a, b) => a.depth - b.depth);
  const fabricColor = model.kind === "pergola" ? model.roofFabricColor : model.kind === "insect" ? model.meshColor : "fabric" in model ? model.fabric.color : undefined;
  const structureColor = model.kind === "pergola" ? model.colors.structure : model.kind === "awning" ? model.cabinet.color : model.kind === "screen" ? model.cassette.color : model.frameColor;
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W_BOX} ${H_BOX}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby="project-drawing-title"
      data-testid="project-drawing"
      data-kind={model.kind}
      data-view={view}
      data-width-mm={model.kind === "pergola" ? model.lengthMm : model.widthMm}
      data-depth-mm={model.kind === "pergola" ? model.widthMm : model.kind === "awning" || model.kind === "roof_screen" ? model.projectionMm : undefined}
      data-height-mm={"heightMm" in model ? model.heightMm : undefined}
      data-structure-color={structureColor}
      data-fabric-color={fabricColor}
      data-led={c.prims.some((p) => p.key === "led" || p.key === "spot") ? "on" : "off"}
      className="block h-auto w-full bg-white"
    >
      <title id="project-drawing-title">{`Dessin indicatif : ${model.familyName}, ${model.dimensionLabel}`}</title>
      <defs>
        <filter id="pd-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect x="0" y="0" width={W_BOX} height={H_BOX} fill="#fbfcfa" />
      {sorted.map((p, i) => (
        p.fill === "none"
          ? <polyline key={i} points={toPts(p.d)} fill="none" stroke={p.stroke} strokeWidth={p.sw} strokeLinecap="round" strokeDasharray={p.dash} opacity={p.opacity} filter={p.glow ? "url(#pd-glow)" : undefined} data-part={p.key} />
          : <polygon key={i} points={toPts(p.d)} fill={p.fill} fillOpacity={p.opacity} stroke={p.stroke === "none" ? undefined : p.stroke} strokeWidth={p.sw} strokeLinejoin="round" strokeDasharray={p.dash} filter={p.glow ? "url(#pd-glow)" : undefined} data-part={p.key} />
      ))}
      {c.labels.map((l, i) => (
        <text key={`l${i}`} x={tx(l.x)} y={ty(l.y) - 6} textAnchor={l.anchor} fontSize="15" fontFamily="system-ui, sans-serif" fill="#2c5a4f" paintOrder="stroke" stroke="#fbfcfa" strokeWidth="4" data-part="dimension">{l.text}</text>
      ))}
    </svg>
  );
});

/** Rasterise le dessin (PNG data URL) pour l'export et l'image jointe au devis. */
export async function drawingToPng(svg: SVGSVGElement, width = 1600): Promise<string> {
  const xml = new XMLSerializer().serializeToString(svg);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("dessin illisible"));
    i.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round((width * H_BOX) / W_BOX);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2D indisponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
