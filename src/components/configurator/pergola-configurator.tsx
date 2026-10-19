"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Share2, Save, ShoppingBag, FileText } from "lucide-react";
import { adaptStandardInput, evaluate } from "@/domain/engine";
import { allSegments, layoutForFamily, segmentLabel } from "@/domain/layout";
import { closureChoicesFor, optionChoicesFor } from "@/domain/helpers";
import { formatEur } from "@/domain/money";
import type { CatalogSnapshot, EvaluationResult, PergolaStandardInput, SegmentChoice } from "@/domain/types";
import { addToCartAction, evaluateAction, saveConfigurationAction } from "@/server/actions/configurator";
import { PlanPreview } from "./plan-preview";
import { PergolaArt, colorOf } from "@/components/illustrations/pergola";
import { IssueList, Notice } from "@/components/ui/alert";
import { DemoBadge } from "@/components/ui/demo-badge";
import { QuoteForm } from "./quote-form";

type Pending = ReturnType<typeof adaptStandardInput>["pending"];

export function PergolaConfigurator({ catalog, initial, existing }: { catalog: CatalogSnapshot; initial: PergolaStandardInput; existing?: { id: string; token: string; title: string | null } | null }) {
  const router = useRouter();
  const [input, setInput] = useState<PergolaStandardInput>(initial);
  const [pending, setPending] = useState<Pending>([]);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [serverResult, setServerResult] = useState<EvaluationResult | null>(null);
  const [saved, setSaved] = useState(existing ?? null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [message, setMessage] = useState<{ tone: "info" | "warn" | "error" | "success"; text: React.ReactNode } | null>(null);
  const [showQuote, setShowQuote] = useState(false);
  const [busy, startTransition] = useTransition();
  const recapRef = useRef<HTMLDivElement>(null);

  const family = catalog.families.find((f) => f.slug === input.familySlug);
  const dim = catalog.dimensions.find((d) => d.code === input.dimensionCode);
  const fin = catalog.finishes.find((f) => f.code === input.finishCode);
  const result = useMemo(() => evaluate(catalog, input), [catalog, input]);
  const layout = useMemo(() => (family && dim ? layoutForFamily(family, dim.widthMm, dim.lengthMm, input.mounting) : null), [family, dim, input.mounting]);
  const segments = layout ? allSegments(layout) : [];

  // Confirmation serveur (autoritaire) avec léger délai
  useEffect(() => {
    const t = setTimeout(() => {
      evaluateAction(input).then((r) => { if (r.ok) setServerResult(r.data); });
    }, 400);
    return () => clearTimeout(t);
  }, [input]);
  const confirmed = serverResult && serverResult.totals.totalGrossCents === result.totals.totalGrossCents && serverResult.catalogVersion === result.catalogVersion;

  const change = (patch: Partial<Pick<PergolaStandardInput, "familySlug" | "dimensionCode" | "mounting" | "finishCode">>) => {
    const { next, pending: p } = adaptStandardInput(catalog, input, patch);
    setInput(next);
    if (p.length) setPending((prev) => [...prev, ...p]);
    setSelectedSegment(null);
  };
  const setSegment = (id: string, choice: SegmentChoice | null) => setInput((i) => ({ ...i, segments: { ...i.segments, [id]: choice } }));
  const setOption = (familySlug: string, variantOption: string | undefined, qty: number) =>
    setInput((i) => {
      const others = i.options.filter((o) => o.familySlug !== familySlug);
      return { ...i, options: qty > 0 ? [...others, { familySlug, variantOption, qty }] : others };
    });

  const save = () => startTransition(async () => {
    const r = await saveConfigurationAction(input, title || null, saved?.id ?? null);
    if (r.ok) { setSaved({ id: r.data.id, token: r.data.token, title: title || null }); setMessage({ tone: "success", text: <>Projet enregistré. Retrouvez-le dans <Link href="/compte/projets" className="underline">Mes projets</Link>.</> }); }
    else setMessage({ tone: "error", text: r.error });
  });
  const addToCart = () => startTransition(async () => {
    const r = await addToCartAction(input, saved?.id ?? null);
    if (r.ok) router.push("/panier");
    else setMessage({ tone: "error", text: r.error });
  });
  const shareUrl = saved ? `${window.location.origin}/projets/${saved.token}` : null;
  const stdFamilies = catalog.families.filter((f) => f.kind === "pergola_standard");
  const blocking = result.issues.filter((i) => i.severity !== "info");

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      {/* Colonne visuelle */}
      <div className="space-y-4 lg:sticky lg:top-24 self-start">
        <div className="card overflow-hidden"><PergolaArt structure={colorOf(fin?.structureColor)} blades={colorOf(fin?.bladeColor)} mounting={input.mounting} lighting={!!family?.lightingIncluded && family.lightingIncluded !== "none" || input.options.some((o) => o.familySlug === "bandes-led")} closures={{ left: artFor(input.segments["left-1"]), right: artFor(input.segments["right-1"]), front: artFor(input.segments["front-1"]) }} className="w-full h-auto" title="Aperçu schématique de la configuration" /></div>
        {layout && <div className="card p-3"><PlanPreview layout={layout} segments={input.segments} selected={selectedSegment} onSelect={(id) => { setSelectedSegment(id); document.getElementById("etape-ouvertures")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} finishSwatch={fin?.swatch} options={{ lighting: !!family?.lightingIncluded && family.lightingIncluded !== "none" || input.options.some((o) => o.familySlug === "bandes-led"), heaters: input.options.find((o) => o.familySlug === "lampe-chauffante")?.qty }} /></div>}
        <div className="card p-5 hidden lg:block" aria-live="polite">
          <p className="text-sm text-stone-700">Total estimé {result.totals.isFinal ? "(définitif)" : "(hors livraison)"}</p>
          <p className="text-3xl font-semibold">{formatEur(result.totals.totalGrossCents)} <span className="text-sm font-normal text-stone-700">TTC</span></p>
          <p className="mt-1 text-xs text-stone-700">{confirmed ? <span className="inline-flex items-center gap-1 text-success"><Check className="size-3" aria-hidden="true" /> prix confirmé par le serveur</span> : "confirmation en cours…"}{result.containsDemoData && <> · <DemoBadge /></>}</p>
        </div>
      </div>

      {/* Colonne configuration */}
      <div className="space-y-10">
        <Step n={1} title="Gamme" hint={<Link href="/comparer" className="underline">Comparer les gammes</Link>}>
          <div className="grid gap-3 sm:grid-cols-3">
            {stdFamilies.map((f) => (
              <label key={f.slug} className={`card p-4 cursor-pointer ${input.familySlug === f.slug ? "border-ink ring-1 ring-ink" : ""}`}>
                <input type="radio" name="gamme" className="sr-only" checked={input.familySlug === f.slug} onChange={() => change({ familySlug: f.slug })} />
                <span className="font-display text-lg">{f.name}</span>
                <span className="block mt-1 text-xs text-stone-700">{f.roof === "motorized" ? "Toit motorisé" : "Toit manuel"} · {f.lightingIncluded === "gutter_led" ? "LED gouttière incluse" : f.lightingIncluded === "blade_led" ? "LED lames incluse" : "éclairage en option"} · {f.accessoryRails} rail{(f.accessoryRails ?? 1) > 1 ? "s" : ""}</span>
              </label>
            ))}
          </div>
        </Step>

        <Step n={2} title="Implantation">
          <div className="grid gap-3 sm:grid-cols-2">
            {([["freestanding", "Autoportée", "4 poteaux, indépendante de la maison"], ["wall", "Adossée", "fixée au mur sur la longueur, 2 poteaux"]] as const).map(([v, l, d]) => (
              <label key={v} className={`card p-4 cursor-pointer ${input.mounting === v ? "border-ink ring-1 ring-ink" : ""} ${!family?.mountings?.includes(v) ? "opacity-50" : ""}`}>
                <input type="radio" name="implantation" className="sr-only" checked={input.mounting === v} disabled={!family?.mountings?.includes(v)} onChange={() => change({ mounting: v })} />
                <span className="font-medium">{l}</span><span className="block text-xs text-stone-700">{d}</span>
              </label>
            ))}
          </div>
        </Step>

        <Step n={3} title="Dimension" hint="largeur × longueur, d'extérieur de poteau à extérieur de poteau">
          <div className="flex flex-wrap gap-2">
            {catalog.dimensions.map((d) => {
              const ok = family?.dimensionCodes?.includes(d.code);
              return <button key={d.code} type="button" disabled={!ok} aria-pressed={input.dimensionCode === d.code} onClick={() => change({ dimensionCode: d.code })} className={`rounded-full border px-4 py-2 text-sm min-h-11 ${input.dimensionCode === d.code ? "border-ink bg-anthracite text-sand-50" : "border-sand-300 bg-white"} disabled:opacity-40`}>{d.label}</button>;
            })}
          </div>
          <p className="mt-2 text-xs text-stone-700">Autre taille ? <Link href="/configurateur/sur-mesure" className="underline">Pergola sur mesure (devis)</Link>. Les côtés de 6 m comportent un poteau intermédiaire : deux segments de 3 m à équiper.</p>
        </Step>

        <Step n={4} title="Finition">
          <div className="flex flex-wrap gap-2">
            {catalog.finishes.map((f) => {
              const ok = family?.finishCodes?.includes(f.code);
              return <button key={f.code} type="button" disabled={!ok} aria-pressed={input.finishCode === f.code} onClick={() => change({ finishCode: f.code })} title={ok ? f.label : `${f.label} : non proposée sur ${family?.name}`} className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm min-h-11 ${input.finishCode === f.code ? "border-ink ring-1 ring-ink" : "border-sand-300"} bg-white disabled:opacity-40`}><span className="size-5 rounded-full border border-sand-300" style={{ background: f.swatch }} aria-hidden="true" />{f.label}{!ok && <span className="text-xs text-stone-700">(indisponible)</span>}</button>;
            })}
          </div>
        </Step>

        {pending.length > 0 && (
          <div className="card border-warning/40 p-4 space-y-3" role="region" aria-label="Adaptations à confirmer">
            <p className="font-medium text-warning">Adaptations à confirmer</p>
            {pending.map((p, idx) => {
              const sameLength = segments.filter((s) => !input.segments[s.id]);
              return (
                <div key={`${p.segmentId}-${idx}`} className="text-sm flex flex-wrap items-center gap-2">
                  <span>Fermeture « {catalog.families.find((f) => f.slug === p.choice.closureFamilySlug)?.name} » de l'ouverture {p.segmentId} : {p.reason}</span>
                  {sameLength.length > 0 && <select className="input max-w-56" aria-label="Reporter sur une autre ouverture" defaultValue="" onChange={(e) => { if (e.target.value) { setSegment(e.target.value, p.choice); setPending((prev) => prev.filter((_, i) => i !== idx)); } }}><option value="">Reporter sur…</option>{sameLength.map((s) => <option key={s.id} value={s.id}>{layout ? segmentLabel(s, layout) : s.id} ({s.lengthMm / 1000} m)</option>)}</select>}
                  <button type="button" className="btn-secondary py-1.5" onClick={() => setPending((prev) => prev.filter((_, i) => i !== idx))}>Retirer</button>
                </div>
              );
            })}
          </div>
        )}

        <Step n={5} title="Ouvertures latérales" id="etape-ouvertures" hint="sélectionnez une ouverture sur le plan ou dans la liste">
          <ul className="space-y-2">
            {segments.map((seg) => {
              const choice = input.segments[seg.id];
              const open = selectedSegment === seg.id;
              const choices = closureChoicesFor(catalog, input, seg);
              return (
                <li key={seg.id} className={`card ${open ? "border-ink" : ""}`}>
                  <button type="button" className="w-full flex items-center justify-between p-4 text-left min-h-11" aria-expanded={open} onClick={() => setSelectedSegment(open ? null : seg.id)}>
                    <span><span className="font-medium">{layout ? segmentLabel(seg, layout) : seg.id}</span> <span className="text-stone-700">· {seg.lengthMm / 1000} m</span></span>
                    <span className="text-sm">{choice ? catalog.families.find((f) => f.slug === choice.closureFamilySlug)?.name : "Ouvert"}</span>
                  </button>
                  {open && (
                    <div className="border-t border-sand-200 p-4 space-y-2">
                      <label className="flex items-center gap-2 text-sm"><input type="radio" name={`seg-${seg.id}`} checked={!choice} onChange={() => setSegment(seg.id, null)} /> Laisser ouvert</label>
                      {choices.map((c) => {
                        const disabled = c.status === "forbidden" || c.status === "no_variant";
                        const selected = choice?.closureFamilySlug === c.family.slug;
                        return (
                          <div key={c.family.slug} className={`rounded-lg border p-3 ${selected ? "border-ink" : "border-sand-200"} ${disabled ? "opacity-70" : ""}`}>
                            <label className="flex items-start gap-2 text-sm">
                              <input type="radio" name={`seg-${seg.id}`} disabled={disabled} checked={selected} onChange={() => setSegment(seg.id, { closureFamilySlug: c.family.slug, option: c.variants[0]?.option })} className="mt-1" />
                              <span className="flex-1">
                                <span className="font-medium">{c.family.name}</span>
                                {c.variants[0] && !disabled && <span className="text-stone-700"> · à partir de {formatEur(Math.min(...c.variants.map((v) => v.priceCents)))}</span>}
                                {c.status === "unknown" && <span className="block text-xs text-warning">Compatibilité non confirmée — validée sur devis{c.reason ? ` (${c.reason})` : ""}.</span>}
                                {disabled && <span className="block text-xs text-danger">Indisponible : {c.reason}</span>}
                              </span>
                            </label>
                            {selected && c.variants.length > 1 && (
                              <div className="mt-2 ml-6 flex flex-wrap gap-2">
                                {c.variants.map((v) => <button key={v.sku} type="button" aria-pressed={choice?.option === v.option} onClick={() => setSegment(seg.id, { closureFamilySlug: c.family.slug, option: v.option })} className={`rounded-full border px-3 py-1.5 text-xs ${choice?.option === v.option ? "border-ink bg-anthracite text-sand-50" : "border-sand-300"}`}>{optionLabel(v.option)} · {formatEur(v.priceCents)}</button>)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <p className="text-xs text-stone-700">Une seule fermeture par ouverture. Les empilements (store + vitrage) ne sont pas documentés : demandez un devis.</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Step>

        <Step n={6} title="Éclairage, chauffage et confort">
          <ul className="space-y-2">
            {optionChoicesFor(catalog, input).map((o) => {
              const current = input.options.find((x) => x.familySlug === o.family.slug);
              const variantOptions = [...new Set(o.variants.map((v) => (v.attributes.kind === "option" ? v.attributes.variantOption : undefined)).filter(Boolean))] as string[];
              return (
                <li key={o.family.slug} className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!!current} disabled={o.variants.length === 0} onChange={(e) => setOption(o.family.slug, variantOptions[0], e.target.checked ? 1 : 0)} /> {o.family.name}</label>
                    {o.includedInBase ? <span className="badge-ok">inclus dans {family?.name}</span> : o.variants.length === 0 ? <span className="badge-err">indisponible pour cette configuration</span> : <span className="text-sm">{formatEur(Math.min(...o.variants.map((v) => v.priceCents)))}{o.variants.length > 1 && variantOptions.length <= 1 ? " et plus" : ""}</span>}
                  </div>
                  <p className="text-xs text-stone-700 mt-1">{o.family.shortDescription}{o.status === "unknown" && <span className="text-warning"> · compatibilité non confirmée : devis</span>}</p>
                  {current && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {variantOptions.length > 1 && variantOptions.map((vo) => <button key={vo} type="button" aria-pressed={current.variantOption === vo} onClick={() => setOption(o.family.slug, vo, current.qty)} className={`rounded-full border px-3 py-1.5 text-xs ${current.variantOption === vo ? "border-ink bg-anthracite text-sand-50" : "border-sand-300"}`}>{optionLabel(vo)}</button>)}
                      {o.maxQty > 1 && <label className="text-xs flex items-center gap-1">Quantité <input type="number" min={1} max={o.maxQty} value={current.qty} onChange={(e) => setOption(o.family.slug, current.variantOption, Math.max(1, Math.min(o.maxQty, Number(e.target.value) || 1)))} className="input w-20 py-1" /></label>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Step>

        <Step n={7} title="Livraison et montage">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="cp">Code postal de livraison</label><input id="cp" className="input" inputMode="numeric" maxLength={10} value={input.delivery.postalCode ?? ""} onChange={(e) => setInput((i) => ({ ...i, delivery: { ...i.delivery, postalCode: e.target.value.replace(/\D/g, "").slice(0, 5) } }))} placeholder="ex. 69000" /><p className="text-xs text-stone-700 mt-1">Nécessaire pour un total définitif.</p></div>
            <fieldset><legend className="label">Montage</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="montage" checked={input.installation === "self"} onChange={() => setInput((i) => ({ ...i, installation: "self" }))} /> Par mes soins (notice fournie)</label>
              <label className="flex items-center gap-2 text-sm mt-1"><input type="radio" name="montage" checked={input.installation === "professional"} onChange={() => setInput((i) => ({ ...i, installation: "professional" }))} /> Montage professionnel (chiffré selon la configuration)</label>
            </fieldset>
            <div className="sm:col-span-2"><label className="label" htmlFor="promo">Code promotionnel</label><input id="promo" className="input max-w-xs" value={input.promotionCode ?? ""} onChange={(e) => setInput((i) => ({ ...i, promotionCode: e.target.value.toUpperCase() || undefined }))} /></div>
          </div>
        </Step>

        <Step n={8} title="Récapitulatif" id="recap">
          <div ref={recapRef} className="card p-5">
            <table className="w-full text-sm"><tbody>
              {result.lines.map((l) => <tr key={l.code + (l.path ?? "")} className="border-b border-sand-200"><td className="py-2 pr-2">{l.label}{l.qty > 1 && ` × ${l.qty}`}{l.dataStatus === "demo" && <DemoBadge label="démo" className="ml-2" />}</td><td className="py-2 text-right whitespace-nowrap">{l.included ? "inclus" : formatEur(l.totalGrossCents)}</td></tr>)}
              <tr><td className="py-2">Livraison</td><td className="py-2 text-right">{result.totals.shippingGrossCents === null ? "à calculer" : formatEur(result.totals.shippingGrossCents)}</td></tr>
              <tr className="font-semibold text-lg"><td className="pt-3">Total TTC {result.totals.isFinal ? "" : "(estimé)"}</td><td className="pt-3 text-right">{formatEur(result.totals.totalGrossCents)}</td></tr>
              <tr className="text-xs text-stone-700"><td>dont TVA</td><td className="text-right">{formatEur(result.totals.taxCents)}</td></tr>
            </tbody></table>
            <IssueList issues={result.issues} className="mt-4" />
            {message && <div className="mt-4"><Notice tone={message.tone}>{message.text}</Notice></div>}
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <input className="input sm:col-span-2" placeholder="Nom du projet (facultatif)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Nom du projet" />
              <button type="button" className="btn-secondary" onClick={save} disabled={busy}><Save className="size-4" aria-hidden="true" /> {saved ? "Mettre à jour le projet" : "Sauvegarder le projet"}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowQuote((s) => !s)}><FileText className="size-4" aria-hidden="true" /> Demander un devis</button>
              <button type="button" className="btn-accent sm:col-span-2" onClick={addToCart} disabled={busy || !result.purchasable} title={result.purchasable ? undefined : "Des points sont à résoudre avant l'achat"}><ShoppingBag className="size-4" aria-hidden="true" /> {result.purchasable ? "Ajouter au panier" : blocking.length ? "Achat impossible en l'état — devis conseillé" : "Ajouter au panier"}</button>
            </div>
            {shareUrl && <p className="mt-3 text-xs text-stone-700 flex items-center gap-1 break-all"><Share2 className="size-3" aria-hidden="true" /> Lien de partage (sans données personnelles, révocable depuis Mes projets) : <a className="underline" href={shareUrl}>{shareUrl}</a> · <a className="underline" href={`/projets/${saved!.token}/pdf`}>PDF</a></p>}
            {showQuote && <div className="mt-5 border-t border-sand-200 pt-4"><QuoteForm input={input} kind="configuration" configurationId={saved?.id ?? null} onDone={(n) => { setShowQuote(false); setMessage({ tone: "success", text: `Demande de devis ${n} enregistrée : vous recevez une confirmation par e-mail.` }); }} /></div>}
          </div>
        </Step>
      </div>

      {/* Barre mobile */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-sand-300 bg-white/95 backdrop-blur p-3 flex items-center justify-between gap-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div><p className="text-xs text-stone-700">Total {result.totals.isFinal ? "" : "estimé"}</p><p className="font-semibold">{formatEur(result.totals.totalGrossCents)}</p></div>
        <a href="#recap" className="btn-accent">Récapitulatif</a>
      </div>
      <div className="lg:hidden h-20" aria-hidden="true" />
    </div>
  );
}

function Step({ n, title, hint, id, children }: { n: number; title: string; hint?: React.ReactNode; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`step-${n}`} className="scroll-mt-24">
      <h2 id={`step-${n}`} className="font-display text-2xl flex items-baseline gap-3"><span className="text-copper-600 text-base font-sans font-semibold">{String(n).padStart(2, "0")}</span>{title}</h2>
      {hint && <p className="mt-1 text-xs text-stone-700">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function artFor(c: SegmentChoice | null | undefined): "glass" | "slats" | "screen" | undefined {
  if (!c) return undefined;
  if (c.closureFamilySlug.includes("vitree")) return "glass";
  if (c.closureFamilySlug.includes("persienne")) return "slats";
  return "screen";
}

export function optionLabel(o?: string): string {
  const map: Record<string, string> = { fixed: "fixe", sliding_framed: "coulissante avec cadre", sliding_frameless: "coulissante sans cadre", zip: "ZIP", warm_white: "blanc chaud", rgb: "RGB", "1500w": "1 500 W", "2000w": "2 000 W", medium: "moyenne", large: "grande" };
  return o ? (map[o] ?? o) : "";
}
