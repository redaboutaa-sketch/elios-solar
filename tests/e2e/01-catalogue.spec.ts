import { test, expect, type Page } from "./fixtures";
import { acceptNecessaryOnly, shot } from "./helpers";
import { one, publicPricesActive } from "./db";
import { PUBLIC_FORBIDDEN_NAMES } from "../../src/domain/public-sanitize";

// fabricant, fournisseur et références (produits, moteurs) : jamais sur une page publique ni dans ses données
const FORBIDDEN = PUBLIC_FORBIDDEN_NAMES;
const AMOUNT = /\d[\d\s\u00a0\u202f]*(,\d+)?[\s\u00a0]?(€|EUR|DH|MAD)/;

/** Page publique : aucune mention du fabricant ni du fournisseur (texte visible ET source HTML), prix « à partir de » si une grille est active. */
async function expectPublicPage(page: Page, priced: boolean) {
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(FORBIDDEN);
  expect(await page.content()).not.toMatch(FORBIDDEN);
  if (!priced) expect(text).not.toMatch(AMOUNT);
  else expect(text).toMatch(/À partir de[\s\u00a0]+\d[\d\s\u00a0\u202f]*(,\d+)?[\s\u00a0]€[\s\u00a0]HT/i);
}

test("catalogue HELIOSTORES : trois familles, fiches sans référence fabricant/fournisseur, prix de la grille, aucun ancien produit", async ({ page }) => {
  const priced = await publicPricesActive();
  test.info().annotations.push({ type: "prix", description: priced ? "grille « Prix final HELIOSTORES » active : prix « à partir de » vérifiés" : "aucune grille active dans cet environnement : prix sur devis vérifié" });
  await page.goto("/");
  await acceptNecessaryOnly(page);
  await expect(page.locator("header")).toContainText("Pergolas");
  await expect(page.locator("header")).toContainText("Screens");
  await expect(page.locator("header")).toContainText("Stores bannes");
  await expect(page.locator('a[href="/accessoires"], a[href="/comparer"], a[href="/realisations"]')).toHaveCount(0);
  for (const key of ["PERGOLAS", "SCREENS", "STORES_BANNES"]) await expect(page.getByTestId(`home-${key}`)).toBeVisible();
  await expectPublicPage(page, priced);
  await expect(page.locator("footer")).not.toContainText(FORBIDDEN);
  await shot(page, "accueil");

  const families: Array<[string, string[]]> = [["/pergolas", ["HELIO Horizon", "HELIO Panorama"]], ["/screens", ["HELIO Ombra"]], ["/stores-bannes", ["HELIO Riviera"]]];
  for (const [path, names] of families) {
    await page.goto(path);
    const list = page.getByTestId("collection");
    await expect(list.locator(":scope > li")).toHaveCount(names.length);
    for (const n of names) await expect(list).toContainText(n);
    await expectPublicPage(page, priced);
    await expect(list.getByTestId("collection-price")).toHaveCount(names.length);
  }
  await shot(page, "collection");

  // fiche : galerie sans crédit fabricant, prix « à partir de » (ou sur devis), contradiction signalée sans citer de source
  await page.goto("/screens/helio-ombra");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("HELIO Ombra");
  if (priced) await expect(page.getByTestId("from-price")).toContainText(/À partir de\s*\d/);
  else await expect(page.getByTestId("price-on-quote")).toContainText("Prix sur devis");
  // les visuels fabricant sont des fichiers privés importés par environnement (absents en CI) : on vérifie l'état réel
  const imported = Number((await one<{ n: string }>(`SELECT count(*) AS n FROM "ProductMedia" pm JOIN "ProductFamily" f ON f.id = pm."familyId" JOIN "Media" m ON m.id = pm."mediaId" WHERE f.slug = 'helio-ombra' AND m.status = 'PUBLISHED' AND m.provenance IS NOT NULL`))!.n);
  if (imported > 0) {
    const img = page.getByTestId("system-gallery").locator("figure img");
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
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
  await expectPublicPage(page, priced);
  await shot(page, "fiche-screen");

  await page.goto("/pergolas/helio-horizon");
  await expect(page.getByRole("tab", { name: "Points à confirmer" })).toHaveCount(0);
  await expectPublicPage(page, priced);
  await page.getByRole("tab", { name: "Dimensions et pose" }).click();
  await expect(page.getByTestId("system-dimensions")).toContainText("par pas de 20 cm");
  await shot(page, "fiche-sb400");

  // brouillon (classement à décider) et ancien catalogue : jamais publics
  for (const path of ["/stores-bannes/helio-verriere", "/configurateur/helio-verriere", "/pergolas/pergola-solis", "/stores-bannes/store-banne-ombra"]) {
    expect((await page.request.get(path)).status(), path).toBe(404);
  }
  await page.goto("/comparer");
  await expect(page).toHaveURL(/\/pergolas$/);
  await page.goto("/configurateur?gamme=pergola-solis");
  await expect(page.getByTestId("legacy-notice")).toContainText("ancien catalogue");
});
