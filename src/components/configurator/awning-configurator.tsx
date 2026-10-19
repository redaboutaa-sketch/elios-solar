"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { evaluate } from "@/domain/engine";
import { formatEur } from "@/domain/money";
import type { AwningInput, CatalogSnapshot } from "@/domain/types";
import { addToCartAction } from "@/server/actions/configurator";
import { AwningArt } from "@/components/illustrations/pergola";
import { IssueList, Notice } from "@/components/ui/alert";
import { DemoBadge } from "@/components/ui/demo-badge";
import { QuoteForm } from "./quote-form";

const CAB: Record<string, string> = { ANTHRACITE: "#3a3d41", WHITE: "#e9e6df" };
const FAB: Record<string, [string, string]> = { GREY: ["gris", "#9a9a94"], BEIGE: ["beige", "#d9c7a5"] };

export function AwningConfigurator({ catalog, familySlug }: { catalog: CatalogSnapshot; familySlug: string }) {
  const variants = catalog.variants.filter((v) => v.familySlug === familySlug && v.attributes.kind === "awning");
  const combos = [...new Map(variants.map((v) => { const a = v.attributes as { widthMm: number; projectionMm: number }; return [`${a.widthMm}-${a.projectionMm}`, a] as const; })).values()];
  const widths = [...new Set(combos.map((c) => c.widthMm))].sort((a, b) => a - b);
  const router = useRouter();
  const [input, setInput] = useState<AwningInput>({ kind: "awning", familySlug, widthMm: combos[0]?.widthMm ?? 3000, projectionMm: combos[0]?.projectionMm ?? 2000, cabinetColor: "ANTHRACITE", fabricCode: "GREY", bracketMount: "wall", options: [], installation: "self", delivery: { countryCode: "FR" } });
  const projections = combos.filter((c) => c.widthMm === input.widthMm).map((c) => c.projectionMm).sort((a, b) => a - b);
  const result = useMemo(() => evaluate(catalog, input), [catalog, input]);
  const [msg, setMsg] = useState<string | null>(null);
  const [showQuote, setShowQuote] = useState(false);
  const [busy, start] = useTransition();
  const anemo = catalog.families.find((f) => f.slug === "anemometre");
  const setWidth = (w: number) => { const p = combos.filter((c) => c.widthMm === w).map((c) => c.projectionMm); setInput((i) => ({ ...i, widthMm: w, projectionMm: p.includes(i.projectionMm) ? i.projectionMm : (p[0] ?? i.projectionMm) })); };
  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-4 lg:sticky lg:top-24 self-start">
        <div className="card overflow-hidden"><AwningArt cabinet={CAB[input.cabinetColor]} fabric={FAB[input.fabricCode]?.[1]} className="w-full h-auto" /></div>
        <div className="card p-5"><p className="text-sm text-stone-700">Total {result.totals.isFinal ? "définitif" : "estimé"}</p><p className="text-3xl font-semibold">{formatEur(result.totals.totalGrossCents)}</p>{result.containsDemoData && <DemoBadge className="mt-1" />}</div>
      </div>
      <div className="space-y-6">
        <section className="card p-5 space-y-4">
          <div><p className="label">Largeur</p><div className="flex flex-wrap gap-2" data-testid="awning-widths">{widths.map((w) => <button key={w} type="button" aria-pressed={input.widthMm === w} onClick={() => setWidth(w)} className={`rounded-full border px-4 py-2 text-sm min-h-11 ${input.widthMm === w ? "border-ink bg-anthracite text-sand-50" : "border-sand-300 bg-white"}`}>{w / 1000} m</button>)}</div></div>
          <div><p className="label">Avancée (selon largeur)</p><div className="flex flex-wrap gap-2" data-testid="awning-projections">{projections.map((p) => <button key={p} type="button" aria-pressed={input.projectionMm === p} onClick={() => setInput((i) => ({ ...i, projectionMm: p }))} className={`rounded-full border px-4 py-2 text-sm min-h-11 ${input.projectionMm === p ? "border-ink bg-anthracite text-sand-50" : "border-sand-300 bg-white"}`}>{p / 1000} m</button>)}</div><p className="text-xs text-stone-700 mt-1">Seules les combinaisons fabriquées sont proposées.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset><legend className="label">Couleur du coffre</legend>{Object.entries(CAB).map(([k, c]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="cab" checked={input.cabinetColor === k} onChange={() => setInput((i) => ({ ...i, cabinetColor: k }))} /><span className="size-4 rounded-full border" style={{ background: c }} aria-hidden="true" />{k === "WHITE" ? "Blanc" : "Anthracite"}</label>)}</fieldset>
            <fieldset><legend className="label">Toile</legend>{Object.entries(FAB).map(([k, [l, c]]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="fab" checked={input.fabricCode === k} onChange={() => setInput((i) => ({ ...i, fabricCode: k }))} /><span className="size-4 rounded-full border" style={{ background: c }} aria-hidden="true" />{l}</label>)}</fieldset>
            <fieldset><legend className="label">Fixation (supports inclus)</legend><label className="flex gap-2 text-sm"><input type="radio" name="br" checked={input.bracketMount === "wall"} onChange={() => setInput((i) => ({ ...i, bracketMount: "wall" }))} /> Murale</label><label className="flex gap-2 text-sm"><input type="radio" name="br" checked={input.bracketMount === "ceiling"} onChange={() => setInput((i) => ({ ...i, bracketMount: "ceiling" }))} /> Plafond</label></fieldset>
            <fieldset><legend className="label">Options</legend>{anemo && <label className="flex gap-2 text-sm"><input type="checkbox" checked={input.options.some((o) => o.familySlug === "anemometre")} onChange={(e) => setInput((i) => ({ ...i, options: e.target.checked ? [{ familySlug: "anemometre", qty: 1 }] : [] }))} /> {anemo.name} — {anemo.shortDescription}</label>}<label className="flex gap-2 text-sm mt-1"><input type="checkbox" checked={input.installation === "professional"} onChange={(e) => setInput((i) => ({ ...i, installation: e.target.checked ? "professional" : "self" }))} /> Montage professionnel</label></fieldset>
          </div>
          <div><label className="label" htmlFor="cp-store">Code postal de livraison</label><input id="cp-store" className="input max-w-xs" inputMode="numeric" value={input.delivery.postalCode ?? ""} onChange={(e) => setInput((i) => ({ ...i, delivery: { countryCode: "FR", postalCode: e.target.value.replace(/\D/g, "").slice(0, 5) } }))} /></div>
        </section>
        <section className="card p-5">
          <table className="w-full text-sm"><tbody>{result.lines.map((l) => <tr key={l.code} className="border-b border-sand-200"><td className="py-2">{l.label}{l.qty > 1 && ` × ${l.qty}`}</td><td className="py-2 text-right">{l.included ? "inclus" : formatEur(l.totalGrossCents)}</td></tr>)}<tr><td className="py-2">Livraison</td><td className="text-right">{result.totals.shippingGrossCents === null ? "à calculer" : formatEur(result.totals.shippingGrossCents)}</td></tr><tr className="font-semibold text-lg"><td className="pt-2">Total TTC</td><td className="pt-2 text-right">{formatEur(result.totals.totalGrossCents)}</td></tr></tbody></table>
          <IssueList issues={result.issues} className="mt-3" />
          {msg && <div className="mt-3"><Notice tone="error">{msg}</Notice></div>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-accent" disabled={busy || !result.purchasable} onClick={() => start(async () => { const r = await addToCartAction(input, null); if (r.ok) router.push("/panier"); else setMsg(r.error); })}>Ajouter au panier</button>
            <button type="button" className="btn-secondary" onClick={() => setShowQuote((s) => !s)}>Demander un devis</button>
          </div>
          {showQuote && <div className="mt-4 border-t border-sand-200 pt-4"><QuoteForm input={input} kind="configuration" configurationId={null} /></div>}
        </section>
      </div>
    </div>
  );
}
