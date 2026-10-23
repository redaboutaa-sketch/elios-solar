import { expect, test } from "@playwright/test";
import { acceptNecessaryOnly, loginAdmin, shot } from "./helpers";

/** Retour client du 2026-10-21 : entrée par dessins, niveaux de stores, options, guides, paiements, rubriques masquées. */

test("accueil : les trois familles par leur dessin dès le premier écran, carte entièrement cliquable", async ({ page }) => {
  await page.goto("/");
  await acceptNecessaryOnly(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const cards = page.getByTestId("family-picker").locator("li");
  await expect(cards).toHaveCount(3);
  const vh = page.viewportSize()!.height;
  for (const key of ["PERGOLAS", "SCREENS", "STORES_BANNES"]) {
    const card = page.getByTestId(`home-${key}`);
    await expect(card.locator("svg.panel-sketch")).toBeVisible();
    const box = (await card.boundingBox())!;
    expect(box.y + box.height, key).toBeLessThanOrEqual(vh + 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await shot(page, "accueil-dessins");
  // toute la carte mène à la collection (clic au centre du dessin)
  const sketch = (await page.getByTestId("home-SCREENS").locator("svg.panel-sketch").boundingBox())!;
  await page.mouse.click(sketch.x + sketch.width / 2, sketch.y + sketch.height / 2);
  await expect(page).toHaveURL(/\/screens$/);
  await expect(page.locator("main").getByRole("heading", { name: /HELIO Ombra/ }).first()).toBeVisible();
});

test("stores bannes : niveaux Essentiel et Confort du même store, Premium en préparation ; options avec prérequis", async ({ page }) => {
  await page.goto("/stores-bannes");
  await acceptNecessaryOnly(page);
  const levels = page.getByTestId("levels");
  await expect(levels).toContainText("Essentiel");
  await expect(levels).toContainText("Confort");
  await expect(levels).toContainText("en préparation");
  await expect(page.locator("body")).not.toContainText(/HELIO Azur|Corsica/i);
  await page.goto("/configurateur/helio-riviera");
  const packs = page.getByTestId("packs");
  await expect(packs.getByRole("radio", { name: /Essentiel/ })).toBeChecked();
  await expect(packs.getByRole("radio", { name: /Premium/ })).toBeDisabled();
  // Essentiel (manivelle) : l'automatisme vent-soleil exige la motorisation
  await expect(page.getByTestId("prereq-weather_automation")).toContainText("nécessite la motorisation");
  await expect(page.getByRole("checkbox", { name: /HELIO Vent/ })).toBeDisabled();
  await packs.getByRole("radio", { name: /Confort/ }).check();
  await expect(page.locator("#control")).toHaveValue("electric");
  await expect(page.getByRole("checkbox", { name: /HELIO Vent/ })).toBeEnabled();
  await expect(page.getByTestId("wind-behaviour")).toContainText("se replie");
  await shot(page, "configurateur-store-niveaux");
});

test("guides et installation : synthèses non publiées tant qu'elles ne sont pas validées ; aperçu en administration", async ({ page, browser }) => {
  await page.goto("/guides");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Guides et installation");
  await expect(page.getByTestId("install-guides-pending")).toBeVisible();
  expect((await page.goto("/guides/installation/helio-riviera-installation"))!.status()).toBe(404);
  expect((await page.request.get("/api/guides/helio-riviera-installation/pdf")).status()).toBe(404);
  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await loginAdmin(admin, "/admin/guides/helio-riviera-installation");
  await expect(admin.getByTestId("install-guide")).toContainText("pas une notice officielle");
  await expect(admin.getByTestId("install-guide")).toContainText("2200 mm");
  const pdf = await admin.request.get("/api/guides/helio-riviera-installation/pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  await shot(admin, "admin-guide-riviera");
  await ctx.close();
});

test("modes de paiement : rien d'envisagé présenté comme actif ; rubriques sans contenu réel masquées", async ({ page }) => {
  await page.goto("/modes-de-paiement");
  const list = page.getByTestId("payment-methods");
  await expect(list).toContainText("Acompte et solde sur devis");
  await expect(list.locator("li").filter({ hasText: "Virement" })).toHaveAttribute("data-state", "planned");
  await expect(list).not.toContainText(/\d+\s?%|mensualit|gratuit/i);
  for (const u of ["/realisations", "/savoir-faire"]) expect((await page.goto(u))!.status(), u).toBe(404);
});
