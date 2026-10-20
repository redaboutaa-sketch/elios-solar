"use client";
import type { Layout, SegmentChoice } from "@/domain/types";
import { SIDE_LABELS } from "@/domain/layout";

const CLOSURE_COLORS: Record<string, string> = { "paroi-vitree": "#7fb0c4", "persienne-aluminium": "#8d6b4e", "store-vertical-zip": "#5c6166", "screen-refleksol-120-ziiip": "#5c6166" };
const CLOSURE_SHORT: Record<string, string> = { "paroi-vitree": "Vitrage", "persienne-aluminium": "Persienne", "store-vertical-zip": "Store ZIP", "screen-refleksol-120-ziiip": "Screen (souhait)" };

/**
 * Vue en plan (dessus) fidèle à la configuration : dimensions, mur, poteaux, segments
 * et fermetures choisies. Schéma indicatif, pas un plan d'exécution.
 */
export function PlanPreview({ layout, segments, selected, onSelect, finishSwatch, options }: {
  layout: Layout;
  segments: Record<string, SegmentChoice | null>;
  selected?: string | null;
  onSelect?: (segmentId: string) => void;
  finishSwatch?: string;
  options?: { lighting?: boolean; heaters?: number };
}) {
  const W = 520, H = 420, pad = 70;
  const scale = Math.min((W - pad * 2) / layout.lengthMm, (H - pad * 2) / layout.widthMm);
  const w = layout.lengthMm * scale, h = layout.widthMm * scale;
  const x0 = (W - w) / 2, y0 = (H - h) / 2;
  const post = 10;
  const sidePath = (key: string, start: number, len: number) => {
    const fr = start / (key === "front" || key === "back" ? layout.lengthMm : layout.widthMm);
    const fl = len / (key === "front" || key === "back" ? layout.lengthMm : layout.widthMm);
    if (key === "back") return { x: x0 + fr * w, y: y0 - 6, width: fl * w, height: 12, horizontal: true };
    if (key === "front") return { x: x0 + fr * w, y: y0 + h - 6, width: fl * w, height: 12, horizontal: true };
    if (key === "left") return { x: x0 - 6, y: y0 + fr * h, width: 12, height: fl * h, horizontal: false };
    return { x: x0 + w - 6, y: y0 + fr * h, width: 12, height: fl * h, horizontal: false };
  };
  const posts: Array<[number, number]> = [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]];
  for (const side of layout.sides) {
    let acc = 0;
    for (const seg of side.segments) {
      acc += seg.lengthMm;
      if (seg.hasDividerPost) {
        const p = sidePath(side.key, acc, 0);
        posts.push([p.x + (p.horizontal ? 0 : 6), p.y + (p.horizontal ? 6 : 0)]);
      }
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Vue en plan : ${layout.lengthMm / 1000} × ${layout.widthMm / 1000} m, ${layout.mounting === "wall" ? "adossée" : "autoportée"}`} className="w-full h-auto">
      <rect width={W} height={H} fill="#faf8f4" />
      {/* toit / emprise */}
      <rect x={x0} y={y0} width={w} height={h} fill={finishSwatch && !finishSwatch.startsWith("linear") ? finishSwatch : "#3a3d41"} opacity="0.12" stroke="#3a3d41" strokeWidth="1.5" />
      {Array.from({ length: 9 }).map((_, i) => <line key={i} x1={x0 + ((i + 1) * w) / 10} y1={y0 + 4} x2={x0 + ((i + 1) * w) / 10} y2={y0 + h - 4} stroke="#3a3d41" strokeOpacity="0.25" />)}
      {options?.lighting && <rect x={x0 + 4} y={y0 + 4} width={w - 8} height={h - 8} fill="none" stroke="#e6b35a" strokeWidth="3" strokeDasharray="6 4" />}
      {/* mur */}
      {layout.mounting === "wall" && <g><rect x={x0 - 20} y={y0 - 16} width={w + 40} height={12} fill="#b8ad99" /><text x={x0 + w / 2} y={y0 - 24} textAnchor="middle" fontSize="12" fill="#5b5f63">Mur de la maison</text></g>}
      {/* segments */}
      {layout.sides.flatMap((side) => {
        let acc = 0;
        return side.segments.map((seg) => {
          const p = sidePath(side.key, acc, seg.lengthMm);
          acc += seg.lengthMm;
          const choice = segments[seg.id];
          const color = choice ? (CLOSURE_COLORS[choice.closureFamilySlug] ?? "#888") : "#ffffff";
          const isSel = selected === seg.id;
          const labelX = p.horizontal ? p.x + p.width / 2 : side.key === "left" ? p.x - 8 : p.x + 20;
          const labelY = p.horizontal ? (side.key === "back" ? p.y - 10 : p.y + 26) : p.y + p.height / 2;
          return (
            <g key={seg.id} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={`${SIDE_LABELS[side.key]} ${side.segments.length > 1 ? `segment ${seg.index}` : ""} : ${choice ? CLOSURE_SHORT[choice.closureFamilySlug] ?? choice.closureFamilySlug : "ouvert"}`} onClick={() => onSelect?.(seg.id)} onKeyDown={(e) => { if (onSelect && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(seg.id); } }} className={onSelect ? "cursor-pointer" : undefined}>
              <rect x={p.x} y={p.y} width={p.width} height={p.height} fill={color} stroke={isSel ? "#b5693c" : "#3a3d41"} strokeWidth={isSel ? 3 : 1} rx="2" />
              <text x={labelX} y={labelY} textAnchor={p.horizontal ? "middle" : side.key === "left" ? "end" : "start"} dominantBaseline="middle" fontSize="11" fill="#1f2123">{choice ? CLOSURE_SHORT[choice.closureFamilySlug] ?? "Fermé" : "Ouvert"} · {seg.lengthMm / 1000} m</text>
            </g>
          );
        });
      })}
      {/* poteaux */}
      {posts.map(([px, py], i) => <rect key={i} x={px - post / 2} y={py - post / 2} width={post} height={post} fill="#1f2123" />)}
      {/* cotes */}
      <text x={x0 + w / 2} y={y0 + h + 44} textAnchor="middle" fontSize="12" fill="#5b5f63">Longueur {layout.lengthMm / 1000} m (côtés avant / arrière)</text>
      <text x={x0 - 44} y={y0 + h / 2} textAnchor="middle" fontSize="12" fill="#5b5f63" transform={`rotate(-90 ${x0 - 44} ${y0 + h / 2})`}>Largeur {layout.widthMm / 1000} m</text>
      {options?.heaters ? <text x={x0 + w - 6} y={y0 + 18} textAnchor="end" fontSize="11" fill="#9c5730">🔥 × {options.heaters}</text> : null}
      <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#8a8a8a">Schéma indicatif — pas un plan d'exécution ni une validation structurelle</text>
    </svg>
  );
}
