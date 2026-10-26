import { test, expect } from "./fixtures";
import { acceptNecessaryOnly, fillCheckout, goStep, openConfigurator, setDim, shot, uid } from "./helpers";
import { IN_FORCE_GRID_SQL, one, publicPricesActive } from "./db";

const fmt = (minor: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(minor / 100);
const norm = (s: string | null) => (s ?? "").replace(/[\u00a0\u202f]/g, " ");

test("Casablanca structure seule : commande en ligne au prix de la grille, paiement simulé ; avec option, choix à confirmer ou pose, devis seulement", async ({ page }) => {
  await openConfigurator(page, "casablanca");
  const order = page.getByTestId("online-order");
  if (!(await publicPricesActive())) {
    // sans grille active (CI) : aucune commande en ligne, motif affiché
    await goStep(page, "recap");
    await expect(order).toHaveAttribute("data-orderable", "false");
    await expect(order).toContainText("ne figurent pas dans la grille");
    await expect(page.getByTestId("add-to-cart")).toHaveCount(0);
    return;
  }
  // cellule de la grille active : avancée fabriquée, largeur de la plage compatible avec la largeur minimale du modèle
  const cell = await one<{ dimAmm: number; widthMinMm: number; widthMaxMm: number; amountMinor: number }>(`SELECT r."dimAmm", r."widthMinMm", r."widthMaxMm", r."amountMinor" FROM "SupplierPriceRow" r JOIN "SupplierPriceList" l ON l.id = r."listId" WHERE ${IN_FORCE_GRID_SQL} AND l."dimRule" = 'EXACT' AND r.kind = 'GRID' AND r."familySlug" = 'casablanca' AND r."variantKey" = '' AND r.status <> 'REJECTED' AND r."amountMinor" IS NOT NULL AND r."dimAmm" IN (1600, 2100) AND r."widthMaxMm" >= 2000 AND r."widthMinMm" <= 6000 ORDER BY r."dimAmm", r."widthMinMm" LIMIT 1`);
  expect(cell).not.toBeNull();
  const width = Math.max(2000, cell!.widthMinMm);
  await setDim(page, "dim-width", width);
  await page.getByTestId("dim-depth-values").getByText(`${(cell!.dimAmm / 1000).toLocaleString("fr-FR")} m`, { exact: true }).click();
  await expect(page.getByTestId("system-price-amount")).toHaveText(new RegExp(fmt(cell!.amountMinor).replace(/\s/g, "\\s")));
  await goStep(page, "recap");
  await expect(order).toHaveAttribute("data-orderable", "true");

  // commande électrique à confirmer, puis option : commande en ligne indisponible (chiffrées au devis)
  await goStep(page, "pose");
  await page.getByLabel("Manœuvre et commande").selectOption({ label: "Motorisation électrique (moteur à définir) — à confirmer" });
  await goStep(page, "equip");
  await page.getByTestId("option-remote_control").getByRole("checkbox").check();
  await goStep(page, "recap");
  await expect(order).toHaveAttribute("data-orderable", "false");
  await expect(order).toContainText("les options sont chiffrées au devis");
  await expect(order).toContainText("un choix est à confirmer au devis");
  await goStep(page, "equip");
  await page.getByTestId("option-remote_control").getByRole("checkbox").uncheck();
  await page.getByLabel("Pose professionnelle souhaitée").check();
  await goStep(page, "pose");
  await page.getByLabel("Manœuvre et commande").selectOption({ label: "Manuelle — manivelle 150 cm" });
  await goStep(page, "recap");
  await expect(order).toContainText("la pose professionnelle est chiffrée au devis");
  await goStep(page, "equip");
  await page.getByLabel("Pose professionnelle souhaitée").uncheck();
  await goStep(page, "recap");
  await expect(order).toHaveAttribute("data-orderable", "true");

  await page.getByTestId("add-to-cart").click();
  await page.waitForURL(/\/panier/);
  await expect(page.getByTestId("cart-lines")).toContainText("Casablanca");
  expect(norm(await page.getByTestId("cart-line-ht").textContent())).toContain(`${norm(fmt(cell!.amountMinor))} € HT`);
  await expect(page.getByTestId("cart-delivery-not-included")).toContainText("non comprises");
  await expect(page.getByTestId("cart-system-note")).toContainText("Livraison et pose non comprises");
  await expect(page.getByLabel("Code promotionnel")).toHaveCount(0);
  await shot(page, "panier-systeme");

  await page.getByRole("link", { name: "Passer la commande" }).click();
  await page.waitForURL(/\/commande$/);
  // particulier ou professionnel (le paiement en plusieurs fois est réservé aux particuliers)
  await expect(page.getByRole("radio", { name: "Particulier" })).toBeChecked();
  await page.getByRole("radio", { name: "Professionnel" }).check();
  await expect(page.getByRole("radio", { name: "Professionnel" })).toBeChecked();
  await page.getByRole("radio", { name: "Particulier" }).check();
  await fillCheckout(page, `systeme-${uid()}@test.invalid`);
  await page.getByRole("button", { name: /paiement simulé/ }).click();
  await page.waitForURL(/paiement-demo/);
  await expect(page.getByText("PAIEMENT SIMULÉ — MODE TEST")).toBeVisible();
  await page.getByRole("button", { name: "Simuler un paiement accepté" }).click();
  await page.waitForURL(/confirmation/);
  await expect(page.getByRole("heading", { name: /commande est confirmée/ })).toBeVisible();
  await expect(page.getByTestId("order-delivery-not-included")).toBeVisible();
  await expect(page.getByText("Commande de démonstration")).toBeVisible();
  await shot(page, "commande-systeme-confirmation");
});

test("rubriques sans contenu réel : Showroom, Références et Réalisations masqués (404) ; pages provisoires signalées", async ({ page }) => {
  for (const u of ["/showroom", "/references", "/realisations"]) expect((await page.goto(u))?.status(), u).toBe(404);
  await page.goto("/cgv");
  await acceptNecessaryOnly(page);
  await expect(page.getByText(/Document provisoire/)).toBeVisible();
  await expect(page.locator("main")).toContainText("hors taxes");
  await expect(page.locator("main")).not.toContainText(/ELIOS SOLAR/i);
});
