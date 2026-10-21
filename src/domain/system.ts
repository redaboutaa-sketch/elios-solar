/**
 * Systèmes configurables à la cote (catalogue HELIOSTORES) — pur, sans dépendance serveur.
 *
 * Chaque famille porte ses règles (`SystemRules`) établies par des sources précises (fiche du modèle exact,
 * catalogue fournisseur, page fabricant). Le moteur n'invente aucune règle : une valeur absente des sources
 * reste « non documentée » et une contradiction entre sources ne bloque que le champ concerné (validation
 * au devis). Aucun prix n'est calculé ici : tant que la nature, la devise et la fiscalité des tarifs
 * transmis ne sont pas établies, le prix est établi sur devis (`priceMode: "quote"`).
 */
import type { DeliveryInput, Issue, RecapItem, SideKey } from "./types";

export type SystemType = "pergola" | "screen" | "awning" | "roof_blind";
export type SystemMounting = "wall" | "freestanding" | "niche" | "facade" | "ceiling" | "rafter";

/** Référence publiable d'une source : document ou page, et localisation (page, tableau, URL). */
export interface SourceRef {
  id: string;
  label: string;
  loc?: string;
  url?: string;
}

export interface DimRule {
  label: string;
  /** null = minimum non documenté par les sources */
  minMm: number | null;
  maxMm: number;
  /** pas documenté, compté à partir de `minMm` */
  stepMm?: number | null;
  /** valeurs discrètes documentées (ex. avancées de bras) */
  valuesMm?: number[];
  /** au-delà de cette valeur, les sources se contredisent : accepté, validé au devis */
  confirmAboveMm?: number;
  confirmNote?: string;
  sources: SourceRef[];
  note?: string;
}

export interface Choice {
  code: string;
  label: string;
  status: "established" | "to_confirm";
  sources: SourceRef[];
  note?: string;
  /** couleur d'aperçu indicative (rendu écran, jamais une référence de teinte) */
  swatch?: string;
}

export interface MountingChoice extends Choice {
  code: SystemMounting;
}

export interface ControlChoice extends Choice {
  kind: "electric" | "manual";
  /** largeur minimale du système imposée par ce moteur */
  minWidthMm?: number;
  /** câble fourni avec le moteur, tel que documenté */
  cable?: string;
}

export interface SpotRow {
  depthMinMm: number;
  depthMaxMm: number;
  widthMinMm: number;
  widthMaxMm: number;
  points: number;
}

export interface OptionDef extends Choice {
  group: "lighting" | "structure" | "control" | "energy" | "closure" | "other";
  /** quantité saisissable (sinon case à cocher) */
  maxQty?: number;
  /** options dont le cumul n'est pas documenté */
  cumulToConfirmWith?: string[];
  /** nombre de spots selon les dimensions (table de la fiche) */
  spotTable?: SpotRow[];
  /** valeurs proposées (ex. longueurs de poteau documentées) */
  values?: Array<{ code: string; label: string }>;
}

export interface SystemRules {
  type: SystemType;
  /** libellé de la dimension « profondeur » : projection (pergola), avancée (store) ; absent pour un screen */
  dims: { width: DimRule; depth?: DimRule; height?: DimRule };
  /** largeur minimale par valeur de profondeur (combinaisons absentes de la fiche) */
  depthWidthMin?: Array<{ depthMm: number; widthMinMm: number; sources: SourceRef[] }>;
  mountings: MountingChoice[];
  finishes: Choice[];
  /** teinte hors standard (ex. RAL au choix) : toujours à confirmer au devis */
  customFinish?: Choice;
  fabrics?: Choice[];
  controls?: ControlChoice[];
  included: Array<{ label: string; sources: SourceRef[]; status?: "established" | "to_confirm" }>;
  options: OptionDef[];
  /** pergola : un module seul, extension modulaire documentée ou non */
  modules?: { maxSingleWidthMm: number; multiModule: "documented" | "not_documented"; sources: SourceRef[]; note?: string };
  /** pergola : fermetures latérales souhaitées (étude au devis, jamais une compatibilité supposée) */
  closureWishes?: Array<{ familySlug: string; label: string; status: "to_confirm"; note: string }>;
  /** données de représentation 3D issues des sources (coupes, coffres) — la 3D reste indicative */
  structure3d?: {
    postMm?: [number, number];
    beamMm?: [number, number];
    bladeMm?: [number, number];
    cassetteMm?: [number, number];
    tiltDeg?: [number, number];
    gutters?: number;
  };
  /** messages d'information toujours affichés (pose, alimentation, fixations…) */
  notices?: string[];
}

export interface SystemOptionChoice {
  code: string;
  qty?: number;
  value?: string;
}

export interface SystemInput {
  kind: "system";
  familySlug: string;
  /** largeur (le long du mur pour une pergola ou un store, de la baie pour un screen) */
  widthMm: number;
  /** projection (pergola) ou avancée (store banne) */
  depthMm?: number;
  /** hauteur de passage (pergola) ou hauteur de la baie (screen) */
  heightMm?: number;
  mounting: SystemMounting;
  finishCode: string;
  fabricCode?: string;
  controlCode?: string;
  options: SystemOptionChoice[];
  /** pergola : fermeture latérale souhaitée par côté (slug de la famille), étudiée au devis */
  sides?: Partial<Record<SideKey, string | null>>;
  /** pergola : installation en plusieurs modules souhaitée */
  multiModule?: boolean;
  installation: "self" | "professional";
  delivery: DeliveryInput;
  notes?: string;
}

export const MOUNTING_FR: Record<SystemMounting, string> = {
  wall: "murale (adossée)",
  freestanding: "autoportante",
  niche: "en niche (tableau de baie)",
  facade: "en façade",
  ceiling: "au plafond",
  rafter: "sur chevrons",
};

const fmtM = (mm: number) => `${(mm / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} m`;

/** Libellé d'une plage documentée, sans inventer de minimum. */
export function dimRangeText(r: DimRule): string {
  if (r.valuesMm?.length) return r.valuesMm.map((v) => fmtM(v)).join(", ");
  const step = r.stepMm ? `, par pas de ${r.stepMm / 10} cm` : "";
  return r.minMm == null ? `jusqu'à ${fmtM(r.maxMm)} (minimum non documenté)` : `de ${fmtM(r.minMm)} à ${fmtM(r.maxMm)}${step}`;
}

/** Valeurs admissibles d'une dimension (pas documenté) — utile à l'interface pour proposer la valeur voisine. */
export function nearestAllowed(r: DimRule, v: number): number {
  if (r.valuesMm?.length) return r.valuesMm.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  const min = r.minMm ?? 0;
  const clamped = Math.min(r.maxMm, Math.max(min, v));
  if (!r.stepMm) return Math.round(clamped);
  return Math.min(r.maxMm, min + Math.round((clamped - min) / r.stepMm) * r.stepMm);
}

/** Nombre de spots documenté pour des dimensions données (null = hors table). */
export function spotsFor(table: SpotRow[] | undefined, depthMm: number | undefined, widthMm: number): number | null {
  if (!table || depthMm == null) return null;
  const row = table.find((r) => depthMm >= r.depthMinMm && depthMm <= r.depthMaxMm && widthMm >= r.widthMinMm && widthMm <= r.widthMaxMm);
  return row ? row.points : null;
}

/** Valeurs par défaut d'une configuration : premières valeurs documentées, jamais une valeur hors règles. */
export function defaultSystemInput(familySlug: string, rules: SystemRules): SystemInput {
  const d = rules.dims;
  const mid = (r: DimRule) => nearestAllowed(r, Math.round(((r.minMm ?? r.maxMm / 2) + r.maxMm) / 2));
  return {
    kind: "system",
    familySlug,
    widthMm: mid(d.width),
    depthMm: d.depth ? mid(d.depth) : undefined,
    heightMm: d.height ? Math.min(d.height.maxMm, rules.type === "pergola" ? 2500 : 2200) : undefined,
    mounting: rules.mountings[0]!.code,
    finishCode: rules.finishes[0]!.code,
    fabricCode: rules.fabrics?.[0]?.code,
    controlCode: rules.controls?.[0]?.code,
    options: [],
    sides: {},
    installation: "self",
    delivery: { countryCode: "FR" },
  };
}

export interface SystemEvaluation {
  issues: Issue[];
  recap: RecapItem[];
  /** profondeur et hauteur effectivement retenues (valeurs saisies ou valeur par défaut pour la 3D) */
  geometry: { widthMm: number; depthMm: number | null; heightMm: number | null };
  /** nombre de spots documenté pour ces dimensions, si l'option est choisie */
  spots: number | null;
}

/**
 * Évalue une configuration de système. Ne chiffre rien : produit les blocages, points à confirmer
 * et le récapitulatif — la même entrée alimente la 3D, le devis et le PDF.
 */
export function evaluateSystemRules(rules: SystemRules, input: SystemInput, familyName: string): SystemEvaluation {
  const issues: Issue[] = [];
  const recap: RecapItem[] = [];
  const add = (i: Issue) => issues.push(i);

  const checkDim = (r: DimRule, v: number | undefined, path: string, required: boolean) => {
    if (v == null) {
      if (required) add({ code: "dimension_missing", severity: "blocking", message: `${r.label} : valeur requise.`, path });
      return;
    }
    if (!Number.isInteger(v) || v <= 0) {
      add({ code: "dimension_invalid", severity: "blocking", message: `${r.label} : saisissez une valeur en millimètres.`, path });
      return;
    }
    if (r.valuesMm?.length) {
      if (!r.valuesMm.includes(v)) add({ code: "dimension_value", severity: "blocking", message: `${r.label} : valeurs proposées ${dimRangeText(r)}.`, path });
      return;
    }
    if (v > r.maxMm || (r.minMm != null && v < r.minMm)) {
      add({ code: "dimension_out_of_bounds", severity: "blocking", message: `${r.label} : ${dimRangeText(r)}.`, path });
      return;
    }
    if (r.stepMm && r.minMm != null && (v - r.minMm) % r.stepMm !== 0) {
      add({ code: "dimension_step", severity: "blocking", message: `${r.label} : disponible par pas de ${r.stepMm / 10} cm à partir de ${fmtM(r.minMm)} — valeur voisine : ${fmtM(nearestAllowed(r, v))}.`, path });
      return;
    }
    if (r.confirmAboveMm != null && v > r.confirmAboveMm) {
      add({ code: "dimension_to_confirm", severity: "review", message: `${r.label} supérieure à ${fmtM(r.confirmAboveMm)} : ${r.confirmNote ?? "les sources divergent"} — validée au devis.`, path, quoteSuggested: true });
    }
    if (r.minMm == null && rules.type !== "awning") {
      add({ code: "dimension_min_undocumented", severity: "info", message: `${r.label} : minimum non documenté par les sources, vérifié au devis.`, path });
    }
  };

  checkDim(rules.dims.width, input.widthMm, "widthMm", true);
  if (rules.dims.depth) checkDim(rules.dims.depth, input.depthMm, "depthMm", true);
  if (rules.dims.height) checkDim(rules.dims.height, input.heightMm, "heightMm", rules.type === "screen");

  if (rules.depthWidthMin && input.depthMm != null) {
    const c = rules.depthWidthMin.find((x) => x.depthMm === input.depthMm);
    if (c && input.widthMm < c.widthMinMm) {
      add({ code: "depth_width_combination", severity: "blocking", message: `Avancée ${fmtM(input.depthMm)} : largeur minimale ${fmtM(c.widthMinMm)}.`, path: "widthMm" });
    }
  }

  const mounting = rules.mountings.find((m) => m.code === input.mounting);
  if (!mounting) add({ code: "mounting_unavailable", severity: "blocking", message: "Pose non proposée pour ce système.", path: "mounting" });
  else if (mounting.status === "to_confirm") add({ code: "mounting_to_confirm", severity: "review", message: `Pose ${MOUNTING_FR[mounting.code]} : ${mounting.note ?? "à confirmer"}.`, path: "mounting", quoteSuggested: true });

  const finish = rules.finishes.find((f) => f.code === input.finishCode) ?? (rules.customFinish?.code === input.finishCode ? rules.customFinish : undefined);
  if (!finish) add({ code: "finish_unavailable", severity: "blocking", message: "Teinte non proposée pour ce système.", path: "finishCode" });
  else if (finish.status === "to_confirm" || finish === rules.customFinish) add({ code: "finish_to_confirm", severity: "review", message: `${finish.label} : ${finish.note ?? "conditions et délai confirmés au devis"}.`, path: "finishCode", quoteSuggested: true });

  let fabric: Choice | undefined;
  if (rules.fabrics?.length) {
    fabric = rules.fabrics.find((f) => f.code === input.fabricCode);
    if (!fabric) add({ code: "fabric_unavailable", severity: "blocking", message: "Toile non proposée pour ce système.", path: "fabricCode" });
    else if (fabric.status === "to_confirm") add({ code: "fabric_to_confirm", severity: "review", message: `Toile ${fabric.label} : ${fabric.note ?? "disponibilité à confirmer"}.`, path: "fabricCode", quoteSuggested: true });
  }

  let control: ControlChoice | undefined;
  if (rules.controls?.length) {
    control = rules.controls.find((c) => c.code === input.controlCode);
    if (!control) add({ code: "control_unavailable", severity: "blocking", message: "Commande non proposée pour ce système.", path: "controlCode" });
    else {
      if (control.minWidthMm && input.widthMm < control.minWidthMm) add({ code: "control_min_width", severity: "blocking", message: `${control.label} : largeur minimale du système ${fmtM(control.minWidthMm)}.`, path: "controlCode" });
      if (control.status === "to_confirm") add({ code: "control_to_confirm", severity: "review", message: `${control.label} : ${control.note ?? "à confirmer au devis"}.`, path: "controlCode", quoteSuggested: true });
    }
  }

  const chosen = new Set<string>();
  let spots: number | null = null;
  input.options.forEach((o, idx) => {
    const def = rules.options.find((d) => d.code === o.code);
    const path = `options.${idx}`;
    if (!def) { add({ code: "option_unknown", severity: "blocking", message: "Option non proposée pour ce système.", path }); return; }
    if (chosen.has(def.code)) { add({ code: "option_duplicate", severity: "blocking", message: `${def.label} : sélectionnée deux fois.`, path }); return; }
    chosen.add(def.code);
    if (def.maxQty != null && (!Number.isInteger(o.qty ?? 1) || (o.qty ?? 1) < 1 || (o.qty ?? 1) > def.maxQty)) add({ code: "option_qty", severity: "blocking", message: `${def.label} : quantité entre 1 et ${def.maxQty}.`, path });
    if (def.values?.length && !def.values.some((v) => v.code === o.value)) add({ code: "option_value", severity: "blocking", message: `${def.label} : choisissez une valeur proposée.`, path });
    if (def.spotTable) {
      spots = spotsFor(def.spotTable, input.depthMm, input.widthMm);
      if (spots == null) add({ code: "spots_out_of_table", severity: "review", message: `${def.label} : dimensions hors du tableau de la fiche — nombre de points confirmé au devis.`, path, quoteSuggested: true });
    }
    if (def.status === "to_confirm") add({ code: "option_to_confirm", severity: "review", message: `${def.label} : ${def.note ?? "à confirmer au devis"}.`, path, quoteSuggested: true });
  });
  for (const def of rules.options) {
    if (!chosen.has(def.code) || !def.cumulToConfirmWith) continue;
    for (const other of def.cumulToConfirmWith) {
      if (chosen.has(other) && def.code < other) {
        const o = rules.options.find((x) => x.code === other);
        add({ code: "option_cumul_to_confirm", severity: "review", message: `${def.label} + ${o?.label ?? other} : cumul non documenté par la fiche — confirmé au devis.`, path: "options", quoteSuggested: true });
      }
    }
  }

  if (rules.type === "pergola") {
    const sides = Object.entries(input.sides ?? {}).filter(([, v]) => !!v) as Array<[SideKey, string]>;
    for (const [side, slug] of sides) {
      const wish = rules.closureWishes?.find((w) => w.familySlug === slug);
      if (!wish) add({ code: "closure_unavailable", severity: "blocking", message: "Fermeture latérale non proposée pour ce système.", path: `sides.${side}` });
      else add({ code: "closure_to_confirm", severity: "review", message: `${wish.label} côté ${SIDE_FR[side]} : ${wish.note}`, path: `sides.${side}`, quoteSuggested: true });
      if (input.mounting === "wall" && side === "back") add({ code: "closure_on_wall", severity: "blocking", message: "Côté mur : aucune fermeture en pose murale.", path: `sides.${side}` });
    }
    if (input.multiModule) {
      const m = rules.modules;
      add({ code: "multi_module", severity: "review", message: m?.multiModule === "documented" ? `Installation en plusieurs modules : possible — composition (modules, poteaux, gouttières) établie au devis.` : "Installation en plusieurs modules : non documentée pour ce système — étude au devis.", path: "multiModule", quoteSuggested: true });
    }
  }

  if (input.installation === "professional") add({ code: "installation_quote", severity: "review", message: "Pose professionnelle : zones et tarifs non établis — chiffrée sur devis.", path: "installation", quoteSuggested: true });
  for (const n of rules.notices ?? []) add({ code: "system_notice", severity: "info", message: n });
  add({ code: "system_quote_only", severity: "review", message: "Prix établi sur devis : les tarifs transmis n'ont pas encore de nature (vente ou achat), de devise et de fiscalité validées. Aucun prix n'est affiché.", quoteSuggested: true });

  /* Récapitulatif */
  const d = rules.dims;
  recap.push({ label: "Produit", value: familyName });
  recap.push({ label: d.width.label, value: Number.isInteger(input.widthMm) ? fmtM(input.widthMm) : "—" });
  if (d.depth) recap.push({ label: d.depth.label, value: input.depthMm != null ? fmtM(input.depthMm) : "—" });
  if (d.height) recap.push({ label: d.height.label, value: input.heightMm != null ? fmtM(input.heightMm) : "à préciser au relevé", status: input.heightMm == null ? "to_confirm" : undefined });
  if (mounting) recap.push({ label: "Pose", value: MOUNTING_FR[mounting.code], status: mounting.status === "to_confirm" ? "to_confirm" : undefined });
  if (finish) recap.push({ label: "Teinte de structure", value: finish.label, status: finish.status === "to_confirm" || finish === rules.customFinish ? "to_confirm" : undefined });
  if (fabric) recap.push({ label: "Toile", value: fabric.label, status: fabric.status === "to_confirm" ? "to_confirm" : undefined });
  if (control) recap.push({ label: "Commande", value: control.label, status: control.status === "to_confirm" ? "to_confirm" : undefined });
  for (const inc of rules.included) recap.push({ label: "Inclus", value: inc.label, status: inc.status === "to_confirm" ? "to_confirm" : "included" });
  for (const o of input.options) {
    const def = rules.options.find((x) => x.code === o.code);
    if (!def) continue;
    const val = def.values?.find((v) => v.code === o.value)?.label;
    const extra = def.spotTable ? (spots != null ? ` — ${spots} points selon dimensions` : " — nombre de points à confirmer") : "";
    recap.push({ label: "Option", value: `${def.label}${def.maxQty != null ? ` × ${o.qty ?? 1}` : ""}${val ? ` (${val})` : ""}${extra}`, status: def.status === "to_confirm" ? "to_confirm" : "option" });
  }
  if (rules.type === "pergola") {
    for (const [side, slug] of Object.entries(input.sides ?? {})) {
      if (!slug) continue;
      const wish = rules.closureWishes?.find((w) => w.familySlug === slug);
      recap.push({ label: `Fermeture côté ${SIDE_FR[side as SideKey]}`, value: `${wish?.label ?? slug} (souhait, étude au devis)`, status: "to_confirm" });
    }
    if (input.multiModule) recap.push({ label: "Modules", value: "installation en plusieurs modules souhaitée", status: "to_confirm" });
  }
  recap.push({ label: "Pose du système", value: input.installation === "professional" ? "pose professionnelle souhaitée (devis)" : "sans pose" });
  recap.push({ label: "Prix", value: "établi sur devis", status: "to_confirm" });

  const depth = d.depth ? (input.depthMm ?? null) : null;
  const height = d.height ? (input.heightMm ?? (rules.type === "pergola" ? Math.min(2500, d.height.maxMm) : null)) : null;
  return { issues, recap, geometry: { widthMm: input.widthMm, depthMm: depth, heightMm: height }, spots };
}

const SIDE_FR: Record<SideKey, string> = { back: "arrière", front: "avant", left: "gauche", right: "droit" };

/** Le système est-il représentable en 3D (dimensions valides) ? Retourne le motif sinon. */
export function systemSceneBlocker(rules: SystemRules, input: SystemInput): string | null {
  const ev = evaluateSystemRules(rules, input, "");
  const dim = ev.issues.find((i) => i.severity === "blocking" && /^(widthMm|depthMm|heightMm)$/.test(i.path ?? ""));
  if (dim) return `${dim.message} Vue 3D indisponible tant que la cote n'est pas corrigée.`;
  if (ev.issues.some((i) => i.severity === "blocking" && i.path === "mounting")) return "Pose non proposée : vue 3D indisponible.";
  return null;
}
