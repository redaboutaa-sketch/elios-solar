import { describe, expect, it } from "vitest";
import { LOCALES, localizePath, parseLocaleList, splitLocale } from "@/i18n/config";
import { AREAS } from "@/i18n/messages";
import { fmt } from "@/i18n/format";
import { MARKETS } from "@/i18n/markets";
import { PUBLIC_FORBIDDEN_NAMES } from "@/domain/public-sanitize";

/** Chemins de clés d'un objet de messages (« footer.legal »…). */
function keys(v: unknown, prefix = ""): string[] {
  if (typeof v === "string") return [prefix];
  if (Array.isArray(v)) return [prefix];
  return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => keys(x, prefix ? `${prefix}.${k}` : k));
}
function leaves(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.map(String);
  return Object.values(v as Record<string, unknown>).flatMap(leaves);
}
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("langues : chemins", () => {
  it("le français reste à la racine ; les autres langues sous leur préfixe", () => {
    expect(localizePath("/pergolas", "fr")).toBe("/pergolas");
    expect(localizePath("/pergolas", "es")).toBe("/es/pergolas");
    expect(localizePath("/", "nl")).toBe("/nl");
    expect(localizePath("/configurateur/marbella?projet=abc&etape=pose-finitions", "de")).toBe("/de/configurateur/marbella?projet=abc&etape=pose-finitions");
    expect(localizePath("/#solutions", "en")).toBe("/en#solutions");
  });
  it("chemins techniques, externes, déjà préfixés : inchangés", () => {
    for (const h of ["/api/health", "/admin", "/uploads/x.webp", "https://exemple.fr/", "//cdn", "#ancre", "/es/pergolas", "/robots.txt"]) expect(localizePath(h, "es"), h).toBe(h);
  });
  it("lecture du préfixe", () => {
    expect(splitLocale("/es/pergolas/marbella")).toEqual({ locale: "es", path: "/pergolas/marbella" });
    expect(splitLocale("/en")).toEqual({ locale: "en", path: "/" });
    expect(splitLocale("/essai")).toEqual({ locale: "fr", path: "/essai" });
    expect(splitLocale("/pergolas")).toEqual({ locale: "fr", path: "/pergolas" });
  });
  it("activation : français toujours servi, langues inconnues ignorées, défaut français seul", () => {
    expect(parseLocaleList(undefined)).toEqual(["fr"]);
    expect(parseLocaleList("es, xx ,EN")).toEqual(["fr", "es", "en"]);
  });
});

describe("langues : messages", () => {
  it("chaque langue a exactement les clés et les variables du français", () => {
    for (const [area, m] of Object.entries(AREAS)) {
      const ref = keys(m.fr).sort();
      for (const l of LOCALES) {
        expect(keys(m[l]).sort(), `${area}/${l}`).toEqual(ref);
        const frLeaves = new Map(keys(m.fr).map((k, i) => [k, leaves(m.fr)[i]!]));
        const lLeaves = new Map(keys(m[l]).map((k, i) => [k, leaves(m[l])[i]!]));
        for (const [k, v] of frLeaves) expect(vars(lLeaves.get(k) ?? ""), `${area}/${l}/${k}`).toEqual(vars(v));
      }
    }
  });
  it("traductions non vides ; aucune référence fournisseur", () => {
    for (const [area, m] of Object.entries(AREAS)) {
      for (const l of LOCALES.filter((x) => x !== "fr")) {
        const fr = new Map(keys(m.fr).map((k, i) => [k, leaves(m.fr)[i]!]));
        keys(m[l]).forEach((k, i) => {
          const v = leaves(m[l])[i]!;
          // une clé vide en français (ex. bandeau d'aperçu) peut être renseignée dans une autre langue, jamais l'inverse
          if (fr.get(k)) expect(v.trim(), `${area}/${l}/${k}`).not.toBe("");
          expect(PUBLIC_FORBIDDEN_NAMES.test(v), `${area}/${l}/${k}`).toBe(false);
        });
      }
    }
  });
  it("variables", () => {
    expect(fmt("{brand} — Accueil", { brand: "HELIOSTORES" })).toBe("HELIOSTORES — Accueil");
    expect(fmt("{a} {b}", { a: 1 })).toBe("1 {b}");
  });
});

describe("marchés : distincts des langues, rien d'inventé", () => {
  it("seule la France est active ; les autres pays restent à valider, sans devise ni conditions propres", () => {
    expect(MARKETS.filter((m) => m.status === "active").map((m) => m.country)).toEqual(["FR"]);
    for (const m of MARKETS.filter((x) => x.country !== "FR")) expect([m.currency, m.delivery, m.taxes, m.terms], m.country).toEqual([null, "to_validate", "to_validate", "to_validate"]);
    // la Belgique n'est pas une langue : versions française et néerlandaise
    expect(MARKETS.find((m) => m.country === "BE")!.locales).toEqual(["fr", "nl"]);
  });
});

describe("langues : textes repris du domaine", () => {
  it("le délai de livraison des messages français est celui du domaine (aucune divergence)", async () => {
    const { DELIVERY_LEAD_TIME, DELIVERY_TERMS_IN_QUOTE } = await import("@/domain/delivery");
    const fr = AREAS.configurator.fr as unknown as Record<string, unknown>;
    const flat = JSON.stringify(fr);
    expect(flat).toContain(JSON.stringify(DELIVERY_LEAD_TIME).slice(1, -1));
    expect(flat).toContain(JSON.stringify(DELIVERY_TERMS_IN_QUOTE).slice(1, -1));
  });
});
