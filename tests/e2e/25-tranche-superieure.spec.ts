import { test, expect } from "./fixtures";
import { chooseFabric, fillQuote, goStep, loginAdmin, openConfigurator, setDim, shot, uid } from "./helpers";
import { IN_FORCE_GRID_SQL, one, publicCell, publicPricesActive } from "./db";

/**
 * Tranche tarifaire supérieure (décision commerciale HELIOSTORES du 2026-11-18) : HelioLux 1,5 × 2 m, sous la première
 * tranche d'avancée (3 m) mais au-dessus du minimum technique documenté (1,5 × 2 m), est chiffrée à la cellule
 * 1,5 × 3 m ; les cotes réelles restent celles du client (champ, récapitulatif, devis) ; la tranche facturée n'apparaît
 * que dans le détail administrateur. Montant attendu recalculé ici depuis la base (règle indépendante du moteur).
 */
const fmt = (minor: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(minor / 100);

async function expectedTtc(variant: string, depthMm: number, widthMm: number): Promise<number | null> {
  const cell = await publicCell("sevilla", variant, depthMm, widthMm, { widthMm: 1500, dimMm: 2000 });
  if (cell == null) return null;
  const rounding = (await one<{ r: string }>(`SELECT l."saleRounding" AS r FROM "SupplierPriceList" l WHERE ${IN_FORCE_GRID_SQL} AND l."familySlug" = 'sevilla' AND l."variantKey" = $1 LIMIT 1`, [variant]))?.r === "NEAREST_99_TTC";
  const ttc0 = cell + Math.floor((cell * 2000 + 5000) / 10_000);
  const lower = Math.floor((ttc0 - 9900) / 10_000) * 10_000 + 9900;
  return rounding && ttc0 >= 9900 ? (lower + 10_000 - ttc0 <= ttc0 - lower ? lower + 10_000 : lower) : ttc0;
}

for (const [pose, variant] of [[/Adossée/, "murale"], [/Autoportante/, "autoportante"]] as const) {
  test(`HelioLux ${variant} 1,5 × 2 m : tranche supérieure, cotes réelles conservées, devis tracé`, async ({ page, browser }) => {
    await openConfigurator(page, "sevilla");
    await goStep(page, "pose");
    await page.getByRole("radio", { name: pose }).check();
    await chooseFabric(page, "Toile PVC blanche (602N opaque)");
    await goStep(page, "dims");
    await setDim(page, "dim-width", 1500);
    await setDim(page, "dim-depth", 2000);
    await setDim(page, "dim-height", 2500);
    // domaine technique respecté : aucun blocage de dimension
    await expect(page.getByTestId("step-dims")).not.toContainText("Avancée : de");
    await expect(page.locator("#dim-depth")).toHaveValue("2000");
    const price = page.getByTestId("system-price");
    const priced = await publicPricesActive();
    const expected = priced ? await expectedTtc(variant, 2000, 1500) : null;
    if (expected == null) {
      // sans grille de vente active (CI) : jamais « hors grille » pour une cote admissible
      await expect(price).not.toHaveAttribute("data-price-status", "out_of_grid");
      return;
    }
    await expect(price).toHaveAttribute("data-priced", "true");
    await expect(page.getByTestId("system-price-amount")).toHaveText(new RegExp(`${fmt(expected).replace(/\s/g, "\\s")}\\s?€\\s?TTC`));
    await expect(page.getByTestId("system-price-tier")).toHaveText("Tarif calculé selon la tranche de dimensions supérieure.");
    // la tranche facturée (3 m) n'est jamais affichée au client
    await expect(price).not.toContainText("3 m");
    await goStep(page, "recap");
    await expect(page.getByTestId("system-recap")).toContainText("2 m");
    await shot(page, `tranche-heliolux-${variant}`);
    const number = await fillQuote(page, `tranche-${uid()}@test.invalid`);
    // détail administrateur : cotes réelles, tranche facturée, règle et source
    const admin = await browser.newPage();
    await loginAdmin(admin, `/admin/devis?q=${number}`);
    await admin.getByRole("link", { name: number }).first().click();
    const tier = admin.getByTestId("quote-billed-tier");
    await expect(tier).toContainText("Cotes réelles : 1500 × 2000 mm");
    await expect(tier).toContainText("× avancée 3000 mm");
    await expect(tier).toContainText("première tranche");
    await expect(tier).toContainText("source :");
    await admin.close();
  });
}

test("HelioLux : la plus petite configuration (prix d'appel) s'ouvre par « Configurer » et retrouve le même montant", async ({ page }) => {
  test.skip(!(await publicPricesActive()), "aucune grille de vente active");
  await page.goto("/pergolas/sevilla");
  const from = page.getByTestId("from-price");
  await expect(from).toBeVisible();
  const amount = (await from.locator("strong").textContent())!.replace(/[  ]/g, " ").trim();
  await expect(page.getByTestId("entry-config")).toContainText("1,50 m × 2 m");
  await page.goto("/configurateur/sevilla?depart=1");
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await expect(page.locator("#dim-depth")).toHaveValue("2000");
  const shown = (await page.getByTestId("system-price-amount").textContent())!.replace(/[  ]/g, " ").trim();
  expect(shown).toBe(amount);
});
