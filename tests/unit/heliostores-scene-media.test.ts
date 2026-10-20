import { describe, expect, it } from "vitest";
import { buildSceneModel, representedItems } from "@/domain/scene-model";
import { evaluate } from "@/domain/engine";
import { defaultSystemInput, type SystemInput } from "@/domain/system";
import { buildHeliostoresCatalog, HELIOSTORES_FAMILIES } from "@/server/catalog/heliostores-data";
import { HELIOSTORES_MEDIA } from "@/server/media/heliostores-media";
import { attributionFromLocation, sanitizeAttribution } from "@/domain/attribution";

const catalog = buildHeliostoresCatalog();
const input = (slug: string, over: Partial<SystemInput> = {}): SystemInput => ({ ...defaultSystemInput(slug, catalog.families.find((f) => f.slug === slug)!.systemRules!), ...over });
const scene = (i: SystemInput) => buildSceneModel(catalog, i, evaluate(catalog, i));

describe("3D des systèmes : même entrée que le devis", () => {
  it("SB400 : sections du catalogue, lames parallèles au mur à l'entraxe documenté (20 cm), poteaux selon la pose", () => {
    const m = scene(input("pergola-sb400", { widthMm: 3600, depthMm: 5000, heightMm: 2600, mounting: "freestanding", finishCode: "FSM_71319" }));
    expect(m?.kind).toBe("pergola");
    if (m?.kind !== "pergola") return;
    expect(m.lengthMm).toBe(3600);
    expect(m.widthMm).toBe(5000);
    expect(m.heightMm).toBe(2600);
    expect(m.sections).toEqual({ postAlongMm: 150, postAcrossMm: 85, beamHeightMm: 212, beamWidthMm: 85, bladeWidthMm: 216, bladeThicknessMm: 40 });
    expect(m.blades.orientation).toBe("along_length");
    expect(m.blades.count).toBe(25);
    expect(m.blades.maxAngleDeg).toBe(120);
    expect(m.posts).toHaveLength(4);
    const wall = scene(input("pergola-sb400", { mounting: "wall" }));
    expect(wall?.kind === "pergola" && wall.posts.length).toBe(2);
  });
  it("options représentées : LED périphérique, nombre de spots documenté, fermeture souhaitée marquée à confirmer", () => {
    const m = scene(input("pergola-sb500", { widthMm: 4000, depthMm: 6000, options: [{ code: "led_perimeter" }, { code: "led_spots" }], sides: { front: "screen-refleksol-120-ziiip" } }));
    if (m?.kind !== "pergola") throw new Error("pergola attendue");
    expect(m.lighting.gutter).toBe(true);
    expect(m.lighting.spots).toBe(12);
    expect(m.closures).toHaveLength(1);
    expect(m.closures[0]!.assembly.toConfirm).toBe(true);
    const items = representedItems(catalog, m);
    expect(items.join("\n")).toMatch(/Spots LED dans les lames : 12 points/);
    expect(items.join("\n")).toMatch(/À confirmer : Screen REFLEKSOL 120 ZiiiP côté avant/);
  });
  it("cotes hors règles : pas de scène (jamais de cote bornée silencieusement)", () => {
    expect(scene(input("pergola-sb400", { depthMm: 1500 }))).toBeNull();
    expect(scene(input("screen-refleksol-120-ziiip", { widthMm: 7500 }))).toBeNull();
  });
  it("screen : coffre 126 mm du catalogue, cotes saisies, toile de teinte indicative", () => {
    const m = scene(input("screen-refleksol-120-ziiip", { widthMm: 3000, heightMm: 2400, mounting: "niche" }));
    expect(m).toMatchObject({ kind: "screen", widthMm: 3000, heightMm: 2400, mounting: "niche", cassette: { widthMm: 126, heightMm: 126 } });
    expect(representedItems(catalog, m!).join("\n")).toMatch(/teinte représentée indicative/);
  });
  it("store banne : inclinaison dans la plage documentée, ni LED ni anémomètre supposés", () => {
    const m = scene(input("store-banne-casablanca", { widthMm: 5000, depthMm: 3100, mounting: "rafter" }));
    expect(m).toMatchObject({ kind: "awning", widthMm: 5000, projectionMm: 3100, bracketMount: "rafter", led: false, anemometer: false });
    if (m?.kind === "awning") { expect(m.tiltDeg).toBeGreaterThanOrEqual(5); expect(m.tiltDeg).toBeLessThanOrEqual(40); }
  });
});

describe("médias HELIOSTORES : provenance et rattachement", () => {
  const slugs = new Set(HELIOSTORES_FAMILIES.map((f) => f.slug));
  it("chaque média est rattaché à un produit existant, avec source, crédit et texte alternatif", () => {
    for (const m of HELIOSTORES_MEDIA) {
      expect(slugs.has(m.familySlug), m.key).toBe(true);
      expect(m.alt.length, m.key).toBeGreaterThan(20);
      expect(m.credit, m.key).toMatch(/ALUPROF|THYSENS/);
      if (m.source.type === "pdf") expect(m.source.page).toBeGreaterThan(0);
      else { expect(m.source.url).toMatch(/^https:\/\/aluprof\.com\//); expect(m.source.retrievedAt).toBe("2026-10-20"); }
    }
  });
  it("une photo par produit publié en tête de galerie, aucune image d'un autre produit (SB 400 PRO, SB500 sur la page SB 400)", () => {
    for (const slug of ["pergola-sb400", "pergola-sb500", "screen-refleksol-120-ziiip", "store-banne-casablanca"]) expect(HELIOSTORES_MEDIA.filter((m) => m.familySlug === slug && m.role === "hero")).toHaveLength(1);
    expect(HELIOSTORES_MEDIA.some((m) => /400_Pro|PRO|SB500/.test(m.source.type === "url" ? m.source.url : ""))).toBe(false);
  });
  it("aucune image présentée comme une réalisation HELIOSTORES", () => {
    for (const m of HELIOSTORES_MEDIA) expect(`${m.caption} ${m.alt}`).not.toMatch(/réalisation|installée par HELIOSTORES|chez nos clients/i);
  });
});

describe("attribution du prospect", () => {
  it("garde les paramètres de campagne, l'hôte du référent et le chemin d'entrée, rien d'autre", () => {
    const a = attributionFromLocation("https://demo.example/pergolas?utm_source=newsletter&utm_campaign=printemps&email=x@y.z", "https://www.google.com/search?q=pergola", new Date("2026-10-21T08:00:00Z"));
    expect(a).toEqual({ params: { utm_source: "newsletter", utm_campaign: "printemps" }, referrerHost: "www.google.com", landingPath: "/pergolas", firstSeenAt: "2026-10-21T08:00:00.000Z" });
  });
  it("le serveur ne conserve que des champs connus et bornés", () => {
    expect(sanitizeAttribution({ params: { utm_source: "x".repeat(500), evil: "1" }, referrerHost: "a.b<script>", landingPath: "/p?token=1", extra: 1 })).toEqual({ params: { utm_source: "x".repeat(120) }, referrerHost: "a.bscript", landingPath: "/p" });
    expect(sanitizeAttribution("n'importe quoi")).toBeNull();
    expect(sanitizeAttribution({ params: {} })).toBeNull();
  });
});
