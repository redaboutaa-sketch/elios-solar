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
import type { AwningInput, CatalogSnapshot, ConfigurationInput, EvaluationResult, Layout, Mounting, PergolaStandardInput, SideKey } from "./types";

export const SCENE_DISCLAIMER = "Visualisation indicative — ne constitue pas un plan d'exécution";

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
  assembly: { kind: "monobloc" | "modular"; modules: number; intermediatePosts: number; usableWidthMm?: number; toConfirm: boolean };
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
  indicative: { heightMm: true; sections: true; bladeCount: true; accessoryPlacement: true };
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
export function buildPergolaSceneModel(catalog: CatalogSnapshot, input: PergolaStandardInput, layout: Layout): PergolaSceneModel {
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
  const included = family?.lightingIncluded ?? "none";
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
      const closure: SceneClosure | null = choice
        ? { id: seg.id, side: side.key, index: seg.index, familySlug: choice.closureFamilySlug, type: closureTypeOf(choice.closureFamilySlug), option: choice.option, lengthMm: seg.lengthMm, from: segFrom, to: segTo, assembly: closureAssembly(catalog, choice.closureFamilySlug, choice.option, seg.lengthMm, fin?.structureColor ?? "ANTHRACITE", mounting) }
        : null;
      if (closure) closures.push(closure);
      openings.push({ id: seg.id, side: side.key, index: seg.index, lengthMm: seg.lengthMm, from: segFrom, to: segTo, closure });
    }
  }

  const heater = input.options.find((o) => o.familySlug === "lampe-chauffante" && o.qty > 0);
  const lantern = input.options.find((o) => o.familySlug === "lanterne-ambiance" && o.qty > 0);
  const structureCode = fin?.structureColor ?? "ANTHRACITE";
  const bladeCode = fin?.bladeColor ?? structureCode;

  return {
    kind: "pergola",
    familySlug: input.familySlug,
    familyName: family?.name ?? input.familySlug,
    dimensionLabel: dim?.label ?? `${lengthMm / 1000} × ${widthMm / 1000} m`,
    finishLabel: fin?.label ?? input.finishCode,
    widthMm,
    lengthMm,
    heightMm: INDICATIVE_HEIGHT_MM,
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
    indicative: { heightMm: true, sections: true, bladeCount: true, accessoryPlacement: true },
    disclaimer: SCENE_DISCLAIMER,
  };
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
 * Retourne `null` pour les types non représentés (sur mesure, accessoire seul).
 * `result.layout` est utilisé s'il est fourni, sinon le layout est reconstruit depuis le catalogue.
 */
export function buildSceneModel(catalog: CatalogSnapshot, input: ConfigurationInput, result?: Pick<EvaluationResult, "layout"> | null): SceneModel | null {
  if (input.kind === "awning") return buildAwningSceneModel(catalog, input);
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
