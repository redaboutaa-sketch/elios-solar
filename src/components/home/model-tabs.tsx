"use client";
/** « Nos modèles » : onglets par famille (motif ARIA tabs, flèches du clavier), modèles sur fond clair. */
import { useId, useRef, useState, type ReactNode } from "react";

export function ModelTabs({ tabs }: { tabs: Array<{ key: string; label: string; content: ReactNode }> }) {
  const [active, setActive] = useState(0);
  const base = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (k: number) => { const n = (k + tabs.length) % tabs.length; setActive(n); refs.current[n]?.focus(); };
  return (
    <div>
      <div role="tablist" aria-label="Familles" className="flex gap-6 overflow-x-auto border-b border-sand-200" onKeyDown={(e) => { if (e.key === "ArrowRight") move(active + 1); if (e.key === "ArrowLeft") move(active - 1); }}>
        {tabs.map((t, k) => (
          <button key={t.key} ref={(el) => { refs.current[k] = el; }} id={`${base}-t-${t.key}`} role="tab" type="button" aria-selected={k === active} aria-controls={`${base}-p-${t.key}`} tabIndex={k === active ? 0 : -1} onClick={() => setActive(k)} className={`-mb-px min-h-12 whitespace-nowrap border-b-2 text-sm font-semibold uppercase tracking-[0.12em] transition-colors duration-150 ${k === active ? "border-brand-700 text-ink" : "border-transparent text-stone-700 hover:text-ink"}`}>{t.label}</button>
        ))}
      </div>
      {tabs.map((t, k) => (
        <div key={t.key} id={`${base}-p-${t.key}`} role="tabpanel" aria-labelledby={`${base}-t-${t.key}`} hidden={k !== active} className="animate-fade-in pt-8">{t.content}</div>
      ))}
    </div>
  );
}
