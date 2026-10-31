import { test, expect } from "./fixtures";
import { loginAdmin, shot } from "./helpers";

test("administration HELIOSTORES : familles du catalogue, tarifs fournisseur privés, aucune fuite vers la boutique", async ({ page }) => {
  await loginAdmin(page);
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  await page.goto("/admin/catalogue/familles");
  await expect(page.getByRole("heading", { name: "Familles de produits" })).toBeVisible();
  // nomenclature du 2026-10-25 : quatre familles et leurs modèles (les modèles retirés restent listés pour l'historique)
  for (const n of ["HelioSky", "HelioMax", "HelioLux", "HelioScreen", "HelioRoof", "HelioSun", "HelioShade", "HelioPro", "HelioSquare", "MoskiFold", "MoskiFold 2", "MoskiUp", "MoskiSlide", "MoskiFix"]) await expect(page.getByRole("main")).toContainText(n);
  await shot(page, "admin-familles");

  await page.goto("/admin/catalogue/tarifs-fournisseur");
  await expect(page.getByRole("heading", { name: "Fichiers de tarifs importés (privé)" })).toBeVisible();
  await expect(page.getByText(/Les prix du site ne sont plus lus ici/)).toBeVisible();
  await shot(page, "admin-tarifs-fournisseur");

  // la boutique ne lit jamais ces données : ni montant, ni page d'administration accessible sans session
  const anon = await page.context().browser()!.newContext();
  const r = await anon.request.get("/admin/catalogue/tarifs-fournisseur", { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(r.status());
  await anon.close();
});
