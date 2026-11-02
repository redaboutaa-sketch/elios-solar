import { test, expect, type Page } from "./fixtures";
import { acceptNecessaryOnly, shot } from "./helpers";
import { fromPriceCategories, IN_FORCE_GRID_SQL, one, publicPricesActive } from "./db";
import { PUBLIC_FORBIDDEN_NAMES, withoutSellerIdentity } from "../../src/domain/public-sanitize";

// fabricant, fournisseur et références (produits, moteurs) : jamais sur une page publique ni dans ses données
const FORBIDDEN = PUBLIC_FORBIDDEN_NAMES;
const AMOUNT = /\d[\d\s  ]*(,\d+)?[\s ]?(€|EUR|DH|MAD)/;
const FROM_PRICE = /À partir de[\s ]+\d[\d\s  ]*(,\d+)?[\s ]€[\s ]HT/i;

/** Page publique : aucune mention du fabricant ni du fournisseur (texte visible ET source HTML ; l'entité juridique du vendeur n'est admise que dans l'identité légale, hors contenu principal). */
async function expectNoSupplier(page: Page) {
  expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN);
  expect(withoutSellerIdentity(await page.content())).not.toMatch(FORBIDDEN);
}

/** Nomenclature du 2026-10-25 : quatre familles et leurs modèles configurables (brouillons exclus). */
const FAMILIES: Array<[string, string[], string]> = [
  ["/pergolas", ["HelioSky", "HelioMax", "HelioLux"], "PERGOLAS"],
  ["/screens", ["HelioScreen", "HelioRoof"], "SCREENS"],
  ["/stores-bannes", ["HelioSun", "HelioShade", "HelioPro", "HelioSquare"], "STORES_BANNES"],
  ["/moustiquaires", ["MoskiFold", "MoskiFold 2", "MoskiUp", "MoskiSlide", "MoskiFix"], "MOUSTIQUAIRES"],
];

test("catalogue HELIOSTORES : quatre familles, fiches sans référence fabricant/fournisseur, prix de la grille, modèles retirés et renommés", async ({ page }) => {
  const priced = await publicPricesActive();
  test.info().annotations.push({ type: "prix", description: priced ? "grilles de vente actives (HelioSun, HelioScreen) : prix « à partir de » vérifiés" : "aucune grille active dans cet environnement : prix sur devis vérifié" });
  await page.goto("/");
  await acceptNecessaryOnly(page);
  // en-tête : services seulement ; le catalogue est dans la navigation latérale et le menu mobile
  // (masqué sous 1024 px : lu dans le DOM, quel que soit l'appareil)
  const mainNav = page.locator('header nav[aria-label="Navigation principale"] a');
  expect((await mainNav.allTextContents()).map((t) => t.trim())).toEqual(["Installation et guides", "Contact", "Devis"]);
  await expect(page.locator('a[href="/comparer"], a[href="/realisations"], a[href="/savoir-faire"]')).toHaveCount(0);
  for (const key of ["PERGOLAS", "SCREENS", "STORES_BANNES", "MOUSTIQUAIRES"]) await expect(page.getByTestId(`home-${key}`)).toBeVisible();
  await expectNoSupplier(page);
  expect(withoutSellerIdentity(await page.locator("footer").innerText())).not.toMatch(FORBIDDEN);
  await shot(page, "accueil");

  const withFromPrice = await fromPriceCategories();
  for (const [path, names, category] of FAMILIES) {
    const hasGrid = withFromPrice.has(category);
    await page.goto(path);
    const list = page.getByTestId("collection");
    await expect(list.locator(":scope > li")).toHaveCount(names.length);
    for (const n of names) await expect(list.getByRole("heading", { name: n, exact: true })).toBeVisible();
    await expect(list.getByTestId("collection-price")).toHaveCount(names.length);
    await expectNoSupplier(page);
    const text = await list.innerText();
    // une famille sans grille de vente n'affiche aucun montant ; une famille tarifée affiche « à partir de » (si grille active)
    if (!hasGrid || !priced) expect(text, path).not.toMatch(AMOUNT);
    else expect(text, path).toMatch(FROM_PRICE);
  }
  await shot(page, "collection");

  // fiche : galerie sans crédit fabricant, prix « à partir de » (ou sur devis), contradiction signalée sans citer de source
  await page.goto("/screens/helioscreen");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("HelioScreen");
  // grille publiée : « à partir de » si une configuration complète existe, sinon prix calculé dans le configurateur
  // (moteur obligatoire à chiffrer) ; sans grille : sur devis
  const screenGrid = priced && (await one(`SELECT 1 FROM "SupplierPriceList" l WHERE ${IN_FORCE_GRID_SQL} AND l."familySlug" = 'helioscreen'`)) != null;
  if (!screenGrid) await expect(page.getByTestId("price-on-quote")).toContainText("Prix sur devis");
  else await expect(page.getByTestId("from-price").or(page.getByTestId("price-configurator"))).toContainText(/À partir de\s*\d|Prix calculé dans le configurateur/);
  // les visuels fabricant sont des fichiers privés importés par environnement (absents en CI) : on vérifie l'état réel
  const imported = Number((await one<{ n: string }>(`SELECT count(*) AS n FROM "ProductMedia" pm JOIN "ProductFamily" f ON f.id = pm."familyId" JOIN "Media" m ON m.id = pm."mediaId" WHERE f.slug = 'helioscreen' AND m.status = 'PUBLISHED' AND m.provenance IS NOT NULL`))!.n);
  if (imported > 0) {
    const img = page.getByTestId("system-gallery").locator("figure img");
    await expect.poll(() => img.first().evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByTestId("media-credit")).toHaveCount(0);
  } else {
    test.info().annotations.push({ type: "médias", description: "aucun visuel fabricant importé dans cet environnement : état vide vérifié" });
    await expect(page.getByText("Visuels en cours d'intégration.")).toBeVisible();
  }
  await page.getByRole("tab", { name: "Caractéristiques" }).click();
  const width = page.locator('[data-spec="width_max"]');
  await expect(width).toHaveAttribute("data-status", "to_confirm");
  await expect(width).toContainText("4 m");
  await expect(width).toContainText("7 m");
  await expect(page.locator('[data-spec="cassette"]')).toHaveAttribute("data-status", "established");
  await expect(page.getByTestId("sourced-specs")).not.toContainText(/Source|Catalogue|Fiche du modèle|Site du fabricant/);
  await expectNoSupplier(page);
  await shot(page, "fiche-screen");

  // pergola sur mesure : « à partir de » si une grille de vente est publiée, sinon prix sur devis ; bornes documentées
  await page.goto("/pergolas/marbella");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("HelioMax");
  const maxGrid = priced && (await one(`SELECT 1 FROM "SupplierPriceList" l WHERE ${IN_FORCE_GRID_SQL} AND l."familySlug" = 'marbella'`)) != null;
  if (maxGrid) await expect(page.getByTestId("from-price")).toContainText(/À partir de\s*\d/);
  else await expect(page.getByTestId("price-on-quote")).toContainText("Prix sur devis");
  await expect(page.getByRole("tab", { name: "Points à confirmer" })).toHaveCount(0);
  await expectNoSupplier(page);
  await page.getByRole("tab", { name: "Dimensions et pose" }).click();
  await expect(page.getByTestId("system-dimensions")).toContainText("Largeur : de 1 m à 4 m");
  await expect(page.getByTestId("system-dimensions")).toContainText("Avancée : de 1,39 m à 6,01 m");
  await shot(page, "fiche-pergola");

  // modèles retirés : page explicative (200) avec les gammes actuelles, jamais de configurateur ni de conversion
  for (const path of ["/pergolas/helio-horizon", "/configurateur/helio-horizon", "/pergolas/helio-panorama", "/configurateur/helio-panorama", "/configurateur/helio-verriere"]) {
    const r = await page.goto(path);
    expect(r?.status(), path).toBe(200);
    await expect(page.getByTestId("retired-product"), path).toBeVisible();
    await expect(page.getByTestId("system-configurator")).toHaveCount(0);
  }
  // renommages (même produit) : redirection permanente vers le nouveau nom
  for (const [from, to] of [["/screens/helio-ombra", "/screens/helioscreen"], ["/stores-bannes/helio-riviera", "/stores-bannes/casablanca"], ["/stores-bannes/helio-azur", "/stores-bannes/corsica"], ["/configurateur/helio-ombra", "/configurateur/helioscreen"]]) {
    const r = await page.request.get(from!, { maxRedirects: 0 });
    expect(r.status(), from).toBe(308);
    expect(new URL(r.headers()["location"]!, "http://x").pathname, from).toBe(to);
  }
  // ancien catalogue : jamais public
  for (const path of ["/pergolas/pergola-solis", "/stores-bannes/store-banne-ombra"]) {
    expect((await page.request.get(path)).status(), path).toBe(404);
  }
  await page.goto("/comparer");
  await expect(page).toHaveURL(/\/pergolas$/);
  await page.goto("/configurateur?gamme=pergola-solis");
  await expect(page.getByTestId("legacy-notice")).toContainText("ancien catalogue");
});
