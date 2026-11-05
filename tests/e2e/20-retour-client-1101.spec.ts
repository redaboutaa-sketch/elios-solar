import { test, expect } from "./fixtures";
import { acceptNecessaryOnly, goStep, openConfigurator, setDim, STEP } from "./helpers";

/**
 * Retours client traités le 2026-11-01 (docs/client-feedback-followup.md) : navigation et conservation de la
 * configuration, hauteur de pose, coloris par modèle, état du prix, logo et retour à l'accueil, moustiquaires en
 * demande d'étude, aperçus des traductions (noindex, sélecteur de langue).
 */

test("configurateur : étape dans l'adresse, Retour / Suivant du navigateur et actualisation sans perte", async ({ page }) => {
  await openConfigurator(page, "marbella");
  await setDim(page, "dim-width", 3500);
  await goStep(page, "pose");
  await expect(page).toHaveURL(/[?&]etape=pose-finitions/);
  await goStep(page, "equip");
  await expect(page).toHaveURL(/[?&]etape=equipements/);
  await page.goBack();
  await expect(page.getByTestId(STEP.pose)).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId(STEP.dims)).toBeVisible();
  await expect(page).not.toHaveURL(/etape=/);
  await page.goForward();
  await expect(page.getByTestId(STEP.pose)).toBeVisible();
  // actualisation : même étape, mêmes dimensions (brouillon local)
  await page.reload();
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await expect(page.getByTestId(STEP.pose)).toBeVisible();
  await goStep(page, "dims");
  await expect(page.locator("#dim-width")).toHaveValue("3500");
  await expect(page.getByTestId("project-drawing")).toHaveAttribute("data-width-mm", "3500");
});

test("fiche → configurateur → Retour : retour à la fiche, configuration conservée au retour", async ({ page }) => {
  await page.goto("/pergolas/marbella");
  await acceptNecessaryOnly(page);
  await page.locator('main a[href="/configurateur/marbella"]').first().click();
  await expect(page.getByTestId(STEP.dims)).toBeVisible();
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await setDim(page, "dim-width", 4000);
  await page.goBack();
  await expect(page).toHaveURL(/\/pergolas\/marbella$/);
  await page.goForward();
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await expect(page.locator("#dim-width")).toHaveValue("4000");
});

test("store banne : hauteur de pose facultative, collectée comme souhait, bornes contrôlées", async ({ page }) => {
  await openConfigurator(page, "corsica");
  const field = page.getByTestId("install-height");
  await expect(field).toBeVisible();
  await setDim(page, "dim-install-height", 2600);
  await expect(page.getByTestId("system-recap")).toContainText("Hauteur de pose (souhait)");
  await expect(page.getByTestId("project-drawing")).toHaveAttribute("data-height-mm", "2600");
  await setDim(page, "dim-install-height", 260); // saisie en cm par erreur
  await expect(page.getByTestId(STEP.dims)).toContainText("Hauteur de pose : saisissez une valeur en millimètres");
  await setDim(page, "dim-install-height", 2600);
  await expect(page.getByTestId(STEP.dims)).not.toContainText("Hauteur de pose : saisissez");
});

test("coloris : teintes standard et teintes avec supplément distinguées, nuancier de référence, prix honnête", async ({ page }) => {
  await openConfigurator(page, "corsica");
  // HelioShade : sans grille de vente publiée (CI) → motif explicite, aucun montant ; avec la grille du catalogue → le
  // moteur obligatoire figure toujours dans le prix : ajouté (commande filaire, un seul moteur) ou à chiffrer (radio)
  const price = page.getByTestId("system-price");
  await expect(price).toHaveAttribute("data-price-status", /^(priced|no_table|incomplete|out_of_grid|blocked|custom)$/);
  if ((await price.getAttribute("data-priced")) === "true") {
    await expect(price).toContainText("Moteur");
    await goStep(page, "pose");
    await page.getByLabel("Manœuvre et commande").selectOption("radio_io");
    await expect(price).toHaveAttribute("data-partial", "true");
    await expect(page.getByTestId("price-pending")).toContainText("Moteur");
    await page.getByLabel("Manœuvre et commande").selectOption("wired");
    await goStep(page, "dims");
  } else await expect(price).not.toContainText("€");
  await goStep(page, "pose");
  const swatches = page.getByTestId("finish-swatches");
  await expect(swatches.getByTestId("finish-tier-standard")).toBeVisible();
  await expect(swatches.getByTestId("finish-tier-special")).toBeVisible();
  await expect(swatches.getByTestId("finish-tier-standard").getByRole("radio", { name: /RAL 7016 · structuré/ })).toHaveCount(1);
  await expect(page.getByTestId("finish-palette")).toContainText("brochure stores bannes (10.2026)");
  await expect(swatches).toContainText("coffre et bras");
});

test("logo : lien vers l'accueil sur toute sa surface, nom accessible, zone de 44 px", async ({ page }) => {
  await page.goto("/pergolas");
  await acceptNecessaryOnly(page);
  const logo = page.locator("[data-header-logo]");
  await expect(logo).toHaveAttribute("aria-label", /— Accueil$/);
  const box = (await logo.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await logo.focus();
  await expect(logo).toBeFocused();
  await logo.click();
  await expect(page).toHaveURL(/\/$/);
});

test("moustiquaires : cinq modèles, demandes d'étude sans photo d'un autre système", async ({ page }) => {
  await page.goto("/moustiquaires");
  await acceptNecessaryOnly(page);
  const list = page.getByTestId("collection");
  for (const name of ["MoskiFold", "MoskiFold 2", "MoskiUp", "MoskiSlide", "MoskiFix"]) await expect(list.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(list.getByTestId("study-sketch")).toHaveCount(5);
  const r = await page.request.get("/moustiquaires/moskiup");
  expect(r.status()).toBe(200);
  await page.goto("/configurateur/moskislide");
  await expect(page.getByTestId("system-configurator")).toContainText("Demande d'étude");
});

test("langues : aperçus noindex, sélecteur au clavier, page et paramètres conservés, français intact", async ({ page }) => {
  const fr = await page.request.get("/pergolas");
  expect(await fr.text()).not.toContain('hreflang="es"'); // aucune traduction publiée : aucun hreflang
  const es = await page.request.get("/es/pergolas");
  expect(es.status()).toBe(200);
  expect(es.headers()["x-robots-tag"]).toMatch(/noindex/);
  // consentement donné sur une page française (même origine pour toutes les langues : choix conservé)
  await page.goto("/pergolas");
  await acceptNecessaryOnly(page);
  await page.goto("/es/pergolas?vue=1");
  await expect(page.locator('[aria-labelledby="consent-title"]')).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByTestId("locale-preview")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  if ((page.viewportSize()?.width ?? 1440) >= 1024) {
    const switcher = page.getByTestId("locale-switcher");
    await switcher.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByTestId("locale-menu");
    for (const label of ["Français", "Español", "Nederlands", "Deutsch", "English"]) await expect(menu.getByRole("link", { name: new RegExp(label) })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(switcher).toBeFocused();
    await switcher.click();
    await menu.getByRole("link", { name: /Deutsch/ }).click();
  } else {
    // petit écran : les langues sont dans le menu mobile (le bandeau garde la place du logo centré)
    await expect(page.getByTestId("locale-switcher")).toBeHidden();
    await page.getByRole("button", { name: "Abrir el menú" }).click();
    const links = page.getByTestId("locale-links");
    for (const label of ["Français", "Español", "Nederlands", "Deutsch", "English"]) await expect(links.getByRole("link", { name: label })).toBeVisible();
    await links.getByRole("link", { name: "Deutsch" }).click();
  }
  await expect(page).toHaveURL(/\/de\/pergolas\?vue=1$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  // liens internes dans la langue courante, accueil compris
  await expect(page.locator("[data-header-logo]")).toHaveAttribute("href", "/de");
  // langue inconnue : 404 ; le français n'a pas de préfixe
  expect((await page.request.get("/it/pergolas")).status()).toBe(404);
});

test("configurateur : l'étape choisie reste affichée après une action serveur (consentement aux cookies)", async ({ page }) => {
  // non-régression (CI du 2026-11-02) : un nouveau rendu du serveur ne doit ni recharger le brouillon ni ramener l'étape
  await page.goto("/configurateur/marbella");
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await goStep(page, "equip");
  await page.locator('[aria-labelledby="consent-title"] .btn-secondary').first().click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await expect(page.getByTestId(STEP.equip)).toBeVisible();
  await expect(page).toHaveURL(/[?&]etape=equipements/);
});
