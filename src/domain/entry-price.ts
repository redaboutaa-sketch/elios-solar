/**
 * Prix d'appel (« à partir de ») d'un système : configuration réelle la moins chère, calculée par le moteur de la
 * boutique (evaluate) sur la grille de vente publiée — jamais un montant saisi à la main.
 *
 * Configuration de départ : dimensions d'une cellule de la grille (ou taille fabriquée), première teinte standard
 * (sans supplément), première toile, chaque mode de commande proposé, aucune option facultative. Un choix rendu
 * obligatoire par la grille (ex. « télécommande à choisir » tant qu'aucune n'est retenue) est complété par chacune des
 * valeurs chiffrées proposées : un composant obligatoire n'est jamais retiré pour baisser le prix. Seules les
 * configurations sans blocage et sans élément « à chiffrer » donnent un prix d'appel complet ; sinon le sous-total est
 * signalé comme partiel, avec les éléments manquants.
 */
import { evaluate } from "./engine";
import { gridMeta, variantFor, type PriceBreakdown, type PriceBreakdownPending, type SystemPriceCell } from "./system-pricing";
import { defaultSystemInput, MOUNTING_FR, type SystemInput, type SystemOptionChoice, type SystemRules } from "./system";
import type { CatalogSnapshot } from "./types";

export interface EntryChoice {
  input: SystemInput;
  htMinor: number;
  ttcMinor: number | null;
  breakdown: PriceBreakdown;
  complete: boolean;
}

export interface EntryPrice {
  familySlug: string;
  currency: string;
  vatRateBps: number;
  /** configuration retenue (la moins chère complète ; à défaut la moins chère partielle) */
  entry: EntryChoice;
  complete: boolean;
  /** éléments obligatoires non chiffrés (prix d'appel partiel) */
  missing: PriceBreakdownPending[];
  /** plus petite configuration valide (surface) et écart éventuel avec le prix minimal */
  smallest: EntryChoice | null;
  smallestIsCheapest: boolean;
  /** configurations évaluées */
  evaluated: number;
  /** résumé public : dimensions, pose, équipements de base retenus */
  summary: { dims: string; mounting: string; equipment: string[] };
}

const m = (mm: number) => `${(mm / 1000).toLocaleString("fr-FR", { minimumFractionDigits: mm % 1000 ? 2 : 0, maximumFractionDigits: 3 })} m`;

/** Cellules les moins chères examinées par variante (les suppléments peuvent dépendre de la cote). */
const CHEAPEST_CELLS = 12;

export function entryPrice(catalog: CatalogSnapshot, familySlug: string): EntryPrice | null {
  const family = catalog.families.find((f) => f.slug === familySlug);
  const rules = family?.systemRules as SystemRules | null | undefined;
  const table = family?.systemPrices;
  if (!family || !rules || !table?.cells.length) return null;
  const base = defaultSystemInput(familySlug, rules);
  const finish = rules.finishes.find((f) => (f.tier ?? "standard") === "standard") ?? rules.finishes[0]!;
  const controls = rules.controls?.length ? rules.controls.map((c) => c.code) : [undefined];
  // gabarits de dimensions : tailles fabriquées, sinon cellules de la grille par pose
  const shapes: Array<Pick<SystemInput, "mounting" | "widthMm" | "depthMm" | "heightMm" | "sizeCode">> = [];
  if (rules.fixedSizes?.length) {
    for (const mt of rules.mountings) for (const s of rules.fixedSizes) shapes.push({ mounting: mt.code, sizeCode: s.code, widthMm: s.widthMm, depthMm: s.depthMm ?? base.depthMm, heightMm: s.heightMm ?? base.heightMm });
  } else {
    for (const mt of rules.mountings) {
      const variant = variantFor(table, mt.code);
      if (variant == null) continue;
      // toutes les cellules, exigences comprises (ex. « barre élargie incluse ») : l'évaluation décide si la configuration
      // est complète (une exigence non chiffrée, ex. moteur 20 Nm sans tarif, la rend partielle)
      const cells = table.cells.filter((c) => c.variantKey === variant);
      const area = (c: SystemPriceCell) => Math.max(c.widthMinMm, rules.dims.width.minMm ?? 0) * c.dimAmm;
      const picked = new Set([...cells].sort((a, b) => a.amountMinor - b.amountMinor).slice(0, CHEAPEST_CELLS));
      const smallestCell = [...cells].sort((a, b) => area(a) - area(b) || a.amountMinor - b.amountMinor)[0];
      if (smallestCell) picked.add(smallestCell);
      for (const c of picked) {
        const widthMm = Math.max(c.widthMinMm, rules.dims.width.minMm ?? 0);
        if (widthMm > c.widthMaxMm) continue;
        shapes.push(table.dimAKey === "hauteur" ? { mounting: mt.code, widthMm, heightMm: c.dimAmm, depthMm: base.depthMm } : { mounting: mt.code, widthMm, depthMm: c.dimAmm, heightMm: base.heightMm });
      }
      // plus petite configuration technique documentée (minimums des sources) : chiffrée à la première tranche quand elle
      // est sous la grille (décision commerciale du 2026-11-18) ; à prix égal, la plus petite surface est retenue
      const dr = table.dimAKey === "hauteur" ? rules.dims.height : rules.dims.depth;
      const firstDim = Math.min(...cells.map((c) => c.dimAmm));
      const techDim = dr?.valuesMm?.length ? Math.min(...dr.valuesMm) : dr?.minMm ?? firstDim;
      const techW = rules.dims.width.minMm;
      if (techW != null && cells.length) {
        const widthMm = Math.max(techW, rules.depthWidthMin?.find((x) => x.depthMm === techDim)?.widthMinMm ?? 0);
        shapes.push(table.dimAKey === "hauteur" ? { mounting: mt.code, widthMm, heightMm: techDim, depthMm: base.depthMm } : { mounting: mt.code, widthMm, depthMm: techDim, heightMm: base.heightMm });
      }
    }
  }
  const choices: EntryChoice[] = [];
  let evaluated = 0;
  const run = (input: SystemInput): EntryChoice | null => {
    evaluated++;
    const r = evaluate(catalog, input);
    const b = r.priceBreakdown;
    // toile pas encore choisie (aucune par défaut documentée) : prix inchangé, choix demandé dans le configurateur
    if (!b || r.issues.some((i) => i.severity === "blocking" && i.code !== "fabric_missing")) return null;
    return { input, htMinor: b.totalMinor, ttcMinor: b.totalTtcMinor, breakdown: b, complete: !b.partial };
  };
  for (const shape of shapes) {
    for (const controlCode of controls) {
      // largeur minimale imposée par le mode de commande (moteur), documentée par la source
      const minW = rules.controls?.find((c) => c.code === controlCode)?.minWidthMm ?? 0;
      const input: SystemInput = { ...base, ...shape, widthMm: rules.fixedSizes?.length ? shape.widthMm : Math.max(shape.widthMm, minW), finishCode: finish.code, controlCode, options: [], sides: {} };
      const first = run(input);
      if (!first) continue;
      choices.push(first);
      if (first.complete) continue;
      // choix obligatoire signalé par la grille (« … à choisir » tant qu'une option n'est pas retenue) : chaque valeur chiffrée
      const variant = variantFor(table, input.mounting) ?? "";
      const sups = gridMeta(table, variant).supplements ?? [];
      const required = new Set<string>();
      for (const p of first.breakdown.pending) {
        const s = sups.find((x) => x.code === p.code);
        for (const t of s?.applies ?? []) for (const a of t.split("&")) if (a.startsWith("!option:")) required.add(a.slice("!option:".length));
      }
      for (const code of required) {
        const values = sups.filter((s) => (s.mode === "fixed" || s.mode === "table") && s.applies.some((t) => t.startsWith(`option:${code}=`))).map((s) => s.applies.find((t) => t.startsWith(`option:${code}=`))!.split("=")[1]!.split("&")[0]!);
        for (const value of new Set(values)) {
          const opt: SystemOptionChoice = { code, value };
          const c = run({ ...input, options: [opt] });
          if (c) choices.push(c);
        }
      }
    }
  }
  if (!choices.length) return null;
  const cmp = (a: EntryChoice, b: EntryChoice) => (a.ttcMinor ?? a.htMinor) - (b.ttcMinor ?? b.htMinor) || a.input.widthMm * (a.input.depthMm ?? a.input.heightMm ?? 0) - b.input.widthMm * (b.input.depthMm ?? b.input.heightMm ?? 0);
  const complete = choices.filter((c) => c.complete).sort(cmp);
  const entry = complete[0] ?? [...choices].sort(cmp)[0]!;
  const surface = (c: EntryChoice) => c.input.widthMm * (c.input.depthMm ?? c.input.heightMm ?? 1);
  const pool = complete.length ? complete : choices;
  const smallest = [...pool].sort((a, b) => surface(a) - surface(b) || cmp(a, b))[0] ?? null;
  const control = rules.controls?.find((c) => c.code === entry.input.controlCode);
  const equipment = [
    ...(control ? [control.label] : []),
    ...entry.input.options.map((o) => {
      const def = rules.options.find((x) => x.code === o.code);
      const v = def?.values?.find((x) => x.code === o.value)?.label;
      return def ? (v ? `${def.label} (${v})` : def.label) : o.code;
    }),
  ];
  const d = entry.input;
  const dims = rules.dims.depth && d.depthMm != null ? `${m(d.widthMm)} × ${m(d.depthMm)}` : rules.dims.height && d.heightMm != null ? `${m(d.widthMm)} × ${m(d.heightMm)} (${rules.dims.height.label.toLowerCase()})` : m(d.widthMm);
  return {
    familySlug,
    currency: entry.breakdown.currency,
    vatRateBps: entry.breakdown.vatRateBps,
    entry,
    complete: entry.complete,
    missing: entry.breakdown.pending,
    smallest,
    smallestIsCheapest: !!smallest && (smallest.ttcMinor ?? smallest.htMinor) === (entry.ttcMinor ?? entry.htMinor),
    evaluated,
    summary: { dims, mounting: MOUNTING_FR[d.mounting], equipment },
  };
}
