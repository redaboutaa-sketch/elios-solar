import { describe, expect, it } from "vitest";
import { evaluate } from "@/domain/engine";
import { INDICATIVE_HEIGHT_MM, SCENE_DISCLAIMER, buildSceneModel, closureTypeOf } from "@/domain/scene-model";
import type { AwningInput, PergolaStandardInput } from "@/domain/types";
import { buildDemoCatalog } from "@/server/catalog/demo-data";

const catalog = buildDemoCatalog();

function standard(over: Partial<PergolaStandardInput> = {}): PergolaStandardInput {
  return {
    kind: "pergola_standard",
    familySlug: "pergola-solis",
    mounting: "freestanding",
    dimensionCode: "3x4",
    finishCode: "ANTHRACITE",
    segments: {},
    options: [],
    installation: "self",
    delivery: { countryCode: "FR", postalCode: "69000" },
    ...over,
  };
}

function pergola(over: Partial<PergolaStandardInput> = {}) {
  const input = standard(over);
  const model = buildSceneModel(catalog, input, evaluate(catalog, input));
  if (!model || model.kind !== "pergola") throw new Error("modèle pergola attendu");
  return model;
}

describe("modèle de scène — pergola", () => {
  it("3x4 autoportée : 4 poteaux d'angle, 4 poutres, 4 ouvertures, hauteur indicative", () => {
    const m = pergola();
    expect(m.lengthMm).toBe(4000);
    expect(m.widthMm).toBe(3000);
    expect(m.posts.filter((p) => p.kind === "corner")).toHaveLength(4);
    expect(m.posts.filter((p) => p.kind === "divider")).toHaveLength(0);
    expect(m.beams).toHaveLength(4);
    expect(m.openings.map((o) => o.id)).toEqual(["back-1", "right-1", "front-1", "left-1"]);
    expect(m.heightMm).toBe(INDICATIVE_HEIGHT_MM);
    expect(m.indicative.heightMm).toBe(true);
    expect(m.disclaimer).toBe(SCENE_DISCLAIMER);
    expect(m.wall).toBe(false);
  });

  it("4x6 autoportée : les côtés de 6 m sont divisés avec un poteau intermédiaire au milieu", () => {
    const m = pergola({ dimensionCode: "4x6" });
    const dividers = m.posts.filter((p) => p.kind === "divider");
    expect(dividers).toHaveLength(2);
    expect(dividers.map((d) => [d.side, d.xMm, d.zMm])).toEqual([["back", 3000, 0], ["front", 3000, 4000]]);
    expect(m.posts).toHaveLength(6);
    expect(m.openings.map((o) => o.id)).toEqual(["back-1", "back-2", "right-1", "front-1", "front-2", "left-1"]);
    const back2 = m.openings.find((o) => o.id === "back-2")!;
    expect(back2.from).toEqual({ xMm: 3000, zMm: 0 });
    expect(back2.to).toEqual({ xMm: 6000, zMm: 0 });
  });

  it("adossée : 2 poteaux avant, mur et poutre arrière sur le mur, pas d'ouverture arrière", () => {
    const m = pergola({ mounting: "wall", dimensionCode: "3x5" });
    expect(m.wall).toBe(true);
    expect(m.posts).toHaveLength(2);
    expect(m.posts.every((p) => p.zMm === m.widthMm)).toBe(true);
    expect(m.beams.find((b) => b.side === "back")?.onWall).toBe(true);
    expect(m.openings.map((o) => o.id)).toEqual(["right-1", "front-1", "left-1"]);
  });

  it("une fermeture sur left-1 est placée sur le côté gauche avec le bon type et la bonne longueur", () => {
    const m = pergola({ segments: { "left-1": { closureFamilySlug: "paroi-vitree", option: "sliding_frameless" } } });
    expect(m.closures).toHaveLength(1);
    const c = m.closures[0]!;
    expect(c).toMatchObject({ id: "left-1", side: "left", type: "glass", option: "sliding_frameless", lengthMm: 3000 });
    expect(c.from).toEqual({ xMm: 0, zMm: 0 });
    expect(c.to).toEqual({ xMm: 0, zMm: 3000 });
    expect(m.openings.find((o) => o.id === "left-1")?.closure?.id).toBe("left-1");
    expect(m.openings.find((o) => o.id === "right-1")?.closure).toBeNull();
    expect(closureTypeOf("persienne-aluminium")).toBe("slats");
    expect(closureTypeOf("store-vertical-zip")).toBe("screen");
  });

  it("persienne de 5 m : assemblage modulaire (2 modules, 1 poteau intermédiaire) marqué à confirmer ; 3 m : monobloc", () => {
    const m = pergola({ dimensionCode: "3x5", segments: { "front-1": { closureFamilySlug: "persienne-aluminium" }, "left-1": { closureFamilySlug: "persienne-aluminium" } } });
    const front = m.closures.find((c) => c.id === "front-1")!;
    expect(front.assembly).toMatchObject({ kind: "modular", modules: 2, intermediatePosts: 1, toConfirm: true });
    expect(front.assembly.usableWidthMm).toBeLessThan(5000);
    expect(m.closures.find((c) => c.id === "left-1")!.assembly).toMatchObject({ kind: "monobloc", modules: 1, intermediatePosts: 0, toConfirm: false });
  });

  it("Solis Pro : éclairage de gouttière même sans option ; Solis : aucun ; Solis Max : LED dans les lames", () => {
    expect(pergola({ familySlug: "pergola-solis-pro" }).lighting).toMatchObject({ gutter: true, blades: false, ledStrips: null, color: "warm_white" });
    expect(pergola({ familySlug: "pergola-solis-pro" }).beams.every((b) => b.led)).toBe(true);
    expect(pergola().lighting).toMatchObject({ gutter: false, blades: false, ledStrips: null });
    expect(pergola({ familySlug: "pergola-solis-max" }).lighting).toMatchObject({ gutter: false, blades: true });
  });

  it("bandes LED RGB : gouttières éclairées en couleur rgb", () => {
    const m = pergola({ options: [{ familySlug: "bandes-led", variantOption: "rgb", qty: 1 }] });
    expect(m.lighting).toMatchObject({ gutter: true, ledStrips: { color: "rgb" }, color: "rgb" });
    expect(m.beams.every((b) => b.led)).toBe(true);
  });

  it("finition « anthracite, lames blanches » : couleurs structure et lames distinctes", () => {
    const m = pergola({ finishCode: "ANTHRACITE_WHITE_BLADES" });
    expect(m.colors.structureCode).toBe("ANTHRACITE");
    expect(m.colors.bladeCode).toBe("WHITE");
    expect(m.colors.structure).not.toBe(m.colors.blades);
    expect(m.finishLabel).toBe("Anthracite, lames blanches");
    const uni = pergola({ finishCode: "WHITE" });
    expect(uni.colors.structure).toBe(uni.colors.blades);
  });

  it("chauffages et lanternes : quantités reportées ; lames : nombre déduit de la longueur", () => {
    const m = pergola({ options: [{ familySlug: "lampe-chauffante", variantOption: "2000w", qty: 2 }, { familySlug: "lanterne-ambiance", variantOption: "large", qty: 1 }] });
    expect(m.heaters).toEqual({ count: 2, option: "2000w" });
    expect(m.lanterns).toEqual({ count: 1, option: "large" });
    expect(m.blades.count).toBe(20);
    expect(m.blades.spanMm).toBe(3000);
    expect(m.blades.motorized).toBe(false);
    expect(pergola({ familySlug: "pergola-solis-pro" }).blades.motorized).toBe(true);
  });

  it("est déterministe et sérialisable en JSON", () => {
    const input = standard({ dimensionCode: "4x6", segments: { "front-2": { closureFamilySlug: "store-vertical-zip", option: "zip" } } });
    const a = buildSceneModel(catalog, input);
    const b = buildSceneModel(catalog, input, evaluate(catalog, input));
    expect(JSON.parse(JSON.stringify(a))).toEqual(b);
  });
});

describe("modèle de scène — store banne", () => {
  const awning: AwningInput = { kind: "awning", familySlug: "store-banne-ombra", widthMm: 5000, projectionMm: 3000, cabinetColor: "WHITE", fabricCode: "BEIGE", bracketMount: "ceiling", options: [{ familySlug: "anemometre", qty: 1 }], installation: "self", delivery: { countryCode: "FR" } };
  it("reporte largeur, avancée, coffre, toile, supports et anémomètre", () => {
    const m = buildSceneModel(catalog, awning);
    if (!m || m.kind !== "awning") throw new Error("modèle store attendu");
    expect(m).toMatchObject({ widthMm: 5000, projectionMm: 3000, bracketMount: "ceiling", bracketCount: 3, anemometer: true, led: true });
    expect(m.cabinet.code).toBe("WHITE");
    expect(m.cabinet.color).toBe("#e9e6df");
    expect(m.fabric.code).toBe("BEIGE");
    expect(m.fabric.color).toBe("#d9c7a5");
    expect(m.dimensionLabel).toBe("5 × 3 m");
    expect(m.finishLabel).toBe("coffre blanc, toile beige");
    expect(m.indicative.heightMm).toBe(true);
    expect(m.disclaimer).toBe(SCENE_DISCLAIMER);
  });
  it("2 supports sous 5 m, sans anémomètre par défaut", () => {
    const m = buildSceneModel(catalog, { ...awning, widthMm: 3000, projectionMm: 2000, options: [] });
    expect(m).toMatchObject({ kind: "awning", bracketCount: 2, anemometer: false });
  });
});

describe("types non représentés", () => {
  it("retourne null pour un accessoire seul", () => {
    expect(buildSceneModel(catalog, { kind: "accessory", familySlug: "bandes-led", sku: "x", qty: 1, target: { pergolaFamilySlug: "pergola-solis" }, delivery: { countryCode: "FR" } })).toBeNull();
  });
});
