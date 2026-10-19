/**
 * Modèle de scène 3D — pur, déterministe, sérialisable (JSON), sans dépendance React ni three.js.
 *
 * Il décrit *ce qui est représenté* dans la vue 3D à partir d'une configuration et du catalogue :
 * dimensions, poteaux, poutres, lames, fermetures par segment, éclairage, chauffages, lanternes.
 * Ce n'est PAS un plan d'exécution : la hauteur, les sections de profilés, le nombre de lames,
 * l'écartement et l'emplacement exact des accessoires sont des valeurs indicatives (voir `indicative`).
 *
 * Repère (plan vu de dessus, en millimètres) :
 * - x : le long de la longueur commerciale (côtés `back` / `front`), de 0 (gauche) à `lengthMm` (droite) ;
 * - z : le long de la largeur commerciale (côtés `left` / `right`), de 0 (arrière, mur en adossée) à `widthMm` (avant) ;
 * - y : la hauteur (0 = sol).
 */
import { layoutForFamily } from "./layout";
import type { AwningInput, CatalogSnapshot, ConfigurationInput, EvaluationResult, Layout, Mounting, PergolaCustomInput, PergolaStandardInput, SideKey } from "./types";

export const SCENE_DISCLAIMER = "Visualisation indicative — ne constitue pas un plan d'exécution";
/** Mention portée par toute image jointe à un devis (image, PDF, compte, administration). */
export const VISUAL_DISCLAIMER = "Visualisation non contractuelle — ne constitue ni un plan d'exécution ni une validation technique";
/** Mention ajoutée aux scènes sur mesure : la géométrie ne valide pas la faisabilité. */
export const CUSTOM_FEASIBILITY_NOTE = "Faisabilité technique à valider sur devis : la représentation reprend vos cotes sans les valider.";

/** Hauteur de passage indicative (la fiche fournisseur n'est pas validée). */
export const INDICATIVE_HEIGHT_MM = 2500;
/** Hauteur de pose indicative du coffre d'un store banne. */
export const INDICATIVE_AWNING_HEIGHT_MM = 2600;
/** Entraxe indicatif des lames du toit. */
export const INDICATIVE_BLADE_PITCH_MM = 200;
/** Section indicative des poteaux et poutres. */
export const INDICATIVE_POST_SECTION_MM = 120;
export const INDICATIVE_BEAM_HEIGHT_MM = 200;

const STRUCTURE_HEX: Record<string, string> = { ANTHRACITE: "#3a3d41", WHITE: "#e9e6df", BLACK: "#15161a" };
const FABRIC_HEX: Record<string, string> = { GREY: "#9a9a94", BEIGE: "#d9c7a5" };

export type ClosureType = "glass" | "slats" | "screen";
export type LedColor = "warm_white" | "rgb";

export interface ScenePoint {
  xMm: number;
  zMm: number;
}

export interface ScenePost extends ScenePoint {
  id: string;
  kind: "corner" | "divider";
  /** côté porteur pour un poteau intermédiaire */
  side?: SideKey;
}

export interface SceneBeam {
  side: SideKey;
  from: ScenePoint;
  to: ScenePoint;
  lengthMm: number;
  /** poutre fixée au mur (implantation adossée) */
  onWall: boolean;
  /** gouttière avec éclairage LED (inclus dans la gamme ou bandes LED en option) */
  led: boolean;
}

export interface SceneClosure {
  id: string;
  side: SideKey;
  index: number;
  familySlug: string;
  type: ClosureType;
  option?: string;
  lengthMm: number;
  from: ScenePoint;
  to: ScenePoint;
  /**
   * Assemblage lu sur la variante catalogue (persiennes 5/6 m : modules avec poteau intermédiaire).
   * `toConfirm` = assemblage non validé par le fournisseur : représenté à titre indicatif.
   */
  assembly: { kind: "monobloc" | "modular" | "made_to_measure"; modules: number; intermediatePosts: number; usableWidthMm?: number; toConfirm: boolean };
}

export interface SceneOpening {
  id: string;
  side: SideKey;
  index: number;
  lengthMm: number;
  from: ScenePoint;
  to: ScenePoint;
  closure: SceneClosure | null;
}

export interface PergolaSceneModel {
  kind: "pergola";
  /** gamme standard (dimension catalogue) ou sur mesure (cotes saisies) */
  source: "standard" | "custom";
  familySlug: string;
  familyName: string;
  dimensionLabel: string;
  finishLabel: string;
  widthMm: number;
  lengthMm: number;
  heightMm: number;
  mounting: Mounting;
  /** mur de la maison le long du côté arrière */
  wall: boolean;
  posts: ScenePost[];
  beams: SceneBeam[];
  blades: {
    count: number;
    /** les lames s'étendent de l'arrière vers l'avant (le long de la largeur) et se succèdent le long de la longueur */
    orientation: "across_width";
    pitchMm: number;
    spanMm: number;
    motorized: boolean;
  };
  colors: {
    structureCode: string;
    bladeCode: string;
    structure: string;
    blades: string;
  };
  /** toutes les ouvertures (segments), fermées ou non — dans l'ordre du layout */
  openings: SceneOpening[];
  closures: SceneClosure[];
  lighting: {
    /** LED de gouttière (incluse Solis Pro ou bandes LED en option) */
    gutter: boolean;
    /** LED intégrées aux lames (Solis Max) */
    blades: boolean;
    /** bandes LED optionnelles : couleur choisie */
    ledStrips: { color: LedColor } | null;
    /** couleur de l'éclairage de gouttière (inclus : couleur choisie à l'étape 6 ou blanc chaud par défaut) */
    color: LedColor;
  };
  heaters: { count: number; option?: string };
  lanterns: { count: number; option?: string };
  /** la hauteur est-elle indicative (gamme standard) ou saisie (sur mesure) ? */
  indicative: { heightMm: boolean; sections: true; bladeCount: true; accessoryPlacement: true };
  /** éléments représentés mais non confirmés (assemblages, poteaux intermédiaires, bornes) */
  toConfirm: string[];
  disclaimer: string;
}

export interface AwningSceneModel {
  kind: "awning";
  familySlug: string;
  familyName: string;
  dimensionLabel: string;
  finishLabel: string;
  widthMm: number;
  projectionMm: number;
  heightMm: number;
  bracketMount: "wall" | "ceiling";
  bracketCount: number;
  cabinet: { code: string; color: string; heightMm: number; depthMm: number };
  fabric: { code: string; color: string };
  /** éclairage LED intégré au coffre (inclus dans la gamme démo) */
  led: boolean;
  anemometer: boolean;
  indicative: { heightMm: true; sections: true; armGeometry: true };
  disclaimer: string;
}

export type SceneModel = PergolaSceneModel | AwningSceneModel;

/** Catégorie visuelle d'une fermeture (même convention que `artFor` du configurateur). */
export function closureTypeOf(familySlug: string): ClosureType {
  if (familySlug.includes("vitree")) return "glass";
  if (familySlug.includes("persienne")) return "slats";
  return "screen";
}

function sideEndpoints(key: SideKey, lengthMm: number, widthMm: number): { from: ScenePoint; to: ScenePoint } {
  switch (key) {
    case "back":
      return { from: { xMm: 0, zMm: 0 }, to: { xMm: lengthMm, zMm: 0 } };
    case "front":
      return { from: { xMm: 0, zMm: widthMm }, to: { xMm: lengthMm, zMm: widthMm } };
    case "left":
      return { from: { xMm: 0, zMm: 0 }, to: { xMm: 0, zMm: widthMm } };
    case "right":
      return { from: { xMm: lengthMm, zMm: 0 }, to: { xMm: lengthMm, zMm: widthMm } };
  }
}

function closureAssembly(catalog: CatalogSnapshot, familySlug: string, option: string | undefined, lengthMm: number, colorCode: string, mounting: Mounting): SceneClosure["assembly"] {
  const variant = catalog.variants.find((v) => {
    if (v.familySlug !== familySlug || v.attributes.kind !== "side_closure") return false;
    const a = v.attributes;
    return a.sideLengthMm === lengthMm && a.colorCode === colorCode && (!option || !a.option || a.option === option) && (!a.mounting || a.mounting === mounting);
  });
  const a = variant?.attributes.kind === "side_closure" ? variant.attributes : undefined;
  const modular = a?.assembly === "modular";
  return {
    kind: modular ? "modular" : "monobloc",
    modules: Math.max(1, a?.modules ?? 1),
    intermediatePosts: Math.max(0, a?.intermediatePosts ?? 0),
    usableWidthMm: a?.usableWidthMm,
    toConfirm: modular && (a?.validation !== "confirmed" || !variant?.purchasable),
  };
}

function pointAlong(from: ScenePoint, to: ScenePoint, distanceMm: number): ScenePoint {
  const total = Math.hypot(to.xMm - from.xMm, to.zMm - from.zMm);
  const t = total === 0 ? 0 : distanceMm / total;
  return { xMm: Math.round(from.xMm + (to.xMm - from.xMm) * t), zMm: Math.round(from.zMm + (to.zMm - from.zMm) * t) };
}

/** Modèle de scène d'une pergola standard à partir du layout (géométrie) et de l'entrée. */
interface SceneOverrides {
  source: "custom";
  heightMm: number;
  dimensionLabel: string;
  /** fermetures fabriquées à la cote : assemblage jamais déduit d'une variante catalogue */
  boundsStatus: string;
}

export function buildPergolaSceneModel(catalog: CatalogSnapshot, input: PergolaStandardInput, layout: Layout, overrides?: SceneOverrides): PergolaSceneModel {
  const family = catalog.families.find((f) => f.slug === input.familySlug);
  const dim = catalog.dimensions.find((d) => d.code === input.dimensionCode);
  const fin = catalog.finishes.find((f) => f.code === input.finishCode);
  const { widthMm, lengthMm, mounting } = layout;
  const wall = mounting === "wall";

  const posts: ScenePost[] = [];
  if (!wall) {
    posts.push({ id: "post-back-left", kind: "corner", xMm: 0, zMm: 0 }, { id: "post-back-right", kind: "corner", xMm: lengthMm, zMm: 0 });
  }
  posts.push({ id: "post-front-left", kind: "corner", xMm: 0, zMm: widthMm }, { id: "post-front-right", kind: "corner", xMm: lengthMm, zMm: widthMm });

  const ledStrip = input.options.find((o) => o.familySlug === "bandes-led" && o.qty > 0);
  // Sur mesure : le moteur ne chiffre aucun éclairage inclus (inclusion non confirmée — la référence observée est
  // contradictoire : texte « LED intégrées » mais option LED vendue à part) ; seule l'option choisie est représentée.
  const included = overrides?.source === "custom" ? "none" : (family?.lightingIncluded ?? "none");
  const gutterLed = included === "gutter_led" || !!ledStrip;
  const ledColorChoice = ledStrip?.variantOption ?? input.options.find((o) => o.familySlug === "bandes-led")?.variantOption;
  const ledColor: LedColor = ledColorChoice === "rgb" ? "rgb" : "warm_white";

  const beams: SceneBeam[] = [];
  const openings: SceneOpening[] = [];
  const closures: SceneClosure[] = [];
  for (const side of layout.sides) {
    const { from, to } = sideEndpoints(side.key, lengthMm, widthMm);
    beams.push({ side: side.key, from, to, lengthMm: side.lengthMm, onWall: side.isWall, led: gutterLed });
    let acc = 0;
    for (const seg of side.segments) {
      const segFrom = pointAlong(from, to, acc);
      acc += seg.lengthMm;
      const segTo = pointAlong(from, to, acc);
      if (seg.hasDividerPost) posts.push({ id: `post-${seg.id}`, kind: "divider", side: side.key, ...segTo });
      const choice = input.segments[seg.id];
      const assembly: SceneClosure["assembly"] | null = choice
        ? overrides
          ? { kind: "made_to_measure", modules: 1, intermediatePosts: 0, toConfirm: true }
          : closureAssembly(catalog, choice.closureFamilySlug, choice.option, seg.lengthMm, fin?.structureColor ?? "ANTHRACITE", mounting)
        : null;
      const closure: SceneClosure | null = choice && assembly
        ? { id: seg.id, side: side.key, index: seg.index, familySlug: choice.closureFamilySlug, type: closureTypeOf(choice.closureFamilySlug), option: choice.option, lengthMm: seg.lengthMm, from: segFrom, to: segTo, assembly }
        : null;
      if (closure) closures.push(closure);
      openings.push({ id: seg.id, side: side.key, index: seg.index, lengthMm: seg.lengthMm, from: segFrom, to: segTo, closure });
    }
  }

  const heater = input.options.find((o) => o.familySlug === "lampe-chauffante" && o.qty > 0);
  const lantern = input.options.find((o) => o.familySlug === "lanterne-ambiance" && o.qty > 0);
  const structureCode = fin?.structureColor ?? "ANTHRACITE";
  const bladeCode = fin?.bladeColor ?? structureCode;

  const toConfirm: string[] = [];
  for (const c of closures) {
    if (!c.assembly.toConfirm) continue;
    const name = catalog.families.find((f) => f.slug === c.familySlug)?.name ?? c.familySlug;
    const where = `côté ${c.side === "back" ? "arrière" : c.side === "front" ? "avant" : c.side === "left" ? "gauche" : "droit"}${side2count(openings, c.side) > 1 ? ` ${c.index}` : ""}`;
    toConfirm.push(c.assembly.kind === "made_to_measure" ? `${name} ${where} : fabrication et assemblage à la cote (${fmtM(c.lengthMm)} m) à confirmer` : `${name} ${where} : assemblage en ${c.assembly.modules} modules à confirmer`);
  }
  const dividers = posts.filter((p) => p.kind === "divider").length;
  if (overrides && dividers > 0) toConfirm.push(`${dividers} poteau${dividers > 1 ? "x" : ""} intermédiaire${dividers > 1 ? "s" : ""} représenté${dividers > 1 ? "s" : ""} selon la règle de portée de démonstration (à confirmer)`);
  if (overrides && overrides.boundsStatus !== "supplier_verified") toConfirm.push("Bornes dimensionnelles du sur mesure non confirmées par le fournisseur");

  return {
    kind: "pergola",
    source: overrides?.source ?? "standard",
    familySlug: input.familySlug,
    familyName: family?.name ?? input.familySlug,
    dimensionLabel: overrides?.dimensionLabel ?? dim?.label ?? `${lengthMm / 1000} × ${widthMm / 1000} m`,
    finishLabel: fin?.label ?? input.finishCode,
    widthMm,
    lengthMm,
    heightMm: overrides?.heightMm ?? INDICATIVE_HEIGHT_MM,
    mounting,
    wall,
    posts,
    beams,
    blades: {
      count: Math.max(1, Math.round(lengthMm / INDICATIVE_BLADE_PITCH_MM)),
      orientation: "across_width",
      pitchMm: INDICATIVE_BLADE_PITCH_MM,
      spanMm: widthMm,
      motorized: family?.roof === "motorized",
    },
    colors: { structureCode, bladeCode, structure: STRUCTURE_HEX[structureCode] ?? "#3a3d41", blades: STRUCTURE_HEX[bladeCode] ?? "#3a3d41" },
    openings,
    closures,
    lighting: { gutter: gutterLed, blades: included === "blade_led", ledStrips: ledStrip ? { color: ledColor } : null, color: ledColor },
    heaters: { count: heater?.qty ?? 0, option: heater?.variantOption },
    lanterns: { count: lantern?.qty ?? 0, option: lantern?.variantOption },
    indicative: { heightMm: !overrides, sections: true, bladeCount: true, accessoryPlacement: true },
    toConfirm,
    disclaimer: overrides ? `${SCENE_DISCLAIMER}. ${CUSTOM_FEASIBILITY_NOTE}` : SCENE_DISCLAIMER,
  };
}

function side2count(openings: SceneOpening[], side: SideKey) {
  return openings.filter((o) => o.side === side).length;
}

const fmtM = (mm: number) => `${(mm / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`;

/**
 * Motif pour lequel une configuration sur mesure n'est pas représentée en 3D (null = représentable).
 * Les bornes et pas sont ceux du catalogue (`catalog.custom`) : aucune valeur n'est bornée silencieusement.
 */
export function customSceneBlocker(catalog: CatalogSnapshot, input: PergolaCustomInput): string | null {
  const c = catalog.custom;
  const checks: Array<[string, number, { min: number; max: number; step: number }]> = [["Largeur", input.widthMm, c.widthMm], ["Longueur", input.lengthMm, c.lengthMm], ["Hauteur", input.heightMm, c.heightMm]];
  for (const [label, v, r] of checks) {
    if (!Number.isInteger(v) || v < r.min || v > r.max) return `${label} hors bornes (${r.min}–${r.max} mm) : vue 3D indisponible tant que la cote n'est pas corrigée.`;
    if ((v - r.min) % r.step !== 0) return `${label} : saisissez une valeur par pas de ${r.step} mm pour afficher la vue 3D.`;
  }
  if (!catalog.finishes.some((f) => f.code === input.finishCode)) return "Finition inconnue : vue 3D indisponible.";
  return null;
}

/**
 * Scène d'une pergola sur mesure : cotes saisies (largeur, longueur, hauteur), implantation, finition,
 * fermetures par côté réparties sur les segments du layout du moteur, options. Même entrée que le devis.
 */
export function buildCustomSceneModel(catalog: CatalogSnapshot, input: PergolaCustomInput, layout?: Layout | null): PergolaSceneModel | null {
  if (customSceneBlocker(catalog, input)) return null;
  const family = catalog.families.find((f) => f.slug === "pergola-sur-mesure") ?? catalog.families.find((f) => f.kind === "pergola_custom");
  const geo = layout ?? (family ? layoutForFamily(family, input.widthMm, input.lengthMm, input.mounting) : null);
  if (!geo) return null;
  const segments: PergolaStandardInput["segments"] = {};
  for (const side of geo.sides) {
    const choice = input.sides[side.key];
    if (!choice) continue;
    for (const seg of side.segments) segments[seg.id] = { closureFamilySlug: choice.closureFamilySlug };
  }
  const std: PergolaStandardInput = { kind: "pergola_standard", familySlug: family?.slug ?? "pergola-sur-mesure", mounting: input.mounting, dimensionCode: "custom", finishCode: input.finishCode, segments, options: input.options, installation: input.installation, delivery: input.delivery };
  return buildPergolaSceneModel(catalog, std, geo, { source: "custom", heightMm: input.heightMm, dimensionLabel: `largeur ${fmtM(input.widthMm)} m × longueur ${fmtM(input.lengthMm)} m, hauteur ${fmtM(input.heightMm)} m`, boundsStatus: catalog.custom.dataStatus });
}

export function buildAwningSceneModel(catalog: CatalogSnapshot, input: AwningInput): AwningSceneModel {
  const family = catalog.families.find((f) => f.slug === input.familySlug);
  const cabinetLabel = input.cabinetColor === "WHITE" ? "coffre blanc" : input.cabinetColor === "ANTHRACITE" ? "coffre anthracite" : `coffre ${input.cabinetColor.toLowerCase()}`;
  const fabricLabel = input.fabricCode === "GREY" ? "toile grise" : input.fabricCode === "BEIGE" ? "toile beige" : `toile ${input.fabricCode.toLowerCase()}`;
  return {
    kind: "awning",
    familySlug: input.familySlug,
    familyName: family?.name ?? input.familySlug,
    dimensionLabel: `${input.widthMm / 1000} × ${input.projectionMm / 1000} m`,
    finishLabel: `${cabinetLabel}, ${fabricLabel}`,
    widthMm: input.widthMm,
    projectionMm: input.projectionMm,
    heightMm: INDICATIVE_AWNING_HEIGHT_MM,
    bracketMount: input.bracketMount,
    // même règle indicative que le moteur (3 supports à partir de 5 m)
    bracketCount: input.widthMm >= 5000 ? 3 : 2,
    cabinet: { code: input.cabinetColor, color: STRUCTURE_HEX[input.cabinetColor] ?? "#3a3d41", heightMm: 220, depthMm: 260 },
    fabric: { code: input.fabricCode, color: FABRIC_HEX[input.fabricCode] ?? "#9a9a94" },
    led: true,
    anemometer: input.options.some((o) => o.familySlug === "anemometre" && o.qty > 0),
    indicative: { heightMm: true, sections: true, armGeometry: true },
    disclaimer: SCENE_DISCLAIMER,
  };
}

/**
 * Point d'entrée générique : construit le modèle de scène d'une configuration.
 * Retourne `null` pour les types non représentés (accessoire seul) ou un sur mesure hors bornes.
 * `result.layout` est utilisé s'il est fourni, sinon le layout est reconstruit depuis le catalogue.
 */
export function buildSceneModel(catalog: CatalogSnapshot, input: ConfigurationInput, result?: Pick<EvaluationResult, "layout"> | null): SceneModel | null {
  if (input.kind === "awning") return buildAwningSceneModel(catalog, input);
  if (input.kind === "pergola_custom") return buildCustomSceneModel(catalog, input, result?.layout ?? null);
  if (input.kind !== "pergola_standard") return null;
  let layout = result?.layout ?? null;
  if (!layout) {
    const family = catalog.families.find((f) => f.slug === input.familySlug);
    const dim = catalog.dimensions.find((d) => d.code === input.dimensionCode);
    if (!family || !dim) return null;
    layout = layoutForFamily(family, dim.widthMm, dim.lengthMm, input.mounting);
  }
  return buildPergolaSceneModel(catalog, input, layout);
}

const CLOSURE_FR: Record<ClosureType, string> = { glass: "paroi vitrée", slats: "persienne", screen: "store ZIP" };
const SIDE_FR: Record<SideKey, string> = { back: "arrière", front: "avant", left: "gauche", right: "droit" };

/**
 * Liste détaillée de ce qui est représenté sur la visualisation (jointe au devis et au PDF).
 * Dérivée du modèle de scène : elle décrit exactement ce qui est dessiné, rien de plus.
 */
export function representedItems(catalog: CatalogSnapshot, model: SceneModel): string[] {
  if (model.kind === "awning") {
    return [
      `Gamme : ${model.familyName}`,
      `Dimensions : ${model.dimensionLabel} (largeur × avancée)`,
      `Finition : ${model.finishLabel}`,
      `${model.bracketCount} supports ${model.bracketMount === "wall" ? "muraux" : "plafond"}`,
      model.led ? "Éclairage LED du coffre" : null,
      model.anemometer ? "Anémomètre" : null,
      `Hauteur de pose représentée : ${fmtM(model.heightMm)} m (indicative)`,
    ].filter((x): x is string => !!x);
  }
  const familyName = (slug: string) => catalog.families.find((f) => f.slug === slug)?.name ?? CLOSURE_FR[closureTypeOf(slug)];
  const items = [
    `Gamme : ${model.familyName}`,
    `Dimensions : ${model.dimensionLabel}`,
    `Implantation : ${model.mounting === "wall" ? "adossée au mur" : "autoportée"}`,
    `Finition : ${model.finishLabel}`,
    `${model.posts.length} poteaux dont ${model.posts.filter((p) => p.kind === "divider").length} intermédiaire(s) (indicatif)`,
    `Toit : ${model.blades.count} lames ${model.blades.motorized ? "motorisées" : "orientables"} (nombre indicatif)`,
  ];
  for (const o of model.openings) {
    const multi = model.openings.filter((x) => x.side === o.side).length > 1;
    const where = `Côté ${SIDE_FR[o.side]}${multi ? ` ${o.index}` : ""} (${fmtM(o.lengthMm)} m)`;
    items.push(o.closure ? `${where} : ${familyName(o.closure.familySlug)}${o.closure.option ? ` (${o.closure.option})` : ""}${o.closure.assembly.toConfirm ? " — assemblage à confirmer" : ""}` : `${where} : ouvert`);
  }
  items.push(model.lighting.blades ? "Éclairage : LED intégrées aux lames" : model.lighting.gutter ? `Éclairage : LED de gouttière ${model.lighting.color === "rgb" ? "RGB" : "blanc chaud"}` : "Éclairage : aucun");
  if (model.heaters.count) items.push(`${model.heaters.count} lampe(s) chauffante(s)${model.heaters.option ? ` ${model.heaters.option}` : ""} (emplacement indicatif)`);
  if (model.lanterns.count) items.push(`${model.lanterns.count} lanterne(s)${model.lanterns.option ? ` ${model.lanterns.option}` : ""} (emplacement indicatif)`);
  items.push(model.indicative.heightMm ? `Hauteur représentée : ${fmtM(model.heightMm)} m (indicative)` : `Hauteur saisie : ${fmtM(model.heightMm)} m`);
  for (const t of model.toConfirm) items.push(`À confirmer : ${t}`);
  return items;
}
