"use client";
/**
 * Galerie d'un système : visuels publiés de la médiathèque (photographies, rendus, schémas). Leur provenance et
 * leur crédit restent dans la médiathèque (administration) ; la page publique ne cite ni fabricant ni fournisseur.
 */
import { useState } from "react";
import type { PublishedMedia } from "@/server/media/types";

const NATURE: Record<string, string> = { PHOTO: "Photographie", RENDER: "Rendu", ILLUSTRATION: "Schéma", VIDEO: "Vidéo", DOCUMENT: "Document" };

export function SystemGallery({ name, media }: { name: string; media: PublishedMedia[] }) {
  const [i, setI] = useState(0);
  if (!media.length) return <div className="card grid aspect-[4/3] place-items-center text-sm text-stone-700">Visuels en cours d'intégration.</div>;
  const m = media[Math.min(i, media.length - 1)]!;
  return (
    <div data-testid="system-gallery">
      <figure className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
        <div className="relative aspect-[4/3] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- médias servis par /api/media, dimensions connues */}
          <img key={m.id} src={m.path} alt={m.alt} width={m.width ?? undefined} height={m.height ?? undefined} className="absolute inset-0 size-full object-contain animate-fade-in" loading={i === 0 ? "eager" : "lazy"} />
        </div>
        <figcaption className="border-t border-sand-200 px-4 py-2 text-xs text-stone-700">
          <span className="font-medium text-stone-800">{m.caption || m.title}</span> · <span data-testid="media-nature">{NATURE[m.nature] ?? m.nature}</span>{m.visibleOptions ? <span data-testid="media-options"> · visible sur l&apos;image, non inclus d&apos;office : {m.visibleOptions}</span> : null}
        </figcaption>
      </figure>
      {media.length > 1 && (
        <ul className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1" aria-label={`Visuels ${name}`}>
          {media.map((x, k) => (
            <li key={x.id} className="shrink-0 snap-start">
              <button type="button" onClick={() => setI(k)} aria-pressed={k === i} aria-label={`Afficher : ${x.alt}`} className={`block size-20 overflow-hidden rounded-lg border bg-white transition-[border-color,opacity] duration-150 ${k === i ? "border-brand-700 ring-2 ring-brand-700/30" : "border-sand-300 opacity-80 hover:opacity-100 hover:border-brand-700/50"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- vignette de la médiathèque */}
                <img src={x.smallPath ?? x.path} alt="" className="size-full object-contain" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
