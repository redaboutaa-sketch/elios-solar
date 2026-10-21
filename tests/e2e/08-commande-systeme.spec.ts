import { test, expect, type Page } from "./fixtures";
import { acceptNecessaryOnly, fillCheckout, shot, uid } from "./helpers";
import { one, publicPricesActive } from "./db";

async function setDim(page: Page, id: string, value: number) {
  const input = page.locator(`#${id}`);
  await input.fill(String(value));
  await input.blur();
}

const fmt = (minor: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(minor / 100);
const norm = (s: string | null) => (s ?? "").replace(/[  ]/g, " ");

test("SB400 structure seule : commande en ligne au prix de la grille, paiement simulé ; avec option, devis seulement", async ({ page }) => {
  await page.goto("/configurateur/pergola-sb400");
  await acceptNecessaryOnly(page);
  const order = page.getByTestId("online-order");
  if (!(await publicPricesActive())) {
    // sans grille active (CI) : aucune commande en ligne, motif affiché
    await expect(order).toHaveAttribute("data-orderable", "false");
    await expect(order).toContainText("ne figurent pas dans la grille");
    await expect(page.getByTestId("add-to-cart")).toHaveCount(0);
    return;
  }
  // cellule murale de la grille active couvrant une cote exacte du configurateur (pas de 20 cm dès 1,4 m, largeur ≤ 4 m)
  const cell = await one<{ dimAmm: number; widthMaxMm: number; amountMinor: number }>(`SELECT r."dimAmm", r."widthMaxMm", r."amountMinor" FROM "SupplierPriceRow" r JOIN "SupplierPriceList" l ON l.id = r."listId" WHERE l."sourceKey" = 'xlsx-situation-des-tarif' AND l.status = 'ACTIVE' AND r."amountRole" = 'PRIX_FINAL' AND r.kind = 'GRID' AND r."familySlug" = 'pergola-sb400' AND r."variantKey" = 'murale' AND r.status <> 'REJECTED' AND r."widthMinMm" = r."widthMaxMm" AND r."widthMaxMm" <= 4000 AND (r."dimAmm" - 1400) % 200 = 0 AND r."dimAmm" <= 7000 ORDER BY r."dimAmm", r."widthMaxMm" LIMIT 1`);
  expect(cell).not.toBeNull();
  await setDim(page, "dim-width", cell!.widthMaxMm);
  await setDim(page, "dim-depth", cell!.dimAmm);
  await page.getByRole("radio", { name: /Murale/ }).check();
  await expect(page.getByTestId("system-price-amount")).toHaveText(new RegExp(fmt(cell!.amountMinor).replace(/\s/g, "\\s")));
  await expect(order).toHaveAttribute("data-orderable", "true");

  // une option rend la commande en ligne indisponible (options chiffrées au devis)
  const firstOption = page.getByTestId("system-configurator").locator('section[aria-labelledby="equip-title"] input[type="checkbox"]').first();
  await firstOption.check();
  await expect(order).toHaveAttribute("data-orderable", "false");
  await expect(order).toContainText("options sont chiffrées au devis");
  await firstOption.uncheck();
  await expect(order).toHaveAttribute("data-orderable", "true");

  await page.getByTestId("add-to-cart").click();
  await page.waitForURL(/\/panier/);
  await expect(page.getByTestId("cart-lines")).toContainText("SB400");
  expect(norm(await page.getByTestId("cart-line-ht").textContent())).toContain(`${norm(fmt(cell!.amountMinor))} € HT`);
  await expect(page.getByTestId("cart-delivery-not-included")).toContainText("non comprises");
  await expect(page.getByTestId("cart-system-note")).toContainText("Livraison et pose non comprises");
  await expect(page.getByLabel("Code promotionnel")).toHaveCount(0);
  await shot(page, "panier-systeme");

  await page.getByRole("link", { name: "Passer la commande" }).click();
  await page.waitForURL(/\/commande$/);
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

test("rubriques sans contenu réel : Réalisations et Showroom masquées (404) ; pages provisoires signalées", async ({ page }) => {
  for (const path of ["/realisations", "/showroom"]) expect((await page.goto(path))?.status(), path).toBe(404);
  await page.goto("/cgv");
  await acceptNecessaryOnly(page);
  await expect(page.getByText(/Document provisoire/)).toBeVisible();
  await expect(page.locator("main")).toContainText("hors taxes");
  await expect(page.locator("main")).not.toContainText(/ELIOS SOLAR/i);
});
