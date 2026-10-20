import { test, expect } from "./fixtures";
import { many, one, runMailWorkerOnce } from "./db";
import { acceptNecessaryOnly, shot, uid } from "./helpers";

test("acheter un accessoire seul après vérification de compatibilité", async ({ page }) => {
  await page.goto("/accessoires/store-vertical-zip");
  await acceptNecessaryOnly(page);
  await page.getByLabel("Ma pergola").selectOption("pergola-solis-pro");
  await page.getByLabel("Dimension").selectOption("4x4");
  await page.getByLabel("Finition de la pergola").selectOption("WHITE");
  await page.getByLabel("Côté à équiper").selectOption({ label: "Avant — 4 m" });
  await expect(page.getByLabel("Référence compatible")).toContainText("4 m – blanc");
  await page.getByRole("button", { name: "Vérifier la compatibilité" }).click();
  await expect(page.getByText(/^Compatible\./)).toBeVisible();
  await shot(page, "accessoire");
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page.waitForURL(/\/panier/);
  await expect(page.getByText(/Store vertical ZIP 4 m – blanc/).first()).toBeVisible();
});

test("demander un devis sur mesure : persistance et notification", async ({ page }) => {
  await page.goto("/configurateur/sur-mesure");
  await acceptNecessaryOnly(page);
  await page.getByLabel("Largeur (mm)", { exact: true }).fill("3600");
  await page.getByLabel("Longueur (mm)", { exact: true }).fill("5200");
  await page.getByLabel("Avant", { exact: true }).selectOption("paroi-vitree");
  // 3,6 × 5,2 m adossée : zone volontairement sans tarif dans la grille fictive → devis, aucun prix
  await expect(page.getByTestId("custom-price")).toContainText("Pas de prix calculable");
  await expect(page.getByText(/Aucun tarif dans la grille/)).toBeVisible();
  await expect(page.getByText(/€\s*\/\s*m²/)).toHaveCount(0);
  const email = `devis-${uid()}@test.invalid`;
  await page.getByLabel("Prénom").fill("Ana");
  await page.getByLabel("Nom", { exact: true }).fill("Martin");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Code postal du projet").fill("33000");
  await page.getByLabel(/J'accepte/).check();
  await page.getByRole("button", { name: "Envoyer la demande de devis" }).click();
  await expect(page.getByText(/Demande DEV-\d{6}-[A-Z0-9]{6} enregistrée/)).toBeVisible();
  await shot(page, "devis-sur-mesure");
  const quote = await one<{ id: string; kind: string; snapshot: { input: { widthMm: number } } }>('SELECT id, kind, snapshot FROM "Quote" WHERE email = $1 ORDER BY "createdAt" DESC LIMIT 1', [email]);
  expect(quote?.kind).toBe("custom");
  expect(quote?.snapshot.input.widthMm).toBe(3600);
  const mails = await many<{ template: string }>('SELECT template FROM "EmailOutbox" WHERE "toEmail" = $1 OR "dedupeKey" = $2', [email, `quote-admin:${quote!.id}`]);
  expect(mails.map((m) => m.template).sort()).toEqual(["quote-admin-notification", "quote-received"]);
  runMailWorkerOnce();
  const sent = await one<{ status: string }>('SELECT status FROM "EmailOutbox" WHERE "toEmail" = $1', [email]);
  expect(sent?.status).toBe("SENT");
});

test("configurer un store banne avec ses variantes réellement disponibles", async ({ page }) => {
  await page.goto("/configurateur/store-banne");
  await acceptNecessaryOnly(page);
  const widths = page.getByTestId("awning-widths");
  const projections = page.getByTestId("awning-projections");
  await widths.getByRole("button", { name: "6 m" }).click();
  await expect(projections.getByRole("button", { name: "3 m", pressed: true })).toBeVisible();
  await expect(projections.getByRole("button", { name: "3.5 m" })).toHaveCount(0);
  await widths.getByRole("button", { name: "4 m" }).click();
  await expect(projections.getByRole("button", { name: "3.5 m" })).toBeVisible();
  await projections.getByRole("button", { name: "3.5 m" }).click();
  await page.getByRole("radio", { name: "Plafond" }).check();
  await page.getByRole("checkbox", { name: /Anémomètre/ }).check();
  await page.getByLabel("Code postal de livraison").fill("75011");
  await expect(page.getByText(/3 supports de fixation plafond|2 supports de fixation plafond/)).toBeVisible();
  await expect(page.getByText(/Anémomètre – anthracite/)).toBeVisible();
  await shot(page, "store-banne");
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page.waitForURL(/\/panier/);
  await expect(page.getByTestId("cart-lines").getByText(/Store banne Ombra 4 × 3.5 m/)).toBeVisible();
});

test("sur mesure dans la grille fictive : estimation affichée, jamais d'achat direct", async ({ page }) => {
  await page.goto("/configurateur/sur-mesure");
  await acceptNecessaryOnly(page);
  await page.getByLabel("Largeur (mm)", { exact: true }).fill("3200");
  await page.getByLabel("Longueur (mm)", { exact: true }).fill("4500");
  const price = page.getByTestId("custom-price");
  await expect(price).toContainText("Estimation indicative");
  await expect(price).toContainText("grille fictive");
  await expect(price.getByRole("button", { name: "Ajouter au panier" })).toHaveCount(0);
  await shot(page, "sur-mesure-estimation");
});
