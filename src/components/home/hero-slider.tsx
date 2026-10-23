"use client";
/**
 * Grand visuel de l'accueil : 1 à 3 vues choisies manuellement (aucun défilement automatique). Seule la vue active est
 * chargée au départ ; une vue n'est chargée qu'au moment où on l'affiche. Flèches du clavier lorsque le focus est dans
 * le carrousel, indicateur de la vue active, fondu court (supprimé avec la réduction des animations).
 */
import { useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MediaImage } from "@/components/ui/media-image";

export interface HeroSlide { id: string; media: { path: string; alt: string; width?: number | null; height?: number | null; smallPath?: string | null }; label: string; href: string; nature: string }

export function HeroSlider({ slides, children }: { slides: HeroSlide[]; children: ReactNode }) {
  const [i, setI] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const go = (n: number) => { const k = (n + slides.length) % slides.length; setI(k); setSeen((s) => new Set(s).add(k)); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); } };
  const cur = slides[i];
  return (
    <section className="relative isolate h-[min(88svh,56rem)] min-h-[34rem] overflow-hidden bg-night text-white" aria-roledescription="carrousel" aria-label="Nos produits en situation" onKeyDown={onKey} data-testid="home-hero">
      {slides.map((s, k) => (
        <div key={s.id} className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${k === i ? "opacity-100" : "opacity-0"}`} aria-hidden={k !== i} role="group" aria-roledescription="vue" aria-label={`${k + 1} sur ${slides.length} : ${s.label}`}>
          {seen.has(k) && <MediaImage media={s.media} sizes="100vw" eager={k === 0} className="size-full object-cover" />}
        </div>
      ))}
      {/* voile pour la lisibilité du titre et de l'en-tête superposé */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(11_15_13/0.6)_0%,rgb(11_15_13/0.1)_30%,rgb(11_15_13/0.3)_60%,rgb(11_15_13/0.8)_100%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(11_15_13/0.55)_0%,rgb(11_15_13/0.15)_55%,transparent_80%)]" aria-hidden="true" />
      <div className="container-x relative flex h-full flex-col justify-end pb-32 pt-32 sm:pb-28">{children}</div>
      {slides.length > 0 && (
        <div className="absolute inset-x-0 bottom-0">
          <div className="container-x flex flex-col items-start gap-2 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:pb-6">
            {cur && <p className="text-xs text-sand-100/90"><Link href={cur.href} className="font-semibold text-white underline-offset-4 hover:underline">{cur.label}</Link> · {cur.nature}</p>}
            {slides.length > 1 && (
              <div className="flex items-center gap-3">
                <ol className="flex items-center gap-2" aria-label="Choisir une vue">
                  {slides.map((s, k) => (
                    <li key={s.id}><button type="button" onClick={() => go(k)} aria-current={k === i ? "true" : undefined} aria-label={`Vue ${k + 1} : ${s.label}`} className="group grid h-8 w-10 place-items-center"><span className={`block h-0.5 w-full transition-colors ${k === i ? "bg-white" : "bg-white/40 group-hover:bg-white/70"}`} /></button></li>
                  ))}
                </ol>
                <button type="button" onClick={() => go(i - 1)} aria-label="Vue précédente" className="grid size-10 place-items-center border border-white/40 hover:bg-white/10"><ChevronLeft className="size-5" aria-hidden="true" /></button>
                <button type="button" onClick={() => go(i + 1)} aria-label="Vue suivante" className="grid size-10 place-items-center border border-white/40 hover:bg-white/10"><ChevronRight className="size-5" aria-hidden="true" /></button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
