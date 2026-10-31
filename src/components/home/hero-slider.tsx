"use client";
/**
 * Grand visuel de l'accueil : une vue par famille, choisie manuellement (aucun défilement automatique). La première vue
 * (et toute vue ouverte avant d'avoir été préchargée) est chargée en priorité ; la suivante est préchargée en priorité basse une fois l'image active affichée et le
 * navigateur inactif (fondu sans vide), les autres au moment où on s'en approche. AVIF proposé avant WebP, cadrage
 * (`object-position`) propre à chaque vue sur mobile et à partir de 1024 px. Flèches du clavier lorsque le focus est
 * dans le carrousel, indicateur de la vue active, fondu court (supprimé avec la réduction des animations).
 */
import { useEffect, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { mediaSrcSet, smallPathOf } from "@/components/ui/media-image";

export interface HeroSlide {
  id: string;
  media: { path: string; alt: string; width?: number | null; height?: number | null; smallPath?: string | null; mediumPath?: string | null; avif?: { path: string; width: number }[]; focus?: { mobile: string; desktop: string } | null };
  label: string; href: string; nature: string;
}

const idle = (fn: () => void) => { const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }; if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 3000 }); else setTimeout(fn, 1200); };

function HeroImage({ media: m, priority, onLoad }: { media: HeroSlide["media"]; priority: boolean; onLoad?: () => void }) {
  const srcSet = mediaSrcSet(m);
  const avif = m.avif?.length ? m.avif.map((a) => `${a.path} ${a.width}w`).join(", ") : undefined;
  const style = m.focus ? ({ "--pos-m": m.focus.mobile, "--pos-d": m.focus.desktop } as CSSProperties) : undefined;
  return (
    <picture className="block size-full">
      {avif && <source type="image/avif" srcSet={avif} sizes="100vw" />}
      <img src={srcSet ? m.path : (smallPathOf(m) ?? m.path)} srcSet={srcSet} sizes={srcSet ? "100vw" : undefined} alt={m.alt} width={m.width ?? undefined} height={m.height ?? undefined}
        loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "low"} decoding="async" onLoad={onLoad} style={style}
        className={`size-full object-cover ${m.focus ? "object-[var(--pos-m)] lg:object-[var(--pos-d)]" : ""}`} />
    </picture>
  );
}

export function HeroSlider({ slides, children }: { slides: HeroSlide[]; children: ReactNode }) {
  const [i, setI] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  // vue suivante préchargée quand l'image active est affichée et que le navigateur est inactif
  const preloadNext = (k: number) => idle(() => setSeen((s) => (s.has((k + 1) % slides.length) ? s : new Set(s).add((k + 1) % slides.length))));
  const go = (n: number) => { const k = (n + slides.length) % slides.length; setI(k); if (seen.has(k)) preloadNext(k); setSeen((s) => new Set(s).add(k)); };
  // première vue : son chargement peut précéder l'hydratation (onLoad manqué) → fin du chargement de la page
  useEffect(() => {
    if (slides.length < 2) return;
    const start = () => preloadNext(0);
    if (document.readyState === "complete") start(); else window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois au montage
  }, []);
  const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); } };
  const cur = slides[i];
  return (
    <section className="relative isolate h-[min(88svh,56rem)] min-h-[34rem] overflow-hidden bg-night text-white" aria-roledescription="carrousel" aria-label="Nos produits en situation" onKeyDown={onKey} data-testid="home-hero">
      {slides.map((s, k) => (
        <div key={s.id} className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${k === i ? "opacity-100" : "opacity-0"}`} aria-hidden={k !== i} role="group" aria-roledescription="vue" aria-label={`${k + 1} sur ${slides.length} : ${s.label}`}>
          {seen.has(k) && <HeroImage media={s.media} priority={k === 0 || k === i} onLoad={k === i ? () => preloadNext(k) : undefined} />}
        </div>
      ))}
      {/* voile pour la lisibilité du titre, de la légende et des commandes : léger en haut (aucun texte), plus dense
          derrière le texte (titre ≥ 3,6:1 au 95e centile sur les quatre visuels, mesuré à 390, 768 et 1440 px) */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(11_15_13/0.25)_0%,rgb(11_15_13/0.04)_25%,rgb(11_15_13/0.3)_48%,rgb(11_15_13/0.55)_70%,rgb(11_15_13/0.8)_100%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(11_15_13/0.5)_0%,rgb(11_15_13/0.12)_55%,transparent_80%)]" aria-hidden="true" />
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
