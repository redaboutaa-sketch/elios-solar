import { test, expect, type Page } from "./fixtures";
import { acceptNecessaryOnly, shot } from "./helpers";

/** Aucun montant affiché (euros, dirhams) dans le texte visible d'une page publique. */
async function expectNoAmount(page: Page) {
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/\d[\d\s ]*(,\d+)?\s?(€|EUR|DH|MAD)\b/);
}

test("catalogue HELIOSTORES : trois familles, fiches sourcées, prix sur devis, aucun ancien produit", async ({ page }) => {
  await page.goto("/");
  await acceptNecessaryOnly(page);
  await expect(page.locator("header")).toContainText("Pergolas");
  await expect(page.locator("header")).toContainText("Screens");
  await expect(page.locator("header")).toContainText("Stores bannes");
  await expect(page.locator('a[href="/accessoires"], a[href="/comparer"], a[href="/realisations"]')).toHaveCount(0);
  for (const key of ["PERGOLAS", "SCREENS", "STORES_BANNES"]) await expect(page.getByTestId(`home-${key}`)).toBeVisible();
  await expectNoAmount(page);
  await shot(page, "accueil");

  const families: Array<[string, string[]]> = [["/pergolas", ["Pergola SB400", "Pergola SB500"]], ["/screens", ["Screen REFLEKSOL 120 ZiiiP"]], ["/stores-bannes", ["Store banne CASABLANCA"]]];
  for (const [path, names] of families) {
    await page.goto(path);
    const list = page.getByTestId("collection");
    await expect(list.locator(":scope > li")).toHaveCount(names.length);
    for (const n of names) await expect(list).toContainText(n);
    await expectNoAmount(page);
  }
  await shot(page, "collection");

  // fiche : galerie fabricant créditée, prix sur devis, caractéristiques sourcées avec contradiction signalée
  await page.goto("/screens/screen-refleksol-120-ziiip");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Screen REFLEKSOL 120 ZiiiP");
  await expect(page.getByTestId("price-on-quote")).toContainText("Prix établi sur devis");
  const img = page.getByTestId("system-gallery").locator("figure img");
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByTestId("media-credit").first()).toContainText(/THYSENS|ALUPROF/);
  await page.getByRole("tab", { name: "Caractéristiques" }).click();
  const width = page.locator('[data-spec="width_max"]');
  await expect(width).toHaveAttribute("data-status", "to_confirm");
  await expect(width).toContainText("4 m");
  await expect(width).toContainText("7 m");
  await expect(page.locator('[data-spec="cassette"]')).toHaveAttribute("data-status", "established");
  await expectNoAmount(page);
  await shot(page, "fiche-screen");

  await page.goto("/pergolas/pergola-sb400");
  await page.getByRole("tab", { name: "Points à confirmer" }).click();
  await expect(page.getByTestId("open-questions")).not.toContainText(/Prix|tarif/i);
  await page.getByRole("tab", { name: "Dimensions et pose" }).click();
  await expect(page.getByTestId("system-dimensions")).toContainText("par pas de 20 cm");
  await shot(page, "fiche-sb400");

  // brouillon (classement à décider) et ancien catalogue : jamais publics
  for (const path of ["/stores-bannes/veranda-fts", "/configurateur/veranda-fts", "/pergolas/pergola-solis", "/stores-bannes/store-banne-ombra"]) {
    expect((await page.request.get(path)).status(), path).toBe(404);
  }
  await page.goto("/comparer");
  await expect(page).toHaveURL(/\/pergolas$/);
  await page.goto("/configurateur?gamme=pergola-solis");
  await expect(page.getByTestId("legacy-notice")).toContainText("ancien catalogue");
});
