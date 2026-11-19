import { test, expect } from "@playwright/test";
import { acceptNecessaryOnly } from "../e2e/helpers";

/**
 * Contrôles visuels représentatifs à 390, 768 et 1440 px : aucune barre de défilement horizontale, en-tête et contenu
 * principal visibles ; captures conservées dans le rapport (elles ne remplacent pas les assertions fonctionnelles).
 * Exécuté par le seul projet « desktop » (les largeurs sont imposées ici).
 */
const WIDTHS = [390, 768, 1440];
const PAGES = ["/", "/pergolas", "/pergolas/sevilla", "/configurateur/sevilla?depart=1", "/screens/helioscreen", "/stores-bannes/casablanca", "/devis"];

for (const width of WIDTHS) {
  for (const path of PAGES) {
    test(`${width} px ${path} : pas de débordement horizontal, contenu principal visible`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "sans objet : largeurs imposées par le test (projet desktop seulement)");
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await acceptNecessaryOnly(page);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "débordement horizontal (px)").toBeLessThanOrEqual(1);
      await expect(page.locator("header").first()).toBeVisible();
      await expect(page.locator("main").first()).toBeVisible();
      const dir = process.env.RECETTE_REPORT_DIR ?? "private/recette/last";
      await page.screenshot({ path: `${dir}/captures/${width}${path.replace(/[/?=]/g, "_") || "_accueil"}.png` });
    });
  }
}
