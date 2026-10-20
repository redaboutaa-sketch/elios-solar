import { test, expect } from "./fixtures";
import { configureStandard, shot, uid } from "./helpers";

test("configurer une pergola, équiper un côté, vérifier le total, sauvegarder et recharger", async ({ page }) => {
  await configureStandard(page);
  const recap = page.locator("#recap");
  await expect(recap.getByText(/Paroi vitrée fixe 3 m – anthracite – Gauche/)).toBeVisible();
  await expect(recap.getByText(/Livraison France/)).toBeVisible();
  const total = (await recap.getByText(/Total TTC/).locator("..").locator("td").last().textContent())?.trim();
  expect(total).toMatch(/€/);
  await shot(page, "configurateur");
  const title = `Projet ${uid()}`;
  await page.getByLabel("Nom du projet").fill(title);
  await page.getByRole("button", { name: /Sauvegarder le projet/ }).click();
  await expect(page.getByText("Projet enregistré")).toBeVisible();
  const shareAbs = await page.locator("a[href*='/projets/']:not([href$='/pdf'])").first().getAttribute("href");
  expect(shareAbs).toBeTruthy();
  const share = new URL(shareAbs!).pathname;
  await page.goto(share);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText(total!)).toBeVisible();
  await page.getByRole("link", { name: "Ouvrir dans le configurateur" }).click();
  await expect(page.locator("#recap").getByText(/Paroi vitrée fixe 3 m/)).toBeVisible();
  const pdf = await page.request.get(`${share}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
});

test("une combinaison incompatible est refusée avec explication, une inconnue est dirigée vers un devis", async ({ page }) => {
  await page.goto("/configurateur?gamme=pergola-solis&dimension=3x4&finition=BLACK");
  await page.getByRole("button", { name: /^Gauche · 3 m/ }).click();
  const glass = page.getByRole("radio", { name: /Paroi vitrée/ });
  await expect(glass).toBeDisabled();
  await expect(page.getByText(/finition noire/).first()).toBeVisible();
  await page.getByRole("radio", { name: /Store vertical ZIP/ }).check();
  await expect(page.locator("#recap").getByText(/Store vertical ZIP 3 m – noir/)).toBeVisible();
  // inconnue : Solis Max 3x5 + paroi vitrée sur le côté avant (5 m)
  await page.goto("/configurateur?gamme=pergola-solis-max&dimension=3x5&finition=ANTHRACITE");
  await page.getByRole("button", { name: /^Avant · 5 m/ }).click();
  await page.getByRole("radio", { name: /Paroi vitrée/ }).check();
  await expect(page.getByText(/compatibilité non confirmée/i).first()).toBeVisible();
  const addBtn = page.getByRole("button", { name: /Achat impossible en l'état — devis conseillé/ });
  await expect(addBtn).toBeDisabled();
  await page.getByRole("button", { name: "Demander un devis" }).click();
  await expect(page.getByRole("form", { name: "Demande de devis" })).toBeVisible();
});

test("changer de dimension présente les adaptations à confirmer sans supprimer le choix", async ({ page }) => {
  await page.goto("/configurateur?gamme=pergola-solis&dimension=4x6&finition=ANTHRACITE");
  await page.getByRole("button", { name: /^Arrière – segment 2 · 3 m/ }).click();
  await page.getByRole("radio", { name: /Persienne aluminium/ }).check();
  await page.getByRole("button", { name: "3 × 4 m" }).click();
  await expect(page.getByRole("region", { name: "Adaptations à confirmer" })).toBeVisible();
  await page.getByRole("region", { name: "Adaptations à confirmer" }).getByLabel("Reporter sur une autre ouverture").selectOption({ label: "Gauche (3 m)" });
  await expect(page.locator("#recap").getByText(/Persienne aluminium 3 m .* Gauche/)).toBeVisible();
});
