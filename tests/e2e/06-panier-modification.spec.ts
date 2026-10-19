import { test, expect } from "@playwright/test";
import { configureStandard, shot } from "./helpers";

test("modifier une configuration depuis le panier remplace la ligne sans la dupliquer", async ({ page }) => {
  await configureStandard(page);
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page.waitForURL(/\/panier/);
  await expect(page.getByText(/Pergola Solis 3 × 4 m · Anthracite · autoportée/)).toHaveCount(1);
  await page.getByRole("link", { name: "Modifier la configuration" }).click();
  await page.waitForURL(/\/configurateur\?ligne=/);
  await expect(page.getByRole("heading", { name: "Modifier votre configuration" })).toBeVisible();
  // la fermeture existante est bien reprise
  await expect(page.locator("#recap").getByText(/Paroi vitrée fixe 3 m/)).toBeVisible();
  await page.getByRole("button", { name: "4 × 4 m" }).click();
  await page.getByTestId("price-confirmation").getByText("Prix confirmé par le serveur").waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Mettre à jour le panier" }).click();
  await page.waitForURL(/\/panier$/);
  const lines = page.getByTestId("cart-lines");
  await expect(lines.getByText(/Pergola Solis 4 × 4 m · Anthracite · autoportée/)).toHaveCount(1);
  await expect(lines.getByText(/Pergola Solis 3 × 4 m/)).toHaveCount(0);
  await expect(lines.getByText(/Paroi vitrée fixe 4 m/)).toHaveCount(1);
  await shot(page, "panier-modifie");
});

test("éclairage inclus sur la gamme Pro : choix de couleur sans supplément", async ({ page }) => {
  await page.goto("/configurateur?gamme=pergola-solis-pro&dimension=3x4&finition=ANTHRACITE");
  await expect(page.getByText("inclus avec Pergola Solis Pro").first()).toBeVisible();
  await page.getByRole("button", { name: "RGB" }).click();
  await expect(page.locator("#recap").getByText(/Éclairage LED de gouttière \(inclus\) – .*RGB/)).toBeVisible();
  await expect(page.locator("#recap").getByText(/Éclairage LED de gouttière \(inclus\)/)).toHaveCount(1);
  await shot(page, "led-incluse");
});
