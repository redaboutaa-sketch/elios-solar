import { expect, test } from "@playwright/test";
import { acceptNecessaryOnly, goStep, loginAdmin, shot } from "./helpers";

/** Retours clients des 2026-10-21 et 2026-10-25 : entrée par dessins, lecture de la gamme des stores, options, guides, paiements, rubriques regroupées. */

test("accueil : les quatre familles par leur dessin dès le premier écran, carte entièrement cliquable", async ({ page }) => {
  await page.goto("/");
  await acceptNecessaryOnly(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const cards = page.getByTestId("family-picker").locator(":scope > li");
  await expect(cards).toHaveCount(4);
  const vh = page.viewportSize()!.height;
  for (const key of ["PERGOLAS", "SCREENS", "STORES_BANNES", "MOUSTIQUAIRES"]) {
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
  await expect(page.locator("main").getByRole("heading", { name: /HelioScreen/ }).first()).toBeVisible();
});

test("stores bannes : lecture de la gamme et comparatif des quatre modèles ; options soumises à la motorisation", async ({ page }) => {
  await page.goto("/stores-bannes");
  await acceptNecessaryOnly(page);
  const levels = page.getByTestId("levels");
  await expect(levels.getByRole("heading", { name: "Lire la gamme" })).toBeVisible();
  for (const n of ["Casablanca", "Corsica", "Jamaica", "Madera"]) await expect(levels.getByRole("link", { name: n }).first()).toBeVisible();
  const compare = page.getByTestId("collection-compare");
  await expect(compare.locator("thead th")).toHaveCount(5);
  for (const n of ["Casablanca", "Corsica", "Jamaica", "Madera"]) await expect(compare.locator("thead")).toContainText(n);
  await expect(page.locator("main")).not.toContainText(/\b(Essentiel|Premium)\b|HELIO Azur|HELIO Riviera/);
  await shot(page, "stores-bannes-lecture");
  await page.goto("/configurateur/casablanca");
  await expect(page.getByTestId("packs")).toHaveCount(0);
  await goStep(page, "equip");
  // manivelle : l'automatisme vent-soleil (souhait) exige la motorisation
  await expect(page.getByTestId("prereq-weather_automation")).toContainText("nécessite la motorisation");
  const wish = page.getByTestId("option-wishes").getByRole("checkbox", { name: /Automatisme vent-soleil/ });
  await expect(wish).toBeDisabled();
  await goStep(page, "pose");
  await page.getByLabel("Manœuvre et commande").selectOption("electric");
  await expect(page.locator("#control")).toHaveValue("electric");
  await goStep(page, "equip");
  await expect(wish).toBeEnabled();
  await expect(page.getByTestId("wind-behaviour")).toContainText("se replie");
  await shot(page, "configurateur-store-options");
});

test("guides et installation : synthèses non publiées tant qu'elles ne sont pas validées ; aperçu en administration", async ({ page, browser }) => {
  await page.goto("/guides");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Guides et installation");
  await expect(page.getByTestId("install-guides-pending")).toBeVisible();
  await expect(page.getByTestId("documents-library")).toBeVisible();
  expect((await page.goto("/guides/installation/casablanca-installation"))!.status()).toBe(404);
  expect((await page.request.get("/api/guides/casablanca-installation/pdf")).status()).toBe(404);
  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await loginAdmin(admin, "/admin/guides/casablanca-installation");
  await expect(admin.getByTestId("install-guide")).toContainText("pas une notice officielle");
  await expect(admin.getByTestId("install-guide")).toContainText("2200 mm");
  const pdf = await admin.request.get("/api/guides/casablanca-installation/pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  await shot(admin, "admin-guide-casablanca");
  await ctx.close();
});

test("modes de paiement : rien d'envisagé présenté comme actif ; rubriques sans contenu réel regroupées dans Références", async ({ page }) => {
  await page.goto("/modes-de-paiement");
  const list = page.getByTestId("payment-methods");
  const method = (label: string) => list.locator(":scope > li").filter({ hasText: label });
  await expect(list.locator(":scope > li")).toHaveCount(5);
  // paiement de démonstration : carte et devis accepté simulés ; virement et PayPal / Bancontact envisagés
  await expect(method("Carte bancaire")).toHaveAttribute("data-state", "simulated");
  await expect(method("Paiement d'un devis accepté")).toHaveAttribute("data-state", "simulated");
  await expect(method("Virement bancaire")).toHaveAttribute("data-state", "planned");
  await expect(method("PayPal, Bancontact")).toHaveAttribute("data-state", "planned");
  await expect(method("Paiement en plusieurs fois")).toHaveAttribute("data-state", /^(planned|simulated)$/);
  await expect(list).not.toContainText("Acompte et solde sur devis");
  await expect(list).not.toContainText(/mensualit|gratuit/i);
  for (const [u, hash] of [["/realisations", "realisations"], ["/savoir-faire", "production"]] as const) {
    await page.goto(u);
    await expect(page, u).toHaveURL(new RegExp(`/references#${hash}$`));
    await expect(page.getByTestId(`references-${hash}`)).toBeVisible();
  }
});
