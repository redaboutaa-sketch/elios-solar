import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, jsonLdString, organizationJsonLd, productJsonLd } from "@/server/seo/structured-data";
import { productNature, productTitle, quoteSafeDescription } from "@/server/seo/product-nature";
import { PRIVATE_PREFIXES, robotsRules } from "@/server/seo/robots-rules";
import { GUIDE_REDIRECTS, GUIDES, PUBLISHED_GUIDES } from "@/server/content/guides";

const SITE = "https://heliostores.com";

describe("données structurées", () => {
  it("produit sur devis : aucune offre, aucun prix, aucune note ni marque", () => {
    const j = productJsonLd(SITE, { name: "Marbella", description: "Pergola", path: "/pergolas/marbella", category: "Pergola à lames orientables", images: ["/api/media/x.webp"], price: null });
    const s = JSON.stringify(j);
    expect(j).not.toHaveProperty("offers");
    for (const k of ["price", "aggregateRating", "review", "gtin", "brand", "manufacturer", "availability"]) expect(s).not.toContain(`"${k}`);
    expect(j.url).toBe("https://heliostores.com/pergolas/marbella");
    expect(j.image).toEqual(["https://heliostores.com/api/media/x.webp"]);
  });
  it("un montant nul, négatif ou sans base fiscale ne produit jamais d'offre", () => {
    for (const price of [{ amountMinor: 0, currency: "EUR", taxBasis: "HT" as const }, { amountMinor: -5, currency: "EUR", taxBasis: "TTC" as const }, { amountMinor: 1000, currency: "EUR", taxBasis: null }, { amountMinor: 1000, currency: "", taxBasis: "HT" as const }]) {
      expect(productJsonLd(SITE, { name: "X", description: "", path: "/x", category: "c", images: [], price })).not.toHaveProperty("offers");
    }
  });
  it("prix public : offre fidèle (devise, base fiscale)", () => {
    const j = productJsonLd(SITE, { name: "X", description: "", path: "/x", category: "c", images: [], price: { amountMinor: 123456, currency: "EUR", taxBasis: "HT" } }) as { offers: { priceSpecification: { minPrice: string; valueAddedTaxIncluded: boolean; priceCurrency: string } } };
    expect(j.offers.priceSpecification).toMatchObject({ minPrice: "1234.56", priceCurrency: "EUR", valueAddedTaxIncluded: false });
  });
  it("organisation : coordonnées seulement si renseignées", () => {
    const empty = organizationJsonLd({ name: "HELIOSTORES", siteUrl: SITE, logoPath: "/brand/logo.png" });
    expect(Object.keys(empty).sort()).toEqual(["@context", "@id", "@type", "logo", "name", "url"]);
    const partial = organizationJsonLd({ name: "HELIOSTORES", siteUrl: SITE, logoPath: "/l.png", address: { line1: "1 rue", postalCode: null, city: "Lille" } });
    expect(partial).not.toHaveProperty("address");
  });
  it("fil d'Ariane absolu, accueil en premier", () => {
    const b = breadcrumbJsonLd(SITE, [{ name: "Pergolas", path: "/pergolas" }]);
    expect(b.itemListElement.map((i) => i.item)).toEqual(["https://heliostores.com/", "https://heliostores.com/pergolas"]);
  });
  it("sérialisation : aucune fermeture de balise possible", () => {
    expect(jsonLdString({ a: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});

describe("titres « Nom — Nature »", () => {
  it("qualification confirmée seulement", () => {
    expect(productTitle("HelioScreen", { type: "screen" })).toBe("HelioScreen — Store screen extérieur");
    expect(productTitle("Malaga", { type: "pergola", roof: "louvres" })).toBe("Malaga — Pergola à lames orientables");
    expect(productNature({ type: "awning", protection: { level: "full", status: "to_confirm" } })).toBe("Store banne");
    expect(productNature({ type: "awning", protection: { level: "semi", status: "established" } })).toBe("Store banne semi-coffre");
    expect(productNature({ type: "insect_screen", insect: { opening: "pleated", leaves: 2 } })).toBe("Moustiquaire plissée à deux vantaux");
    expect(productTitle("X", { type: "inconnu" })).toBe("X");
    expect(productNature({ type: "pergola", roof: "louvres" })).not.toMatch(/bioclimatique/i);
  });
  it("description sans mention de prix lorsqu'il n'y a pas de prix public", () => {
    expect(quoteSafeDescription("Screen zip HelioScreen motorisé — prix selon vos dimensions", false)).toBe("Screen zip HelioScreen motorisé");
    expect(quoteSafeDescription("Configurez vos cotes, avec prix selon vos dimensions.", false)).not.toMatch(/prix/);
  });
});

describe("robots.txt", () => {
  it("préproduction : tout interdit, sans sitemap", () => {
    expect(robotsRules(false, SITE)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
  it("production : exploration autorisée hors espaces privés, ressources /_next non bloquées", () => {
    const r = robotsRules(true, SITE) as { rules: { allow: string; disallow: string[] }; sitemap: string };
    expect(r.rules.allow).toBe("/");
    expect(r.sitemap).toBe("https://heliostores.com/sitemap.xml");
    for (const p of ["/admin", "/compte", "/panier", "/commande", "/projets/", "/api/"]) expect(r.rules.disallow).toContain(p);
    expect(r.rules.disallow.some((p) => "/_next/static/x.js".startsWith(p))).toBe(false);
    expect(PRIVATE_PREFIXES).not.toContain("/guides");
  });
});

describe("guides", () => {
  it("chaque guide publié a une URL unique ; les anciens guides redirigent vers un guide publié", () => {
    const hrefs = PUBLISHED_GUIDES.map((g) => g.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const [from, to] of Object.entries(GUIDE_REDIRECTS)) {
      expect(GUIDES[from]).toBeUndefined();
      expect(hrefs).toContain(to);
    }
  });
  it("aucun délai, prix ou mention de fabricant dans les guides rédigés", () => {
    const text = JSON.stringify(GUIDES) + JSON.stringify(PUBLISHED_GUIDES);
    expect(text).not.toMatch(/aluprof|thysens|cortinadecor|sous \d+ ?(h|heures|jours)|€|ans de garantie/i);
  });
});

describe("contenus éditoriaux publics", () => {
  it("ni fabricant, ni délai, ni prix, ni zone desservie inventés", async () => {
    const { readFileSync } = await import("node:fs");
    const files = ["src/components/catalog/family-guide.tsx", "src/components/guides/guide-page.tsx", "src/components/layout/not-found-content.tsx", ...["choisir-sa-pergola", "choisir-son-screen-exterieur", "choisir-sa-moustiquaire", "comparer-protections-solaires"].map((s) => `src/app/(boutique)/guides/${s}/page.tsx`)];
    for (const f of files) {
      const t = readFileSync(f, "utf8");
      expect(t, f).not.toMatch(/aluprof|thysens|cortinadecor|sous \d+ ?(h|heures|jours)|\d+ ?€|garantie (\d|décennale|commerciale)|ans de garantie|livraison gratuite|partout en|intervenons|nos équipes|showroom/i);
    }
  });
});
