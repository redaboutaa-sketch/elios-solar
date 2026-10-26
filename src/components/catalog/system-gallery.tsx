"use client";
/**
 * Galerie d'un système : modes distincts « Photos et rendus », « Vue 3D » (configuration par défaut, three.js chargé
 * au clic) et « Dessins techniques » (schémas et profils publiés). Un mode sans contenu n'est pas proposé. Chaque image
 * reste identifiée par sa nature (photographie, rendu, schéma). Agrandissement dans une fenêtre modale native
 * (<dialog> : focus piégé, Échap). Provenance et crédits restent dans la médiathèque (administration).
 */
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Box, ChevronLeft, ChevronRight, Expand, Images, PencilRuler, X } from "lucide-react";
import type { PublishedMedia } from "@/server/media/types";
import type { SceneModel } from "@/domain/scene-model";
import { has3D } from "@/domain/scene-model";
import { mediaSrcSet } from "@/components/ui/media-image";

const NATURE: Record<string, string> = { PHOTO: "Photographie", RENDER: "Rendu", ILLUSTRATION: "Schéma", VIDEO: "Vidéo", DOCUMENT: "Document" };
const SystemScene3D = dynamic(() => import("@/components/configurator/scene-3d/viewer-3d").then((m) => m.SystemScene3D), { ssr: false, loading: () => <p className="grid aspect-[4/3] place-items-center bg-sand-100 text-sm text-stone-700">Chargement de la vue 3D…</p> });

type Mode = "photos" | "3d" | "technique";

export function SystemGallery({ name, media, scene = null }: { name: string; media: PublishedMedia[]; scene?: SceneModel | null }) {
  const photos = media.filter((m) => m.role !== "technical");
  const drawings = media.filter((m) => m.role === "technical");
  const [mode, setMode] = useState<Mode>(photos.length ? "photos" : drawings.length ? "technique" : "photos");
  const [i, setI] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  if (!media.length) {
    // aucun visuel publiable (ex. modèle en demande d'étude) : vue 3D indicative chargée seulement à la demande
    if (scene && has3D(scene) && mode === "3d") return <div className="border border-sand-200 bg-white p-3" data-testid="gallery-3d"><SystemScene3D model={scene} fallback={<p className="p-6 text-sm text-stone-700">Vue 3D indisponible sur cet appareil.</p>} /><p className="mt-2 text-xs text-stone-700">Représentation schématique indicative, sans valeur de fiche technique.</p></div>;
    return <div className="grid aspect-[4/3] place-items-center gap-3 border border-sand-200 bg-white p-6 text-center text-sm text-stone-700" data-testid="system-gallery-empty"><p>Visuels en cours d&apos;intégration.</p>{scene && has3D(scene) && <button type="button" className="btn-secondary" onClick={() => setMode("3d")}><Box className="size-4" aria-hidden="true" /> Afficher une vue 3D indicative</button>}</div>;
  }
  const list = mode === "technique" ? drawings : photos;
  const m = list[Math.min(i, list.length - 1)];
  const modes: Array<{ id: Mode; label: string; icon: React.ReactNode; show: boolean }> = [
    { id: "photos", label: "Photos et rendus", icon: <Images className="size-4" aria-hidden="true" />, show: photos.length > 0 },
    { id: "3d", label: "Vue 3D", icon: <Box className="size-4" aria-hidden="true" />, show: !!scene },
    { id: "technique", label: "Dessins techniques", icon: <PencilRuler className="size-4" aria-hidden="true" />, show: drawings.length > 0 },
  ];
  const pick = (k: Mode) => { setMode(k); setI(0); };
  const step = (d: number) => setI((x) => (x + d + list.length) % list.length);
  return (
    <div data-testid="system-gallery">
      {modes.filter((x) => x.show).length > 1 && (
        <div role="group" aria-label="Mode de visualisation" className="mb-3 flex flex-wrap gap-x-6 border-b border-sand-200">
          {modes.filter((x) => x.show).map((x) => (
            <button key={x.id} type="button" aria-pressed={mode === x.id} onClick={() => pick(x.id)} data-testid={`gallery-mode-${x.id}`} className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 text-sm font-semibold transition-colors duration-150 ${mode === x.id ? "border-brand-700 text-ink" : "border-transparent text-stone-700 hover:text-ink"}`}>{x.icon}{x.label}</button>
          ))}
        </div>
      )}
      {mode === "3d" && scene && has3D(scene) ? (
        <div className="border border-sand-200 bg-white p-3" data-testid="gallery-3d">
          <SystemScene3D model={scene} fallback={<p className="p-6 text-sm text-stone-700">Vue 3D indisponible sur cet appareil.</p>} />
          <p className="mt-2 text-xs text-stone-700">Configuration par défaut, à titre indicatif : modifiez les cotes et les choix dans le configurateur.</p>
        </div>
      ) : m ? (
        <>
          <figure className="overflow-hidden border border-sand-200 bg-white">
            <div className="group relative aspect-[4/3] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- médias servis par /api/media, dimensions connues */}
              <img key={m.id} src={m.path} srcSet={mediaSrcSet(m)} sizes="(min-width: 1024px) 55vw, (min-width: 640px) calc(100vw - 3rem), calc(100vw - 2rem)" alt={m.alt} width={m.width ?? undefined} height={m.height ?? undefined} className="absolute inset-0 size-full object-contain animate-fade-in" loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : undefined} />
              <button type="button" onClick={() => dialog.current?.showModal()} aria-label={`Agrandir : ${m.alt}`} className="absolute right-3 top-3 grid size-10 place-items-center border border-sand-300 bg-white/90 text-ink hover:bg-white"><Expand className="size-4" aria-hidden="true" /></button>
              {list.length > 1 && <>
                <button type="button" onClick={() => step(-1)} aria-label="Visuel précédent" className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center border border-sand-300 bg-white/90 hover:bg-white"><ChevronLeft className="size-5" aria-hidden="true" /></button>
                <button type="button" onClick={() => step(1)} aria-label="Visuel suivant" className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center border border-sand-300 bg-white/90 hover:bg-white"><ChevronRight className="size-5" aria-hidden="true" /></button>
              </>}
            </div>
            <figcaption className="flex flex-wrap justify-between gap-2 border-t border-sand-200 px-4 py-2 text-xs text-stone-700">
              <span><span className="font-medium text-stone-800">{m.caption || m.title}</span> · <span data-testid="media-nature">{NATURE[m.nature] ?? m.nature}</span>{m.visibleOptions ? <span data-testid="media-options"> · visible sur l&apos;image, non inclus d&apos;office : {m.visibleOptions}</span> : null}</span>
              <span className="tabular-nums">{Math.min(i, list.length - 1) + 1} / {list.length}</span>
            </figcaption>
          </figure>
          {list.length > 1 && (
            <ul className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1" aria-label={`Visuels ${name}`}>
              {list.map((x, k) => (
                <li key={x.id} className="shrink-0 snap-start">
                  <button type="button" onClick={() => setI(k)} aria-pressed={k === i} aria-label={`Afficher : ${x.alt}`} className={`block size-20 overflow-hidden border bg-white transition-[border-color,opacity] duration-150 ${k === i ? "border-brand-700 ring-1 ring-brand-700" : "border-sand-300 opacity-80 hover:opacity-100 hover:border-brand-700/50"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- vignette de la médiathèque */}
                    <img src={x.smallPath ?? x.path} alt="" width={80} height={80} className="size-full object-contain" loading="lazy" decoding="async" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <dialog ref={dialog} aria-label={`${name} — ${m.alt}`} className="m-auto max-h-[92dvh] w-[min(96vw,80rem)] bg-white p-0 backdrop:bg-night/80" onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
            <div className="flex items-center justify-between gap-3 border-b border-sand-200 px-4 py-2 text-sm"><span className="truncate"><span className="font-medium">{m.caption || m.title}</span> · {NATURE[m.nature] ?? m.nature}</span><button type="button" onClick={() => dialog.current?.close()} aria-label="Fermer" className="grid size-10 place-items-center hover:bg-sand-100"><X className="size-5" aria-hidden="true" /></button></div>
            <div className="relative h-[min(80dvh,56rem)] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- agrandissement du visuel courant */}
              <img src={m.path} alt={m.alt} className="absolute inset-0 size-full object-contain p-4" loading="lazy" decoding="async" />
              {list.length > 1 && <>
                <button type="button" onClick={() => step(-1)} aria-label="Visuel précédent" className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center border border-sand-300 bg-white hover:bg-sand-50"><ChevronLeft className="size-5" aria-hidden="true" /></button>
                <button type="button" onClick={() => step(1)} aria-label="Visuel suivant" className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center border border-sand-300 bg-white hover:bg-sand-50"><ChevronRight className="size-5" aria-hidden="true" /></button>
              </>}
            </div>
          </dialog>
        </>
      ) : null}
    </div>
  );
}
