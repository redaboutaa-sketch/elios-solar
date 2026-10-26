import { describe, expect, it } from "vitest";
import { evaluate } from "@/domain/engine";
import { CUSTOM_SIZE, defaultSystemInput, spotsFor, type SystemInput } from "@/domain/system";
import { buildHeliostoresCatalog, HELIOSTORES_FAMILIES } from "@/server/catalog/heliostores-data";
import { CATEGORIES } from "@/domain/categories";
import { PUBLIC_FORBIDDEN_NAMES } from "@/domain/public-sanitize";

const base = buildHeliostoresCatalog();
/**
 * Les fiches retirées (SB 400 / SB 500, nomenclature du 2026-10-25) restent en base pour l'historique : leurs règles
 * sont encore testées, sur un instantané où elles sont réactivées (le catalogue réel les bloque, voir « périmètre »).
 */
const catalog = { ...base, families: base.families.map((f) => (f.status === "archived" ? { ...f, status: "quote_only" as const } : f)) };
const rules = (slug: string) => catalog.families.find((f) => f.slug === slug)!.systemRules!;
const input = (slug: string, over: Partial<SystemInput> = {}): SystemInput => ({ ...defaultSystemInput(slug, rules(slug)), ...over });
const codes = (slug: string, over: Partial<SystemInput> = {}) => evaluate(catalog, input(slug, over)).issues.map((i) => `${i.severity}:${i.code}`);
const realCodes = (slug: string, over: Partial<SystemInput> = {}) => evaluate(base, input(slug, over)).issues.map((i) => `${i.severity}:${i.code}`);

describe("catalogue HELIOSTORES : périmètre", () => {
  it("quatre familles publiques ; modèles actuels de la nomenclature du 2026-10-25", () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual(["Pergolas", "Screens", "Stores bannes", "Moustiquaires"]);
    const offered = HELIOSTORES_FAMILIES.filter((f) => f.status === "QUOTE_ONLY" || f.status === "PUBLISHED");
    expect(offered.map((f) => [f.slug, f.name, f.category])).toEqual([
      ["malaga", "Malaga", "PERGOLAS"],
      ["marbella", "Marbella", "PERGOLAS"],
      ["sevilla", "Sevilla", "PERGOLAS"],
      ["helioscreen", "HelioScreen", "SCREENS"],
      ["helioroof-screen", "HelioRoof Screen", "SCREENS"],
      ["casablanca", "Casablanca", "STORES_BANNES"],
      ["corsica", "Corsica", "STORES_BANNES"],
      ["jamaica", "Jamaica", "STORES_BANNES"],
      ["madera", "Madera", "STORES_BANNES"],
      ["moskifold", "MoskiFold", "MOUSTIQUAIRES"],
      ["moskifold-2", "MoskiFold 2", "MOUSTIQUAIRES"],
    ]);
    // moustiquaires sans dimensions maximales documentées : brouillons, jamais configurables
    expect(HELIOSTORES_FAMILIES.filter((f) => f.status === "DRAFT").map((f) => f.slug)).toEqual(["moskiup", "moskislide", "moskifix"]);
    for (const s of ["moskiup", "moskislide", "moskifix"]) expect(realCodes(s), s).toContain("blocking:family_unavailable");
  });

  it("modèles retirés (SB 400, SB 500, VERANDA FTS) : conservés, archivés, jamais configurables ; un choix de gamme est proposé", () => {
    for (const s of ["helio-horizon", "helio-panorama", "helio-verriere"]) {
      const f = HELIOSTORES_FAMILIES.find((x) => x.slug === s)!;
      expect(f.status, s).toBe("ARCHIVED");
      expect(f.retired?.suggest.length, s).toBeGreaterThan(0);
      expect(realCodes(s), s).toContain("blocking:family_unavailable");
    }
    // SB 350 / SB 450 sont d'autres produits : aucune fiche SB 400 / SB 500 ne leur est rattachée
    expect(HELIOSTORES_FAMILIES.find((f) => f.slug === "malaga")!.supplierRef).toMatch(/SB 350/);
    expect(HELIOSTORES_FAMILIES.find((f) => f.slug === "marbella")!.supplierRef).toMatch(/SB 450/);
    expect(HELIOSTORES_FAMILIES.find((f) => f.slug === "helioroof-screen")!.supplierRef).toMatch(/pas Veranda FTS/);
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
  for (const slug of ["malaga", "marbella", "sevilla", "helioscreen", "helioroof-screen", "casablanca", "corsica", "jamaica", "madera", "moskifold", "moskifold-2"]) {
    it(`${slug} : aucune ligne de prix sans grille publiée, devis recommandé`, () => {
      const r = evaluate(catalog, input(slug));
      expect(r.priceMode).toBe("quote");
      expect(r.lines).toEqual([]);
      expect(r.totals.totalGrossCents).toBe(0);
      expect(r.totals.isFinal).toBe(false);
      expect(r.purchasable).toBe(false);
      expect(r.quoteRecommended).toBe(true);
      expect(r.issues.some((i) => i.code === "system_quote_only")).toBe(true);
      expect(r.issues.filter((i) => i.severity === "blocking"), slug).toEqual([]);
      expect(r.recap?.some((x) => x.label.startsWith("Prix"))).toBe(false);
    });
  }
});

describe("fiche retirée SB 400 (historique, ex-HELIO Horizon)", () => {
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
    expect(codes("helio-horizon", { mounting: "wall", sides: { front: "helioscreen" } })).toContain("review:closure_to_confirm");
    expect(codes("helio-horizon", { mounting: "wall", sides: { back: "helioscreen" } })).toContain("blocking:closure_on_wall");
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

describe("fiche retirée SB 500 (historique, ex-HELIO Panorama)", () => {
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

describe("HelioScreen (R 120 ZiiiP, ex-HELIO Ombra)", () => {
  it("largeur > 4 m : sources contradictoires → accepté, à confirmer ; > 7 m refusé", () => {
    expect(codes("helioscreen", { widthMm: 4000 })).not.toContain("review:dimension_to_confirm");
    expect(codes("helioscreen", { widthMm: 4500 })).toContain("review:dimension_to_confirm");
    expect(codes("helioscreen", { widthMm: 7100 })).toContain("blocking:dimension_out_of_bounds");
  });
  it("moteurs de la fiche transmise : à confirmer, sans largeur minimale imposée (non confirmée par le fabricant)", () => {
    expect(codes("helioscreen", { widthMm: 700, controlCode: "electric_5" })).not.toContain("blocking:control_min_width");
    expect(codes("helioscreen", { controlCode: "electric_5" })).toContain("review:control_to_confirm");
  });
  it("hauteur requise, jusqu'à 4 m ; au-delà de 3 m signalée (texte fabricant)", () => {
    expect(codes("helioscreen", { heightMm: undefined })).toContain("blocking:dimension_missing");
    expect(codes("helioscreen", { heightMm: 3500 })).toContain("review:dimension_to_confirm");
    expect(codes("helioscreen", { heightMm: 4100 })).toContain("blocking:dimension_out_of_bounds");
  });
  it("toiles de la page du fabricant établies ; toiles de la seule fiche transmise à confirmer", () => {
    expect(codes("helioscreen", { fabricCode: "polyscreen" })).toContain("review:fabric_to_confirm");
    expect(codes("helioscreen", { fabricCode: "serge_1" })).not.toContain("review:fabric_to_confirm");
    expect(codes("helioscreen", { fabricCode: "acrylique" })).toContain("blocking:fabric_unavailable");
  });
});

describe("Casablanca", () => {
  it("avancées documentées seulement, avec largeur minimale selon l'avancée", () => {
    expect(codes("casablanca", { depthMm: 2000 })).toContain("blocking:dimension_value");
    expect(codes("casablanca", { depthMm: 2600, widthMm: 2900 })).toContain("blocking:depth_width_combination");
    expect(codes("casablanca", { depthMm: 2600, widthMm: 2910 })).not.toContain("blocking:depth_width_combination");
    expect(codes("casablanca", { depthMm: 3600, widthMm: 3500 })).toContain("blocking:depth_width_combination");
    expect(codes("casablanca", { depthMm: 1600, widthMm: 2000 })).not.toContain("blocking:depth_width_combination");
  });
  it("largeur 2 à 6 m ; aucune hypothèse héritée (LED, télécommande, câble, 230 V)", () => {
    expect(codes("casablanca", { widthMm: 6100 })).toContain("blocking:dimension_out_of_bounds");
    const r = evaluate(catalog, input("casablanca"));
    // rien d'inclus ni de chiffré qui ne soit documenté ; l'absence de LED est dite explicitement
    expect(JSON.stringify({ recap: r.recap, lines: r.lines })).not.toMatch(/LED|télécommande|câble|230 V/);
    expect(r.issues.map((i) => i.message)).toContain("Éclairage LED : non proposé sur ce modèle.");
    expect(r.recap?.find((x) => x.label === "Niveau")).toBeUndefined();
    expect(r.recap?.find((x) => x.label === "Supports muraux")?.value).toBe("2");
  });
  it("divergences conservées en données sourcées (jamais une valeur choisie)", () => {
    const spec = (slug: string, key: string) => catalog.families.find((f) => f.slug === slug)!.technicalSpecs!.filter((t) => t.key === key);
    expect(new Set(spec("helio-horizon", "height_max").map((t) => t.valueNum))).toEqual(new Set([2800, 3020]));
    expect(new Set(spec("helioscreen", "height_max").map((t) => t.valueNum))).toEqual(new Set([4000, 3000]));
    expect(new Set(spec("helioscreen", "width_max").map((t) => t.valueNum))).toEqual(new Set([7000, 4000]));
    expect(new Set(spec("malaga", "projection_values").map((t) => t.valueText)).size).toBe(2);
    expect(new Set(spec("helio-panorama", "manufacturer_reference").map((t) => t.source)).size).toBe(2);
    expect(new Set(spec("casablanca", "drive").map((t) => t.valueText)).size).toBe(2);
  });
  it("commande manuelle documentée ; électrique à confirmer", () => {
    expect(codes("casablanca", { controlCode: "crank_1800" })).not.toContain("review:control_to_confirm");
    expect(codes("casablanca", { controlCode: "electric" })).toContain("review:control_to_confirm");
  });
});

describe("options, souhaits et protection au vent (nomenclature du 2026-10-25)", () => {
  const rules = (slug: string) => catalog.families.find((f) => f.slug === slug)!.systemRules!;
  it("Casablanca : plus de niveaux factices ; un ancien choix de niveau reste lisible sans effet", () => {
    expect(rules("casablanca").packs).toBeUndefined();
    expect(codes("casablanca", { packCode: "confort" })).not.toContain("blocking:pack_unavailable");
  });
  it("une option motorisée exige la motorisation ; aucune LED sur Casablanca", () => {
    expect(codes("casablanca", { controlCode: "crank_1500", options: [{ code: "remote_control" }] })).toContain("blocking:option_requires_control");
    expect(codes("casablanca", { controlCode: "electric", options: [{ code: "remote_control" }] })).not.toContain("blocking:option_requires_control");
    expect(rules("casablanca").options.some((o) => o.group === "lighting")).toBe(false);
  });
  it("équipement sans compatibilité confirmée : souhait au devis, jamais une option compatible", () => {
    expect(codes("casablanca", { controlCode: "electric", options: [{ code: "connect_box" }] })).toContain("review:option_wish");
    const r = evaluate(catalog, input("corsica", { options: [{ code: "wind_sensor" }] }));
    expect(r.recap!.find((x) => x.label === "Souhait")!.value).toMatch(/étude au devis/);
    expect(r.onlineOrder!.ok).toBe(false);
  });
  it("protection au vent propre à chaque système, jamais identique", () => {
    const actions = Object.fromEntries(["malaga", "marbella", "sevilla", "helioscreen", "helioroof-screen", "casablanca", "corsica", "jamaica", "madera"].map((s) => [s, rules(s).wind?.action]));
    expect(actions).toEqual({ malaga: "blades", marbella: "blades", sevilla: "retract", helioscreen: "raise", "helioroof-screen": "retract", casablanca: "retract", corsica: "retract", jamaica: "retract", madera: "retract" });
    for (const s of Object.keys(actions)) expect(rules(s).wind!.sources.length, s).toBeGreaterThan(0);
  });
  it("options : prix toujours sur devis ; libellés et prérequis sans marque ni ancienne appellation", () => {
    for (const f of base.families.filter((x) => x.systemRules && x.status !== "archived")) for (const o of f.systemRules!.options) {
      expect(o.pricing ?? "quote", `${f.slug}/${o.code}`).toBe("quote");
      if (o.prerequisite) expect(o.prerequisite).not.toMatch(PUBLIC_FORBIDDEN_NAMES);
      expect(o.label, `${f.slug}/${o.code}`).not.toMatch(PUBLIC_FORBIDDEN_NAMES);
      expect(o.label, `${f.slug}/${o.code}`).not.toMatch(/HELIO (Pilot|Vent|Soleil|Connect|Lumière)/);
    }
  });
});

describe("Malaga (SB 350) : produit prêt à poser en tailles fixes", () => {
  it("tailles fabriquées seulement ; une autre dimension est une demande hors gamme explicite", () => {
    expect(rules("malaga").fixedSizes!.map((z) => z.depthMm)).toEqual([3400, 3850, 4300, 4750]);
    expect(codes("malaga")).not.toContain("blocking:size_missing");
    expect(codes("malaga", { sizeCode: "3500x4300", depthMm: 3400 })).toContain("blocking:size_mismatch");
    const hors = evaluate(catalog, input("malaga", { sizeCode: CUSTOM_SIZE, widthMm: 4200, depthMm: 5000 }));
    expect(hors.issues.map((i) => i.code)).toContain("out_of_range_request");
    expect(hors.issues.some((i) => i.severity === "blocking")).toBe(false);
    expect(hors.onlineOrder!.ok).toBe(false);
    expect(hors.systemPrice ?? null).toBeNull();
  });
  it("autoportante seulement ; deux teintes", () => {
    expect(codes("malaga", { mounting: "wall" })).toContain("blocking:mounting_unavailable");
    expect(rules("malaga").finishes.map((f) => f.label)).toEqual(["RAL 9016 mat", "RAL 7016 mat"]);
  });
});

describe("Marbella, Sevilla, HelioRoof Screen, stores bannes, moustiquaires", () => {
  it("Marbella : sur mesure jusqu'à 4 × 6,01 m, adossée ou autoportante ; fermetures coulissantes en souhait étudié", () => {
    expect(codes("marbella", { widthMm: 4100 })).toContain("blocking:dimension_out_of_bounds");
    expect(codes("marbella", { heightMm: 2950 })).toContain("review:dimension_to_confirm");
    expect(codes("marbella", { mounting: "wall", sides: { front: "sliding_glass" } })).toContain("review:closure_to_confirm");
  });
  it("Sevilla : toiture toile, adossée uniquement, aucune fermeture latérale", () => {
    expect(rules("sevilla").roof).toBe("fabric");
    expect(codes("sevilla", { mounting: "freestanding" })).toContain("blocking:mounting_unavailable");
    expect(rules("sevilla").closureWishes).toBeUndefined();
  });
  it("HelioRoof Screen : 4,5 × 5 m maximum, projection > 4 m à confirmer ; aucune donnée FTS (6,5 m, deux moteurs)", () => {
    expect(codes("helioroof-screen", { depthMm: 4500 })).toContain("review:dimension_to_confirm");
    expect(codes("helioroof-screen", { depthMm: 6500 })).toContain("blocking:dimension_out_of_bounds");
    expect(JSON.stringify(rules("helioroof-screen").included)).not.toMatch(/deux moteurs|6,5/i);
  });
  it("supports muraux selon la largeur (Corsica, Jamaica, Madera)", () => {
    const sup = (slug: string, w: number) => evaluate(catalog, input(slug, { widthMm: w, depthMm: 1600 })).recap!.find((x) => x.label === "Supports muraux")!.value;
    expect([sup("corsica", 3500), sup("corsica", 4000), sup("corsica", 6000)]).toEqual(["2", "3", "5"]);
    expect(sup("madera", 5000)).toBe("4");
  });
  it("Corsica et Madera : motorisation imposée ; Jamaica : manivelle ou moteur", () => {
    expect(rules("corsica").controls!.every((c) => c.kind === "electric")).toBe(true);
    expect(rules("madera").controls!.every((c) => c.kind === "electric")).toBe(true);
    expect(rules("jamaica").controls!.some((c) => c.kind === "manual")).toBe(true);
    expect(codes("jamaica", { depthMm: 3600, widthMm: 4000 })).toContain("blocking:depth_width_combination");
  });
  it("moustiquaires : ouverture documentée, aucune borne inventée", () => {
    expect(rules("moskifold").insect).toMatchObject({ opening: "pleated", leaves: 1 });
    expect(rules("moskifold-2").insect).toMatchObject({ opening: "pleated", leaves: 2 });
    expect(rules("moskifold").dims.width.minMm).toBeNull();
    // correspondance fabricant non confirmée : demande d'étude, cotes souhaitées sans borne publiée ni configuration validée
    for (const slug of ["moskifold", "moskifold-2"]) {
      expect(rules(slug).studyOnly).toBeTruthy();
      expect(rules(slug).dims.width.maxMm).toBe(0);
      expect(codes(slug, { widthMm: 4100, heightMm: 3000 })).toContain("review:study_request");
      expect(codes(slug, { widthMm: 4100, heightMm: 3000 }).some((c) => c.startsWith("blocking:"))).toBe(false);
    }
  });
});
