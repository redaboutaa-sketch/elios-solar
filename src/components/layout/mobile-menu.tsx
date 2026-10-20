"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

interface MobileCategory { key: string; label: string; href: string; items: ReadonlyArray<{ slug: string; name: string; href: string }> }

export function MobileMenu({ categories = [], services = [] }: { categories?: ReadonlyArray<MobileCategory>; services?: ReadonlyArray<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div className="lg:hidden">
      <button type="button" className="btn px-2 text-sand-50 hover:bg-white/10" aria-expanded={open} aria-controls={id} aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} onClick={() => setOpen((o) => !o)}>
        {open ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
      </button>
      {open && (
        <div id={id} className="absolute inset-x-0 top-full z-50 h-[calc(100dvh-4rem)] bg-sand-50 text-ink overflow-y-auto border-t border-sand-200">
          <nav aria-label="Navigation mobile" className="container-x py-4 pb-24 flex flex-col">
            {categories.map((c) => (
              <div key={c.key} className="border-b border-sand-200">
                <Link href={c.href} onClick={close} className="block py-3.5 text-lg font-display font-medium">{c.label}</Link>
                <ul className="pb-3 pl-4 space-y-1">
                  {c.items.map((p) => <li key={p.slug}><Link href={p.href} onClick={close} className="block py-1.5 text-base text-stone-800">{p.name}</Link></li>)}
                  <li><Link href={c.href} onClick={close} className="block py-1.5 text-base font-medium text-brand-700">Voir la famille</Link></li>
                </ul>
              </div>
            ))}
            {services.map((n) => (
              <Link key={n.href} href={n.href} onClick={close} className="py-3.5 text-lg border-b border-sand-200 last:border-b-0">{n.label}</Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
