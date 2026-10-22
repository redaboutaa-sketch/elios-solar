import { test, expect } from "./fixtures";
import { loginAdmin, shot } from "./helpers";

test("administration HELIOSTORES : familles du catalogue, tarifs fournisseur privés, aucune fuite vers la boutique", async ({ page }) => {
  await loginAdmin(page);
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  await page.goto("/admin/catalogue/familles");
  await expect(page.getByRole("heading", { name: "Familles de produits" })).toBeVisible();
  for (const n of ["HELIO Horizon", "HELIO Panorama", "HELIO Ombra", "HELIO Riviera", "HELIO Verrière"]) await expect(page.getByRole("main")).toContainText(n);
  await shot(page, "admin-familles");

  await page.goto("/admin/catalogue/tarifs-fournisseur");
  await expect(page.getByRole("heading", { name: "Tarifs fournisseur (privé)" })).toBeVisible();
  await expect(page.getByText(/Prix publics : colonne « Prix final HELIOSTORES »/)).toBeVisible();
  await shot(page, "admin-tarifs-fournisseur");

  // la boutique ne lit jamais ces données : ni montant, ni page d'administration accessible sans session
  const anon = await page.context().browser()!.newContext();
  const r = await anon.request.get("/admin/catalogue/tarifs-fournisseur", { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(r.status());
  await anon.close();
});
