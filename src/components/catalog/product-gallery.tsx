"use client";
import { useState } from "react";
import { PergolaArt } from "@/components/illustrations/pergola";
import { TerraceScene } from "@/components/illustrations/scene";
import { PlanPreview } from "@/components/configurator/plan-preview";
import { buildLayout } from "@/domain/layout";

export interface GalleryProps {
  name: string;
  structure: string;
  blades: string;
  mounting: "freestanding" | "wall";
  lighting: boolean;
  widthMm: number;
  lengthMm: number;
  dividerThresholdMm?: number;
  finishSwatch?: string;
}

/** Galerie multi-vues générée (rendus originaux) : scène, trois quarts, soirée, plan, finition. */
export function ProductGallery(p: GalleryProps) {
  const layout = buildLayout({ widthMm: p.widthMm, lengthMm: p.lengthMm, mounting: p.mounting, dividerThresholdMm: p.dividerThresholdMm ?? 6000 });
  const views = [
    { id: "scene", label: "En situation", node: <TerraceScene structure={p.structure} blades={p.blades} mounting={p.mounting} lighting={false} className="w-full h-full" title={`${p.name} en situation`} /> },
    { id: "art", label: "Vue trois quarts", node: <PergolaArt structure={p.structure} blades={p.blades} mounting={p.mounting} lighting={false} className="w-full h-full" title={`${p.name}, vue trois quarts`} /> },
    ...(p.lighting ? [{ id: "night", label: "Éclairage inclus, le soir", node: <TerraceScene structure={p.structure} blades={p.blades} mounting={p.mounting} lighting evening className="w-full h-full" title={`${p.name} le soir, éclairage inclus`} /> }] : []),
    { id: "plan", label: `Plan ${p.widthMm / 1000} × ${p.lengthMm / 1000} m`, node: <div className="bg-sand-50 w-full h-full flex items-center justify-center p-2"><PlanPreview layout={layout} segments={{}} finishSwatch={p.finishSwatch} /></div> },
  ];
  const [active, setActive] = useState(0);
  const v = views[active] ?? views[0]!;
  return (
    <div>
      <div className="card overflow-hidden relative w-full max-w-full" style={{ aspectRatio: "5 / 3" }}>
        <div className="absolute inset-0">{v.node}</div>
        <span className="absolute bottom-3 right-3 badge bg-white/90 border border-sand-300">{active + 1} / {views.length} · {v.label}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2" role="tablist" aria-label="Vues du produit">
        {views.map((w, i) => (
          <button key={w.id} type="button" role="tab" aria-selected={i === active} aria-label={w.label} onClick={() => setActive(i)} className={`card overflow-hidden aspect-[5/3] p-0 ${i === active ? "ring-2 ring-copper-500" : "opacity-80 hover:opacity-100"}`}>
            <div className="w-full h-full pointer-events-none [&>svg]:w-full [&>svg]:h-full [&_svg]:w-full [&_svg]:h-full">{w.node}</div>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-700">Rendus originaux générés depuis la configuration (finition, implantation, dimension). Fermetures et accessoires non représentés car non inclus. Photographies à venir avec les médias autorisés.</p>
    </div>
  );
}
