"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { FamilySketch } from "@/components/illustrations/sketches";
import type { CategoryKey } from "@/domain/categories";

interface MobileCategory { key: string; label: string; href: string; items: ReadonlyArray<{ slug: string; name: string; href: string }> }

/**
 * Menu mobile : familles illustrées, modèles, services. Échap, la croix ou le bouton Retour du navigateur ferment le
 * menu et rendent le focus au bouton. L'ouverture ajoute une entrée d'historique (même URL) ; les liens du menu la
 * remplacent (`replace`) pour que Retour ramène ensuite à la page d'origine.
 */
export function MobileMenu({ categories = [], services = [] }: { categories?: ReadonlyArray<MobileCategory>; services?: ReadonlyArray<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const dismiss = () => {
    // fermeture volontaire : retire l'entrée d'historique ajoutée à l'ouverture (popstate ferme le menu)
    if ((window.history.state as { esMenu?: boolean } | null)?.esMenu) window.history.back();
    else setOpen(false);
    toggle.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ ...(window.history.state ?? {}), esMenu: true }, "");
    const onPop = () => { setOpen(false); toggle.current?.focus(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    return () => { window.removeEventListener("popstate", onPop); document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div className="lg:hidden">
      <button ref={toggle} type="button" className="btn px-2 text-sand-50 hover:bg-white/10" aria-expanded={open} aria-controls={id} aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} onClick={() => (open ? dismiss() : setOpen(true))}>
        {open ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
      </button>
      {open && (
        <div id={id} ref={panel} className="absolute inset-x-0 top-full z-50 h-[calc(100dvh-var(--header-h))] overflow-y-auto overscroll-contain border-t border-sand-200 bg-sand-50 text-ink animate-sheet-in">
          <nav aria-label="Navigation mobile" className="container-x flex flex-col py-5 pb-24">
            <p className="eyebrow">Choisir une famille</p>
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {categories.map((c) => (
                <li key={c.key}>
                  <Link replace href={c.href} onClick={close} className="sketch-trigger flex h-full flex-col items-center rounded-xl border border-sand-200 bg-white p-2 text-center text-sm font-semibold hover:border-brand-700 focus-visible:border-brand-700">
                    <FamilySketch kind={c.key as CategoryKey} sun={false} animated={false} className="w-full" />
                    <span className="mt-1 leading-tight">{c.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-5 divide-y divide-sand-200 border-y border-sand-200">
              {categories.map((c) => (
                <div key={c.key} className="py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-700">{c.label}</p>
                  <ul className="mt-1">
                    {c.items.map((p) => <li key={p.slug}><Link replace href={p.href} onClick={close} className="flex min-h-11 items-center text-base">{p.name}</Link></li>)}
                  </ul>
                </div>
              ))}
            </div>
            {services.map((n) => (
              <Link key={n.href} href={n.href} onClick={close} className="flex min-h-12 items-center border-b border-sand-200 text-lg">{n.label}</Link>
            ))}
            <Link replace href="/configurateur" onClick={close} className="btn-accent mt-6 w-full text-base">Configurer mon projet <ArrowRight className="size-4" aria-hidden="true" /></Link>
          </nav>
        </div>
      )}
    </div>
  );
}
