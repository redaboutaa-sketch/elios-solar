"use client";
import { useId, useState } from "react";

export function ProductTabs({ tabs }: { tabs: Array<{ id: string; label: string; content: React.ReactNode }> }) {
  const [active, setActive] = useState(0);
  const base = useId();
  return (
    <div>
      <div role="tablist" aria-label="Informations produit" className="flex gap-1 overflow-x-auto border-b border-sand-200">
        {tabs.map((t, i) => (
          <button key={t.id} id={`${base}-tab-${t.id}`} role="tab" type="button" aria-selected={i === active} aria-controls={`${base}-panel-${t.id}`} onClick={() => setActive(i)} className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 -mb-px min-h-11 ${i === active ? "border-brand-500 text-ink" : "border-transparent text-stone-700 hover:text-ink"}`}>{t.label}</button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.id} id={`${base}-panel-${t.id}`} role="tabpanel" aria-labelledby={`${base}-tab-${t.id}`} hidden={i !== active} className="pt-6">{t.content}</div>
      ))}
    </div>
  );
}
