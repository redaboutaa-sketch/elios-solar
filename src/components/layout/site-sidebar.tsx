"use client";
/**
 * Navigation latérale (ordinateur) : les quatre familles et leurs modèles, options et accessoires, installation et
 * guides, références, devis et contact. Même source que le menu mobile (`publicNavigation`), pour ne pas multiplier
 * les menus concurrents. La rubrique active est indiquée (aria-current + repère visuel) ; la famille de la page
 * courante est dépliée. Repliable pour laisser la place au configurateur (préférence conservée localement).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { HeaderCategory } from "./header";
import { SIDEBAR_LINKS } from "@/config/brand";

const PREF = "heliostores:sidebar";

export function SiteSidebar({ categories }: { categories: HeaderCategory[] }) {
  const path = usePathname() ?? "/";
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => { try { setCollapsed(window.localStorage.getItem(PREF) === "collapsed"); } catch { /* préférence indisponible */ } }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const toggle = () => setCollapsed((c) => {
    try { window.localStorage.setItem(PREF, c ? "open" : "collapsed"); } catch { /* idem */ }
    return !c;
  });
  // famille active : page de famille, fiche ou configurateur d'un de ses modèles
  const activeFamily = categories.find((c) => path === c.href || path.startsWith(`${c.href}/`) || c.items.some((p) => path === `/configurateur/${p.slug}`));
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});
  const isOpen = (key: string) => openKeys[key] ?? activeFamily?.key === key;
  // rubrique active : la correspondance la plus précise seulement (« Prise de mesures » plutôt que « Guides »)
  const best = SIDEBAR_LINKS.map((l) => l.href).filter((h) => path === h || path.startsWith(`${h}/`)).sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === best;

  if (collapsed) {
    return (
      <aside className="site-sidebar hidden lg:block" data-collapsed="true" aria-label="Navigation du catalogue">
        <div className="sticky top-[calc(var(--header-h)+1rem)] px-2">
          <button type="button" onClick={toggle} className="btn-ghost size-10 p-0" aria-label="Déplier la navigation du catalogue" aria-expanded={false}><PanelLeftOpen className="size-5" aria-hidden="true" /></button>
        </div>
      </aside>
    );
  }
  return (
    <aside className="site-sidebar hidden lg:block" aria-label="Navigation du catalogue" data-testid="site-sidebar">
      <nav className="sticky top-[calc(var(--header-h)+1rem)] max-h-[calc(100dvh-var(--header-h)-2rem)] overflow-y-auto overscroll-contain py-2 pl-4 pr-3 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow">Catalogue</p>
          <button type="button" onClick={toggle} className="btn-ghost size-9 p-0" aria-label="Replier la navigation du catalogue" aria-expanded={true}><PanelLeftClose className="size-4" aria-hidden="true" /></button>
        </div>
        <ul className="space-y-0.5">
          {categories.map((c) => {
            const open = isOpen(c.key);
            const famActive = activeFamily?.key === c.key;
            return (
              <li key={c.key}>
                <div className="flex items-center">
                  <Link href={c.href} aria-current={path === c.href ? "page" : undefined} className={`side-link grow font-semibold ${famActive ? "text-brand-800" : ""}`} data-active={path === c.href || undefined}>{c.label}</Link>
                  <button type="button" className="btn-ghost size-8 shrink-0 p-0" aria-expanded={open} aria-label={`${open ? "Masquer" : "Afficher"} les modèles ${c.label}`} onClick={() => setOpenKeys((o) => ({ ...o, [c.key]: !open }))}><ChevronDown className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" /></button>
                </div>
                {open && c.items.length > 0 && (
                  <ul className="mb-1 ml-2 border-l border-sand-200 pl-2">
                    {c.items.map((p) => {
                      const here = path === p.href || path === `/configurateur/${p.slug}`;
                      return <li key={p.slug}><Link href={p.href} aria-current={here ? "page" : undefined} data-active={here || undefined} className="side-link">{p.name}</Link></li>;
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        <ul className="mt-3 space-y-0.5 border-t border-sand-200 pt-3">
          {SIDEBAR_LINKS.map((l) => <li key={l.href}><Link href={l.href} aria-current={isActive(l.href) ? "page" : undefined} data-active={isActive(l.href) || undefined} className="side-link">{l.label}</Link></li>)}
        </ul>
        <Link href="/devis" className="btn-cta mt-4 w-full text-sm">Demander un devis</Link>
      </nav>
    </aside>
  );
}
