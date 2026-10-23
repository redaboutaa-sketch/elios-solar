"use client";
/**
 * Enveloppe de l'en-tête : collant sur fond plein, compacté au défilement. Le mode superposé (transparent, texte
 * blanc) reste disponible pour une page qui commence par un grand visuel sombre ; l'accueil commence désormais par la
 * navigation par dessins, sur fond clair (retour client du 2026-10-21).
 * Seuls deux attributs `data-*` changent (pas de calcul de mise en page en JavaScript).
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Pages dont le premier bloc est un grand visuel sombre (en-tête superposé). */
const OVERLAY_PATHS: ReadonlySet<string> = new Set<string>();

export function HeaderShell({ children }: { children: React.ReactNode }) {
  const overlay = OVERLAY_PATHS.has(usePathname());
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let raf = 0;
    const read = () => { raf = 0; setScrolled(window.scrollY > 24); };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return (
    <header data-overlay={overlay || undefined} data-scrolled={scrolled || undefined} className="site-header group/h top-0 z-40 text-sand-50">
      {children}
    </header>
  );
}
