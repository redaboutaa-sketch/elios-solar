import { test, expect } from "@playwright/test";
import { configureStandard, fillCheckout, shot, uid } from "./helpers";

test("commander en test et retrouver la configuration dans la commande", async ({ page }) => {
  await configureStandard(page);
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page.waitForURL(/\/panier/);
  await expect(page.getByText(/Pergola Solis 3 × 4 m · Anthracite · autoportée/)).toBeVisible();
  await expect(page.getByText(/Paroi vitrée fixe 3 m/)).toBeVisible();
  await shot(page, "panier");
  const total = (await page.locator("dd").filter({ hasText: "€" }).last().textContent())?.trim();
  await page.getByRole("link", { name: "Passer la commande" }).click();
  await page.waitForURL(/\/commande$/);
  const email = `client-${uid()}@test.invalid`;
  await fillCheckout(page, email);
  await page.getByRole("button", { name: /paiement simulé/ }).click();
  await page.waitForURL(/paiement-demo/);
  await expect(page.getByText("PAIEMENT SIMULÉ — MODE TEST")).toBeVisible();
  await shot(page, "paiement-demo");
  await page.getByRole("button", { name: "Simuler un paiement accepté" }).click();
  await page.waitForURL(/confirmation/);
  await expect(page.getByRole("heading", { name: /commande est confirmée/ })).toBeVisible();
  await expect(page.getByText(/Paroi vitrée fixe 3 m/)).toBeVisible();
  if (total) await expect(page.getByText(total).first()).toBeVisible();
  await expect(page.getByText("Commande de démonstration")).toBeVisible();
});

test("un paiement refusé laisse la commande non payée", async ({ page }) => {
  await configureStandard(page);
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page.waitForURL(/\/panier/);
  await page.getByRole("link", { name: "Passer la commande" }).click();
  await fillCheckout(page, `refus-${uid()}@test.invalid`);
  await page.getByRole("button", { name: /paiement simulé/ }).click();
  await page.waitForURL(/paiement-demo/);
  await page.getByRole("button", { name: "Simuler un refus" }).click();
  await page.waitForURL(/annulation/);
  await expect(page.getByText(/PAYMENT_FAILED/)).toBeVisible();
});
