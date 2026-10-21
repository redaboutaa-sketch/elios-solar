"use client";
/**
 * Enveloppe de l'en-tête : superposé au grand visuel de l'accueil (transparent, texte blanc), puis fond plein et
 * hauteur réduite dès que la page défile. Ailleurs, l'en-tête est collant sur fond plein et se compacte au défilement.
 * Seuls deux attributs `data-*` changent (pas de calcul de mise en page en JavaScript).
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function HeaderShell({ children }: { children: React.ReactNode }) {
  const overlay = usePathname() === "/";
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
