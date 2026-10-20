"use client";
/**
 * Configurateur d'un système HELIOSTORES (pergola, screen, store banne) à partir des règles sourcées de la
 * famille. Le même objet `input` alimente l'évaluation (même moteur que le serveur), la 3D, le plan 2D et la
 * demande de devis. Aucun prix n'est affiché : il est établi sur devis.
 */
import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Save, Share2 } from "lucide-react";
import { saveConfigurationAction } from "@/server/actions/configurator";
import { evaluate } from "@/domain/engine";
import { defaultSystemInput, dimRangeText, nearestAllowed, spotsFor, type DimRule, type SourceRef, type SystemInput, type SystemRules } from "@/domain/system";
import type { CatalogSnapshot, SideKey } from "@/domain/types";
import { IssueList, Notice } from "@/components/ui/alert";
import { PlanPreview } from "./plan-preview";
import { QuoteForm } from "./quote-form";
import { SystemVisuals } from "./scene-3d/visuals";
import { useQuoteVisual } from "./quote-visual";

const SIDES: Array<[SideKey, string]> = [["front", "Avant"], ["left", "Gauche"], ["right", "Droite"], ["back", "Arrière"]];

function Sources({ sources }: { sources: SourceRef[] }) {
  if (!sources.length) return null;
  return (
    <details className="mt-1 text-xs text-stone-700">
      <summary className="cursor-pointer">Sources</summary>
      <ul className="mt-1 list-disc pl-4">
        {sources.map((s, i) => <li key={`${s.id}-${i}`}>{s.url ? <a href={s.url} rel="noopener noreferrer" target="_blank" className="underline">{s.label}</a> : s.label}{s.loc ? ` — ${s.loc}` : ""}</li>)}
      </ul>
    </details>
  );
}

function DimField({ id, rule, value, onChange }: { id: string; rule: DimRule; value: number | undefined; onChange: (v: number | undefined) => void }) {
  if (rule.valuesMm?.length) {
    return (
      <div>
        <label className="label" htmlFor={id}>{rule.label}</label>
        <select id={id} className="input" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
          {rule.valuesMm.map((v) => <option key={v} value={v}>{(v / 1000).toLocaleString("fr-FR")} m</option>)}
        </select>
        <p className="mt-1 text-xs text-stone-700">{dimRangeText(rule)}</p>
        <Sources sources={rule.sources} />
      </div>
    );
  }
  return (
    <div>
      <label className="label" htmlFor={id}>{rule.label} (mm)</label>
      <input id={id} type="number" inputMode="numeric" className="input" min={rule.minMm ?? undefined} max={rule.maxMm} step={rule.stepMm ?? 10} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Math.round(Number(e.target.value)))} />
      <p className="mt-1 text-xs text-stone-700">{dimRangeText(rule)}{rule.note ? ` ${rule.note}` : ""}</p>
      {value != null && rule.stepMm && rule.minMm != null && (value - rule.minMm) % rule.stepMm !== 0 && value >= rule.minMm && value <= rule.maxMm && (
        <button type="button" className="mt-1 text-xs underline" onClick={() => onChange(nearestAllowed(rule, value))}>Utiliser {nearestAllowed(rule, value)} mm</button>
      )}
      <Sources sources={rule.sources} />
    </div>
  );
}

export function SystemConfigurator({ catalog, familySlug, art, initial, existing = null }: { catalog: CatalogSnapshot; familySlug: string; art: ReactNode; initial?: Partial<SystemInput>; existing?: { id: string; token: string; title: string | null } | null }) {
  const family = catalog.families.find((f) => f.slug === familySlug)!;
  const rules = family.systemRules as SystemRules;
  const [input, setInput] = useState<SystemInput>(() => ({ ...defaultSystemInput(familySlug, rules), ...initial, kind: "system", familySlug }));
  const result = useMemo(() => evaluate(catalog, input), [catalog, input]);
  const visual = useQuoteVisual(catalog, input, result);
  const set = (patch: Partial<SystemInput>) => setInput((i) => ({ ...i, ...patch }));
  const [saved, setSaved] = useState(existing);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: ReactNode } | null>(null);
  const [busy, startTransition] = useTransition();
  const save = () => startTransition(async () => {
    const r = await saveConfigurationAction(input, title || null, saved?.id ?? null);
    if (r.ok) { setSaved({ id: r.data.id, token: r.data.token, title: title || null }); setMessage({ tone: "success", text: <>Projet enregistré. Retrouvez-le dans <Link href="/compte/projets" className="underline">Mes projets</Link>.</> }); }
    else setMessage({ tone: "error", text: r.error });
  });
  const finishes = rules.customFinish ? [...rules.finishes, rules.customFinish] : rules.finishes;
  const finish = finishes.find((f) => f.code === input.finishCode);
  const optionOn = (code: string) => input.options.find((o) => o.code === code);
  const toggleOption = (code: string, on: boolean, extra?: { qty?: number; value?: string }) =>
    setInput((i) => ({ ...i, options: on ? [...i.options.filter((o) => o.code !== code), { code, ...extra }] : i.options.filter((o) => o.code !== code) }));
  const spotOpt = rules.options.find((o) => o.spotTable);
  const spots = spotOpt ? spotsFor(spotOpt.spotTable, input.depthMm, input.widthMm) : null;
  const plan = rules.type === "pergola" && result.layout
    ? <PlanPreview layout={result.layout} segments={Object.fromEntries(result.layout.sides.flatMap((s) => s.segments.map((seg) => [seg.id, input.sides?.[s.key] ? { closureFamilySlug: input.sides[s.key]! } : null])))} finishSwatch={finish?.swatch} options={{ lighting: !!optionOn("led_perimeter") }} />
    : null;
  const blocking = result.issues.some((i) => i.severity === "blocking");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]" data-testid="system-configurator" data-family={familySlug}>
      <div className="space-y-4 lg:sticky lg:top-24 self-start">
        <SystemVisuals catalog={catalog} input={input} result={result} art={art} plan={plan} onImage={visual.onImage} onCaptureReady={visual.onCaptureReady} />
        <p className="text-xs text-stone-700">Photographies : documentation fabricant / fournisseur, non représentatives d'une réalisation HELIOSTORES. La vue 3D est indicative et ne valide ni la faisabilité ni la structure.</p>
      </div>

      <div className="space-y-6">
        <section className="card p-5" aria-labelledby="dims-title">
          <h2 id="dims-title" className="font-display text-xl">1. Dimensions</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <DimField id="dim-width" rule={rules.dims.width} value={input.widthMm} onChange={(v) => set({ widthMm: v ?? 0 })} />
            {rules.dims.depth && <DimField id="dim-depth" rule={rules.dims.depth} value={input.depthMm} onChange={(v) => set({ depthMm: v })} />}
            {rules.dims.height && <DimField id="dim-height" rule={rules.dims.height} value={input.heightMm} onChange={(v) => set({ heightMm: v })} />}
          </div>
          {rules.depthWidthMin?.length ? <p className="mt-2 text-xs text-stone-700">Largeur minimale selon l'avancée : {rules.depthWidthMin.map((c) => `${(c.depthMm / 1000).toLocaleString("fr-FR")} m → ${(c.widthMinMm / 1000).toLocaleString("fr-FR")} m`).join(" ; ")}.</p> : null}
        </section>

        <section className="card p-5" aria-labelledby="pose-title">
          <h2 id="pose-title" className="font-display text-xl">2. Pose et teinte</h2>
          <fieldset className="mt-3">
            <legend className="label">Pose</legend>
            <div className="flex flex-wrap gap-4">
              {rules.mountings.map((m) => (
                <label key={m.code} className="flex items-center gap-2 text-sm"><input type="radio" name="mounting" checked={input.mounting === m.code} onChange={() => set({ mounting: m.code, sides: m.code === "wall" ? { ...input.sides, back: null } : input.sides })} /> {m.label}{m.status === "to_confirm" ? " (à confirmer)" : ""}</label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4">
            <label className="label" htmlFor="finish">Teinte de structure</label>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="size-8 shrink-0 rounded-full border border-sand-300" style={{ background: finish?.swatch ?? "repeating-linear-gradient(45deg,#ddd,#ddd 4px,#fff 4px,#fff 8px)" }} />
              <select id="finish" className="input" value={input.finishCode} onChange={(e) => set({ finishCode: e.target.value })}>
                {finishes.map((f) => <option key={f.code} value={f.code}>{f.label}{f.status === "to_confirm" ? " — à confirmer" : ""}</option>)}
              </select>
            </div>
            <p className="mt-1 text-xs text-stone-700">Pastille d'aperçu indicative : la teinte réelle se vérifie sur nuancier.</p>
            <Sources sources={finish?.sources ?? []} />
          </div>
          {rules.fabrics?.length ? (
            <div className="mt-4">
              <label className="label" htmlFor="fabric">Toile</label>
              <select id="fabric" className="input" value={input.fabricCode ?? ""} onChange={(e) => set({ fabricCode: e.target.value })}>
                {rules.fabrics.map((f) => <option key={f.code} value={f.code}>{f.label}{f.status === "to_confirm" ? " — à confirmer" : ""}</option>)}
              </select>
              <Sources sources={rules.fabrics.find((f) => f.code === input.fabricCode)?.sources ?? []} />
            </div>
          ) : null}
          {rules.controls?.length ? (
            <div className="mt-4">
              <label className="label" htmlFor="control">Commande</label>
              <select id="control" className="input" value={input.controlCode ?? ""} onChange={(e) => set({ controlCode: e.target.value })}>
                {rules.controls.map((c) => <option key={c.code} value={c.code}>{c.label}{c.minWidthMm ? ` — largeur min. ${c.minWidthMm / 10} cm` : ""}{c.status === "to_confirm" ? " — à confirmer" : ""}</option>)}
              </select>
              {(() => { const c = rules.controls!.find((x) => x.code === input.controlCode); return c?.cable ? <p className="mt-1 text-xs text-stone-700">Fourni avec {c.cable}.</p> : null; })()}
              <Sources sources={rules.controls.find((c) => c.code === input.controlCode)?.sources ?? []} />
            </div>
          ) : null}
        </section>

        <section className="card p-5" aria-labelledby="equip-title">
          <h2 id="equip-title" className="font-display text-xl">3. Équipements</h2>
          <h3 className="mt-3 text-sm font-medium">Inclus</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-stone-800">{rules.included.map((i) => <li key={i.label}>{i.label}{i.status === "to_confirm" ? " (à confirmer)" : ""}</li>)}</ul>
          {rules.options.length > 0 && <h3 className="mt-4 text-sm font-medium">Options</h3>}
          <div className="mt-1 grid gap-2">
            {rules.options.map((o) => {
              const on = optionOn(o.code);
              return (
                <div key={o.code} className="text-sm">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" checked={!!on} onChange={(e) => toggleOption(o.code, e.target.checked, { qty: o.maxQty != null ? 1 : undefined, value: o.values?.[0]?.code })} />
                    <span>{o.label}{o.status === "to_confirm" ? " — à confirmer au devis" : ""}{o.spotTable ? (spots != null ? ` (${spots} points pour ces dimensions)` : " (nombre de points hors tableau : devis)") : ""}{o.note && o.status !== "to_confirm" ? ` — ${o.note}` : ""}</span>
                  </label>
                  {on && (o.maxQty != null || o.values?.length) ? (
                    <div className="ml-6 mt-1 flex flex-wrap gap-2">
                      {o.values?.length ? <select aria-label={`${o.label} : valeur`} className="input max-w-56" value={on.value ?? ""} onChange={(e) => toggleOption(o.code, true, { qty: on.qty, value: e.target.value })}>{o.values.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}</select> : null}
                      {o.maxQty != null ? <input aria-label={`${o.label} : quantité`} type="number" min={1} max={o.maxQty} className="input max-w-24" value={on.qty ?? 1} onChange={(e) => toggleOption(o.code, true, { qty: Math.round(Number(e.target.value)) || 1, value: on.value })} /> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {rules.type === "pergola" && rules.closureWishes?.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium">Fermetures latérales souhaitées (étude au devis)</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {SIDES.filter(([k]) => !(input.mounting === "wall" && k === "back")).map(([k, label]) => (
                  <div key={k}><label className="label" htmlFor={`side-${k}`}>{label}</label>
                    <select id={`side-${k}`} className="input" value={input.sides?.[k] ?? ""} onChange={(e) => set({ sides: { ...input.sides, [k]: e.target.value || null } })}>
                      <option value="">Ouvert</option>
                      {rules.closureWishes!.map((w) => <option key={w.familySlug} value={w.familySlug}>{w.label} (à étudier)</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {rules.type === "pergola" && rules.modules ? (
            <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={!!input.multiModule} onChange={(e) => set({ multiModule: e.target.checked })} /> Installation en plusieurs modules ({rules.modules.multiModule === "documented" ? "possible selon le fabricant, composée au devis" : "non documentée, à étudier"})</label>
          ) : null}
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={input.installation === "professional"} onChange={(e) => set({ installation: e.target.checked ? "professional" : "self" })} /> Pose professionnelle souhaitée</label>
          <div className="mt-3"><label className="label" htmlFor="notes">Précisions (support, accès, contraintes)</label><textarea id="notes" rows={3} className="input" value={input.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></div>
        </section>

        <section className="card p-5" data-testid="system-recap" aria-live="polite">
          <h2 className="font-display text-xl">Récapitulatif</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {(result.recap ?? []).filter((r) => r.label !== "Inclus").map((r, i) => (
              <div key={`${r.label}-${i}`} className="contents"><dt className="text-stone-700">{r.label}</dt><dd>{r.value}{r.status === "to_confirm" ? <span className="badge-warn ml-2">à confirmer</span> : null}</dd></div>
            ))}
          </dl>
          <p data-testid="system-price" className="mt-4 rounded-lg bg-brand-100 px-3 py-2 text-sm text-ink"><strong>Prix établi sur devis.</strong> Les tarifs transmis par nos fournisseurs sont en cours de validation (nature, devise, fiscalité) : aucun prix n'est affiché en ligne.</p>
        </section>

        <IssueList issues={result.issues.filter((i) => i.code !== "system_quote_only")} />

        <section className="card p-5" aria-labelledby="save-title">
          <h2 id="save-title" className="font-display text-xl">Enregistrer le projet</h2>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="grow"><label className="label" htmlFor="project-title">Nom du projet (facultatif)</label><input id="project-title" className="input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <button type="button" className="btn-secondary" onClick={save} disabled={busy}><Save className="size-4" aria-hidden="true" /> {saved ? "Mettre à jour le projet" : "Sauvegarder le projet"}</button>
          </div>
          {saved && <p className="mt-3 flex items-center gap-1 break-all text-xs text-stone-700"><Share2 className="size-3" aria-hidden="true" /> Lien de partage (sans données personnelles, révocable depuis Mes projets) : <a className="underline" href={`/projets/${saved.token}`}>/projets/{saved.token}</a></p>}
          {message && <div className="mt-3"><Notice tone={message.tone}>{message.text}</Notice></div>}
        </section>

        <section className="card p-5" aria-labelledby="quote-title">
          <h2 id="quote-title" className="font-display text-xl">4. Demander le devis</h2>
          {blocking ? <p className="mt-2 text-sm text-danger">Corrigez les points signalés « Impossible » pour envoyer cette configuration ; vous pouvez aussi décrire votre projet dans le message.</p> : null}
          <div className="mt-3"><QuoteForm input={blocking ? null : input} kind="system" configurationId={saved?.id ?? null} getVisual={blocking ? undefined : visual.getVisual} /></div>
        </section>
      </div>
    </div>
  );
}
