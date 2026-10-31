/**
 * Dessins d'orientation HELIOSTORES (SVG originaux) : pergola, screen, store banne et moustiquaire, dans une projection isométrique
 * commune calculée en mètres (même trait, même échelle de détail). Ils servent à choisir une famille : ce ne sont ni
 * des plans de fabrication ni des représentations contractuelles.
 *
 * Mouvement : chaque élément mobile (`sk-move`) porte deux tracés de même structure, `--off` (repos) et `--on`
 * (au survol ou au focus de `.sketch-trigger`) ; la transition de `d` est définie dans globals.css. Sans support du
 * morphing (ou avec la réduction des animations), le dessin reste dans l'état de repos.
 *
 * Variante « produit seul » (`showWall={false}`, bloc « Nos solutions » de l'accueil) : le screen et le store banne
 * sont dessinés sans la façade ni la baie du bâtiment, recadrés sur le produit (`fitProjector`).
 */
import type { CSSProperties } from "react";
import type { CategoryKey } from "@/domain/categories";

type V3 = readonly [number, number, number];
type Proj = (p: V3) => string;

/** Palette du dessin : `ink` (trait sombre sur fond clair) ou `light` (trait blanc sur photographie). */
interface Palette { /** faces translucides : les arêtes cachées sont omises */ seeThrough: boolean; ink: string; face: string; blade: string; sage: string; ground: string; glass: string; shadow: number; width: number }
const PALETTES: Record<"ink" | "light", Palette> = {
  ink: { seeThrough: false, ink: "#1a201c", face: "#fff", blade: "#c4dbd3", sage: "#8ab4a8", ground: "#e2ece5", glass: "#eef3f1", shadow: 0.06, width: 1.6 },
  light: { seeThrough: true, ink: "#fff", face: "rgb(255 255 255 / 0.06)", blade: "rgb(138 180 168 / 0.45)", sage: "rgb(138 180 168 / 0.55)", ground: "rgb(255 255 255 / 0.10)", glass: "rgb(255 255 255 / 0.08)", shadow: 0, width: 1.8 },
};

function projector(ox: number, oy: number, s: number): Proj {
  const c = Math.cos(Math.PI / 6), k = 0.5;
  const r = (v: number) => String(Math.round(v * 10) / 10);
  return ([x, y, z]) => `${r(ox + (x - z) * c * s)} ${r(oy + (x + z) * k * s - y * s)}`;
}
/** Projection qui inscrit les points donnés (les deux états d'animation compris) dans le cadre, centrés. */
function fitProjector(pts: readonly V3[], [bx0, by0, bx1, by1]: readonly [number, number, number, number]): Proj {
  const c = Math.cos(Math.PI / 6), k = 0.5;
  const us = pts.map(([x, , z]) => (x - z) * c), vs = pts.map(([x, y, z]) => (x + z) * k - y);
  const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
  const s = Math.min((bx1 - bx0) / (u1 - u0), (by1 - by0) / (v1 - v0));
  return projector((bx0 + bx1) / 2 - s * (u0 + u1) / 2, (by0 + by1) / 2 - s * (v0 + v1) / 2, s);
}
/** Coins d'une boîte, pour le recadrage. */
const corners = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): V3[] => [x0, x1].flatMap((x) => [y0, y1].flatMap((y) => [z0, z1].map((z) => [x, y, z] as V3)));
/** Cadre du produit seul dans le viewBox 400 × 300 (le soleil, ou le moustique des moustiquaires, reste en haut à droite). */
const PRODUCT_BOX = [40, 22, 330, 288] as const;
const poly = (P: Proj, pts: readonly V3[]) => `M${pts.map(P).join(" L")} Z`;
const line = (P: Proj, pts: readonly V3[]) => `M${pts.map(P).join(" L")}`;
/** Quadrilatère d'une boîte : face à x constant, y constant ou z constant. */
const faceX = (P: Proj, x: number, y0: number, y1: number, z0: number, z1: number) => poly(P, [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]]);
const faceY = (P: Proj, y: number, x0: number, x1: number, z0: number, z1: number) => poly(P, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]);
const faceZ = (P: Proj, z: number, x0: number, x1: number, y0: number, y1: number) => poly(P, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]);

type Morph = (off: string, on: string) => { d: string; style?: CSSProperties };
/** Élément mobile : tracé de repos, plus les deux états d'animation sauf en dessin statique (menus). */
const morpher = (animated: boolean): Morph => (off, on) => (animated ? { d: off, style: { "--off": `path("${off}")`, "--on": `path("${on}")` } as CSSProperties } : { d: off });

const strokeOf = (c: Palette) => ({ stroke: c.ink, strokeWidth: c.width, strokeLinejoin: "round" as const, strokeLinecap: "round" as const, vectorEffect: "non-scaling-stroke" as const });
const thinOf = (c: Palette) => ({ ...strokeOf(c), strokeWidth: c.width * 0.56 });

function Sun({ c, cx = 352, cy = 34 }: { c: Palette; cx?: number; cy?: number }) {
  const thin = thinOf(c);
  return (
    <g className="sk-badge">
      <circle cx={cx} cy={cy} r="13" fill={c.sage} fillOpacity="0.55" />
      <circle cx={cx} cy={cy} r="13" fill="none" {...thin} />
      {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={cx + Math.cos(a) * 18} y1={cy + Math.sin(a) * 18} x2={cx + Math.cos(a) * 23} y2={cy + Math.sin(a) * 23} {...thin} />; })}
    </g>
  );
}

/**
 * Moustique au trait (famille Moustiquaires), à la place du soleil : même centre, même encombrement (± 23 unités).
 * Vu de profil, tête à gauche : trompe, antennes, tête, thorax et abdomen fin teintés de sauge, deux ailes
 * translucides, six pattes longues articulées.
 */
function Mosquito({ c, cx = 352, cy = 34 }: { c: Palette; cx?: number; cy?: number }) {
  const thin = thinOf(c);
  const fine = { ...thin, strokeWidth: c.width * 0.48 };
  const t = (dx: number, dy: number) => `${cx + dx} ${cy + dy}`;
  const legs: Array<[number, number, number, number, number, number]> = [
    [-3, 2, -10, 9, -17, 19], [-1, 3, -4, 12, -8, 22], [1, 3, 2, 12, 0, 22],
    [2, 3, 9, 10, 12, 21], [3, 2.5, 14, 8, 20, 18], [4, 2, 17, 4, 23, 13],
  ];
  return (
    <g className="sk-badge" data-testid="sketch-mosquito">
      {/* ailes (derrière le corps) */}
      <path d={`M${t(1, -2)} C${t(4, -16)} ${t(16, -22)} ${t(20, -19)} C${t(21, -14)} ${t(10, -6)} ${t(1, -2)} Z`} fill={c.sage} fillOpacity="0.3" {...fine} />
      <path d={`M${t(-1, -2)} C${t(-2, -15)} ${t(6, -24)} ${t(10, -22)} C${t(12, -17)} ${t(5, -7)} ${t(-1, -2)} Z`} fill={c.sage} fillOpacity="0.22" {...fine} />
      {/* pattes */}
      {legs.map(([x0, y0, x1, y1, x2, y2], i) => <path key={i} d={`M${t(x0, y0)} L${t(x1, y1)} L${t(x2, y2)}`} fill="none" {...fine} />)}
      {/* abdomen fin et segmenté */}
      <path d={`M${t(3, -1)} C${t(10, -1)} ${t(19, 3)} ${t(24, 8)} C${t(19, 7)} ${t(9, 4)} ${t(3, 2)} Z`} fill={c.sage} fillOpacity="0.55" {...thin} />
      <path d={`M${t(9, 0.4)} L${t(8.6, 3.6)} M${t(14, 2.2)} L${t(13.4, 5.2)} M${t(19, 4.6)} L${t(18.4, 6.6)}`} fill="none" {...fine} />
      {/* thorax, tête, antennes, trompe */}
      <ellipse cx={cx} cy={cy} rx="4.4" ry="3.4" fill={c.sage} fillOpacity="0.55" {...thin} />
      <circle cx={cx - 6.6} cy={cy - 1.2} r="2.3" fill={c.face} {...thin} />
      <path d={`M${t(-7.5, -3.2)} L${t(-11, -9)} M${t(-6.2, -3.4)} L${t(-7.6, -9.6)}`} fill="none" {...fine} />
      <path d={`M${t(-8.8, -0.4)} L${t(-22, 5)}`} fill="none" {...thin} />
    </g>
  );
}

function PergolaSketch(morph: Morph, c: Palette) {
  const stroke = strokeOf(c), thin = thinOf(c);
  const P = projector(186, 128, 40);
  const W = 4, D = 3.2, H = 2.5, bh = 0.24, t = 0.14, f = 0.12, n = 13;
  const post = (px: number, pz: number) => <g key={`${px}-${pz}`} fill={c.face} {...stroke}><path d={faceZ(P, pz + t, px, px + t, 0, H)} /><path d={faceX(P, px + t, 0, H, pz, pz + t)} /></g>;
  const pitch = (D - 2 * f) / n, hw = pitch * 0.5 * 0.96, yc = H + bh * 0.55;
  // lame tournant autour de son axe (parallèle à la largeur) ; vers 27° elle est vue par la tranche : toiture ouverte
  const blade = (zc: number, a: number) => { const dy = hw * Math.sin(a), dz = hw * Math.cos(a); return poly(P, [[f, yc - dy, zc - dz], [W - f, yc - dy, zc - dz], [W - f, yc + dy, zc + dz], [f, yc + dy, zc + dz]]); };
  return (
    <>
      <path d={faceY(P, 0, -0.5, W + 0.5, -0.5, D + 0.5)} fill={c.ground} />
      <path d={faceY(P, 0, 0.35, W + 0.35, 0.45, D + 0.45)} fill={c.ink} fillOpacity={c.shadow} />
      {!c.seeThrough && post(0, 0)}{post(W - t, 0)}{post(0, D - t)}
      {/* faces intérieures du cadre vues par l'ouverture */}
      <g fill={c.face} {...thin}><path d={faceZ(P, f, f, W - f, H, H + bh)} /><path d={faceX(P, f, H, H + bh, f, D - f)} /></g>
      {Array.from({ length: n }, (_, i) => { const zc = f + pitch * (i + 0.5); return <path key={i} className="sk-move" fill={c.blade} {...thin} {...morph(blade(zc, -0.08), blade(zc, 0.42))} />; })}
      <g fill={c.face} {...stroke}>
        <path d={faceZ(P, D, 0, W, H, H + bh)} />
        <path d={faceX(P, W, H, H + bh, 0, D)} />
        <path fillRule="evenodd" d={`${faceY(P, H + bh, 0, W, 0, D)} ${faceY(P, H + bh, f, W - f, f, D - f)}`} />
      </g>
      {post(W - t, D - t)}
    </>
  );
}

function ScreenSketch(morph: Morph, c: Palette, wall: boolean) {
  const stroke = strokeOf(c), thin = thinOf(c);
  const WW = 4.6, WH = 3.0, x0 = 0.9, x1 = 3.7, oh = 2.5, r = 0.08;
  // produit seul : sol et ombre ramenés à l'emprise du screen
  const gx0 = x0 - 0.3, gx1 = x1 + 0.3, gz0 = -0.25, gz1 = 1.15;
  const P = wall ? projector(151, 145, 42) : fitProjector([...corners(x0 - 0.05, x1 + 0.05, 0, oh + 0.2, 0, 0.15), ...corners(gx0, gx1, 0, 0, gz0, gz1)], PRODUCT_BOX);
  const fabric = (drop: number) => faceZ(P, 0.05, x0 + r, x1 - r, oh - drop, oh);
  const bar = (drop: number) => faceZ(P, 0.07, x0 + r, x1 - r, oh - drop - 0.06, oh - drop);
  const shadow = (drop: number) => faceY(P, 0, x0 + 0.15, x1 + 0.2, 0.18, 0.18 + 0.4 * drop);
  if (!wall) return (
    <>
      <path d={faceY(P, 0, gx0, gx1, gz0, gz1)} fill={c.ground} />
      <path className="sk-move" fill={c.ink} fillOpacity={c.shadow} {...morph(shadow(0.95), shadow(2.4))} />
      {/* toile, barre de charge, puis coulisses (avant et flanc) et coffre */}
      <path className="sk-move" fill={c.sage} fillOpacity="0.75" {...thin} {...morph(fabric(0.95), fabric(2.4))} />
      <path className="sk-move" fill={c.ink} {...thin} {...morph(bar(0.95), bar(2.4))} />
      <g fill={c.face} {...stroke}>
        <path d={faceZ(P, 0.1, x0 - 0.05, x0 + r, 0, oh)} /><path d={faceX(P, x0 + r, 0, oh, 0, 0.1)} />
        <path d={faceZ(P, 0.1, x1 - r, x1 + 0.05, 0, oh)} /><path d={faceX(P, x1 + 0.05, 0, oh, 0, 0.1)} />
        <path d={faceZ(P, 0.15, x0 - 0.05, x1 + 0.05, oh, oh + 0.2)} />
        <path d={faceY(P, oh + 0.2, x0 - 0.05, x1 + 0.05, 0, 0.15)} />
        <path d={faceX(P, x1 + 0.05, oh, oh + 0.2, 0, 0.15)} />
      </g>
    </>
  );
  return (
    <>
      <path d={faceY(P, 0, -0.2, WW + 0.2, 0, 2.2)} fill={c.ground} />
      {/* façade et épaisseur du mur */}
      <g fill={c.face} {...stroke}>
        <path fillRule="evenodd" d={`${faceZ(P, 0, 0, WW, 0, WH)} ${faceZ(P, 0, x0, x1, 0, oh)}`} />
        <path d={faceX(P, WW, 0, WH, -0.3, 0)} />
        <path d={faceY(P, WH, 0, WW, -0.3, 0)} />
      </g>
      {/* baie vitrée en retrait */}
      <path d={faceZ(P, -0.25, x0, x1, 0, oh)} fill={c.glass} {...thin} />
      <path d={faceX(P, x0, 0, oh, -0.25, 0)} fill={c.face} {...thin} />
      <path d={line(P, [[(x0 + x1) / 2, 0, -0.25], [(x0 + x1) / 2, oh, -0.25]])} fill="none" {...thin} />
      {/* toile, barre de charge, coulisses et coffre */}
      <path className="sk-move" fill={c.sage} fillOpacity="0.75" {...thin} {...morph(fabric(0.95), fabric(2.4))} />
      <path className="sk-move" fill={c.ink} {...thin} {...morph(bar(0.95), bar(2.4))} />
      <g fill={c.face} {...stroke}>
        <path d={faceZ(P, 0.1, x0 - 0.05, x0 + r, 0, oh)} /><path d={faceX(P, x0 + r, 0, oh, 0, 0.1)} />
        <path d={faceZ(P, 0.1, x1 - r, x1 + 0.05, 0, oh)} /><path d={faceX(P, x1 + 0.05, 0, oh, 0, 0.1)} />
        <path d={faceZ(P, 0.15, x0 - 0.05, x1 + 0.05, oh, oh + 0.2)} />
        <path d={faceY(P, oh + 0.2, x0 - 0.05, x1 + 0.05, 0, 0.15)} />
        <path d={faceX(P, x1 + 0.05, oh, oh + 0.2, 0, 0.15)} />
      </g>
    </>
  );
}

function AwningSketch(morph: Morph, c: Palette, wall: boolean) {
  const stroke = strokeOf(c), thin = thinOf(c);
  const WW = 4.8, WH = 3.0, cy = 2.45, cz = 0.22, slope = 0.27, L = 1.45;
  const fx0 = 0.5, fx1 = 4.3;
  const OFF = 1.3, ON = 2.6;
  // produit seul : sol ramené à l'emprise du store déployé (ombre comprise)
  const gx0 = 0.25, gx1 = 4.75, gz0 = -0.15, gz1 = ON + 0.45;
  const P = wall ? projector(169, 130, 40) : fitProjector([...corners(0.4, 4.4, cy, cy + 0.22, 0, cz), ...corners(fx0 - 0.05, fx1 + 0.05, cy - ON * slope - 0.3, cy, ON, ON), ...corners(gx0, gx1, 0, 0, gz0, gz1)], PRODUCT_BOX);
  const yb = (p: number) => cy + 0.02 - p * slope;
  const fabric = (p: number) => poly(P, [[fx0, cy + 0.02, cz], [fx1, cy + 0.02, cz], [fx1, yb(p), p], [fx0, yb(p), p]]);
  const bar = (p: number) => faceZ(P, p, fx0 - 0.05, fx1 + 0.05, yb(p) - 0.09, yb(p));
  const valance = (p: number) => faceZ(P, p, fx0 - 0.05, fx1 + 0.05, yb(p) - 0.32, yb(p) - 0.09);
  const arm = (xs: number, dir: 1 | -1, p: number) => {
    const sh: V3 = [xs, cy - 0.05, 0.1], hd: V3 = [xs, yb(p) - 0.05, p];
    const dist = Math.hypot(hd[1] - sh[1], hd[2] - sh[2]), e = Math.sqrt(Math.max(0, L * L - (dist / 2) ** 2));
    const el: V3 = [xs + dir * e, (sh[1] + hd[1]) / 2 - 0.04, (sh[2] + hd[2]) / 2];
    return line(P, [sh, el, hd]);
  };
  // sans façade, les bras sont tracés au trait principal, puis repris en transparence sur la toile pour rester lisibles
  const armStroke = wall ? thin : stroke;
  const arms = (opacity?: number) => [arm(0.85, 1, OFF), arm(3.95, -1, OFF)].map((off, i) => <path key={i} className="sk-move" fill="none" {...armStroke} strokeOpacity={opacity} {...morph(off, i ? arm(3.95, -1, ON) : arm(0.85, 1, ON))} />);
  if (!wall) return (
    <>
      <path d={faceY(P, 0, gx0, gx1, gz0, gz1)} fill={c.ground} />
      <path className="sk-move" fill={c.ink} fillOpacity={c.shadow} {...morph(faceY(P, 0, fx0 + 0.3, fx1 + 0.3, 0.3, OFF + 0.3), faceY(P, 0, fx0 + 0.3, fx1 + 0.3, 0.3, ON + 0.3))} />
      {/* bras articulés (vus à travers la toile), toile, barre de charge et lambrequin, coffre */}
      {arms()}
      <path className="sk-move" fill={c.sage} fillOpacity="0.62" {...stroke} {...morph(fabric(OFF), fabric(ON))} />
      {arms(0.45)}
      <path className="sk-move" fill={c.sage} {...thin} {...morph(valance(OFF), valance(ON))} />
      <path className="sk-move" fill={c.face} {...stroke} {...morph(bar(OFF), bar(ON))} />
      <g fill={c.face} {...stroke}>
        <path d={faceZ(P, cz, 0.4, 4.4, cy, cy + 0.22)} />
        <path d={faceY(P, cy + 0.22, 0.4, 4.4, 0, cz)} />
        <path d={faceX(P, 4.4, cy, cy + 0.22, 0, cz)} />
      </g>
    </>
  );
  return (
    <>
      <path d={faceY(P, 0, -0.2, WW + 0.2, 0, 3)} fill={c.ground} />
      <path className="sk-move" fill={c.ink} fillOpacity={c.shadow} {...morph(faceY(P, 0, fx0 + 0.3, fx1 + 0.3, 0.3, OFF + 0.3), faceY(P, 0, fx0 + 0.3, fx1 + 0.3, 0.3, ON + 0.3))} />
      <g fill={c.face} {...stroke}>
        <path fillRule="evenodd" d={`${faceZ(P, 0, 0, WW, 0, WH)} ${faceZ(P, 0, 1.6, 3.2, 0, 2.15)}`} />
        <path d={faceX(P, WW, 0, WH, -0.3, 0)} />
        <path d={faceY(P, WH, 0, WW, -0.3, 0)} />
      </g>
      <path d={faceZ(P, -0.22, 1.6, 3.2, 0, 2.15)} fill={c.glass} {...thin} />
      <path d={faceX(P, 1.6, 0, 2.15, -0.22, 0)} fill={c.face} {...thin} />
      {/* bras articulés (vus à travers la toile), toile, barre de charge et lambrequin */}
      <path className="sk-move" fill="none" {...thin} {...morph(arm(0.85, 1, OFF), arm(0.85, 1, ON))} />
      <path className="sk-move" fill="none" {...thin} {...morph(arm(3.95, -1, OFF), arm(3.95, -1, ON))} />
      <path className="sk-move" fill={c.sage} fillOpacity="0.62" {...stroke} {...morph(fabric(OFF), fabric(ON))} />
      <path className="sk-move" fill={c.sage} {...thin} {...morph(valance(OFF), valance(ON))} />
      <path className="sk-move" fill={c.face} {...stroke} {...morph(bar(OFF), bar(ON))} />
      <g fill={c.face} {...stroke}>
        <path d={faceZ(P, cz, 0.4, 4.4, cy, cy + 0.22)} />
        <path d={faceY(P, cy + 0.22, 0.4, 4.4, 0, cz)} />
        <path d={faceX(P, 4.4, cy, cy + 0.22, 0, cz)} />
      </g>
    </>
  );
}

/**
 * Moustiquaire plissée : cadre (dormant, seuil bas) et toile en accordéon tirée depuis le profil latéral.
 * Au survol, la toile se déploie jusqu'au profil opposé. Produit seul par défaut ; avec `wall`, posée dans une baie.
 */
function InsectSketch(morph: Morph, c: Palette, wall: boolean) {
  const stroke = strokeOf(c), thin = thinOf(c);
  const W = 2.0, H = 2.3, d = 0.07, x0 = 1.0, x1 = x0 + W;
  const P = wall ? projector(178, 128, 46) : fitProjector([...corners(x0 - 0.3, x1 + 0.3, 0, H + 0.1, -0.2, 0.6)], PRODUCT_BOX);
  const OFF = 0.55, ON = 0.97;
  const folds = 9;
  /** toile plissée : zigzag de `folds` plis entre le profil fixe (gauche) et le profil mobile à la fraction `t` */
  const mesh = (t: number) => {
    const xm = x0 + 0.06 + (W - 0.12) * t;
    const pts: V3[] = [];
    for (let i = 0; i <= folds; i += 1) pts.push([x0 + 0.06 + ((xm - x0 - 0.06) * i) / folds, H - 0.06, i % 2 ? 0.05 : 0.0]);
    const bottom = [...pts].reverse().map(([x, , z]) => [x, 0.06, z] as V3);
    return poly(P, [...pts, ...bottom]);
  };
  const pleats = (t: number) => {
    const xm = x0 + 0.06 + (W - 0.12) * t;
    return Array.from({ length: folds - 1 }, (_, i) => {
      const x = x0 + 0.06 + ((xm - x0 - 0.06) * (i + 1)) / folds;
      return line(P, [[x, 0.06, (i + 1) % 2 ? 0.05 : 0], [x, H - 0.06, (i + 1) % 2 ? 0.05 : 0]]);
    }).join(" ");
  };
  const bar = (t: number) => { const xm = x0 + 0.06 + (W - 0.12) * t; return `${faceZ(P, 0.06, xm, xm + 0.06, 0.06, H - 0.06)} ${faceX(P, xm + 0.06, 0.06, H - 0.06, 0, 0.06)}`; };
  return (
    <>
      <path d={faceY(P, 0, x0 - 0.4, x1 + 0.4, -0.1, 0.7)} fill={c.ground} />
      {wall && (
        <g fill={c.face} {...stroke}>
          <path fillRule="evenodd" d={`${faceZ(P, -0.02, x0 - 0.9, x1 + 0.9, 0, H + 0.6)} ${faceZ(P, -0.02, x0, x1, 0, H)}`} />
        </g>
      )}
      <path d={faceZ(P, -0.01, x0, x1, 0, H)} fill={c.glass} {...thin} />
      {/* toile plissée et profil mobile */}
      <path className="sk-move" fill={c.sage} fillOpacity="0.45" {...thin} {...morph(mesh(OFF), mesh(ON))} />
      <path className="sk-move" fill="none" {...thin} strokeOpacity={0.7} {...morph(pleats(OFF), pleats(ON))} />
      <path className="sk-move" fill={c.face} {...stroke} {...morph(bar(OFF), bar(ON))} />
      {/* cadre : profil fixe, traverse haute, seuil bas, coulisse opposée */}
      <g fill={c.face} {...stroke}>
        <path d={faceZ(P, d, x0 - 0.06, x0 + 0.06, 0, H)} />
        <path d={faceX(P, x0 + 0.06, 0, H, 0, d)} />
        <path d={faceZ(P, d, x1 - 0.05, x1 + 0.03, 0, H)} />
        <path d={faceX(P, x1 + 0.03, 0, H, 0, d)} />
        <path d={faceZ(P, d, x0 - 0.06, x1 + 0.03, H - 0.07, H + 0.02)} />
        <path d={faceY(P, H + 0.02, x0 - 0.06, x1 + 0.03, 0, d)} />
        <path d={faceZ(P, d, x0 - 0.06, x1 + 0.03, 0, 0.02)} />
      </g>
    </>
  );
}

const SKETCHES: Record<CategoryKey, { draw: (morph: Morph, c: Palette, wall: boolean) => React.ReactNode; label: string }> = {
  PERGOLAS: { draw: PergolaSketch, label: "Dessin d'une pergola à lames orientables" },
  SCREENS: { draw: ScreenSketch, label: "Dessin d'un screen à toile verticale devant une baie" },
  STORES_BANNES: { draw: AwningSketch, label: "Dessin d'un store banne à bras articulés" },
  MOUSTIQUAIRES: { draw: InsectSketch, label: "Dessin d'une moustiquaire plissée dans son cadre" },
};

/**
 * Dessin d'une famille. `decorative` (défaut) : masqué des lecteurs d'écran, le lien parent porte le nom.
 * `showWall={false}` : screen et store banne sans le bâtiment (sans effet sur la pergola).
 */
export function FamilySketch({ kind, className = "", decorative = true, sun = true, animated = true, tone = "ink", showWall = true }: { kind: CategoryKey; className?: string; decorative?: boolean; sun?: boolean; animated?: boolean; tone?: "ink" | "light"; showWall?: boolean }) {
  const s = SKETCHES[kind];
  const c = PALETTES[tone];
  const body = s.draw(morpher(animated), c, showWall);
  return (
    <svg viewBox="0 0 400 300" className={`sketch ${className}`} {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": s.label })} focusable="false">
      {sun && (kind === "MOUSTIQUAIRES" ? <Mosquito c={c} /> : <Sun c={c} />)}
      {body}
    </svg>
  );
}
