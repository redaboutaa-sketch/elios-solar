import { describe, expect, it } from "vitest";
import { evaluate } from "@/domain/engine";
import { allSegments } from "@/domain/layout";
import { CUSTOM_FEASIBILITY_NOTE, buildSceneModel, customSceneBlocker, representedItems, type PergolaSceneModel } from "@/domain/scene-model";
import type { PergolaCustomInput } from "@/domain/types";
import { buildDemoCatalog } from "@/server/catalog/demo-data";

const catalog = buildDemoCatalog();
const c = catalog.custom;
const custom = (over: Partial<PergolaCustomInput> = {}): PergolaCustomInput => ({ kind: "pergola_custom", widthMm: 3500, lengthMm: 4500, heightMm: 2500, mounting: "wall", finishCode: "ANTHRACITE", sides: {}, options: [], installation: "self", delivery: { countryCode: "FR" }, ...over });
const scene = (input: PergolaCustomInput) => buildSceneModel(catalog, input, evaluate(catalog, input)) as PergolaSceneModel | null;

describe("vue 3D du sur mesure", () => {
  it("reprend largeur, longueur et hauteur saisies (la hauteur n'est plus indicative)", () => {
    const m = scene(custom({ widthMm: 3200, lengthMm: 5100, heightMm: 2750 }))!;
    expect(m.source).toBe("custom");
    expect([m.widthMm, m.lengthMm, m.heightMm]).toEqual([3200, 5100, 2750]);
    expect(m.indicative.heightMm).toBe(false);
    expect(m.dimensionLabel).toBe("largeur 3,2 m × longueur 5,1 m, hauteur 2,75 m");
    expect(m.disclaimer).toContain(CUSTOM_FEASIBILITY_NOTE);
  });

  it("suit les changements de dimensions et d'implantation", () => {
    const a = scene(custom({ mounting: "wall" }))!;
    const b = scene(custom({ mounting: "freestanding", lengthMm: 4000 }))!;
    expect(a.posts.length).toBe(2);
    expect(a.wall).toBe(true);
    expect(b.posts.length).toBe(4);
    expect(b.lengthMm).toBe(4000);
    expect(b.blades.count).not.toBe(a.blades.count);
  });

  it("valeurs limites : min et max acceptés, hors bornes et hors pas refusés", () => {
    expect(scene(custom({ widthMm: c.widthMm.min, lengthMm: c.lengthMm.min, heightMm: c.heightMm.min }))).not.toBeNull();
    expect(scene(custom({ widthMm: c.widthMm.max, lengthMm: c.lengthMm.max, heightMm: c.heightMm.max }))).not.toBeNull();
    expect(scene(custom({ widthMm: c.widthMm.max + c.widthMm.step }))).toBeNull();
    expect(scene(custom({ heightMm: c.heightMm.min - 10 }))).toBeNull();
    expect(customSceneBlocker(catalog, custom({ lengthMm: c.lengthMm.max + 10 }))).toMatch(/Longueur hors bornes/);
    expect(customSceneBlocker(catalog, custom({ widthMm: c.widthMm.min + 5 }))).toMatch(/pas de 10 mm/);
    expect(customSceneBlocker(catalog, custom({ finishCode: "ROSE" }))).toMatch(/Finition inconnue/);
  });

  it("poteaux et segments cohérents avec le layout du moteur ; poteau intermédiaire signalé à confirmer", () => {
    const input = custom({ mounting: "freestanding", lengthMm: c.lengthMm.max, sides: { front: { closureFamilySlug: "paroi-vitree" } } });
    const r = evaluate(catalog, input);
    const m = scene(input)!;
    expect(m.posts.length).toBe(r.layout!.postCount);
    expect(m.openings.map((o) => o.id)).toEqual(allSegments(r.layout!).map((s) => s.id));
    // la fermeture d'un côté est répartie sur tous ses segments
    expect(m.closures.filter((x) => x.side === "front").length).toBe(r.layout!.sides.find((s) => s.key === "front")!.segments.length);
    expect(m.closures.length).toBeGreaterThan(1);
    expect(m.toConfirm.some((t) => /poteau.*intermédiaire/.test(t))).toBe(true);
  });

  it("fermetures sur mesure : assemblage jamais déduit d'une variante catalogue, toujours à confirmer", () => {
    const m = scene(custom({ sides: { left: { closureFamilySlug: "persienne-aluminium" }, right: { closureFamilySlug: "store-vertical-zip" } } }))!;
    expect(m.closures.map((x) => x.type).sort()).toEqual(["screen", "slats"]);
    expect(m.closures.every((x) => x.assembly.kind === "made_to_measure" && x.assembly.toConfirm)).toBe(true);
    expect(m.toConfirm.some((t) => /Persienne/.test(t))).toBe(true);
  });

  it("éclairage : aucun éclairage inclus supposé (non chiffré par le moteur) ; seule l'option choisie est représentée", () => {
    const none = scene(custom({ options: [] }))!;
    expect(none.lighting.gutter).toBe(false);
    expect(none.lighting.blades).toBe(false);
    expect(representedItems(catalog, none)).toContain("Éclairage : aucun");
    const withLed = scene(custom({ options: [{ familySlug: "bandes-led", variantOption: "warm_white", qty: 1 }] }))!;
    expect(withLed.lighting.gutter).toBe(true);
  });

  it("accessoires et finition représentés ; bornes non confirmées signalées", () => {
    const m = scene(custom({ finishCode: "ANTHRACITE_WHITE_BLADES", options: [{ familySlug: "lampe-chauffante", variantOption: "1500W", qty: 2 }, { familySlug: "bandes-led", variantOption: "rgb", qty: 1 }] }))!;
    expect(m.heaters.count).toBe(2);
    expect(m.lighting.ledStrips).toEqual({ color: "rgb" });
    expect(m.colors.structure).not.toBe(m.colors.blades);
    expect(m.toConfirm).toContain("Bornes dimensionnelles du sur mesure non confirmées par le fournisseur");
    const items = representedItems(catalog, m);
    expect(items).toContain("Hauteur saisie : 2,5 m");
    expect(items.some((i) => /2 lampe\(s\) chauffante\(s\)/.test(i))).toBe(true);
    expect(items.some((i) => /^À confirmer : Bornes/.test(i))).toBe(true);
  });

  it("l'entrée du devis n'est pas modifiée par la construction de la scène", () => {
    const input = custom({ sides: { front: { closureFamilySlug: "paroi-vitree" } } });
    const before = JSON.stringify(input);
    scene(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
