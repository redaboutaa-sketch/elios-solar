import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/domain/categories";
import { HOME_VISUALS } from "@/server/media/home-visuals";
import { HELIOSTORES_FAMILIES } from "@/server/catalog/heliostores-data";
import { MEDIA_SLUG_RE, checkSignature, resolveMediaFile } from "@/server/media/storage";

describe("visuels du carrousel de l'accueil", () => {
  it("un visuel par famille, dans l'ordre des familles", () => {
    expect(HOME_VISUALS.map((v) => v.category)).toEqual(CATEGORIES.map((c) => c.key));
    expect(new Set(HOME_VISUALS.map((v) => v.key)).size).toBe(HOME_VISUALS.length);
  });
  it("présentés comme des visualisations, sans modèle précis ni référence fournisseur", () => {
    const models = HELIOSTORES_FAMILIES.map((f) => f.name.toLowerCase());
    for (const v of HOME_VISUALS) {
      expect(v.alt, v.key).toMatch(/^Visualisation d/);
      expect(v.title, v.key).toMatch(/^Visualisation/);
      const text = `${v.alt} ${v.title} ${v.slug} ${v.file}`.toLowerCase();
      expect(text, v.key).not.toMatch(/aluprof|thysens|cortinadecor|photographie|réalisation|fabricant/);
      for (const m of models) expect(text.includes(m.toLowerCase()), `${v.key} cite ${m}`).toBe(false);
    }
  });
  it("noms publics descriptifs valides et cadrage défini pour mobile et ordinateur", () => {
    for (const v of HOME_VISUALS) {
      expect(MEDIA_SLUG_RE.test(`${v.slug}-1672`), v.slug).toBe(true);
      expect(resolveMediaFile(`${v.slug}-1672-0123abcd.avif`), v.slug).not.toBeNull();
      for (const p of [v.focus.mobile, v.focus.desktop]) expect(p).toMatch(/^\d{1,3}% \d{1,3}%$/);
    }
  });
});

describe("stockage des médias : noms et AVIF", () => {
  it("accepte les noms aléatoires et descriptifs, refuse le reste", () => {
    expect(resolveMediaFile(`${"a".repeat(32)}.webp`)).not.toBeNull();
    expect(resolveMediaFile("visualisation-pergola-640-0123abcd.webp")).not.toBeNull();
    for (const bad of ["../x-0123abcd.webp", "Visualisation-0123abcd.webp", "pergola.webp", "pergola-0123abcd.exe", "pergola--x-0123abcd.webp"]) expect(resolveMediaFile(bad), bad).toBeNull();
  });
  it("vérifie la signature AVIF", () => {
    const avif = Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from("ftypavif"), Buffer.alloc(8)]);
    expect(checkSignature(avif, "image/avif")).toBeNull();
    expect(checkSignature(Buffer.from("RIFF0000WEBPxxxx"), "image/avif")).not.toBeNull();
  });
});
