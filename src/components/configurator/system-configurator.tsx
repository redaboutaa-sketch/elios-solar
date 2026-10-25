"use client";
/**
 * Configurateur d'un système HELIOSTORES (pergola, screen, store banne) à partir des règles sourcées de la
 * famille. Le même objet `input` alimente l'évaluation (même moteur que le serveur), la 3D, le plan 2D et la
 * demande de devis. Le prix affiché est celui de la grille publique (structure à la cote) ; options, pose et
 * livraison sont chiffrées au devis. Une configuration entièrement tarifée (structure seule, sans option ni point à
 * confirmer) peut être ajoutée au panier ; le serveur réévalue la configuration avant de l'accepter.
 */
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, Save, Share2, ShoppingCart } from "lucide-react";
import { addToCartAction, saveConfigurationAction } from "@/server/actions/configurator";
import { evaluate } from "@/domain/engine";
import { CUSTOM_SIZE, defaultSystemInput, dimRangeText, nearestAllowed, spotsFor, type DimRule, type SystemInput, type SystemRules } from "@/domain/system";
import type { CatalogSnapshot, EvaluationResult, SideKey } from "@/domain/types";
import { formatSystemPrice } from "@/domain/system-pricing";
import { IssueList, Notice } from "@/components/ui/alert";
import { QuoteForm } from "./quote-form";
import { SystemVisuals } from "./scene-3d/visuals";
import { useQuoteVisual } from "./quote-visual";

/** Prix de la grille publique pour la cote saisie, ou renvoi au devis (cote hors grille, blocage). */
function SystemPriceBox({ result }: { result: EvaluationResult }) {
  const p = result.systemPrice;
  if (!p) {
    const s = result.pricedSizes;
    const list = (xs: string[]) => (xs.length > 8 ? `${xs.slice(0, 4).join(", ")} … ${xs.slice(-2).join(", ")}` : xs.join(", "));
    return (
      <div data-testid="system-price" data-priced="false" className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-ink">
        <p><strong>Prix sur devis</strong> pour ces dimensions : un conseiller vous le communique avec votre devis.</p>
        {s && <p className="mt-1 text-xs text-stone-700" data-testid="priced-sizes">Prix affiché en ligne pour les cotes de la grille : largeur {list(s.widths.map((w) => (w.min === w.max ? fmtM(w.max) : `${fmtM(w.min)} à ${fmtM(w.max)}`)))} ; {s.dimLabel.toLowerCase()} {list(s.dims.map(fmtM))}.</p>}
      </div>
    );
  }
  return (
    <div data-testid="system-price" data-priced="true" className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-ink">
      <p className="flex flex-wrap items-baseline justify-between gap-2"><span>Prix de la structure</span><strong className="font-display text-2xl font-semibold tabular-nums" data-testid="system-price-amount">{formatSystemPrice(p.amountMinor, p.currency, p.taxBasis)}</strong></p>
      <p className="mt-1 text-xs text-stone-700">Tarif pour {fmtM(p.grid.widthMm)} de largeur × {fmtM(p.grid.dimMm)} ({p.grid.dimLabel.toLowerCase()}){p.roundedUp ? ", dimension de la grille immédiatement supérieure à votre cote" : ""}. Options, pose et livraison chiffrées au devis.</p>
    </div>
  );
}

const fmtM = (mm: number) => `${(mm / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} m`;

const SIDES: Array<[SideKey, string]> = [["front", "Avant"], ["left", "Gauche"], ["right", "Droite"], ["back", "Arrière"]];

/**
 * Saisie d'une dimension : curseur (bornes et pas documentés), saisie numérique précise, boutons − / + et unité.
 * Une liste de valeurs documentées est proposée en boutons (pas de curseur libre). Hors gamme : bornes non imposées.
 */
function DimField({ id, rule, value, onChange, free = false }: { id: string; rule: DimRule; value: number | undefined; onChange: (v: number | undefined) => void; free?: boolean }) {
  if (rule.valuesMm?.length && !free) {
    return (
      <fieldset>
        <legend className="label">{rule.label}</legend>
        <div className="flex flex-wrap gap-1.5" data-testid={`${id}-values`}>
          {rule.valuesMm.map((v) => (
            <label key={v} className="cursor-pointer rounded-lg border border-sand-300 px-3 py-2 text-sm tabular-nums has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500">
              <input type="radio" className="sr-only" name={id} value={v} checked={value === v} onChange={() => onChange(v)} />{(v / 1000).toLocaleString("fr-FR")} m
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-stone-700">Valeurs fabriquées : {dimRangeText(rule)}.</p>
      </fieldset>
    );
  }
  const step = free ? 10 : rule.stepMm ?? 10;
  const min = free ? 1 : rule.minMm ?? Math.max(10, step);
  const max = free ? Math.max(rule.maxMm * 3, 20000) : rule.maxMm;
  const bump = (dir: 1 | -1) => {
    const base = value ?? min;
    const next = free ? base + dir * step : nearestAllowed(rule, base + dir * step);
    onChange(Math.min(max, Math.max(min, next)));
  };
  return (
    <div>
      <label className="label" htmlFor={id}>{rule.label}</label>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost size-11 shrink-0 border border-sand-300 p-0" aria-label={`${rule.label} : diminuer de ${step / 10} cm`} onClick={() => bump(-1)} disabled={value != null && value <= min}><Minus className="size-4" aria-hidden="true" /></button>
        <div className="relative grow">
          <input id={id} type="number" inputMode="numeric" className="input pr-12 tabular-nums" min={min} max={max} step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Math.round(Number(e.target.value)))} aria-describedby={`${id}-help`} />
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-stone-700" aria-hidden="true">mm</span>
        </div>
        <button type="button" className="btn-ghost size-11 shrink-0 border border-sand-300 p-0" aria-label={`${rule.label} : augmenter de ${step / 10} cm`} onClick={() => bump(1)} disabled={value != null && value >= max}><Plus className="size-4" aria-hidden="true" /></button>
      </div>
      {!free && rule.minMm != null && (
        <input type="range" aria-label={`${rule.label} (curseur)`} className="mt-2 w-full accent-brand-700" min={rule.minMm} max={rule.maxMm} step={step} value={Math.min(rule.maxMm, Math.max(rule.minMm, value ?? rule.minMm))} onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={value != null ? `${(value / 1000).toLocaleString("fr-FR")} m` : undefined} data-testid={`${id}-slider`} />
      )}
      <p id={`${id}-help`} className="mt-1 text-xs text-stone-700">{value != null ? <strong className="tabular-nums">{(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} m</strong> : null}{value != null ? " — " : ""}{free ? "dimension souhaitée, étudiée au devis" : <>{dimRangeText(rule)}{rule.note ? ` ${rule.note}` : ""}</>}</p>
      {!free && value != null && rule.stepMm && rule.minMm != null && (value - rule.minMm) % rule.stepMm !== 0 && value >= rule.minMm && value <= rule.maxMm && (
        <button type="button" className="mt-1 text-xs underline" onClick={() => onChange(nearestAllowed(rule, value))}>Utiliser {nearestAllowed(rule, value)} mm</button>
      )}
    </div>
  );
}

const STEPS = [["dims", "Dimensions"], ["pose", "Pose et finitions"], ["equip", "Équipements"], ["recap", "Récapitulatif et devis"]] as const;
type StepId = (typeof STEPS)[number][0];

/** Liste des étapes, toujours visible : l'étape courante est indiquée, chaque étape est accessible directement. */
function StepNav({ step, onStep }: { step: number; onStep: (i: number) => void }) {
  return (
    <nav aria-label="Étapes de la configuration" className="sticky top-[var(--header-h)] z-20 -mx-4 overflow-x-auto border-b border-sand-200 bg-sand-50/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-[3px] sm:border sm:px-2 lg:top-[calc(var(--header-h)+0.75rem)]" data-testid="config-steps">
      <ol className="flex min-w-max gap-1 text-sm">
        {STEPS.map(([id, label], i) => (
          <li key={id}><button type="button" onClick={() => onStep(i)} aria-current={step === i ? "step" : undefined} className={`inline-flex min-h-9 items-center gap-1 rounded-[2px] px-2.5 transition-colors duration-150 ${step === i ? "bg-anthracite text-sand-50" : "text-stone-800 hover:bg-white"}`}><span className="tabular-nums opacity-70">{i + 1}</span>{label}</button></li>
        ))}
      </ol>
    </nav>
  );
}

function StepFooter({ step, onStep, last }: { step: number; onStep: (i: number) => void; last?: ReactNode }) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3 border-t border-sand-200 pt-4">
      {step > 0 ? <button type="button" className="btn-secondary" onClick={() => onStep(step - 1)} data-testid="step-prev"><ChevronLeft className="size-4" aria-hidden="true" /> Précédent</button> : <span />}
      {step < STEPS.length - 1 ? <button type="button" className="btn-accent" onClick={() => onStep(step + 1)} data-testid="step-next">Suivant : {STEPS[step + 1]![1]} <ChevronRight className="size-4" aria-hidden="true" /></button> : last ?? null}
    </div>
  );
}

const DRAFT_PREFIX = "heliostores:configuration:";
function readDraft(slug: string): SystemInput | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_PREFIX + slug);
    if (!raw) return null;
    const v = JSON.parse(raw) as { input?: SystemInput };
    return v.input?.kind === "system" && v.input.familySlug === slug ? v.input : null;
  } catch {
    return null;
  }
}
function writeDraft(slug: string, input: SystemInput) {
  try { window.localStorage.setItem(DRAFT_PREFIX + slug, JSON.stringify({ input, at: new Date().toISOString() })); } catch { /* stockage indisponible : la configuration reste en mémoire */ }
}
function clearDraft(slug: string) {
  try { window.localStorage.removeItem(DRAFT_PREFIX + slug); } catch { /* idem */ }
}

/** Liens de navigation du configurateur : fiche du produit, famille et autres modèles (produit présélectionné). */
export interface ConfiguratorNav { productHref: string; familyHref: string; familyLabel: string; siblings: Array<{ slug: string; name: string; href: string }> }

const choiceCls = "flex cursor-pointer items-start gap-2 rounded-xl border border-sand-200 px-3 py-2.5 text-sm transition-colors duration-150 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50";
const cardCls = "scroll-mt-[calc(var(--header-h)+4rem)] rounded-2xl border border-sand-200 bg-white p-5 sm:p-6";
const stepTitle = "font-display text-xl font-semibold";

/** Commande en ligne d'une configuration entièrement tarifée, sinon motifs du passage au devis. */
function OnlineOrder({ result, busy, onAdd, editing }: { result: EvaluationResult; busy: boolean; onAdd: () => void; editing: boolean }) {
  const o = result.onlineOrder;
  if (o?.ok) {
    return (
      <div data-testid="online-order" data-orderable="true">
        <p className="mt-2 text-sm text-stone-700">Cette configuration est entièrement tarifée : vous pouvez la commander en ligne (structure seule, TVA ajoutée au panier). La livraison et la pose s'organisent ensuite avec un conseiller.</p>
        <button type="button" className="btn-accent mt-3" onClick={onAdd} disabled={busy} data-testid="add-to-cart"><ShoppingCart className="size-4" aria-hidden="true" /> {editing ? "Mettre à jour le panier" : "Ajouter au panier"}</button>
      </div>
    );
  }
  return (
    <div data-testid="online-order" data-orderable="false">
      <p className="mt-2 text-sm text-stone-700">Commande en ligne indisponible pour cette configuration{o?.reasons.length ? <> : {o.reasons.join(" ; ")}</> : null}. Demandez un devis ci-dessous.</p>
      <p className="mt-1 text-xs text-stone-700">La commande en ligne est possible pour la structure seule, aux dimensions de la grille de prix, sans option ni choix à confirmer.</p>
    </div>
  );
}

export function SystemConfigurator({ catalog, familySlug, art, initial, existing = null, cartLineId = null, nav }: { catalog: CatalogSnapshot; familySlug: string; art: ReactNode; initial?: Partial<SystemInput>; existing?: { id: string; token: string; title: string | null } | null; cartLineId?: string | null; nav?: ConfiguratorNav }) {
  const family = catalog.families.find((f) => f.slug === familySlug)!;
  const rules = family.systemRules as SystemRules;
  const defaults = useMemo(() => defaultSystemInput(familySlug, rules), [familySlug, rules]);
  const [input, setInput] = useState<SystemInput>(() => ({ ...defaults, ...initial, kind: "system", familySlug }));
  const [step, setStep] = useState(0);
  const [restored, setRestored] = useState(false);
  const fromLink = !!initial || !!existing || !!cartLineId;
  // brouillon local : les choix sont conservés pendant la navigation (fiche, autres modèles, retour)
  // le brouillon n'est écrit qu'après la lecture du précédent (sinon la première visite se « restaurerait » elle-même)
  const [draftReady, setDraftReady] = useState(fromLink);
  useEffect(() => {
    if (fromLink) return;
    // lecture différée (après hydratation) : le rendu serveur reste celui des valeurs par défaut
    const t = window.setTimeout(() => {
      const d = readDraft(familySlug);
      if (d && JSON.stringify(d) !== JSON.stringify(defaults)) { setInput({ ...defaults, ...d, kind: "system", familySlug }); setRestored(true); }
      setDraftReady(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [familySlug, fromLink, defaults]);
  useEffect(() => { if (draftReady) writeDraft(familySlug, input); }, [draftReady, familySlug, input]);
  const result = useMemo(() => evaluate(catalog, input), [catalog, input]);
  const visual = useQuoteVisual(catalog, input, result);
  const set = (patch: Partial<SystemInput>) => setInput((i) => ({ ...i, ...patch }));
  const [saved, setSaved] = useState(existing);
  const [savedKey, setSavedKey] = useState<string | null>(existing ? JSON.stringify(initial ?? null) : null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: ReactNode } | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  const [cartError, setCartError] = useState<string | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const goStep = (i: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, i)));
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  const addToCart = () => startTransition(async () => {
    setCartError(null);
    const r = await addToCartAction(input, saved?.id ?? null, cartLineId);
    if (r.ok) { clearDraft(familySlug); router.push("/panier"); }
    else setCartError([r.error, ...(r.issues ?? []).map((i) => i.message)].join(" "));
  });
  const save = () => startTransition(async () => {
    const r = await saveConfigurationAction(input, title || null, saved?.id ?? null);
    if (r.ok) { setSaved({ id: r.data.id, token: r.data.token, title: title || null }); setSavedKey(JSON.stringify(input)); setMessage({ tone: "success", text: <>Projet enregistré. Retrouvez-le dans <Link href="/compte/projets" className="underline">Mes projets</Link>.</> }); }
    else setMessage({ tone: "error", text: r.error });
  });
  const dirty = JSON.stringify(input) !== JSON.stringify(defaults) && JSON.stringify(input) !== savedKey;
  const reset = () => {
    // seule action qui ferait perdre la configuration : confirmation si elle n'est pas enregistrée
    if (dirty && !window.confirm("Recommencer efface la configuration en cours, qui n'est pas enregistrée. Continuer ?")) return;
    clearDraft(familySlug);
    setInput(defaults);
    setRestored(false);
    goStep(0);
  };
  const finishes = rules.customFinish ? [...rules.finishes, rules.customFinish] : rules.finishes;
  const finish = finishes.find((f) => f.code === input.finishCode);
  const optionOn = (code: string) => input.options.find((o) => o.code === code);
  const toggleOption = (code: string, on: boolean, extra?: { qty?: number; value?: string }) =>
    setInput((i) => ({ ...i, options: on ? [...i.options.filter((o) => o.code !== code), { code, ...extra }] : i.options.filter((o) => o.code !== code) }));
  const spotOpt = rules.options.find((o) => o.spotTable);
  const spots = spotOpt ? spotsFor(spotOpt.spotTable, input.depthMm, input.widthMm) : null;
  const blocking = result.issues.some((i) => i.severity === "blocking");
  const custom = input.sizeCode === CUSTOM_SIZE;
  const confirmed = rules.options.filter((o) => !o.wish);
  const wishes = rules.options.filter((o) => o.wish);
  const stepIssues = (id: StepId) => result.issues.filter((i) => i.severity === "blocking" && stepOf(i.path) === id);

  const optionCard = (o: (typeof rules.options)[number]) => {
    const on = optionOn(o.code);
    const ctl = rules.controls?.find((x) => x.code === input.controlCode);
    const unmet = (o.requiresControlKind && ctl?.kind !== o.requiresControlKind) || (o.requiresControls?.length && !o.requiresControls.includes(ctl?.code ?? ""));
    return (
      <div key={o.code} className="rounded-xl border border-sand-200 p-3 text-sm transition-colors duration-150 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50" data-testid={`option-${o.code}`}>
        <label className="flex cursor-pointer items-start gap-2">
          <input type="checkbox" className="mt-1 accent-brand-700" checked={!!on} disabled={!!unmet && !on} onChange={(e) => toggleOption(o.code, e.target.checked, { qty: o.maxQty != null ? 1 : undefined, value: o.values?.[0]?.code })} />
          <span>{o.label}{o.wish ? " — souhait étudié au devis" : o.status === "to_confirm" ? " — à confirmer au devis" : ""}{o.spotTable ? (spots != null ? ` (${spots} points pour ces dimensions)` : " (nombre de points hors tableau : devis)") : ""}{o.note && o.status !== "to_confirm" && !o.wish ? ` — ${o.note}` : ""}</span>
        </label>
        {o.description && <p className="ml-6 mt-0.5 text-xs text-stone-700">{o.description}</p>}
        {o.prerequisite && <p className={`ml-6 mt-0.5 text-xs ${unmet ? "text-danger" : "text-stone-700"}`} data-testid={`prereq-${o.code}`}>{unmet ? "Indisponible avec la commande choisie — " : ""}Prérequis : {o.prerequisite}.</p>}
        {on && (o.maxQty != null || o.values?.length) ? (
          <div className="ml-6 mt-1 flex flex-wrap gap-2">
            {o.values?.length ? <select aria-label={`${o.label} : valeur`} className="input max-w-56" value={on.value ?? ""} onChange={(e) => toggleOption(o.code, true, { qty: on.qty, value: e.target.value })}>{o.values.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}</select> : null}
            {o.maxQty != null ? <input aria-label={`${o.label} : quantité`} type="number" min={1} max={o.maxQty} className="input max-w-24" value={on.qty ?? 1} onChange={(e) => toggleOption(o.code, true, { qty: Math.round(Number(e.target.value)) || 1, value: on.value })} /> : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10" data-testid="system-configurator" data-family={familySlug}>
      <div className="min-w-0 space-y-4 self-start lg:sticky lg:top-24">
        <SystemVisuals catalog={catalog} input={input} result={result} art={art} onImage={visual.onImage} onCaptureReady={visual.onCaptureReady} onDrawingReady={visual.onDrawingReady} />
        <section id="recap" className="scroll-mt-[calc(var(--header-h)+4rem)] rounded-2xl border border-sand-200 bg-white p-5" data-testid="system-recap" aria-live="polite" aria-labelledby="recap-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recap-title" className={stepTitle}>Récapitulatif</h2>
            <button type="button" className="btn-ghost -my-2 px-3 text-sm lg:hidden" aria-expanded={recapOpen} aria-controls="recap-details" onClick={() => setRecapOpen((o) => !o)}>{recapOpen ? "Masquer" : "Détails"} <ChevronDown className={`size-4 transition-transform duration-200 ${recapOpen ? "rotate-180" : ""}`} aria-hidden="true" /></button>
          </div>
          <dl id="recap-details" className={`mt-3 grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm ${recapOpen ? "grid" : "hidden lg:grid"}`}>
            {(result.recap ?? []).filter((r) => r.label !== "Inclus").map((r, i) => (
              <div key={`${r.label}-${i}`} className="contents"><dt className="text-stone-700">{r.label}</dt><dd>{r.value}{r.status === "to_confirm" ? <span className="badge-warn ml-2">à confirmer</span> : null}</dd></div>
            ))}
          </dl>
          <div className="mt-4"><SystemPriceBox result={result} /></div>
        </section>
      </div>

      <div className="min-w-0 space-y-4" ref={top}>
        {nav && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" data-testid="config-links">
            <Link href={nav.productHref} className="link-brand">Fiche {family.name}</Link>
            <Link href={nav.familyHref} className="link-brand">Tous les modèles {nav.familyLabel.toLowerCase()}</Link>
            {nav.siblings.length ? <span className="text-stone-700">Autres modèles : {nav.siblings.map((x, i) => <span key={x.slug}>{i ? ", " : ""}<Link href={x.href} className="underline">{x.name}</Link></span>)}</span> : null}
          </div>
        )}
        {restored && <Notice tone="info">Vos choix précédents pour {family.name} ont été conservés. <button type="button" className="underline" onClick={reset}>Recommencer</button></Notice>}
        <StepNav step={step} onStep={goStep} />

        {step === 0 && (
          <section className={cardCls} aria-labelledby="dims-title" data-testid="step-dims">
            <h2 id="dims-title" className={stepTitle}>1. Dimensions</h2>
            {rules.fixedSizes?.length ? (
              <fieldset className="mt-3" data-testid="fixed-sizes">
                <legend className="label">Taille</legend>
                <p className="mb-2 text-xs text-stone-700">Ce modèle est fabriqué dans les tailles ci-dessous (pas de fabrication à la cote).</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {rules.fixedSizes.map((z) => (
                    <label key={z.code} className={choiceCls}><input type="radio" name="size" className="mt-0.5 accent-brand-700" checked={input.sizeCode === z.code} onChange={() => set({ sizeCode: z.code, widthMm: z.widthMm, depthMm: z.depthMm ?? input.depthMm, heightMm: z.heightMm ?? input.heightMm })} /> {z.label}</label>
                  ))}
                  <label className={choiceCls}><input type="radio" name="size" className="mt-0.5 accent-brand-700" checked={custom} onChange={() => set({ sizeCode: CUSTOM_SIZE })} /> Autre dimension — étude hors gamme sur devis</label>
                </div>
              </fieldset>
            ) : null}
            {(!rules.fixedSizes?.length || custom) && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <DimField id="dim-width" rule={rules.dims.width} value={input.widthMm} free={custom} onChange={(v) => set({ widthMm: v ?? 0 })} />
                {rules.dims.depth && <DimField id="dim-depth" rule={rules.dims.depth} value={input.depthMm} free={custom} onChange={(v) => set({ depthMm: v })} />}
                {rules.dims.height && <DimField id="dim-height" rule={rules.dims.height} value={input.heightMm} free={custom} onChange={(v) => set({ heightMm: v })} />}
              </div>
            )}
            {!rules.fixedSizes?.length && (
              <label className={`mt-4 ${choiceCls}`} data-testid="out-of-range"><input type="checkbox" className="mt-1 accent-brand-700" checked={custom} onChange={(e) => set({ sizeCode: e.target.checked ? CUSTOM_SIZE : undefined })} /> <span>Mes dimensions sortent de la gamme : demander une étude hors gamme <span className="block text-xs text-stone-700">Les cotes ne sont plus bornées ; la faisabilité et le prix sont établis au devis, sans garantie de fabrication.</span></span></label>
            )}
            {rules.depthWidthMin?.length && !custom ? <p className="mt-2 text-xs text-stone-700">Largeur minimale selon l'avancée : {rules.depthWidthMin.map((c) => `${(c.depthMm / 1000).toLocaleString("fr-FR")} m → ${(c.widthMinMm / 1000).toLocaleString("fr-FR")} m`).join(" ; ")}.</p> : null}
            <p className="mt-3 text-xs text-stone-700">Besoin d'aide pour mesurer ? <Link href="/guides/prise-de-mesures" className="underline">Guide de prise de mesures</Link>.</p>
            <IssueList issues={stepIssues("dims")} />
            <StepFooter step={step} onStep={goStep} />
          </section>
        )}

        {step === 1 && (
          <section className={cardCls} aria-labelledby="pose-title" data-testid="step-pose">
            <h2 id="pose-title" className={stepTitle}>2. Pose et finitions</h2>
            <fieldset className="mt-3">
              <legend className="label">Pose</legend>
              <div className="flex flex-wrap gap-2">
                {rules.mountings.map((m) => (
                  <label key={m.code} className={choiceCls}><input type="radio" className="accent-brand-700" name="mounting" checked={input.mounting === m.code} onChange={() => set({ mounting: m.code, sides: m.code === "wall" ? { ...input.sides, back: null } : input.sides })} /> {m.label}{m.status === "to_confirm" ? " (à confirmer)" : ""}</label>
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
            </div>
            {rules.fabrics?.length ? (
              <div className="mt-4">
                <label className="label" htmlFor="fabric">{rules.type === "insect_screen" ? "Toile moustiquaire" : "Toile"}</label>
                <select id="fabric" className="input" value={input.fabricCode ?? ""} onChange={(e) => set({ fabricCode: e.target.value })}>
                  {rules.fabrics.map((f) => <option key={f.code} value={f.code}>{f.label}{f.status === "to_confirm" ? " — à confirmer" : ""}</option>)}
                </select>
                {(() => { const f = rules.fabrics!.find((x) => x.code === input.fabricCode); return f?.description ? <p className="mt-1 text-xs text-stone-700">{f.description}</p> : null; })()}
                <p className="mt-1 text-xs text-stone-700"><Link href="/guides/choisir-toile-et-motorisation" className="underline">Aide au choix des toiles et motorisations</Link></p>
              </div>
            ) : null}
            {rules.packs?.length ? (
              <fieldset className="mt-4" data-testid="packs">
                <legend className="label">Niveau d'équipement</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {rules.packs.map((p) => {
                    const other = !!p.familySlug;
                    const checked = input.packCode === p.code;
                    return (
                      <label key={p.code} className={`rounded-xl border p-3 text-sm ${other ? "cursor-not-allowed border-dashed border-sand-300 text-stone-700" : "cursor-pointer border-sand-200 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50"}`}>
                        <span className="flex items-center gap-2 font-semibold"><input type="radio" name="pack" className="accent-brand-700" disabled={other} checked={checked} onChange={() => {
                          const c = rules.controls?.find((x) => p.controlKinds.includes(x.kind));
                          set({ packCode: p.code, ...(c && !p.controlKinds.includes(rules.controls!.find((x) => x.code === input.controlCode)?.kind ?? "manual") ? { controlCode: c.code } : {}) });
                        }} /> {p.label}{other ? " — autre modèle" : p.status === "to_confirm" ? " — à confirmer" : ""}</span>
                        <span className="mt-1 block text-xs text-stone-700">{p.summary}</span>
                        {!other && <span className="mt-1 block text-xs text-stone-800">Compris : {p.includes.join(", ")}.</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}
            {rules.controls?.length ? (
              <div className="mt-4">
                <label className="label" htmlFor="control">Manœuvre et commande</label>
                <select id="control" className="input" value={input.controlCode ?? ""} onChange={(e) => {
                  const kind = rules.controls!.find((x) => x.code === e.target.value)?.kind;
                  const cur = rules.packs?.find((p) => p.code === input.packCode);
                  const pack = kind && cur && !cur.controlKinds.includes(kind) ? rules.packs!.find((p) => !p.familySlug && p.controlKinds.includes(kind)) : undefined;
                  set({ controlCode: e.target.value, ...(pack ? { packCode: pack.code } : {}) });
                }}>
                  {rules.controls.map((c) => <option key={c.code} value={c.code}>{c.label}{c.minWidthMm ? ` — largeur min. ${c.minWidthMm / 10} cm` : ""}{c.status === "to_confirm" ? " — à confirmer" : ""}</option>)}
                </select>
                {(() => { const c = rules.controls!.find((x) => x.code === input.controlCode); return c ? <p className="mt-1 text-xs text-stone-700">{c.description ? `${c.description} ` : ""}{c.cable ? `Fourni avec ${c.cable}.` : ""}</p> : null; })()}
              </div>
            ) : null}
            <IssueList issues={stepIssues("pose")} />
            <StepFooter step={step} onStep={goStep} />
          </section>
        )}

        {step === 2 && (
          <section className={cardCls} aria-labelledby="equip-title" data-testid="step-equip">
            <h2 id="equip-title" className={stepTitle}>3. Équipements</h2>
            {rules.included.length ? <><h3 className="mt-4 text-sm font-semibold">Inclus</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-stone-800">{rules.included.map((i) => <li key={i.label}>{i.label}{i.status === "to_confirm" ? " (à confirmer)" : ""}</li>)}</ul></> : null}
            {confirmed.length > 0 && <h3 className="mt-5 text-sm font-semibold">Options <span className="font-normal text-stone-700">(en supplément, chiffrées au devis)</span></h3>}
            <div className="mt-2 grid gap-2">{confirmed.map(optionCard)}</div>
            {wishes.length > 0 && (
              <div className="mt-5" data-testid="option-wishes">
                <h3 className="text-sm font-semibold">Équipements à étudier au devis</h3>
                <p className="mt-0.5 text-xs text-stone-700">Ces équipements existent dans la gamme du fabricant, mais leur compatibilité avec ce modèle n'est pas confirmée : cochez-les pour les signaler au conseiller.</p>
                <div className="mt-2 grid gap-2">{wishes.map(optionCard)}</div>
              </div>
            )}
            {rules.wind && (
              <p className="mt-4 rounded-lg bg-sand-100 px-3 py-2 text-xs text-stone-800" data-testid="wind-behaviour"><strong>Protection au vent</strong>{rules.wind.status === "to_confirm" ? " (à confirmer)" : ""} : {rules.wind.text}</p>
            )}
            {rules.type === "pergola" && rules.closureWishes?.length ? (
              <div className="mt-4" data-testid="side-closures">
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
              <label className={`mt-4 ${choiceCls}`}><input type="checkbox" className="mt-1 accent-brand-700" checked={!!input.multiModule} onChange={(e) => set({ multiModule: e.target.checked })} /> Installation en plusieurs modules ({rules.modules.multiModule === "documented" ? "possible selon le fabricant, composée au devis" : "non documentée, à étudier"})</label>
            ) : null}
            <label className={`mt-2 ${choiceCls}`}><input type="checkbox" className="accent-brand-700" checked={input.installation === "professional"} onChange={(e) => set({ installation: e.target.checked ? "professional" : "self" })} /> Pose professionnelle souhaitée</label>
            <div className="mt-3"><label className="label" htmlFor="notes">Précisions (support, accès, contraintes)</label><textarea id="notes" rows={3} className="input" value={input.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></div>
            <IssueList issues={stepIssues("equip")} />
            <StepFooter step={step} onStep={goStep} />
          </section>
        )}

        {step === 3 && (
          <div className="space-y-4" data-testid="step-recap">
            <IssueList issues={result.issues.filter((i) => i.code !== "system_quote_only")} />
            <section className={cardCls} aria-labelledby="save-title">
              <h2 id="save-title" className={stepTitle}>Enregistrer le projet</h2>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="grow"><label className="label" htmlFor="project-title">Nom du projet (facultatif)</label><input id="project-title" className="input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <button type="button" className="btn-secondary" onClick={save} disabled={busy}><Save className="size-4" aria-hidden="true" /> {saved ? "Mettre à jour le projet" : "Sauvegarder le projet"}</button>
              </div>
              {saved && <p className="mt-3 flex items-center gap-1 break-all text-xs text-stone-700"><Share2 className="size-3" aria-hidden="true" /> Lien de partage (sans données personnelles, révocable depuis Mes projets) : <a className="underline" href={`/projets/${saved.token}`}>/projets/{saved.token}</a></p>}
              {message && <div className="mt-3"><Notice tone={message.tone}>{message.text}</Notice></div>}
            </section>
            <section className={cardCls} aria-labelledby="order-title">
              <h2 id="order-title" className={stepTitle}>Commander en ligne</h2>
              <OnlineOrder result={result} busy={busy} onAdd={addToCart} editing={!!cartLineId} />
              {cartError && <div className="mt-3"><Notice tone="error">{cartError}</Notice></div>}
            </section>
            <section className={cardCls} aria-labelledby="quote-title">
              <h2 id="quote-title" className={stepTitle}>Demander le devis</h2>
              {blocking ? <p className="mt-2 text-sm text-danger">Corrigez les points signalés « Impossible » pour envoyer cette configuration ; vous pouvez aussi décrire votre projet dans le message.</p> : null}
              <div className="mt-3"><QuoteForm input={blocking ? null : input} kind="system" configurationId={saved?.id ?? null} getVisual={blocking ? undefined : visual.getVisual} /></div>
              <p className="mt-3 text-xs text-stone-700">Une question ? <Link href="/contact" className="underline">Demander conseil</Link>.</p>
            </section>
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary" onClick={() => goStep(step - 1)} data-testid="step-prev"><ChevronLeft className="size-4" aria-hidden="true" /> Précédent</button>
              <button type="button" className="btn-ghost text-sm" onClick={reset} data-testid="config-reset"><RotateCcw className="size-4" aria-hidden="true" /> Recommencer</button>
            </div>
          </div>
        )}
      </div>
      {/* barre mobile compacte : prix et action prioritaire ; masquée pendant la saisie (clavier virtuel), voir globals.css */}
      <div className="cfg-bar fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-sand-300 bg-white/95 px-3 py-2 backdrop-blur lg:hidden" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }} data-testid="config-price-bar">
        <a href="#recap" onClick={() => setRecapOpen(true)} className="min-w-0"><span className="block text-xs text-stone-700">{STEPS[step]![1]} · étape {step + 1}/{STEPS.length}</span><span className="block truncate text-sm font-semibold tabular-nums">{result.systemPrice ? formatSystemPrice(result.systemPrice.amountMinor, result.systemPrice.currency, result.systemPrice.taxBasis) : "Prix sur devis"}</span></a>
        {step < STEPS.length - 1 ? <button type="button" className="btn-accent shrink-0" onClick={() => goStep(step + 1)}>Suivant</button> : <a href={result.onlineOrder?.ok ? "#order-title" : "#quote-title"} className="btn-accent shrink-0">{result.onlineOrder?.ok ? "Commander" : "Demander le devis"}</a>}
      </div>
      <div className="h-16 lg:hidden" aria-hidden="true" />
    </div>
  );
}

/** Étape où se corrige un point bloquant (d'après le chemin du champ). */
function stepOf(path: string | undefined): StepId {
  if (!path) return "recap";
  if (/^(widthMm|depthMm|heightMm|sizeCode)$/.test(path)) return "dims";
  if (/^(mounting|finishCode|fabricCode|controlCode|packCode)$/.test(path)) return "pose";
  if (/^(options|sides|multiModule|installation)/.test(path)) return "equip";
  return "recap";
}
