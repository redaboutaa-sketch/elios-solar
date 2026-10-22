import { describe, expect, it } from "vitest";
import { HELIOSTORES_FAMILIES } from "@/server/catalog/heliostores-data";
import { HELIOSTORES_MEDIA } from "@/server/media/heliostores-media";
import { PUBLIC_FORBIDDEN_NAMES, publicSpecs, publicSystemRules } from "@/domain/public-sanitize";
import { ACCESSORY_NAMES, PRODUCT_NAMES } from "@/domain/nomenclature";
import { LEGACY_FAMILY_SLUGS, canonicalFamilySlug, legacyProductRedirects } from "@/server/catalog/legacy-slugs";

/** Tout ce qu'une famille envoie au site public (pages, instantané du configurateur, données structurées). */
function publicView(f: (typeof HELIOSTORES_FAMILIES)[number]) {
  return JSON.stringify({
    slug: f.slug, name: f.name, shortDescription: f.shortDescription, description: f.description, seoTitle: f.seoTitle, seoDescription: f.seoDescription, faq: f.faq,
    rules: publicSystemRules(f.rules),
    specs: publicSpecs(f.specs).map((s) => ({ key: s.key, label: s.label, valueNum: s.valueNum, unit: s.unit, valueText: s.valueText, note: s.note })),
  });
}

describe("nomenclature commerciale HELIOSTORES", () => {
  it("noms commerciaux et slugs : HELIO Horizon, Panorama, Ombra, Riviera ; HELIO Verrière réservé en brouillon", () => {
    expect(HELIOSTORES_FAMILIES.map((f) => [f.slug, f.name, f.category])).toEqual([
      ["helio-horizon", "HELIO Horizon", "PERGOLAS"],
      ["helio-panorama", "HELIO Panorama", "PERGOLAS"],
      ["helio-ombra", "HELIO Ombra", "SCREENS"],
      ["helio-riviera", "HELIO Riviera", "STORES_BANNES"],
      ["helio-verriere", "HELIO Verrière", null],
    ]);
    for (const f of HELIOSTORES_FAMILIES) expect(PRODUCT_NAMES[f.slug as keyof typeof PRODUCT_NAMES]).toBe(f.name);
    expect(HELIOSTORES_FAMILIES.find((f) => f.slug === "helio-verriere")!.status).toBe("DRAFT");
  });

  it("aucune référence du fournisseur, du fabricant ou d'un moteur dans les données publiques", () => {
    for (const f of HELIOSTORES_FAMILIES) expect(publicView(f), f.slug).not.toMatch(PUBLIC_FORBIDDEN_NAMES);
    for (const m of HELIOSTORES_MEDIA) expect(`${m.alt} ${m.caption}`, m.key).not.toMatch(PUBLIC_FORBIDDEN_NAMES);
  });

  it("correspondance fournisseur conservée en interne (famille, moteurs, équipements renommés)", () => {
    expect(Object.fromEntries(HELIOSTORES_FAMILIES.map((f) => [f.slug, f.supplierRef]))).toEqual({
      "helio-horizon": "SB 400 (SunBreaker 400)",
      "helio-panorama": "SB500 (SunBreaker 500)",
      "helio-ombra": "REFLEKSOL 120 ZiiiP",
      "helio-riviera": "CASABLANCA",
      "helio-verriere": "VERANDA FTS",
    });
    const ombra = HELIOSTORES_FAMILIES.find((f) => f.slug === "helio-ombra")!.rules;
    expect(ombra.controls!.map((c) => c.supplierRef)).toContain("Moteur Altus WT");
    expect(ombra.controls!.every((c) => /^Motorisation (électrique|radio)/.test(c.label))).toBe(true);
    // la référence fournisseur ne part jamais vers le navigateur
    expect(JSON.stringify(publicSystemRules(ombra))).not.toContain("supplierRef");
  });

  it("noms d'équipement appliqués aux seuls équipements documentés ; aucun accessoire créé", () => {
    const text = HELIOSTORES_FAMILIES.map((f) => JSON.stringify(f.rules)).join("\n");
    expect(text).toContain(ACCESSORY_NAMES.remote);
    expect(text).toContain(ACCESSORY_NAMES.light);
    expect(text).not.toContain(ACCESSORY_NAMES.connect);
    expect(text).not.toContain(ACCESSORY_NAMES.heating);
    // une télécommande n'est nommée HELIO Pilot que là où la fiche la documente (pergolas)
    expect(HELIOSTORES_FAMILIES.filter((f) => JSON.stringify(f.rules).includes(ACCESSORY_NAMES.remote)).map((f) => f.slug)).toEqual(["helio-horizon", "helio-panorama"]);
  });

  it("anciennes URL : redirections permanentes vers les nouvelles fiches, sans boucle ; brouillon sans page", () => {
    const r = legacyProductRedirects();
    expect(r).toContainEqual({ source: "/pergolas/pergola-sb400", destination: "/pergolas/helio-horizon", permanent: true });
    expect(r).toContainEqual({ source: "/screens/screen-refleksol-120-ziiip", destination: "/screens/helio-ombra", permanent: true });
    expect(r).toContainEqual({ source: "/stores-bannes/store-banne-casablanca", destination: "/stores-bannes/helio-riviera", permanent: true });
    expect(r).toContainEqual({ source: "/configurateur/pergola-sb500", destination: "/configurateur/helio-panorama", permanent: true });
    const sources = new Set(r.map((x) => x.source));
    for (const x of r) expect(sources.has(x.destination)).toBe(false);
    expect(r.some((x) => x.destination.includes("helio-verriere"))).toBe(false);
    expect(canonicalFamilySlug("veranda-fts")).toBe("helio-verriere");
    expect(canonicalFamilySlug("helio-ombra")).toBe("helio-ombra");
    expect(Object.values(LEGACY_FAMILY_SLUGS).sort()).toEqual(Object.keys(PRODUCT_NAMES).sort());
  });
});
