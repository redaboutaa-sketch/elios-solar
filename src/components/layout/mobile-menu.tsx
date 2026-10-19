"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function MobileMenu({ items }: { items: ReadonlyArray<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);
  return (
    <div className="lg:hidden">
      <button type="button" className="btn-ghost px-2" aria-expanded={open} aria-controls={id} aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} onClick={() => setOpen((o) => !o)}>
        {open ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
      </button>
      {open && (
        <div id={id} className="fixed inset-x-0 top-16 bottom-0 z-50 bg-sand-50 overflow-y-auto border-t border-sand-200">
          <nav aria-label="Navigation mobile" className="container-x py-4 flex flex-col">
            {items.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="py-3.5 text-lg border-b border-sand-200">{n.label}</Link>
            ))}
            <Link href="/devis" onClick={() => setOpen(false)} className="py-3.5 text-lg border-b border-sand-200">Demander un devis</Link>
            <Link href="/contact" onClick={() => setOpen(false)} className="py-3.5 text-lg">Contact</Link>
          </nav>
        </div>
      )}
    </div>
  );
}
