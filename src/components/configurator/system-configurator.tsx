"use client";
/**
 * Configurateur d'un système HELIOSTORES (pergola, screen, store banne) à partir des règles sourcées de la
 * famille. Le même objet `input` alimente l'évaluation (même moteur que le serveur), la 3D, le plan 2D et la
 * demande de devis. Le prix affiché est celui de la grille publique (structure à la cote) ; options, pose et
 * livraison sont chiffrées au devis. Une configuration entièrement tarifée (structure seule, sans option ni point à
 * confirmer) peut être ajoutée au panier ; le serveur réévalue la configuration avant de l'accepter.
 */
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "@/i18n/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Eye, ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, Save, Share2, ShoppingCart } from "lucide-react";
import { colourInfo, colourLabel } from "@/domain/colours";
import { addToCartAction, saveConfigurationAction } from "@/server/actions/configurator";
import { evaluate } from "@/domain/engine";
import { CUSTOM_SIZE, INSTALL_HEIGHT_SANE, defaultSystemInput, dimRangeText, installHeightApplies, nearestAllowed, spotsFor, type DimRule, type SystemInput, type SystemRules } from "@/domain/system";
import type { CatalogSnapshot, EvaluationResult, SideKey } from "@/domain/types";
import { formatSystemPrice } from "@/domain/system-pricing";
import { IssueList, Notice } from "@/components/ui/alert";
import { QuoteForm } from "./quote-form";
import { SystemDrawingPeek, SystemVisuals } from "./scene-3d/visuals";
import { useQuoteVisual } from "./quote-visual";
import { useIntl, useLocalePath, useT } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { AreaMessages } from "@/i18n/messages";

type T = AreaMessages<"configurator">;

/** Prix de la grille publique pour la cote saisie, ou renvoi au devis avec son motif. */
function SystemPriceBox({ result }: { result: EvaluationResult }) {
  const t = useT("configurator").price;
  const intl = useIntl();
  const fmtM = (mm: number) => fmtMeters(mm, intl);
  const p = result.systemPrice;
  if (!p) {
    const s = result.pricedSizes;
    const list = (xs: string[]) => (xs.length > 8 ? `${xs.slice(0, 4).join(", ")} … ${xs.slice(-2).join(", ")}` : xs.join(", "));
    return (
      <div data-testid="system-price" data-priced="false" data-price-status={result.priceStatus ?? "no_table"} className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-ink">
        <p><strong>{t.onQuote}</strong>{t.statusSep}{t.status[result.priceStatus ?? "no_table"]}</p>
        {s && <p className="mt-1 text-xs text-stone-700" data-testid="priced-sizes">{fmt(t.pricedSizes, { widths: list(s.widths.map((w) => (w.min === w.max ? fmtM(w.max) : fmt(t.range, { min: fmtM(w.min), max: fmtM(w.max) })))), dimLabel: s.dimLabel.toLowerCase(), dims: list(s.dims.map(fmtM)) })}</p>}
      </div>
    );
  }
  const b = result.priceBreakdown;
  const money = (m: number) => formatSystemPrice(m, p.currency, p.taxBasis);
  const total = b?.totalMinor ?? p.amountMinor;
  return (
    <div data-testid="system-price" data-priced="true" data-price-status="priced" data-partial={b?.partial ? "true" : "false"} className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-ink">
      <p className="flex flex-wrap items-baseline justify-between gap-2"><span>{b?.partial ? t.totalPartial : b && b.lines.length > 1 ? t.total : t.structure}</span><strong className="font-display text-2xl font-semibold tabular-nums" data-testid="system-price-amount">{money(total)}</strong></p>
      {b?.totalTtcMinor != null && p.taxBasis === "HT" && <p className="text-right text-xs text-stone-700 tabular-nums" data-testid="system-price-ttc">{fmt(t.ttcLine, { amount: formatSystemPrice(b.totalTtcMinor, p.currency, null), rate: (b.vatRateBps / 100).toLocaleString(intl) })}</p>}
      <p className="mt-1 text-xs text-stone-700">{fmt(t.tariffFor, { width: fmtM(p.grid.widthMm), dim: fmtM(p.grid.dimMm), dimLabel: p.grid.dimLabel.toLowerCase(), rounded: p.roundedUp ? t.roundedUp : "" })}</p>
      {b && b.lines.length > 1 && (
        <details className="mt-2 text-xs" data-testid="price-breakdown" open>
          <summary className="cursor-pointer font-medium">{t.breakdown}</summary>
          <ul className="mt-1 space-y-0.5">{b.lines.map((l) => <li key={l.code} className="flex justify-between gap-3"><span>{l.label}{l.detail ? ` (${l.detail})` : ""}</span><span className="tabular-nums">{money(l.amountMinor)}</span></li>)}</ul>
        </details>
      )}
      {b?.pending.length ? (
        <div className="mt-2 text-xs" data-testid="price-pending">
          <p className="font-medium">{t.pending}</p>
          <ul className="list-disc pl-4">{b.pending.map((x) => <li key={x.code}>{x.label} — {x.reason}</li>)}</ul>
        </div>
      ) : null}
      <p className="mt-1 text-xs text-stone-700" data-testid="system-price-scope">{fmt(t.scope, { tax: p.taxBasis === "TTC" ? t.ttc : t.ht, currency: p.currency === "EUR" ? t.euros : p.currency, version: p.listVersion })} {t.services}</p>
    </div>
  );
}

const fmtMeters = (mm: number, intl: string) => `${(mm / 1000).toLocaleString(intl, { maximumFractionDigits: 3 })} m`;

const SIDES: SideKey[] = ["front", "left", "right", "back"];

/**
 * Saisie d'une dimension : curseur (bornes et pas documentés), saisie numérique précise, boutons − / + et unité.
 * Une liste de valeurs documentées est proposée en boutons (pas de curseur libre). Hors gamme : bornes non imposées.
 */
function DimField({ id, rule, value, onChange, free = false }: { id: string; rule: DimRule; value: number | undefined; onChange: (v: number | undefined) => void; free?: boolean }) {
  const t = useT("configurator").dim;
  const intl = useIntl();
  if (rule.valuesMm?.length && !free) {
    return (
      <fieldset>
        <legend className="label">{rule.label}</legend>
        <div className="flex flex-wrap gap-1.5" data-testid={`${id}-values`}>
          {rule.valuesMm.map((v) => (
            <label key={v} className="cursor-pointer rounded-lg border border-sand-300 px-3 py-2 text-sm tabular-nums has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500">
              <input type="radio" className="sr-only" name={id} value={v} checked={value === v} onChange={() => onChange(v)} />{(v / 1000).toLocaleString(intl)} m
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-stone-700">{fmt(t.fabricatedValues, { range: dimRangeText(rule) })}</p>
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
        <button type="button" className="btn-ghost size-11 shrink-0 border border-sand-300 p-0" aria-label={fmt(t.decrease, { label: rule.label, cm: step / 10 })} onClick={() => bump(-1)} disabled={value != null && value <= min}><Minus className="size-4" aria-hidden="true" /></button>
        <div className="relative grow">
          <input id={id} type="number" inputMode="numeric" className="input pr-12 tabular-nums" min={min} max={max} step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Math.round(Number(e.target.value)))} aria-describedby={`${id}-help`} />
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-stone-700" aria-hidden="true">mm</span>
        </div>
        <button type="button" className="btn-ghost size-11 shrink-0 border border-sand-300 p-0" aria-label={fmt(t.increase, { label: rule.label, cm: step / 10 })} onClick={() => bump(1)} disabled={value != null && value >= max}><Plus className="size-4" aria-hidden="true" /></button>
      </div>
      {!free && rule.minMm != null && (
        <input type="range" aria-label={fmt(t.slider, { label: rule.label })} className="mt-2 w-full accent-brand-700" min={rule.minMm} max={rule.maxMm} step={step} value={Math.min(rule.maxMm, Math.max(rule.minMm, value ?? rule.minMm))} onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={value != null ? `${(value / 1000).toLocaleString(intl)} m` : undefined} data-testid={`${id}-slider`} />
      )}
      <p id={`${id}-help`} className="mt-1 text-xs text-stone-700">{value != null ? <strong className="tabular-nums">{(value / 1000).toLocaleString(intl, { maximumFractionDigits: 3 })} m</strong> : null}{value != null ? " — " : ""}{free ? t.freeHelp : <>{dimRangeText(rule)}{rule.note ? ` ${rule.note}` : ""}</>}</p>
      {!free && value != null && rule.stepMm && rule.minMm != null && (value - rule.minMm) % rule.stepMm !== 0 && value >= rule.minMm && value <= rule.maxMm && (
        <button type="button" className="mt-1 text-xs underline" onClick={() => onChange(nearestAllowed(rule, value))}>{fmt(t.useNearest, { mm: nearestAllowed(rule, value) })}</button>
      )}
    </div>
  );
}

/** saisie de la hauteur de pose (souhait) : bornes de saisie seulement, pas une plage technique */
const installHeightRule = (label: string): DimRule => ({ label, minMm: INSTALL_HEIGHT_SANE.minMm, maxMm: INSTALL_HEIGHT_SANE.maxMm, stepMm: 10, sources: [] });

/** éléments laqués concernés par la teinte : nuancier du modèle, sinon selon le type de produit */
function finishComponent(rules: SystemRules, t: T["finishComponent"]): string {
  if (rules.palette?.component) return rules.palette.component;
  return rules.type === "pergola" ? t.pergola : rules.type === "screen" ? t.screen : rules.type === "awning" ? t.awning : rules.type === "insect_screen" ? t.insect : t.other;
}

const STEPS = ["dims", "pose", "equip", "recap"] as const;
type StepId = (typeof STEPS)[number];

/** Liste des étapes, toujours visible : l'étape courante est indiquée, chaque étape est accessible directement. */
function StepNav({ step, onStep }: { step: number; onStep: (i: number) => void }) {
  const t = useT("configurator");
  return (
    <nav aria-label={t.stepsNav} className="sticky top-[var(--header-h)] z-20 -mx-4 overflow-x-auto border-b border-sand-200 bg-sand-50/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-[3px] sm:border sm:px-2 lg:top-[calc(var(--header-h)+0.75rem)]" data-testid="config-steps">
      <ol className="flex min-w-max gap-1 text-sm">
        {STEPS.map((id, i) => (
          <li key={id}><button type="button" onClick={() => onStep(i)} aria-current={step === i ? "step" : undefined} className={`inline-flex min-h-9 items-center gap-1 rounded-[2px] px-2.5 transition-colors duration-150 ${step === i ? "bg-anthracite text-sand-50" : "text-stone-800 hover:bg-white"}`}><span className="tabular-nums opacity-70">{i + 1}</span>{t.steps[id]}</button></li>
        ))}
      </ol>
    </nav>
  );
}

function StepFooter({ step, onStep, last }: { step: number; onStep: (i: number) => void; last?: ReactNode }) {
  const t = useT("configurator");
  return (
    <div className="mt-5 flex items-center justify-between gap-3 border-t border-sand-200 pt-4">
      {step > 0 ? <button type="button" className="btn-secondary" onClick={() => onStep(step - 1)} data-testid="step-prev"><ChevronLeft className="size-4" aria-hidden="true" /> {t.prev}</button> : <span />}
      {step < STEPS.length - 1 ? <button type="button" className="btn-accent" onClick={() => onStep(step + 1)} data-testid="step-next">{fmt(t.nextTo, { label: t.steps[STEPS[step + 1]!] })} <ChevronRight className="size-4" aria-hidden="true" /></button> : last ?? null}
    </div>
  );
}

const DRAFT_PREFIX = "heliostores:configuration:";
/**
 * Clé du brouillon local : une par modèle pour une nouvelle configuration, une par projet enregistré ou ligne de
 * panier rouverte (une actualisation conserve alors les modifications non enregistrées de CE projet, sans écraser le
 * brouillon générique du modèle).
 */
function draftKey(slug: string, projectId?: string | null, cartLineId?: string | null): string {
  return DRAFT_PREFIX + slug + (projectId ? `@projet:${projectId}` : cartLineId ? `@ligne:${cartLineId}` : "");
}
function readDraft(key: string, slug: string): SystemInput | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as { input?: SystemInput };
    return v.input?.kind === "system" && v.input.familySlug === slug ? v.input : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string, input: SystemInput) {
  try { window.localStorage.setItem(key, JSON.stringify({ input, at: new Date().toISOString() })); } catch { /* stockage indisponible : la configuration reste en mémoire */ }
}
function clearDraft(key: string) {
  try { window.localStorage.removeItem(key); } catch { /* idem */ }
}

/** Empreinte stable d'une configuration (ordre des clés indifférent, champs vides ignorés) : détection des modifications. */
export function inputKey(v: unknown): string {
  const norm = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === "object") {
      return Object.fromEntries(Object.keys(x as Record<string, unknown>).sort().filter((k) => (x as Record<string, unknown>)[k] !== undefined && (x as Record<string, unknown>)[k] !== null).map((k) => [k, norm((x as Record<string, unknown>)[k])]));
    }
    return x;
  };
  return JSON.stringify(norm(v));
}

/** Étape dans l'adresse (?etape=…) : le bouton Retour du navigateur revient à l'étape précédente, l'actualisation la conserve. */
const STEP_PARAM = "etape";
const STEP_SLUGS = ["dimensions", "pose-finitions", "equipements", "recapitulatif"] as const;
function stepFromUrl(): number {
  try {
    const v = new URLSearchParams(window.location.search).get(STEP_PARAM);
    const i = STEP_SLUGS.indexOf(v as (typeof STEP_SLUGS)[number]);
    return i < 0 ? 0 : i;
  } catch {
    return 0;
  }
}
function stepUrl(i: number): string {
  const url = new URL(window.location.href);
  if (i === 0) url.searchParams.delete(STEP_PARAM);
  else url.searchParams.set(STEP_PARAM, STEP_SLUGS[i]!);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Liens de navigation du configurateur : fiche du produit, famille et autres modèles (produit présélectionné). */
export interface ConfiguratorNav { productHref: string; familyHref: string; familyLabel: string; siblings: Array<{ slug: string; name: string; href: string }> }

const choiceCls = "flex cursor-pointer items-start gap-2 rounded-xl border border-sand-200 px-3 py-2.5 text-sm transition-colors duration-150 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50";
const cardCls = "scroll-mt-[calc(var(--header-h)+4rem)] rounded-2xl border border-sand-200 bg-white p-5 sm:p-6";
const stepTitle = "font-display text-xl font-semibold";

/** Commande en ligne d'une configuration entièrement tarifée, sinon motifs du passage au devis. */
function OnlineOrder({ result, busy, onAdd, editing, salesOpen }: { result: EvaluationResult; busy: boolean; onAdd: () => void; editing: boolean; salesOpen: boolean }) {
  const t = useT("configurator").order;
  const o = result.onlineOrder;
  // encaissement non ouvert (décision serveur) : jamais de bouton panier, même pour une configuration entièrement tarifée
  if (!salesOpen) return <div data-testid="online-order" data-orderable="false" data-sales="closed"><p className="mt-2 text-sm text-stone-700">{t.salesClosed}</p></div>;
  if (o?.ok) {
    return (
      <div data-testid="online-order" data-orderable="true">
        <p className="mt-2 text-sm text-stone-700">{t.orderable}</p>
        <button type="button" className="btn-accent mt-3" onClick={onAdd} disabled={busy} data-testid="add-to-cart"><ShoppingCart className="size-4" aria-hidden="true" /> {editing ? t.updateCart : t.addToCart}</button>
      </div>
    );
  }
  return (
    <div data-testid="online-order" data-orderable="false">
      <p className="mt-2 text-sm text-stone-700">{fmt(t.unavailable, { reasons: o?.reasons.length ? `${t.reasonsSep}${o.reasons.join(" ; ")}` : "" })}</p>
      <p className="mt-1 text-xs text-stone-700">{t.scope}</p>
    </div>
  );
}

export function SystemConfigurator({ catalog, familySlug, art, initial, existing = null, cartLineId = null, nav, salesOpen = false }: { catalog: CatalogSnapshot; familySlug: string; art: ReactNode; initial?: Partial<SystemInput>; existing?: { id: string; token: string; title: string | null } | null; cartLineId?: string | null; nav?: ConfiguratorNav; salesOpen?: boolean }) {
  const t = useT("configurator");
  const intl = useIntl();
  const lp = useLocalePath();
  const family = catalog.families.find((f) => f.slug === familySlug)!;
  const rules = family.systemRules as SystemRules;
  const defaults = useMemo(() => defaultSystemInput(familySlug, rules), [familySlug, rules]);
  const [input, setInput] = useState<SystemInput>(() => ({ ...defaults, ...initial, kind: "system", familySlug }));
  const [peek, setPeek] = useState(false);
  const [step, setStep] = useState(0);
  const [restored, setRestored] = useState(false);
  const key = draftKey(familySlug, existing?.id, cartLineId);
  // empreinte de la configuration telle qu'ouverte (valeurs par défaut, projet ou ligne de panier)
  const [openedKey] = useState(() => inputKey({ ...defaults, ...initial, kind: "system", familySlug }));
  // brouillon local : les choix sont conservés pendant la navigation (fiche, autres modèles, retour, actualisation)
  // le brouillon n'est écrit qu'après la lecture du précédent (sinon la première visite se « restaurerait » elle-même)
  const [draftReady, setDraftReady] = useState(false);
  // une seule reprise par configuration ouverte : un nouveau rendu du serveur (ex. après une action serveur, qui
  // transmet de nouveaux objets en propriétés) ne doit ni recharger le brouillon ni ramener l'étape lue dans l'adresse
  const restoredFor = useRef<string | null>(null);
  useEffect(() => {
    if (restoredFor.current === key) return;
    // lecture différée (après hydratation) : le rendu serveur reste celui des valeurs ouvertes
    const t = window.setTimeout(() => {
      restoredFor.current = key;
      const d = readDraft(key, familySlug);
      if (d && inputKey({ ...defaults, ...d, kind: "system", familySlug }) !== openedKey) { setInput({ ...defaults, ...d, kind: "system", familySlug }); setRestored(true); }
      setStep(stepFromUrl());
      setDraftReady(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [key, familySlug, defaults, openedKey]);
  useEffect(() => { if (draftReady) writeDraft(key, input); }, [draftReady, key, input]);
  // bouton Retour / Suivant du navigateur : l'étape suit l'adresse (aucun rechargement)
  useEffect(() => {
    const onPop = () => setStep(stepFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const result = useMemo(() => evaluate(catalog, input), [catalog, input]);
  const visual = useQuoteVisual(catalog, input, result);
  const set = (patch: Partial<SystemInput>) => setInput((i) => ({ ...i, ...patch }));
  const [saved, setSaved] = useState(existing);
  const [savedKey, setSavedKey] = useState<string | null>(existing ? openedKey : null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: ReactNode } | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  const [cartError, setCartError] = useState<string | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const goStep = (i: number) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, i));
    // état « null » (documentation Next) : l'état interne du routeur n'est jamais recopié, sinon l'adresse n'est pas
    // synchronisée avec le routeur (un rafraîchissement après une action serveur la réécrirait)
    if (next !== step) { try { window.history.pushState(null, "", stepUrl(next)); } catch { /* adresse inchangée */ } }
    setStep(next);
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  const addToCart = () => startTransition(async () => {
    setCartError(null);
    const r = await addToCartAction(input, saved?.id ?? null, cartLineId);
    if (r.ok) { clearDraft(key); router.push(lp("/panier")); }
    else setCartError([r.error, ...(r.issues ?? []).map((i) => i.message)].join(" "));
  });
  const save = () => startTransition(async () => {
    const r = await saveConfigurationAction(input, title || null, saved?.id ?? null);
    if (r.ok) { setSaved({ id: r.data.id, token: r.data.token, title: title || null }); setSavedKey(inputKey(input)); setMessage({ tone: "success", text: <>{t.saved.before}<Link href="/compte/projets" className="underline">{t.saved.link}</Link>{t.saved.after}</> }); }
    else setMessage({ tone: "error", text: r.error });
  });
  const dirty = inputKey(input) !== inputKey(defaults) && inputKey(input) !== savedKey;
  const reset = () => {
    // seule action qui ferait perdre la configuration : confirmation si elle n'est pas enregistrée
    if (dirty && !window.confirm(t.resetConfirm)) return;
    clearDraft(key);
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
          <span>{o.label}{o.wish ? t.option.wish : o.status === "to_confirm" ? t.option.toConfirm : ""}{o.spotTable ? (spots != null ? fmt(t.option.spots, { n: spots }) : t.option.spotsOut) : ""}{o.note && o.status !== "to_confirm" && !o.wish ? ` — ${o.note}` : ""}</span>
        </label>
        {o.description && <p className="ml-6 mt-0.5 text-xs text-stone-700">{o.description}</p>}
        {o.prerequisite && <p className={`ml-6 mt-0.5 text-xs ${unmet ? "text-danger" : "text-stone-700"}`} data-testid={`prereq-${o.code}`}>{unmet ? t.option.unavailableWithControl : ""}{fmt(t.option.prerequisite, { text: o.prerequisite })}</p>}
        {on && (o.maxQty != null || o.values?.length) ? (
          <div className="ml-6 mt-1 flex flex-wrap gap-2">
            {o.values?.length ? <select aria-label={fmt(t.option.valueAria, { label: o.label })} className="input max-w-56" value={on.value ?? ""} onChange={(e) => toggleOption(o.code, true, { qty: on.qty, value: e.target.value })}>{o.values.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}</select> : null}
            {o.maxQty != null ? <input aria-label={fmt(t.option.qtyAria, { label: o.label })} type="number" min={1} max={o.maxQty} className="input max-w-24" value={on.qty ?? 1} onChange={(e) => toggleOption(o.code, true, { qty: Math.round(Number(e.target.value)) || 1, value: on.value })} /> : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10" data-testid="system-configurator" data-family={familySlug} data-ready={draftReady || undefined}>
      <div className="min-w-0 space-y-4 self-start lg:sticky lg:top-24">
        <SystemVisuals catalog={catalog} input={input} result={result} art={art} onImage={visual.onImage} onCaptureReady={visual.onCaptureReady} onDrawingReady={visual.onDrawingReady} />
        <section id="recap" className="scroll-mt-[calc(var(--header-h)+4rem)] rounded-2xl border border-sand-200 bg-white p-5" data-testid="system-recap" aria-live="polite" aria-labelledby="recap-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recap-title" className={stepTitle}>{t.recap.title}</h2>
            <button type="button" className="btn-ghost -my-2 px-3 text-sm lg:hidden" aria-expanded={recapOpen} aria-controls="recap-details" onClick={() => setRecapOpen((o) => !o)}>{recapOpen ? t.recap.hide : t.recap.details} <ChevronDown className={`size-4 transition-transform duration-200 ${recapOpen ? "rotate-180" : ""}`} aria-hidden="true" /></button>
          </div>
          <dl id="recap-details" className={`mt-3 grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm ${recapOpen ? "grid" : "hidden lg:grid"}`}>
            {(result.recap ?? []).filter((r) => r.label !== "Inclus").map((r, i) => (
              <div key={`${r.label}-${i}`} className="contents"><dt className="text-stone-700">{r.label}</dt><dd>{r.value}{r.status === "to_confirm" ? <span className="badge-warn ml-2">{t.recap.toConfirm}</span> : null}</dd></div>
            ))}
          </dl>
          <div className="mt-4"><SystemPriceBox result={result} /></div>
          <p className="mt-3 text-xs text-stone-700" data-testid="recap-delivery-lead-time">{t.deliveryLeadTime} {t.deliveryTermsInQuote}</p>
        </section>
      </div>

      <div className="min-w-0 space-y-4" ref={top}>
        {nav && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" data-testid="config-links">
            <Link href={nav.productHref} className="link-brand">{fmt(t.links.productSheet, { name: String(family.name) })}</Link>
            <Link href={nav.familyHref} className="link-brand">{fmt(t.links.allModels, { family: nav.familyLabel.toLowerCase() })}</Link>
            {nav.siblings.length ? <span className="text-stone-700">{t.links.otherModels}{nav.siblings.map((x, i) => <span key={x.slug}>{i ? ", " : ""}<Link href={x.href} className="underline">{x.name}</Link></span>)}</span> : null}
          </div>
        )}
        {restored && <Notice tone="info">{fmt(t.restored, { name: String(family.name) })}<button type="button" className="underline" onClick={reset}>{t.restart}</button></Notice>}
        <StepNav step={step} onStep={goStep} />

        {step === 0 && (
          <section className={cardCls} aria-labelledby="dims-title" data-testid="step-dims">
            <h2 id="dims-title" className={stepTitle}>{fmt(t.stepTitle, { n: 1, label: t.steps.dims })}</h2>
            {rules.fixedSizes?.length ? (
              <fieldset className="mt-3" data-testid="fixed-sizes">
                <legend className="label">{t.dims.size}</legend>
                <p className="mb-2 text-xs text-stone-700">{t.dims.fixedSizesNote}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {rules.fixedSizes.map((z) => (
                    <label key={z.code} className={choiceCls}><input type="radio" name="size" className="mt-0.5 accent-brand-700" checked={input.sizeCode === z.code} onChange={() => set({ sizeCode: z.code, widthMm: z.widthMm, depthMm: z.depthMm ?? input.depthMm, heightMm: z.heightMm ?? input.heightMm })} /> {z.label}</label>
                  ))}
                  <label className={choiceCls}><input type="radio" name="size" className="mt-0.5 accent-brand-700" checked={custom} onChange={() => set({ sizeCode: CUSTOM_SIZE })} /> {t.dims.otherSize}</label>
                </div>
              </fieldset>
            ) : null}
            {(!rules.fixedSizes?.length || custom) && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <DimField id="dim-width" rule={rules.dims.width} value={input.widthMm} free={custom || !!rules.studyOnly} onChange={(v) => set({ widthMm: v ?? 0 })} />
                {rules.dims.depth && <DimField id="dim-depth" rule={rules.dims.depth} value={input.depthMm} free={custom || !!rules.studyOnly} onChange={(v) => set({ depthMm: v })} />}
                {rules.dims.height && <DimField id="dim-height" rule={rules.dims.height} value={input.heightMm} free={custom || !!rules.studyOnly} onChange={(v) => set({ heightMm: v })} />}
                {installHeightApplies(rules) && (
                  <div data-testid="install-height">
                    <DimField id="dim-install-height" rule={installHeightRule(t.dim.installHeight)} value={input.installHeightMm} free onChange={(v) => set({ installHeightMm: v })} />
                    <p className="mt-1 text-xs text-stone-700">{t.dims.installHeightHelp}</p>
                  </div>
                )}
              </div>
            )}
            {!rules.fixedSizes?.length && (
              <label className={`mt-4 ${choiceCls}`} data-testid="out-of-range"><input type="checkbox" className="mt-1 accent-brand-700" checked={custom} onChange={(e) => set({ sizeCode: e.target.checked ? CUSTOM_SIZE : undefined })} /> <span>{t.dims.outOfRange} <span className="block text-xs text-stone-700">{t.dims.outOfRangeNote}</span></span></label>
            )}
            {rules.depthWidthMin?.length && !custom ? <p className="mt-2 text-xs text-stone-700">{fmt(t.dims.depthWidthMin, { list: rules.depthWidthMin.map((c) => `${(c.depthMm / 1000).toLocaleString(intl)} m → ${(c.widthMinMm / 1000).toLocaleString(intl)} m`).join(" ; ") })}</p> : null}
            <p className="mt-3 text-xs text-stone-700">{t.dims.measureHelp}<Link href="/guides/prise-de-mesures" className="underline">{t.dims.measureGuide}</Link>.</p>
            <IssueList issues={stepIssues("dims")} />
            <StepFooter step={step} onStep={goStep} />
          </section>
        )}

        {step === 1 && (
          <section className={cardCls} aria-labelledby="pose-title" data-testid="step-pose">
            <h2 id="pose-title" className={stepTitle}>{fmt(t.stepTitle, { n: 2, label: t.steps.pose })}</h2>
            <fieldset className="mt-3">
              <legend className="label">{t.pose.mounting}</legend>
              <div className="flex flex-wrap gap-2">
                {rules.mountings.map((m) => (
                  <label key={m.code} className={choiceCls}><input type="radio" className="accent-brand-700" name="mounting" checked={input.mounting === m.code} onChange={() => set({ mounting: m.code, sides: m.code === "wall" ? { ...input.sides, back: null } : input.sides })} /> {m.label}{m.status === "to_confirm" ? t.pose.toConfirmParen : ""}</label>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-4" data-testid="finish-swatches">
              <legend className="label">{t.pose.finish} <span className="font-normal text-stone-700">— {finishComponent(rules, t.finishComponent)}</span></legend>
              {(["standard", "special"] as const).map((tier) => {
                const group = finishes.filter((f) => (f.tier ?? (f === rules.customFinish ? "special" : "standard")) === tier);
                if (!group.length) return null;
                const title = tier === "standard" ? t.pose.tierStandard : t.pose.tierSpecial;
                const split = finishes.some((f) => (f.tier ?? (f === rules.customFinish ? "special" : "standard")) === "special");
                return (
                  <div key={tier} className={tier === "special" ? "mt-3" : undefined} data-testid={`finish-tier-${tier}`}>
                    {split && <p className="mb-1.5 text-xs font-medium text-stone-800" id={`finish-tier-${tier}`}>{title}</p>}
                    <div role="radiogroup" aria-label={split ? fmt(t.pose.finishTier, { tier: title.toLowerCase() }) : t.pose.finish} className="grid grid-cols-2 gap-2 2xl:grid-cols-3">
                      {group.map((f) => {
                        const c = colourInfo(f.label);
                        const checked = input.finishCode === f.code;
                        return (
                          <label key={f.code} className={`relative flex cursor-pointer items-center gap-2.5 rounded-lg border bg-white p-2 pr-7 text-left text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-700 ${checked ? "border-anthracite ring-1 ring-anthracite" : "border-sand-300 hover:border-stone-700"}`} data-finish={f.code} data-selected={checked || undefined}>
                            <input type="radio" name="finish" value={f.code} checked={checked} onChange={() => set({ finishCode: f.code })} className="absolute inset-0 z-10 m-0 cursor-pointer appearance-none opacity-0" aria-label={`${colourLabel(f.label)}${tier === "special" ? t.pose.withSurcharge : ""}${f.status === "to_confirm" ? t.pose.toConfirmDash : ""}`} />
                            <span aria-hidden="true" className="size-8 shrink-0 rounded-full border border-black/15 shadow-inner" style={{ background: f.swatch ?? "repeating-linear-gradient(45deg,#ddd,#ddd 4px,#fff 4px,#fff 8px)" }} />
                            <span className="min-w-0 leading-tight">
                              <span className="block font-medium [overflow-wrap:anywhere]">{c.name ?? c.code ?? f.label}</span>
                              <span className="block text-xs text-stone-700">{[c.name ? c.code : null, c.finish, f.swatch ? null : t.pose.noPreview].filter(Boolean).join(" · ")}{f.status === "to_confirm" ? (c.code || c.finish ? " · " : "") + t.pose.toConfirm : ""}</span>
                            </span>
                            {checked && <Check aria-hidden="true" className="absolute top-1.5 right-1.5 size-4 text-anthracite" />}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {!finish && input.finishCode ? <p className="mt-2 text-sm text-danger" role="alert" data-testid="finish-unavailable">{fmt(t.pose.finishUnavailable, { code: input.finishCode })}</p> : null}
              <p className="mt-1 text-xs text-stone-700">{t.pose.finishSelected}<strong data-testid="finish-selected">{finish ? colourLabel(finish.label) : "—"}</strong>{t.pose.finishNote}{finish?.note ? ` ${finish.note}` : ""}</p>
              {rules.palette ? <p className="mt-1 text-xs text-stone-700" data-testid="finish-palette">{t.pose.paletteRef}{rules.palette.edition}.{rules.palette.note ? ` ${rules.palette.note.charAt(0).toUpperCase()}${rules.palette.note.slice(1)}.` : ""}</p> : null}
            </fieldset>
            {rules.fabrics?.length ? (
              <div className="mt-4">
                <label className="label" htmlFor="fabric">{rules.type === "insect_screen" ? t.pose.insectFabric : t.pose.fabric}</label>
                <select id="fabric" className="input" value={input.fabricCode ?? ""} onChange={(e) => set({ fabricCode: e.target.value })}>
                  {rules.fabrics.map((f) => <option key={f.code} value={f.code}>{f.label}{f.status === "to_confirm" ? t.pose.toConfirmDash : ""}</option>)}
                </select>
                {(() => { const f = rules.fabrics!.find((x) => x.code === input.fabricCode); return f?.description ? <p className="mt-1 text-xs text-stone-700">{f.description}</p> : null; })()}
                <p className="mt-1 text-xs text-stone-700"><Link href="/guides/choisir-toile-et-motorisation" className="underline">{t.pose.fabricGuide}</Link></p>
              </div>
            ) : null}
            {rules.packs?.length ? (
              <fieldset className="mt-4" data-testid="packs">
                <legend className="label">{t.pose.packs}</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {rules.packs.map((p) => {
                    const other = !!p.familySlug;
                    const checked = input.packCode === p.code;
                    return (
                      <label key={p.code} className={`rounded-xl border p-3 text-sm ${other ? "cursor-not-allowed border-dashed border-sand-300 text-stone-700" : "cursor-pointer border-sand-200 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50"}`}>
                        <span className="flex items-center gap-2 font-semibold"><input type="radio" name="pack" className="accent-brand-700" disabled={other} checked={checked} onChange={() => {
                          const c = rules.controls?.find((x) => p.controlKinds.includes(x.kind));
                          set({ packCode: p.code, ...(c && !p.controlKinds.includes(rules.controls!.find((x) => x.code === input.controlCode)?.kind ?? "manual") ? { controlCode: c.code } : {}) });
                        }} /> {p.label}{other ? t.pose.otherModel : p.status === "to_confirm" ? t.pose.toConfirmDash : ""}</span>
                        <span className="mt-1 block text-xs text-stone-700">{p.summary}</span>
                        {!other && <span className="mt-1 block text-xs text-stone-800">{fmt(t.pose.includes, { list: p.includes.join(", ") })}</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}
            {rules.controls?.length ? (
              <div className="mt-4">
                <label className="label" htmlFor="control">{t.pose.control}</label>
                <select id="control" className="input" value={input.controlCode ?? ""} onChange={(e) => {
                  const kind = rules.controls!.find((x) => x.code === e.target.value)?.kind;
                  const cur = rules.packs?.find((p) => p.code === input.packCode);
                  const pack = kind && cur && !cur.controlKinds.includes(kind) ? rules.packs!.find((p) => !p.familySlug && p.controlKinds.includes(kind)) : undefined;
                  set({ controlCode: e.target.value, ...(pack ? { packCode: pack.code } : {}) });
                }}>
                  {rules.controls.map((c) => <option key={c.code} value={c.code}>{c.label}{c.minWidthMm ? fmt(t.pose.minWidth, { cm: c.minWidthMm / 10 }) : ""}{c.status === "to_confirm" ? t.pose.toConfirmDash : ""}</option>)}
                </select>
                {(() => { const c = rules.controls!.find((x) => x.code === input.controlCode); return c ? <p className="mt-1 text-xs text-stone-700">{c.description ? `${c.description} ` : ""}{c.cable ? fmt(t.pose.suppliedWith, { cable: c.cable }) : ""}</p> : null; })()}
              </div>
            ) : null}
            <IssueList issues={stepIssues("pose")} />
            <StepFooter step={step} onStep={goStep} />
          </section>
        )}

        {step === 2 && (
          <section className={cardCls} aria-labelledby="equip-title" data-testid="step-equip">
            <h2 id="equip-title" className={stepTitle}>{fmt(t.stepTitle, { n: 3, label: t.steps.equip })}</h2>
            {rules.included.length ? <><h3 className="mt-4 text-sm font-semibold">{t.equip.included}</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-stone-800">{rules.included.map((i) => <li key={i.label}>{i.label}{i.status === "to_confirm" ? t.pose.toConfirmParen : ""}</li>)}</ul></> : null}
            {confirmed.length > 0 && <h3 className="mt-5 text-sm font-semibold">{t.equip.options} <span className="font-normal text-stone-700">{t.equip.optionsNote}</span></h3>}
            <div className="mt-2 grid gap-2">{confirmed.map(optionCard)}</div>
            {wishes.length > 0 && (
              <div className="mt-5" data-testid="option-wishes">
                <h3 className="text-sm font-semibold">{t.equip.wishesTitle}</h3>
                <p className="mt-0.5 text-xs text-stone-700">{t.equip.wishesNote}</p>
                <div className="mt-2 grid gap-2">{wishes.map(optionCard)}</div>
              </div>
            )}
            {rules.wind && (
              <p className="mt-4 rounded-lg bg-sand-100 px-3 py-2 text-xs text-stone-800" data-testid="wind-behaviour"><strong>{t.equip.wind}</strong>{rules.wind.status === "to_confirm" ? t.pose.toConfirmParen : ""}{t.equip.windSep}{rules.wind.text}</p>
            )}
            {rules.type === "pergola" && rules.closureWishes?.length ? (
              <div className="mt-4" data-testid="side-closures">
                <h3 className="text-sm font-medium">{t.equip.closuresTitle}</h3>
                <p className="mt-0.5 text-xs text-stone-700">{t.equip.closuresNote}</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {SIDES.filter((k) => !(input.mounting === "wall" && k === "back")).map((k) => (
                    <div key={k}><label className="label" htmlFor={`side-${k}`}>{t.sides[k]}</label>
                      <select id={`side-${k}`} className="input" value={input.sides?.[k] ?? ""} onChange={(e) => set({ sides: { ...input.sides, [k]: e.target.value || null } })}>
                        <option value="">{t.equip.open}</option>
                        {rules.closureWishes!.map((w) => <option key={w.familySlug} value={w.familySlug}>{fmt(t.equip.toStudy, { label: w.label })}</option>)}
                      </select>
                      {input.sides?.[k] ? <p className="mt-1 text-xs text-stone-700" data-testid={`side-status-${k}`}>{t.equip.sideStatus}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {rules.type === "pergola" && rules.modules ? (
              <label className={`mt-4 ${choiceCls}`}><input type="checkbox" className="mt-1 accent-brand-700" checked={!!input.multiModule} onChange={(e) => set({ multiModule: e.target.checked })} /> {fmt(t.equip.multiModule, { detail: rules.modules.multiModule === "documented" ? t.equip.multiDocumented : t.equip.multiUndocumented })}</label>
            ) : null}
            <label className={`mt-2 ${choiceCls}`}><input type="checkbox" className="accent-brand-700" checked={input.installation === "professional"} onChange={(e) => set({ installation: e.target.checked ? "professional" : "self" })} /> {t.equip.professional}</label>
            <div className="mt-3"><label className="label" htmlFor="notes">{t.equip.notes}</label><textarea id="notes" rows={3} className="input" value={input.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></div>
            <IssueList issues={stepIssues("equip")} />
            <StepFooter step={step} onStep={goStep} />
          </section>
        )}

        {step === 3 && (
          <div className="space-y-4" data-testid="step-recap">
            <IssueList issues={result.issues.filter((i) => i.code !== "system_quote_only")} />
            <section className={cardCls} aria-labelledby="save-title">
              <h2 id="save-title" className={stepTitle}>{t.final.saveTitle}</h2>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="grow"><label className="label" htmlFor="project-title">{t.final.projectName}</label><input id="project-title" className="input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <button type="button" className="btn-secondary" onClick={save} disabled={busy}><Save className="size-4" aria-hidden="true" /> {saved ? t.final.updateProject : t.final.saveProject}</button>
              </div>
              {saved && <p className="mt-3 flex items-center gap-1 break-all text-xs text-stone-700"><Share2 className="size-3" aria-hidden="true" /> {t.final.shareLink}<a className="underline" href={lp(`/projets/${saved.token}`)}>/projets/{saved.token}</a></p>}
              {message && <div className="mt-3"><Notice tone={message.tone}>{message.text}</Notice></div>}
            </section>
            <section className={cardCls} aria-labelledby="order-title">
              <h2 id="order-title" className={stepTitle}>{t.final.orderTitle}</h2>
              <OnlineOrder result={result} busy={busy} onAdd={addToCart} editing={!!cartLineId} salesOpen={salesOpen} />
              {cartError && <div className="mt-3"><Notice tone="error">{cartError}</Notice></div>}
            </section>
            <section className={cardCls} aria-labelledby="quote-title">
              <h2 id="quote-title" className={stepTitle}>{t.final.quoteTitle}</h2>
              {blocking ? <p className="mt-2 text-sm text-danger">{t.final.blockingNote}</p> : null}
              <div className="mt-3"><QuoteForm input={blocking ? null : input} kind="system" configurationId={saved?.id ?? null} getVisual={blocking ? undefined : visual.getVisual} /></div>
              <p className="mt-3 text-xs text-stone-700">{t.final.question}<Link href="/contact" className="underline">{t.final.advice}</Link>.</p>
            </section>
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn-secondary" onClick={() => goStep(step - 1)} data-testid="step-prev"><ChevronLeft className="size-4" aria-hidden="true" /> {t.prev}</button>
              <button type="button" className="btn-ghost text-sm" onClick={reset} data-testid="config-reset"><RotateCcw className="size-4" aria-hidden="true" /> {t.restart}</button>
            </div>
          </div>
        )}
      </div>
      {/* barre mobile compacte : prix et action prioritaire ; masquée pendant la saisie (clavier virtuel), voir globals.css */}
      <div className="cfg-bar fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-sand-300 bg-white/95 px-3 py-2 backdrop-blur lg:hidden" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }} data-testid="config-price-bar">
        <a href="#recap" onClick={() => setRecapOpen(true)} className="min-w-0"><span className="block text-xs text-stone-700">{fmt(t.bar.step, { label: t.steps[STEPS[step]!], n: step + 1, total: STEPS.length })}</span><span className="block truncate text-sm font-semibold tabular-nums">{result.systemPrice ? formatSystemPrice(result.systemPrice.amountMinor, result.systemPrice.currency, result.systemPrice.taxBasis) : t.price.onQuote}</span></a>
        <button type="button" className="btn-secondary shrink-0 px-3" aria-pressed={peek} onClick={() => setPeek((v) => !v)} data-testid="drawing-peek-toggle"><Eye className="size-4" aria-hidden="true" /> {t.bar.peek}</button>
        {step < STEPS.length - 1 ? <button type="button" className="btn-accent shrink-0" onClick={() => goStep(step + 1)}>{t.next}</button> : <a href={result.onlineOrder?.ok ? "#order-title" : "#quote-title"} className="btn-accent shrink-0">{result.onlineOrder?.ok ? t.bar.order : t.final.quoteTitle}</a>}
      </div>
      {peek && <SystemDrawingPeek catalog={catalog} input={input} result={result} onClose={() => setPeek(false)} />}
      <div className="h-16 lg:hidden" aria-hidden="true" />
    </div>
  );
}

/** Étape où se corrige un point bloquant (d'après le chemin du champ). */
function stepOf(path: string | undefined): StepId {
  if (!path) return "recap";
  if (/^(widthMm|depthMm|heightMm|installHeightMm|sizeCode)$/.test(path)) return "dims";
  if (/^(mounting|finishCode|fabricCode|controlCode|packCode)$/.test(path)) return "pose";
  if (/^(options|sides|multiModule|installation)/.test(path)) return "equip";
  return "recap";
}
