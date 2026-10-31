import { expect, test } from "@playwright/test";
import { createAccount, loginAdmin, shot, uid } from "./helpers";

/**
 * Écran Tarifs (administrateurs) : consultation des grilles importées, modification d'une cellule dans un nouveau
 * brouillon, comparaison, simulation, publication d'une grille de test complète puis désactivation, refus d'une
 * grille incomplète, refus d'accès aux visiteurs et aux clients.
 * Aucun tarif de test ne reste actif : le brouillon modifié est rejeté, la grille de test (variante propre au test,
 * qui ne correspond à aucune pose du modèle, donc jamais affichée) est désactivée.
 */

test("consultation des grilles importées", async ({ page }) => {
  await loginAdmin(page, "/admin/tarifs");
  await expect(page.getByRole("heading", { level: 1, name: "Tarifs" })).toBeVisible();
  // grilles importées du classeur (préproduction, dev) ; sans import (CI) : produits listés, aucun tarif en vigueur
  const list = page.getByTestId("tariff-list");
  // grilles existantes rattachées à HelioSun et HelioScreen (nouveaux modèles : aucune grille, prix sur devis)
  const imported = (await list.getByRole("row").filter({ hasText: "Prix final" }).filter({ hasText: "HelioSun" }).count()) > 0;
  if (imported) await expect(list).toContainText("HelioScreen");
  await expect(page.getByTestId("tariff-counts")).toBeVisible();
  const products = page.getByRole("table", { name: "Produits et tarif de vente en vigueur" });
  for (const n of ["HelioSun", "HelioScreen", "HelioMax", "MoskiFold"]) await expect(products).toContainText(n);
  await shot(page, "admin-tarifs");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("modifier une cellule (nouveau brouillon), comparer, simuler, puis rejeter le brouillon", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "parcours d'écriture : une seule fois par campagne");
  // grille de vente importée, en vigueur ou désactivée (le 2026-10-26, HelioScreen est passé sur devis : grille désactivée)
  await loginAdmin(page, "/admin/tarifs?produit=helioscreen&nature=SALE");
  const row = page.getByTestId("tariff-list").getByRole("row").filter({ hasText: "HelioScreen" }).filter({ hasText: "Prix final" });
  test.skip((await row.count()) === 0, "aucune grille importée du classeur (base CI sans import) : parcours couvert par les tests d'intégration des grilles");
  await row.first().getByRole("link").first().click();
  await expect(page.getByTestId("tariff-matrix")).toBeVisible();
  // origine d'une cellule importée
  await page.getByTestId("tariff-matrix").locator("td button").first().click();
  await expect(page.getByTestId("cell-origin")).toContainText(/SITUATION DES TARIF\.xlsx|Saisie|Recalcul/);
  await page.getByTestId("restore-grid").click();
  await expect(page.getByText(/Brouillon v\d+ créé/)).toBeVisible();
  const draftUrl = page.url();
  const draftId = draftUrl.split("/").pop()!.split("?")[0]!;
  const cell = page.getByTestId("tariff-matrix").locator("td input:not([type=checkbox])").first();
  const label = (await cell.getAttribute("aria-label"))!;
  const before = await cell.inputValue();
  const [euros, cents = "00"] = before.split(",");
  const after = `${Number(euros!.replace(/[\s\u00a0\u202f]/g, "")) + 1},${cents}`;
  await cell.fill(after);
  await page.getByTestId("save-cells").click();
  await expect(page.getByText(/Enregistré : 1 modifiée/)).toBeVisible();
  await expect(page.getByTestId("grid-diff-summary")).toContainText("1 modifiée(s)");
  await shot(page, "admin-tarifs-brouillon");
  // simulateur : la version brouillon est utilisée pour la cote de la cellule modifiée
  const m = label.match(/(\d+(?:,\d+)?) m × largeur (\d+(?:,\d+)?) m/)!;
  const mm = (s: string) => Math.round(Number(s.replace(",", ".")) * 1000);
  await page.goto(`/admin/tarifs/simulateur?produit=helioscreen&pose=facade&largeur=${mm(m[2]!)}&cote=${mm(m[1]!)}&clientele=PARTICULIER&version=${draftId}`);
  await expect(page.getByTestId("sim-versions")).toContainText("simulation seulement");
  const amount = (await page.getByTestId("sim-amount").textContent())!.replace(/[\s  ]/g, "");
  expect(amount).toContain(after.replace(/\s/g, ""));
  await shot(page, "admin-tarifs-simulateur");
  // nettoyage : brouillon rejeté (rien n'est publié)
  await page.goto(draftUrl);
  await page.getByRole("button", { name: "Rejeter le brouillon" }).click();
  await expect(page.getByText("Brouillon rejeté")).toBeVisible();
});

test("grille de test : incomplète refusée, complète publiée puis désactivée", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "parcours d'écriture : une seule fois par campagne");
  await loginAdmin(page, "/admin/tarifs");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Créer le brouillon" }) });
  // HelioMax (sans grille) : variante propre au test, qui ne correspond à aucune pose (murale / autoportante) → jamais affichée
  await form.getByLabel("Produit").selectOption("marbella");
  await form.getByLabel(/Variante/).fill(`e2e-${uid()}`);
  await form.getByLabel("Libellé").fill("Grille de test e2e");
  await form.getByLabel("Nature").selectOption("SALE");
  await form.getByLabel("Axe principal").selectOption("projection");
  await form.getByRole("button", { name: "Créer le brouillon" }).click();
  await expect(page.getByText(/Grille créée/)).toBeVisible();
  await page.getByLabel("Devise (ISO)").fill("EUR");
  await page.getByLabel("Montants").selectOption("HT");
  await page.getByRole("button", { name: "Enregistrer les paramètres" }).click();
  await expect(page.getByText(/Paramètres enregistrés/)).toBeVisible();
  await page.getByLabel(/Nouvelle ligne/).fill("1500");
  await page.getByRole("button", { name: "Ajouter la ligne" }).click();
  await page.getByLabel(/Nouvelle colonne : largeur min/).fill("1000");
  await page.getByRole("button", { name: "Ajouter la colonne" }).click();
  await page.getByRole("button", { name: /non tarifée, ajouter un prix/ }).click();
  await page.getByTestId("save-cells").click();
  await expect(page.getByText(/1 ajoutée/)).toBeVisible();
  // cellule vide : publication refusée
  await page.getByTestId("verify-grid").click();
  await expect(page.getByText(/Vérification refusée.*vide/)).toBeVisible();
  await shot(page, "admin-tarifs-refus");
  await page.getByTestId("tariff-matrix").locator("td input:not([type=checkbox])").first().fill("1234,56");
  await page.getByTestId("save-cells").click();
  await expect(page.getByText(/1 modifiée/)).toBeVisible();
  await page.getByTestId("verify-grid").click();
  await expect(page.getByText(/Grille vérifiée/)).toBeVisible();
  await page.getByTestId("publish-form").getByRole("button", { name: "Publier" }).click();
  await expect(page.getByText(/Grille publiée/)).toBeVisible();
  await expect(page.getByTestId("grid-header")).toContainText("En vigueur");
  await expect(page.getByTestId("grid-history")).toContainText("Publiée");
  // aucun tarif de test ne reste actif
  await page.getByTestId("deactivate-grid").click();
  await expect(page.getByText(/Version désactivée/)).toBeVisible();
  await expect(page.getByTestId("grid-header")).toContainText("Désactivée");
});

test("visiteur et compte client : accès aux tarifs refusé", async ({ browser }) => {
  const visitor = await browser.newContext();
  const v = await visitor.newPage();
  await v.goto("/admin/tarifs");
  await expect(v).toHaveURL(/\/compte\/connexion/);
  await v.goto("/admin/tarifs/simulateur?produit=casablanca&largeur=4000&cote=2600");
  await expect(v).toHaveURL(/\/compte\/connexion/);
  await createAccount(v, `client-tarifs-${uid()}@test.invalid`, `Mdp-${uid()}-${uid()}`);
  await v.goto("/admin/tarifs");
  await expect(v).toHaveURL(/\/compte\?forbidden=1/);
  expect(await v.content()).not.toContain("Prix final HELIOSTORES");
  await visitor.close();
});
