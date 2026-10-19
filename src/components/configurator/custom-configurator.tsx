"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatEur } from "@/domain/money";
import { addToCartAction } from "@/server/actions/configurator";
import { DemoBadge } from "@/components/ui/demo-badge";
import { evaluate } from "@/domain/engine";
import type { CatalogSnapshot, PergolaCustomInput, SideKey } from "@/domain/types";
import { PlanPreview } from "./plan-preview";
import { IssueList } from "@/components/ui/alert";
import { QuoteForm } from "./quote-form";
import { PergolaArt, colorOf } from "@/components/illustrations/pergola";
import { PergolaVisuals } from "./scene-3d/visuals";
import { useQuoteVisual } from "./quote-visual";

const SIDES: Array<[SideKey, string]> = [["back", "Arrière"], ["front", "Avant"], ["left", "Gauche"], ["right", "Droite"]];

export function CustomConfigurator({ catalog }: { catalog: CatalogSnapshot }) {
  const c = catalog.custom;
  const [input, setInput] = useState<PergolaCustomInput>({ kind: "pergola_custom", widthMm: 3500, lengthMm: 4500, heightMm: 2500, mounting: "wall", finishCode: "ANTHRACITE", sides: {}, options: [], installation: "self", delivery: { countryCode: "FR" } });
  const result = useMemo(() => evaluate(catalog, input), [catalog, input]);
  const visual = useQuoteVisual(catalog, input, result);
  const customFamily = catalog.families.find((f) => f.kind === "pergola_custom");
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const priced = result.lines.some((l) => l.kind === "base");
  const estimate = priced && !result.purchasable;
  const fin = catalog.finishes.find((f) => f.code === input.finishCode);
  const closures = catalog.families.filter((f) => f.kind === "side_closure");
  const num = (k: "widthMm" | "lengthMm" | "heightMm") => (e: React.ChangeEvent<HTMLInputElement>) => setInput((i) => ({ ...i, [k]: Number(e.target.value) || 0 }));
  const segmentsForPreview = Object.fromEntries(Object.entries(input.sides).flatMap(([side, v]) => (v ? [[`${side}-1`, { closureFamilySlug: v.closureFamilySlug }], [`${side}-2`, { closureFamilySlug: v.closureFamilySlug }]] : [])));
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4 lg:sticky lg:top-24 self-start">
        <PergolaVisuals catalog={catalog} input={input} result={result} onImage={visual.onImage} onCaptureReady={visual.onCaptureReady}
          art={<PergolaArt structure={colorOf(fin?.structureColor)} blades={colorOf(fin?.bladeColor)} mounting={input.mounting} lighting className="w-full h-auto" title="Aperçu schématique sur mesure" />}
          plan={result.layout ? <PlanPreview layout={result.layout} segments={segmentsForPreview} finishSwatch={fin?.swatch} options={{ lighting: (!!customFamily?.lightingIncluded && customFamily.lightingIncluded !== "none") || input.options.some((o) => o.familySlug === "bandes-led"), heaters: input.options.find((o) => o.familySlug === "lampe-chauffante")?.qty }} /> : null} />
        <p className="text-xs text-stone-700">Bornes dimensionnelles : largeur {c.widthMm.min}–{c.widthMm.max} mm, longueur {c.lengthMm.min}–{c.lengthMm.max} mm, hauteur {c.heightMm.min}–{c.heightMm.max} mm ({c.dataStatus === "unknown" ? "à confirmer par le fournisseur" : c.dataStatus}).</p>
      </div>
      <div className="space-y-8">
        <section className="card p-5 grid gap-4 sm:grid-cols-3">
          {([["widthMm", "Largeur (mm)", c.widthMm], ["lengthMm", "Longueur (mm)", c.lengthMm], ["heightMm", "Hauteur sous poutre (mm)", c.heightMm]] as const).map(([k, label, r]) => (
            <div key={k}><label className="label" htmlFor={k}>{label}</label><input id={k} type="number" className="input" min={r.min} max={r.max} step={r.step} value={input[k]} onChange={num(k)} /><input aria-label={`${label} (curseur)`} type="range" className="w-full mt-2" min={r.min} max={r.max} step={r.step} value={input[k]} onChange={num(k)} /></div>
          ))}
          <div className="sm:col-span-3 grid gap-4 sm:grid-cols-2">
            <fieldset><legend className="label">Implantation</legend><label className="flex gap-2 text-sm"><input type="radio" name="m" checked={input.mounting === "wall"} onChange={() => setInput((i) => ({ ...i, mounting: "wall" }))} /> Adossée</label><label className="flex gap-2 text-sm"><input type="radio" name="m" checked={input.mounting === "freestanding"} onChange={() => setInput((i) => ({ ...i, mounting: "freestanding" }))} /> Autoportée</label></fieldset>
            <div><label className="label" htmlFor="fin">Finition</label><select id="fin" className="input" value={input.finishCode} onChange={(e) => setInput((i) => ({ ...i, finishCode: e.target.value }))}>{catalog.finishes.filter((f) => catalog.families.find((x) => x.kind === "pergola_custom")?.finishCodes?.includes(f.code) ?? true).map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}</select></div>
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-display text-xl">Fermetures souhaitées par côté</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {SIDES.filter(([k]) => !(input.mounting === "wall" && k === "back")).map(([k, label]) => (
              <div key={k}><label className="label" htmlFor={`side-${k}`}>{label}</label><select id={`side-${k}`} className="input" value={input.sides[k]?.closureFamilySlug ?? ""} onChange={(e) => setInput((i) => ({ ...i, sides: { ...i.sides, [k]: e.target.value ? { closureFamilySlug: e.target.value } : null } }))}><option value="">Ouvert</option>{closures.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}</select></div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {catalog.families.filter((f) => f.kind === "option" && f.slug !== "anemometre" && f.slug !== "cable-alimentation").map((f) => <label key={f.slug} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={input.options.some((o) => o.familySlug === f.slug)} onChange={(e) => setInput((i) => ({ ...i, options: e.target.checked ? [...i.options, { familySlug: f.slug, qty: 1 }] : i.options.filter((o) => o.familySlug !== f.slug) }))} /> {f.name}</label>)}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={input.installation === "professional"} onChange={(e) => setInput((i) => ({ ...i, installation: e.target.checked ? "professional" : "self" }))} /> Montage professionnel souhaité</label>
          </div>
          <div className="mt-4"><label className="label" htmlFor="notes">Précisions (terrain, contraintes, accès)</label><textarea id="notes" rows={3} className="input" value={input.notes ?? ""} onChange={(e) => setInput((i) => ({ ...i, notes: e.target.value }))} /></div>
        </section>
        <section className="card p-5" data-testid="custom-price" aria-live="polite">
          {priced ? (
            <>
              <p className="text-sm text-stone-700">{estimate ? "Estimation indicative (non contractuelle)" : "Prix calculé depuis la grille fournisseur"}</p>
              <p className="text-3xl font-semibold">{estimate ? "≈ " : ""}{formatEur(result.totals.totalGrossCents)} <span className="text-sm font-normal text-stone-700">TTC{result.totals.shippingGrossCents === null ? ", hors livraison" : ""}</span></p>
              {result.containsDemoData && <DemoBadge label="grille fictive de démonstration" className="mt-1" />}
              <table className="mt-3 w-full text-sm"><tbody>{result.lines.map((l) => <tr key={l.code} className="border-b border-sand-200"><td className="py-1.5">{l.label}{l.qty > 1 && ` × ${l.qty}`}</td><td className="py-1.5 text-right whitespace-nowrap">{formatEur(l.totalGrossCents)}</td></tr>)}</tbody></table>
              {estimate && <p className="mt-2 text-xs text-stone-700">Cette estimation ne devient jamais automatiquement un prix ferme : notre équipe confirme le prix par devis après étude.</p>}
            </>
          ) : (
            <p className="text-sm">Pas de prix calculable pour cette combinaison : le projet complet (cotes, fermetures, options, précisions) est conservé dans votre demande de devis.</p>
          )}
          {result.purchasable && (
            <div className="mt-4 space-y-2">
              <div><label className="label" htmlFor="cp-sm">Code postal de livraison</label><input id="cp-sm" className="input max-w-xs" inputMode="numeric" value={input.delivery.postalCode ?? ""} onChange={(e) => setInput((i) => ({ ...i, delivery: { countryCode: "FR", postalCode: e.target.value.replace(/\D/g, "").slice(0, 5) } }))} /></div>
              <button type="button" className="btn-accent" disabled={busy} onClick={() => start(async () => { const r = await addToCartAction(input, null, null); if (r.ok) router.push("/panier"); else setErr(r.error); })}>Ajouter au panier</button>
              {err && <p className="text-sm text-danger">{err}</p>}
            </div>
          )}
        </section>
        <IssueList issues={result.issues} />
        <section className="card p-5">
          <h2 className="font-display text-xl">Demander le devis</h2>
          <div className="mt-3"><QuoteForm input={input} kind="custom" configurationId={null} getVisual={visual.getVisual} /></div>
        </section>
      </div>
    </div>
  );
}
