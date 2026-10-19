"use client";
import { useState } from "react";
import { PergolaArt } from "@/components/illustrations/pergola";
import { TerraceScene } from "@/components/illustrations/scene";
import { PlanPreview } from "@/components/configurator/plan-preview";
import { buildLayout } from "@/domain/layout";
import { NATURE_FR, type PublishedMedia } from "@/server/media/types";

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
  /** médias PUBLIÉS de la médiathèque, déjà classés (finition / implantation d'abord) */
  media?: PublishedMedia[];
}

interface View {
  id: string;
  label: string;
  node: React.ReactNode;
  thumb?: React.ReactNode;
  media?: PublishedMedia;
}

const isDirectVideo = (url: string) => /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);

function mediaView(m: PublishedMedia, name: string): View {
  const label = m.caption || m.title || m.alt;
  if (m.nature === "VIDEO" && m.externalUrl) {
    const url = m.externalUrl;
    return {
      id: m.id, label, media: m,
      node: isDirectVideo(url)
        ? <video src={url} controls preload="metadata" className="w-full h-full object-contain bg-black" aria-label={m.alt || `Vidéo ${name}`} />
        : <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-sand-100 p-6 text-center"><p className="font-medium">{m.title || "Vidéo de présentation"}</p><a href={url} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary">Voir la vidéo sur le site hébergeur ↗</a><p className="text-xs text-stone-700">Lien externe : aucun lecteur tiers n'est chargé sans votre action.</p></div>,
      thumb: <div className="w-full h-full flex items-center justify-center bg-sand-100 text-xs font-medium">▶ Vidéo</div>,
    };
  }
  // eslint-disable-next-line @next/next/no-img-element
  const img = (cls: string, lazy = false) => <img src={m.path} alt={m.alt} width={m.width ?? undefined} height={m.height ?? undefined} loading={lazy ? "lazy" : undefined} className={cls} />;
  return { id: m.id, label, media: m, node: img("w-full h-full object-cover"), thumb: img("w-full h-full object-cover", true) };
}

/** Galerie générique : vue principale + vignettes, mentions de nature (rendu / photographie) et options visibles. */
export function MediaGallery({ views, note }: { views: View[]; note?: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const v = views[Math.min(active, views.length - 1)] ?? views[0]!;
  const m = v.media;
  return (
    <div>
      <div className="card overflow-hidden relative w-full max-w-full" style={{ aspectRatio: "5 / 3" }}>
        <div className="absolute inset-0">{v.node}</div>
        {m && m.nature !== "VIDEO" && <span data-testid="media-nature" className={`absolute top-3 left-3 badge border ${m.nature === "PHOTO" ? "bg-white/90 border-sand-300" : "bg-anthracite/85 text-sand-50 border-transparent"}`}>{NATURE_FR[m.nature]}</span>}
        <span className="absolute bottom-3 right-3 badge bg-white/90 border border-sand-300">{Math.min(active, views.length - 1) + 1} / {views.length} · {v.label}</span>
      </div>
      {m?.visibleOptions && <p className="mt-2 text-xs text-stone-800" data-testid="media-options">Options visibles non comprises dans le prix : {m.visibleOptions}.</p>}
      {m?.nature === "PHOTO" && m.credit && <p className="mt-1 text-xs text-stone-700">Crédit : {m.credit}</p>}
      {views.length > 1 && (
        <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2" role="tablist" aria-label="Vues du produit">
          {views.map((w, i) => (
            <button key={w.id} type="button" role="tab" aria-selected={i === active} aria-label={w.label} onClick={() => setActive(i)} className={`card overflow-hidden aspect-[5/3] p-0 ${i === active ? "ring-2 ring-copper-500" : "opacity-80 hover:opacity-100"}`}>
              <div className="w-full h-full pointer-events-none [&>svg]:w-full [&>svg]:h-full [&_svg]:w-full [&_svg]:h-full">{w.thumb ?? w.node}</div>
            </button>
          ))}
        </div>
      )}
      {note && <p className="mt-2 text-xs text-stone-700">{note}</p>}
    </div>
  );
}

/** Galerie d'une fiche à partir des médias publiés, avec repli sur les illustrations SVG fournies. */
export function PublishedGallery({ name, media, fallback }: { name: string; media?: PublishedMedia[]; fallback: React.ReactNode }) {
  const views = (media ?? []).map((m) => mediaView(m, name));
  if (views.length === 0) return <div className="card overflow-hidden">{fallback}</div>;
  return <MediaGallery views={views} note={media?.some((x) => x.nature === "RENDER") ? "Les visualisations 3D sont des rendus originaux, pas des photographies du produit." : undefined} />;
}

/** Galerie de pergola : médias publiés (s'il y en a) + plan coté ; sinon vues SVG générées depuis la configuration. */
export function ProductGallery(p: GalleryProps) {
  const layout = buildLayout({ widthMm: p.widthMm, lengthMm: p.lengthMm, mounting: p.mounting, dividerThresholdMm: p.dividerThresholdMm ?? 6000 });
  const plan: View = { id: "plan", label: `Plan ${p.widthMm / 1000} × ${p.lengthMm / 1000} m`, node: <div className="bg-sand-50 w-full h-full flex items-center justify-center p-2"><PlanPreview layout={layout} segments={{}} finishSwatch={p.finishSwatch} /></div> };
  const published = (p.media ?? []).map((m) => mediaView(m, p.name));
  if (published.length > 0) {
    return <MediaGallery key={published.map((v) => v.id).join("|")} views={[...published, plan]} note="Visualisations 3D : rendus originaux (pas des photographies), sélectionnés selon la finition et l'implantation choisies. Les éléments de décor et les options visibles ne sont pas compris dans le prix." />;
  }
  const views: View[] = [
    { id: "scene", label: "En situation", node: <TerraceScene structure={p.structure} blades={p.blades} mounting={p.mounting} lighting={false} className="w-full h-full" title={`${p.name} en situation`} /> },
    { id: "art", label: "Vue trois quarts", node: <PergolaArt structure={p.structure} blades={p.blades} mounting={p.mounting} lighting={false} className="w-full h-full" title={`${p.name}, vue trois quarts`} /> },
    ...(p.lighting ? [{ id: "night", label: "Éclairage inclus, le soir", node: <TerraceScene structure={p.structure} blades={p.blades} mounting={p.mounting} lighting evening className="w-full h-full" title={`${p.name} le soir, éclairage inclus`} /> }] : []),
    plan,
  ];
  return <MediaGallery views={views} note="Rendus originaux générés depuis la configuration (finition, implantation, dimension). Fermetures et accessoires non représentés car non inclus. Photographies à venir avec les médias autorisés." />;
}
