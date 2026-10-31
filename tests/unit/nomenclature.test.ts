import { describe, expect, it } from "vitest";
import { HELIOSTORES_FAMILIES } from "@/server/catalog/heliostores-data";
import { HELIOSTORES_MEDIA } from "@/server/media/heliostores-media";
import { PUBLIC_FORBIDDEN_NAMES, PUBLIC_RETIRED_NAMES, publicSpecs, publicSystemRules } from "@/domain/public-sanitize";
import { ACCESSORY_LABELS, NAME_ALIASES, PRODUCT_NAMES } from "@/domain/nomenclature";
import { NAME_TRANSCO } from "@/server/catalog/name-transco";
import { HELIOSTORES_MEDIA_2026 } from "@/server/media/heliostores-media-2026";
import { LEGACY_FAMILY_SLUGS, RENAMED_2026_10_25, canonicalFamilySlug, legacyProductRedirects } from "@/server/catalog/legacy-slugs";

const current = HELIOSTORES_FAMILIES.filter((f) => !f.retired);

/** Tout ce qu'une famille envoie au site public (pages, instantané du configurateur, données structurées). */
function publicView(f: (typeof HELIOSTORES_FAMILIES)[number]) {
  return JSON.stringify({
    slug: f.slug, name: f.name, shortDescription: f.shortDescription, description: f.description, seoTitle: f.seoTitle, seoDescription: f.seoDescription, faq: f.faq,
    rules: publicSystemRules(f.rules),
    specs: publicSpecs(f.specs).map((s) => ({ key: s.key, label: s.label, valueNum: s.valueNum, unit: s.unit, valueText: s.valueText, note: s.note })),
  });
}

describe("nomenclature commerciale HELIOSTORES (transcodification HELIO du 2026-10-31)", () => {
  it("noms commerciaux : ceux de la décision client, identiques à la nomenclature centrale", () => {
    expect(Object.fromEntries(current.map((f) => [f.slug, f.name]))).toEqual(PRODUCT_NAMES);
    // anciens noms HELIO : seulement sur les fiches retirées (historique), jamais sur un produit actuel
    for (const f of current) expect(publicView(f), f.slug).not.toMatch(/HELIO (Horizon|Panorama|Ombra|Riviera|Azur|Verrière|Pilot|Vent|Soleil|Connect|Lumière)/);
    expect(HELIOSTORES_FAMILIES.filter((f) => f.retired).map((f) => f.slug).sort()).toEqual(["helio-horizon", "helio-panorama", "helio-verriere"]);
  });

  it("aucune référence du fournisseur, du fabricant ou d'un moteur dans les données publiques ; exceptions voulues par le client", () => {
    for (const f of current) expect(publicView(f), f.slug).not.toMatch(PUBLIC_FORBIDDEN_NAMES);
    for (const m of HELIOSTORES_MEDIA.filter((x) => current.some((f) => f.slug === x.familySlug))) expect(`${m.alt} ${m.caption}`, m.key).not.toMatch(PUBLIC_FORBIDDEN_NAMES);
    expect("Madeira").toMatch(PUBLIC_FORBIDDEN_NAMES);
    expect("MB-OpenSlide").toMatch(PUBLIC_FORBIDDEN_NAMES);
    for (const ref of ["OPEN SLIDE", "SYSTEM SLIDE", "VERANDA V ZiiiP", "PERGOLA SOLID", "SB450", "SB350"]) expect(ref).toMatch(PUBLIC_FORBIDDEN_NAMES);
    for (const n of Object.values(PRODUCT_NAMES)) expect(n).not.toMatch(PUBLIC_FORBIDDEN_NAMES);
    expect("HelioSlide ALU HelioSlide VERRE").not.toMatch(PUBLIC_FORBIDDEN_NAMES);
  });

  it("correspondance fournisseur conservée en interne, jamais envoyée au navigateur", () => {
    const ref = Object.fromEntries(HELIOSTORES_FAMILIES.map((f) => [f.slug, f.supplierRef]));
    expect(ref.malaga).toMatch(/^SB 350/);
    expect(ref.marbella).toMatch(/^SB 450/);
    // écarts de correspondance : nouvelle référence client, données existantes signalées « à confirmer » (pas de transfert)
    expect(ref.sevilla).toMatch(/^SOLID .*PERGOLA V ZiiiP.*à confirmer/);
    expect(ref.helioscreen).toMatch(/R 120 ZiiiP/);
    expect(ref["helioroof-screen"]).toMatch(/^VERANDA V ZiiiP .*« Veranda » standard.*à confirmer ; pas Veranda FTS/);
    expect(ref.madera).toMatch(/MADEIRA/);
    for (const s of ["moskifold", "moskifold-2", "moskiup", "moskislide", "moskifix"]) expect(ref[s], s).toMatch(/à confirmer/);
    for (const f of current) expect(JSON.stringify(publicSystemRules(f.rules)), f.slug).not.toContain("supplierRef");
  });

  it("équipements : libellés descriptifs ; fermetures coulissantes = accessoire, pas une famille", () => {
    const text = current.map((f) => JSON.stringify(f.rules)).join("\n");
    expect(text).toContain(ACCESSORY_LABELS.remote);
    expect(text).toContain(ACCESSORY_LABELS.sideClosure);
    expect(text).toContain(ACCESSORY_LABELS.slidingPanels);
    expect(current.some((f) => f.slug === "openslide")).toBe(false);
    for (const f of current) for (const o of f.rules.options.filter((x) => /box domotique/i.test(x.label))) expect(!!(o.requiresControlKind || o.requiresControls?.length), f.slug).toBe(true);
  });

  it("redirections seulement vers le même produit ; modèles retirés sans redirection vers un autre produit", () => {
    const r = legacyProductRedirects();
    expect(r).toContainEqual({ source: "/screens/helio-ombra", destination: "/screens/helioscreen", permanent: true });
    expect(r).toContainEqual({ source: "/stores-bannes/helio-riviera", destination: "/stores-bannes/casablanca", permanent: true });
    expect(r).toContainEqual({ source: "/stores-bannes/helio-azur", destination: "/stores-bannes/corsica", permanent: true });
    expect(r).toContainEqual({ source: "/screens/screen-refleksol-120-ziiip", destination: "/screens/helioscreen", permanent: true });
    expect(r).toContainEqual({ source: "/configurateur/pergola-sb400", destination: "/configurateur/helio-horizon", permanent: true });
    const sources = new Set(r.map((x) => x.source));
    for (const x of r) expect(sources.has(x.destination)).toBe(false);
    for (const x of r) expect(x.destination).not.toMatch(/malaga|marbella|sevilla|helioroof/);
    expect(canonicalFamilySlug("helio-ombra")).toBe("helioscreen");
    expect(canonicalFamilySlug("helio-horizon")).toBe("helio-horizon");
    expect(Object.keys(RENAMED_2026_10_25)).toEqual(["helio-ombra", "helio-riviera", "helio-azur"]);
    expect(Object.values(LEGACY_FAMILY_SLUGS)).not.toContain("malaga");
  });

  it("transcodification HELIO : noms appliqués, identifiants stables, anciens noms en alias internes seulement", () => {
    const families = Object.fromEntries(HELIOSTORES_FAMILIES.map((f) => [f.slug, f]));
    for (const t of NAME_TRANSCO.filter((x) => x.kind === "product")) {
      expect(families[t.slug]?.name, t.slug).toBe(t.name); // même slug (identifiant stable, URL conservée)
      for (const p of t.previous.filter((x) => x !== t.name)) expect(NAME_ALIASES).toContainEqual({ alias: p, name: t.name, slug: t.slug });
    }
    expect(NAME_TRANSCO.filter((t) => t.technical === "a_confirmer").map((t) => t.slug).sort()).toEqual(["helioroof-screen", "sevilla", "sliding_panels"]);
    // anciens noms : ni dans les données publiques des produits actuels, ni dans les textes alternatifs et légendes
    for (const f of current) expect(publicView(f), f.slug).not.toMatch(PUBLIC_RETIRED_NAMES);
    for (const m of [...HELIOSTORES_MEDIA, ...HELIOSTORES_MEDIA_2026]) expect(`${m.alt} ${m.caption}`, m.key).not.toMatch(PUBLIC_RETIRED_NAMES);
    // moustiquaires : noms inchangés
    expect([PRODUCT_NAMES.moskifold, PRODUCT_NAMES["moskifold-2"]]).toEqual(["MoskiFold", "MoskiFold 2"]);
  });
});
