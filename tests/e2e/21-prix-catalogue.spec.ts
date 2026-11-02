import { expect, test } from "@playwright/test";
import { acceptNecessaryOnly, fillQuote, loginAdmin, uid } from "./helpers";

/**
 * Prix affichés depuis l'administration (circuit du 2026-11-02) : grille de vente créée et modifiée (cellule +
 * supplément en pourcentage), simulation A / B / C / D, vérification et publication, configurateur (prix HT et TTC,
 * détail du supplément, récapitulatif), demande de devis (décomposition figée), puis désactivation : aucun tarif de
 * test ne reste en vigueur. Produit : HelioLux (aucune grille de vente publiée en recette), pose adossée.
 * Montants fictifs.
 */
test("administration → modification → simulation → publication → configurateur → devis", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop", "parcours d'écriture : une seule fois par campagne");
  test.setTimeout(180_000);
  await loginAdmin(page, "/admin/tarifs");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Créer le brouillon" }) });
  await form.getByLabel("Produit").selectOption("sevilla");
  await form.getByLabel(/Variante/).fill("murale");
  await form.getByLabel("Libellé").fill(`Grille e2e ${uid()}`);
  await form.getByLabel("Nature").selectOption("SALE");
  await form.getByLabel("Axe principal").selectOption("projection");
  await form.getByRole("button", { name: "Créer le brouillon" }).click();
  await expect(page.getByText(/Grille créée/)).toBeVisible();
  const gridUrl = page.url();
  await page.getByLabel("Devise (ISO)").fill("EUR");
  await page.getByLabel("Montants").selectOption("HT");
  await page.getByLabel(/Taux de TVA/).fill("20");
  await page.getByLabel("Lecture des cotes").selectOption("ROUND_UP");
  await page.getByLabel(/Justification de la lecture/).fill("Décision écrite du client (recette)");
  await page.getByRole("button", { name: "Enregistrer les paramètres" }).click();
  await expect(page.getByText(/Paramètres enregistrés/)).toBeVisible();
  // une cellule 3,00 m × 3,00 m
  await page.getByLabel(/Nouvelle ligne/).fill("3000");
  await page.getByRole("button", { name: "Ajouter la ligne" }).click();
  await page.getByLabel(/Nouvelle colonne : largeur min/).fill("3000");
  await page.getByRole("button", { name: "Ajouter la colonne" }).click();
  await page.getByRole("button", { name: /non tarifée, ajouter un prix/ }).click();
  await page.getByTestId("tariff-matrix").locator("td input:not([type=checkbox])").first().fill("1000");
  await page.getByTestId("save-cells").click();
  await expect(page.getByText(/1 ajoutée/)).toBeVisible();
  // supplément : autre teinte RAL, 15 % du prix de la structure
  const fixed = page.getByRole("table", { name: "Suppléments et tarifs fixes" });
  const first = fixed.getByRole("row").nth(1);
  await first.getByLabel("Code").fill("ral");
  await first.getByLabel("Libellé").fill("Autre teinte RAL");
  await first.getByLabel("Mode").selectOption("percent");
  await first.getByLabel("Pourcentage").fill("15");
  await first.getByLabel("Cible").fill("finition:RAL_CUSTOM");
  await page.getByTestId("save-fixed").click();
  await expect(page.getByText(/1 tarif\(s\) fixe\(s\) enregistré\(s\)/)).toBeVisible();

  // simulation du brouillon (2,90 m × 2,90 m → cellule supérieure), teinte RAL : C = 1 000 + 15 % = 1 150 ; D = 1 380
  const draftId = gridUrl.split("/").pop()!.split("?")[0]!;
  await page.goto(`/admin/tarifs/simulateur?produit=sevilla&pose=wall&largeur=2900&cote=2900&version=${draftId}&teinte=RAL_CUSTOM`);
  await expect(page.getByTestId("sim-sale-ht")).toHaveText(/1\s?150,00\s?(€|EUR)/);
  await expect(page.getByTestId("sim-sale-ttc")).toHaveText(/1\s?380,00\s?(€|EUR)/);
  await expect(page.getByTestId("sim-natures")).toContainText("remise revendeur non communiquée");

  // vérification et publication
  await page.goto(gridUrl);
  await page.getByTestId("verify-grid").click();
  await expect(page.getByText(/Grille vérifiée/)).toBeVisible();
  await page.getByTestId("publish-form").getByRole("button", { name: "Publier" }).click();
  await expect(page.getByText(/Grille publiée/)).toBeVisible();

  try {
    // configurateur (visiteur) : prix HT et TTC ; la teinte RAL ajoute le supplément détaillé
    const ctx = await browser.newContext();
    const v = await ctx.newPage();
    await v.goto("/configurateur/sevilla");
    await acceptNecessaryOnly(v);
    await v.locator("#dim-width").fill("2900"); await v.locator("#dim-width").blur();
    await v.locator("#dim-depth").fill("2900"); await v.locator("#dim-depth").blur();
    const price = v.getByTestId("system-price");
    await expect(price).toHaveAttribute("data-priced", "true");
    await expect(v.getByTestId("system-price-amount")).toHaveText(/1\s?000\s?€\s?HT/);
    await expect(v.getByTestId("system-price-ttc")).toContainText(/1\s?200\s?€/);
    await v.getByTestId("config-steps").getByRole("button", { name: /Pose et finitions/ }).click();
    await v.getByTestId("finish-swatches").locator('[data-finish="RAL_CUSTOM"] input').check();
    await expect(v.getByTestId("system-price-amount")).toHaveText(/1\s?150\s?€\s?HT/);
    await expect(v.getByTestId("price-breakdown")).toContainText("Autre teinte RAL");
    // cote hors grille : plus aucun montant
    await v.getByTestId("config-steps").getByRole("button", { name: /Dimensions/ }).click();
    await v.locator("#dim-width").fill("3500"); await v.locator("#dim-width").blur();
    await expect(price).toHaveAttribute("data-priced", "false");
    await expect(price).not.toContainText("€");
    await v.locator("#dim-width").fill("2900"); await v.locator("#dim-width").blur();
    await expect(price).toHaveAttribute("data-priced", "true");
    // récapitulatif et devis : décomposition figée
    await v.getByTestId("config-steps").getByRole("button", { name: /Récapitulatif et devis/ }).click();
    const number = await fillQuote(v, `e2e-prix-${uid()}@example.invalid`);
    expect(number).toMatch(/^DEV-/);
    await ctx.close();
    await page.goto(`/admin/devis?q=${number}`);
    await page.getByRole("link", { name: number }).first().click();
    await expect(page.getByTestId("quote-breakdown")).toContainText(/total 1\s?150\s?€\s?HT/);
  } finally {
    // aucun tarif de test ne reste en vigueur
    await page.goto(gridUrl);
    await page.getByTestId("deactivate-grid").click();
    await expect(page.getByText(/Version désactivée/)).toBeVisible();
  }
});
