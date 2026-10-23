import { describe, expect, it } from "vitest";
import { evaluate } from "@/domain/engine";
import { defaultSystemInput, spotsFor, type SystemInput } from "@/domain/system";
import { buildHeliostoresCatalog, HELIOSTORES_FAMILIES } from "@/server/catalog/heliostores-data";
import { CATEGORIES } from "@/domain/categories";
import { PUBLIC_FORBIDDEN_NAMES } from "@/domain/public-sanitize";

const catalog = buildHeliostoresCatalog();
const rules = (slug: string) => catalog.families.find((f) => f.slug === slug)!.systemRules!;
const input = (slug: string, over: Partial<SystemInput> = {}): SystemInput => ({ ...defaultSystemInput(slug, rules(slug)), ...over });
const codes = (slug: string, over: Partial<SystemInput> = {}) => evaluate(catalog, input(slug, over)).issues.map((i) => `${i.severity}:${i.code}`);

describe("catalogue HELIOSTORES : périmètre", () => {
  it("exactement trois familles publiques, et chaque produit publié en relève", () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual(["Pergolas", "Screens", "Stores bannes"]);
    const published = HELIOSTORES_FAMILIES.filter((f) => f.status !== "DRAFT");
    expect(published.map((f) => [f.slug, f.category])).toEqual([
      ["helio-horizon", "PERGOLAS"],
      ["helio-panorama", "PERGOLAS"],
      ["helio-ombra", "SCREENS"],
      ["helio-riviera", "STORES_BANNES"],
    ]);
  });

  it("HELIO Verrière (réf. VERANDA FTS) reste un brouillon hors famille publique, non configurable", () => {
    const fts = HELIOSTORES_FAMILIES.find((f) => f.slug === "helio-verriere")!;
    expect(fts.status).toBe("DRAFT");
    expect(fts.category).toBeNull();
    expect(fts.openQuestions.some((q) => q.field === "Classement")).toBe(true);
    expect(codes("helio-verriere")).toContain("blocking:family_unavailable");
  });

  it("chaque dimension, pose, teinte et option cite au moins une source", () => {
    for (const f of HELIOSTORES_FAMILIES) {
      const r = f.rules;
      for (const d of [r.dims.width, r.dims.depth, r.dims.height].filter(Boolean)) expect(d!.sources.length, `${f.slug} ${d!.label}`).toBeGreaterThan(0);
      for (const c of [...r.mountings, ...r.finishes, ...(r.fabrics ?? []), ...(r.controls ?? []), ...r.options]) expect(c.sources.length, `${f.slug} ${c.code}`).toBeGreaterThan(0);
      for (const i of r.included) expect(i.sources.length, `${f.slug} ${i.label}`).toBeGreaterThan(0);
    }
  });

  it("aucune donnée tarifaire dans les données publiables (montant, devise, coefficient)", () => {
    const all = JSON.stringify(HELIOSTORES_FAMILIES);
    expect(all).not.toMatch(/\d\s?(€|DH|MAD|EUR)\b/);
    expect(all).not.toMatch(/0[.,](59|48|45|39)\b/);
    // les questions « Tarifs » (administration, jamais affichées sur la fiche) citent des intitulés de colonnes, sans montant
    const publicPart = JSON.stringify(HELIOSTORES_FAMILIES.map((f) => ({ ...f, openQuestions: f.openQuestions.filter((q) => q.field !== "Tarifs") })));
    expect(publicPart).not.toMatch(/prix fournisseur|prix final|coefficient|remise|marge/i);
  });
});

describe("prix : toujours sur devis tant que les tarifs ne sont pas établis", () => {
  for (const slug of ["helio-horizon", "helio-panorama", "helio-ombra", "helio-riviera"]) {
    it(`${slug} : aucune ligne de prix, aucun total, devis recommandé`, () => {
      const r = evaluate(catalog, input(slug));
      expect(r.priceMode).toBe("quote");
      expect(r.lines).toEqual([]);
      expect(r.totals.totalGrossCents).toBe(0);
      expect(r.totals.isFinal).toBe(false);
      expect(r.purchasable).toBe(false);
      expect(r.quoteRecommended).toBe(true);
      expect(r.issues.some((i) => i.code === "system_quote_only")).toBe(true);
      expect(r.issues.filter((i) => i.severity === "blocking")).toEqual([]);
      expect(r.recap?.some((x) => x.label.startsWith("Prix"))).toBe(false);
    });
  }
});

describe("HELIO Horizon", () => {
  it("projection par pas de 20 cm à partir de 1,4 m, jusqu'à 7 m", () => {
    expect(codes("helio-horizon", { depthMm: 1600 })).not.toContain("blocking:dimension_step");
    expect(codes("helio-horizon", { depthMm: 1500 })).toContain("blocking:dimension_step");
    expect(codes("helio-horizon", { depthMm: 7200 })).toContain("blocking:dimension_out_of_bounds");
    expect(codes("helio-horizon", { depthMm: 1200 })).toContain("blocking:dimension_out_of_bounds");
  });
  it("largeur 1,4 à 4 m par module ; hauteur : 2,8 m (site, catalogue) / 3 020 mm (déclaration) → au-delà de 2,8 m à confirmer, jamais tranché", () => {
    expect(codes("helio-horizon", { widthMm: 4010 })).toContain("blocking:dimension_out_of_bounds");
    expect(codes("helio-horizon", { widthMm: 1390 })).toContain("blocking:dimension_out_of_bounds");
    expect(codes("helio-horizon", { heightMm: 2800 })).not.toContain("review:dimension_to_confirm");
    expect(codes("helio-horizon", { heightMm: 2900 })).toContain("review:dimension_to_confirm");
    expect(codes("helio-horizon", { heightMm: 3020 })).not.toContain("blocking:dimension_out_of_bounds");
    expect(codes("helio-horizon", { heightMm: 3100 })).toContain("blocking:dimension_out_of_bounds");
  });
  it("spots : nombre de points selon le tableau de la fiche", () => {
    const t = rules("helio-horizon").options.find((o) => o.code === "led_spots")!.spotTable;
    expect(spotsFor(t, 3400, 2700)).toBe(4);
    expect(spotsFor(t, 3400, 3000)).toBe(6);
    expect(spotsFor(t, 4000, 2000)).toBe(6);
    expect(spotsFor(t, 5000, 4000)).toBe(9);
    expect(spotsFor(t, 6000, 2000)).toBe(8);
    expect(spotsFor(t, 7000, 4000)).toBe(12);
    const r = evaluate(catalog, input("helio-horizon", { widthMm: 3500, depthMm: 6000, options: [{ code: "led_spots" }] }));
    expect(r.recap!.some((x) => /12 points/.test(x.value))).toBe(true);
  });
  it("LED périphérique + spots : cumul non documenté → à confirmer", () => {
    expect(codes("helio-horizon", { options: [{ code: "led_perimeter" }, { code: "led_spots" }] })).toContain("review:option_cumul_to_confirm");
    expect(codes("helio-horizon", { options: [{ code: "led_perimeter" }] })).not.toContain("review:option_cumul_to_confirm");
  });
  it("fermeture latérale souhaitée : jamais une compatibilité supposée ; aucune fermeture côté mur", () => {
    expect(codes("helio-horizon", { mounting: "wall", sides: { front: "helio-ombra" } })).toContain("review:closure_to_confirm");
    expect(codes("helio-horizon", { mounting: "wall", sides: { back: "helio-ombra" } })).toContain("blocking:closure_on_wall");
    expect(codes("helio-horizon", { sides: { left: "paroi-vitree" } })).toContain("blocking:closure_unavailable");
  });
  it("poses proposées : murale et autoportante uniquement", () => {
    expect(codes("helio-horizon", { mounting: "niche" })).toContain("blocking:mounting_unavailable");
  });
  it("teinte hors standard : acceptée et signalée à confirmer", () => {
    expect(codes("helio-horizon", { finishCode: "RAL_CUSTOM" })).toContain("review:finish_to_confirm");
    expect(codes("helio-horizon", { finishCode: "RAL_9999" })).toContain("blocking:finish_unavailable");
  });
  it("plan 2D : repère largeur le long du mur, projection en profondeur, aucun poteau intermédiaire automatique", () => {
    const r = evaluate(catalog, input("helio-horizon", { widthMm: 3800, depthMm: 6600, mounting: "freestanding" }));
    expect(r.layout).toMatchObject({ lengthMm: 3800, widthMm: 6600, mounting: "freestanding" });
    expect(r.layout!.sides.every((s) => s.segments.length === 1)).toBe(true);
  });
});

describe("HELIO Panorama", () => {
  it("projection par pas de 25 cm à partir de 2 m ; largeur jusqu'à 5 m ; hauteur jusqu'à 3,2 m", () => {
    expect(codes("helio-panorama", { depthMm: 2250 })).not.toContain("blocking:dimension_step");
    expect(codes("helio-panorama", { depthMm: 2200 })).toContain("blocking:dimension_step");
    expect(codes("helio-panorama", { depthMm: 1800 })).toContain("blocking:dimension_out_of_bounds");
    expect(codes("helio-panorama", { widthMm: 5000 })).not.toContain("blocking:dimension_out_of_bounds");
    expect(codes("helio-panorama", { widthMm: 5100 })).toContain("blocking:dimension_out_of_bounds");
    expect(codes("helio-panorama", { heightMm: 3200 })).not.toContain("blocking:dimension_out_of_bounds");
  });
  it("moteurs documentés uniquement ; poteaux supplémentaires aux longueurs de la fiche", () => {
    expect(codes("helio-panorama", { controlCode: "somfy_x" })).toContain("blocking:control_unavailable");
    expect(codes("helio-panorama", { options: [{ code: "extra_post", qty: 2, value: "2600" }] })).not.toContain("blocking:option_value");
    expect(codes("helio-panorama", { options: [{ code: "extra_post", qty: 2, value: "2500" }] })).toContain("blocking:option_value");
    expect(codes("helio-panorama", { options: [{ code: "extra_post", qty: 9, value: "2600" }] })).toContain("blocking:option_qty");
  });
  it("plusieurs modules : documenté, composé au devis", () => {
    const r = evaluate(catalog, input("helio-panorama", { multiModule: true }));
    expect(r.issues.find((i) => i.code === "multi_module")!.message).toMatch(/plusieurs modules : possible — composition/);
  });
});

describe("HELIO Ombra", () => {
  it("largeur > 4 m : sources contradictoires → accepté, à confirmer ; > 7 m refusé", () => {
    expect(codes("helio-ombra", { widthMm: 4000 })).not.toContain("review:dimension_to_confirm");
    expect(codes("helio-ombra", { widthMm: 4500 })).toContain("review:dimension_to_confirm");
    expect(codes("helio-ombra", { widthMm: 7100 })).toContain("blocking:dimension_out_of_bounds");
  });
  it("largeur minimale imposée par le moteur choisi", () => {
    expect(codes("helio-ombra", { widthMm: 700, controlCode: "electric_5" })).toContain("blocking:control_min_width");
    expect(codes("helio-ombra", { widthMm: 730, controlCode: "electric_5" })).not.toContain("blocking:control_min_width");
  });
  it("hauteur requise, jusqu'à 4 m ; au-delà de 3 m signalée (texte fabricant)", () => {
    expect(codes("helio-ombra", { heightMm: undefined })).toContain("blocking:dimension_missing");
    expect(codes("helio-ombra", { heightMm: 3500 })).toContain("review:dimension_to_confirm");
    expect(codes("helio-ombra", { heightMm: 4100 })).toContain("blocking:dimension_out_of_bounds");
  });
  it("toile acrylique : citée par la fiche seulement → à confirmer", () => {
    expect(codes("helio-ombra", { fabricCode: "acrylique" })).toContain("review:fabric_to_confirm");
    expect(codes("helio-ombra", { fabricCode: "soltis" })).not.toContain("review:fabric_to_confirm");
  });
});

describe("HELIO Riviera", () => {
  it("avancées documentées seulement, avec largeur minimale selon l'avancée", () => {
    expect(codes("helio-riviera", { depthMm: 2000 })).toContain("blocking:dimension_value");
    expect(codes("helio-riviera", { depthMm: 2600, widthMm: 2900 })).toContain("blocking:depth_width_combination");
    expect(codes("helio-riviera", { depthMm: 2600, widthMm: 2910 })).not.toContain("blocking:depth_width_combination");
    expect(codes("helio-riviera", { depthMm: 3600, widthMm: 3500 })).toContain("blocking:depth_width_combination");
    expect(codes("helio-riviera", { depthMm: 1600, widthMm: 2000 })).not.toContain("blocking:depth_width_combination");
  });
  it("largeur 2 à 6 m ; aucune hypothèse héritée (LED, télécommande, câble, 230 V)", () => {
    expect(codes("helio-riviera", { widthMm: 6100 })).toContain("blocking:dimension_out_of_bounds");
    const r = evaluate(catalog, input("helio-riviera"));
    // rien d'inclus ni de chiffré qui ne soit documenté ; l'absence de LED est dite explicitement
    expect(JSON.stringify({ recap: r.recap, lines: r.lines })).not.toMatch(/LED|télécommande|câble|230 V/);
    expect(r.issues.map((i) => i.message)).toContain("Éclairage LED : non proposé sur ce modèle.");
    expect(r.recap?.find((x) => x.label === "Niveau")?.value).toBe("Essentiel");
  });
  it("divergences conservées en données sourcées (jamais une valeur choisie)", () => {
    const spec = (slug: string, key: string) => catalog.families.find((f) => f.slug === slug)!.technicalSpecs!.filter((t) => t.key === key);
    expect(new Set(spec("helio-horizon", "height_max").map((t) => t.valueNum))).toEqual(new Set([2800, 3020]));
    expect(new Set(spec("helio-ombra", "height_max").map((t) => t.valueNum))).toEqual(new Set([4000, 3000]));
    expect(new Set(spec("helio-ombra", "width_max").map((t) => t.valueNum))).toEqual(new Set([7000, 4000]));
    expect(new Set(spec("helio-panorama", "manufacturer_reference").map((t) => t.source)).size).toBe(2);
    expect(new Set(spec("helio-riviera", "drive").map((t) => t.valueText)).size).toBe(2);
  });
  it("commande manuelle documentée ; électrique à confirmer", () => {
    expect(codes("helio-riviera", { controlCode: "crank_1800" })).not.toContain("review:control_to_confirm");
    expect(codes("helio-riviera", { controlCode: "electric" })).toContain("review:control_to_confirm");
  });
});

describe("niveaux, options et protection au vent (retour client du 2026-10-21)", () => {
  const rules = (slug: string) => catalog.families.find((f) => f.slug === slug)!.systemRules!;
  it("HELIO Riviera : Essentiel (manivelle) et Confort (motorisé) sont deux niveaux du même store ; Premium est un autre modèle", () => {
    const packs = rules("helio-riviera").packs!;
    expect(packs.map((p) => [p.code, p.familySlug ?? null])).toEqual([["essentiel", null], ["confort", null], ["premium", "helio-azur"]]);
    expect(codes("helio-riviera", { packCode: "confort", controlCode: "crank_1500" })).toContain("blocking:pack_control");
    expect(codes("helio-riviera", { packCode: "confort", controlCode: "electric" })).toEqual(expect.arrayContaining(["review:pack_to_confirm", "review:control_to_confirm"]));
    expect(codes("helio-riviera", { packCode: "premium" })).toContain("blocking:pack_unavailable");
  });
  it("une option motorisée exige la motorisation ; aucune LED sur HELIO Riviera", () => {
    expect(codes("helio-riviera", { controlCode: "crank_1500", options: [{ code: "weather_automation" }] })).toContain("blocking:option_requires_control");
    expect(codes("helio-riviera", { packCode: "confort", controlCode: "electric", options: [{ code: "weather_automation" }] })).not.toContain("blocking:option_requires_control");
    expect(rules("helio-riviera").options.some((o) => o.group === "lighting")).toBe(false);
    // box de pilotage du screen : moteur radio io seulement
    expect(codes("helio-ombra", { controlCode: "electric_1", options: [{ code: "connect_box" }] })).toContain("blocking:option_requires_control");
  });
  it("protection au vent propre à chaque système, jamais identique", () => {
    expect(Object.fromEntries(["helio-horizon", "helio-panorama", "helio-ombra", "helio-riviera"].map((s) => [s, rules(s).wind?.action]))).toEqual({ "helio-horizon": "blades", "helio-panorama": "not_documented", "helio-ombra": "raise", "helio-riviera": "retract" });
    for (const s of ["helio-horizon", "helio-ombra", "helio-riviera"]) expect(rules(s).wind!.sources.length, s).toBeGreaterThan(0);
  });
  it("options : prix toujours sur devis ; prérequis sans marque", () => {
    for (const f of catalog.families.filter((x) => x.systemRules)) for (const o of f.systemRules!.options) {
      expect(o.pricing ?? "quote", `${f.slug}/${o.code}`).toBe("quote");
      if (o.prerequisite) expect(o.prerequisite).not.toMatch(PUBLIC_FORBIDDEN_NAMES);
    }
  });
});
