"use client";
/**
 * Outil de prise de mesures : famille → modèle → type de pose → schéma de ce qu'il faut mesurer → saisie contrôlée par
 * les bornes DOCUMENTÉES du modèle → report dans le configurateur (brouillon local relu par le configurateur).
 * Les conseils sont des bonnes pratiques de relevé ; les cotes définitives sont toujours confirmées lors de l'étude du devis.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoryKey } from "@/domain/categories";
import { defaultSystemInput, dimRangeText, MOUNTING_FR, type SystemInput, type SystemMounting, type SystemRules } from "@/domain/system";

export interface MeasureModel { slug: string; name: string; category: CategoryKey; rules: SystemRules }

const FAMILY_LABEL: Record<CategoryKey, string> = { PERGOLAS: "Pergola", SCREENS: "Screen", STORES_BANNES: "Store banne", MOUSTIQUAIRES: "Moustiquaire" };

/** Ce qu'il faut mesurer, par famille et par pose (conseils génériques de relevé, sans valeur technique inventée). */
function advice(cat: CategoryKey, mounting: SystemMounting, type: SystemRules["type"]): string[] {
  const common = "Mesurez en millimètres, à plusieurs endroits, et notez la plus petite valeur pour une pose entre deux appuis ; le conseiller vérifie toujours les cotes avec vous lors de l'étude du devis.";
  if (cat === "PERGOLAS") return [
    "Largeur : la dimension hors tout souhaitée, le long du mur pour une pergola adossée.",
    "Avancée (projection) : depuis le mur (ou l'arrière de la structure) jusqu'à l'avant des poteaux.",
    "Hauteur : du sol fini au-dessous de la poutre ; repérez une pente éventuelle du sol.",
    mounting === "wall" ? "Pose adossée : vérifiez la nature du mur (béton, maçonnerie) et les obstacles (fenêtres, gouttières, descentes d'eau)." : "Pose autoportante : repérez l'emplacement des poteaux et la nature du sol pour les ancrages.",
    common,
  ];
  if (cat === "SCREENS" && type === "roof_blind") return [
    "Largeur : la largeur de la toiture vitrée à couvrir, entre les appuis prévus pour les coulisses.",
    "Projection : la longueur de toiture à couvrir, du coffre (côté haut) jusqu'à l'avant.",
    "Notez la pente de la toiture et la structure porteuse (véranda, pergola).",
    common,
  ];
  if (cat === "SCREENS") return [
    mounting === "niche" ? "Pose en niche (dans le tableau) : largeur entre les deux tableaux, en haut, au milieu et en bas ; hauteur du linteau à l'appui." : "Pose en façade : largeur de la baie et débord souhaité de chaque côté ; hauteur du point de fixation du coffre jusqu'au sol ou à l'appui.",
    "Repérez une alimentation électrique : le screen est motorisé.",
    common,
  ];
  if (cat === "STORES_BANNES") return [
    "Largeur : la largeur de toile souhaitée ; vérifiez la place disponible pour le coffre et les supports.",
    "Avancée : choisissez parmi les avancées fabriquées ; une grande avancée demande une largeur minimale.",
    `Pose ${MOUNTING_FR[mounting]} : vérifiez la nature et l'état du support, et la hauteur disponible au-dessus de la baie.`,
    common,
  ];
  return [
    mounting === "reveal" ? "Pose dans l'embrasure : largeur entre les tableaux et hauteur entre linteau et appui, à trois endroits ; retenez la plus petite valeur." : "Pose en applique : mesurez le dormant ou l'encadrement sur lequel la moustiquaire sera fixée.",
    "Signalez un seuil, une poignée ou un volet qui pourrait gêner.",
    common,
  ];
}

/** Schéma simple de ce qui est mesuré (trait, lettres L / A / H). */
function Schema({ cat, type }: { cat: CategoryKey; type: SystemRules["type"] }) {
  const s = { fill: "none", stroke: "#1a201c", strokeWidth: 2, strokeLinejoin: "round" as const };
  const d = { stroke: "#396558", strokeWidth: 1.6, markerStart: "url(#ar)", markerEnd: "url(#ar)" };
  const t = (x: number, y: number, v: string) => <text x={x} y={y} fontSize="15" fill="#2c5a4f" fontFamily="system-ui" textAnchor="middle">{v}</text>;
  return (
    <svg viewBox="0 0 320 200" className="h-auto w-full max-w-sm" role="img" aria-label={`Schéma des mesures : ${FAMILY_LABEL[cat].toLowerCase()}`}>
      <defs><marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#396558" /></marker></defs>
      {cat === "PERGOLAS" && <><path d="M60 70 L200 70 L260 40 L120 40 Z" {...s} /><path d="M60 70 V170 M200 70 V170 M260 40 V140" {...s} /><line x1="60" y1="185" x2="200" y2="185" {...d} />{t(130, 198, "L largeur")}<line x1="212" y1="78" x2="268" y2="50" {...d} />{t(265, 75, "A")}<line x1="40" y1="70" x2="40" y2="170" {...d} />{t(24, 125, "H")}</>}
      {cat === "SCREENS" && type !== "roof_blind" && <><rect x="80" y="30" width="160" height="16" {...s} /><path d="M86 46 V170 M234 46 V170" {...s} /><rect x="90" y="46" width="140" height="90" fill="#d0e1dc" stroke="none" /><line x1="80" y1="185" x2="240" y2="185" {...d} />{t(160, 198, "L largeur")}<line x1="262" y1="30" x2="262" y2="170" {...d} />{t(285, 105, "H")}</>}
      {cat === "SCREENS" && type === "roof_blind" && <><path d="M40 60 L280 60 L240 150 L80 150 Z" {...s} fill="#d0e1dc" /><rect x="40" y="48" width="240" height="12" {...s} /><line x1="80" y1="172" x2="240" y2="172" {...d} />{t(160, 192, "L largeur")}<line x1="292" y1="60" x2="252" y2="150" {...d} />{t(292, 120, "P")}</>}
      {cat === "STORES_BANNES" && <><path d="M30 30 V180" {...s} strokeDasharray="4 4" /><rect x="30" y="40" width="40" height="22" {...s} /><path d="M70 50 L250 110 L250 122 L70 62" {...s} fill="#d0e1dc" /><line x1="80" y1="150" x2="250" y2="150" {...d} />{t(165, 170, "A avancée")}<text x="160" y="30" fontSize="13" fill="#5b5f63" fontFamily="system-ui" textAnchor="middle">L : largeur de toile</text></>}
      {cat === "MOUSTIQUAIRES" && <><rect x="90" y="25" width="140" height="150" {...s} /><rect x="98" y="33" width="124" height="134" fill="#d0e1dc" stroke="none" /><line x1="90" y1="188" x2="230" y2="188" {...d} />{t(160, 200, "L largeur")}<line x1="250" y1="25" x2="250" y2="175" {...d} />{t(270, 105, "H")}</>}
    </svg>
  );
}

export function MeasureTool({ models }: { models: MeasureModel[] }) {
  const router = useRouter();
  const cats = [...new Set(models.map((m) => m.category))];
  const [cat, setCat] = useState<CategoryKey>(cats[0] ?? "PERGOLAS");
  const inCat = models.filter((m) => m.category === cat);
  const [slug, setSlug] = useState(inCat[0]?.slug ?? "");
  const model = models.find((m) => m.slug === slug && m.category === cat) ?? inCat[0];
  const [mounting, setMounting] = useState<SystemMounting | "">("");
  const mount = (model?.rules.mountings.find((m) => m.code === mounting) ?? model?.rules.mountings[0])?.code ?? "wall";
  const [vals, setVals] = useState<{ w?: number; d?: number; h?: number }>({});
  const r = model?.rules;
  const check = (() => {
    if (!r) return [];
    const out: string[] = [];
    const chk = (label: string, v: number | undefined, rule?: SystemRules["dims"]["width"]) => {
      if (!rule || v == null) return;
      if (rule.maxMm > 0 && (v > rule.maxMm || (rule.minMm != null && v < rule.minMm))) out.push(`${label} hors de la gamme documentée (${dimRangeText(rule)}) : étude hors gamme au devis.`);
    };
    chk("Largeur", vals.w, r.dims.width); chk(r.dims.depth?.label ?? "Avancée", vals.d, r.dims.depth); chk(r.dims.height?.label ?? "Hauteur", vals.h, r.dims.height);
    if (r.fixedSizes?.length) out.push("Ce modèle est fabriqué dans des tailles définies : le configurateur vous propose la taille la plus proche, ou une étude hors gamme.");
    return out;
  })();
  const report = () => {
    if (!model || !r) return;
    const base = defaultSystemInput(model.slug, r);
    const outOfRange = check.some((c) => c.includes("hors de la gamme"));
    const input: SystemInput = { ...base, mounting: mount, widthMm: vals.w ?? base.widthMm, depthMm: r.dims.depth ? vals.d ?? base.depthMm : undefined, heightMm: r.dims.height ? vals.h ?? base.heightMm : undefined, ...(outOfRange || r.fixedSizes?.length ? { sizeCode: outOfRange ? "custom" : base.sizeCode } : {}), notes: "Mesures reportées depuis le guide de prise de mesures (à confirmer lors de l'étude)." };
    if (r.fixedSizes?.length && !outOfRange) { input.widthMm = base.widthMm; input.depthMm = base.depthMm; input.heightMm = base.heightMm; }
    try { window.localStorage.setItem(`heliostores:configuration:${model.slug}`, JSON.stringify({ input, at: new Date().toISOString(), from: "mesures" })); } catch { /* stockage indisponible */ }
    router.push(`/configurateur/${model.slug}`);
  };
  if (!model || !r) return <p>Aucun modèle configurable.</p>;
  const field = (id: "w" | "d" | "h", label: string, rule?: SystemRules["dims"]["width"]) => rule ? (
    <div><label className="label" htmlFor={`m-${id}`}>{label} (mm)</label><input id={`m-${id}`} className="input tabular-nums" type="number" inputMode="numeric" min={1} value={vals[id] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [id]: e.target.value === "" ? undefined : Math.round(Number(e.target.value)) }))} /><p className="mt-1 text-xs text-stone-700">{rule.maxMm > 0 ? dimRangeText(rule) : "bornes non documentées"}</p></div>
  ) : null;
  return (
    <div className="grid gap-8 lg:grid-cols-2" data-testid="measure-tool">
      <div className="space-y-5">
        <fieldset><legend className="label">1. Famille</legend><div className="flex flex-wrap gap-2">{cats.map((c) => <label key={c} className="cursor-pointer rounded-lg border border-sand-300 px-3 py-2 text-sm has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50"><input type="radio" className="sr-only" name="cat" checked={cat === c} onChange={() => { setCat(c); setSlug(models.find((m) => m.category === c)?.slug ?? ""); setMounting(""); setVals({}); }} />{FAMILY_LABEL[c]}</label>)}</div></fieldset>
        <div><label className="label" htmlFor="m-model">2. Modèle</label><select id="m-model" className="input" value={model.slug} onChange={(e) => { setSlug(e.target.value); setMounting(""); }}>{inCat.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}</select></div>
        <fieldset><legend className="label">3. Type de pose</legend><div className="flex flex-wrap gap-2">{r.mountings.map((m) => <label key={m.code} className="cursor-pointer rounded-lg border border-sand-300 px-3 py-2 text-sm has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50"><input type="radio" className="sr-only" name="mount" checked={mount === m.code} onChange={() => setMounting(m.code)} />{m.label}</label>)}</div></fieldset>
        <div className="grid gap-4 sm:grid-cols-3">{field("w", r.dims.width.label, r.dims.width)}{field("d", r.dims.depth?.label ?? "", r.dims.depth)}{field("h", r.dims.height?.label ?? "", r.dims.height)}</div>
        {check.length > 0 && <ul className="rounded-lg bg-sand-100 p-3 text-sm text-stone-800" data-testid="measure-check">{check.map((c) => <li key={c}>{c}</li>)}</ul>}
        <button type="button" className="btn-accent" onClick={report} data-testid="measure-report">Reporter dans le configurateur {model.name}</button>
      </div>
      <div className="rounded-2xl border border-sand-200 bg-white p-5">
        <Schema cat={cat} type={r.type} />
        <h2 className="mt-4 font-semibold">Ce qu'il faut mesurer</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-800">{advice(cat, mount, r.type).map((a) => <li key={a}>{a}</li>)}</ul>
      </div>
    </div>
  );
}
