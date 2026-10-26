import { test, expect, type Page } from "./fixtures";
import { acceptNecessaryOnly, drawingAttr, goStep, openConfigurator, setDim, shot, stepIssues } from "./helpers";
import { PUBLIC_FORBIDDEN_NAMES } from "../../src/domain/public-sanitize";

/**
 * Nomenclature du 2026-10-25 : quatre familles (pergolas, screens, stores bannes, moustiquaires), navigation latérale
 * et menu mobile, modèles retirés ou renommés, configurateur en étapes dont le dessin du projet suit réellement la
 * configuration, outil de prise de mesures, nouvelles pages (accessoires, références, modes de paiement).
 */

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;
/** anciens noms commerciaux et niveaux retirés : jamais sur les pages publiques */
const OLD_NAMES = /HELIO (Pilot|Vent|Soleil|Connect|Lumière|Horizon|Panorama|Ombra|Riviera|Azur|Verrière)|\b(Essentiel|Premium)\b/;

test("accueil : quatre familles dans le premier écran, cartes entièrement cliquables, sans débordement", async ({ page }) => {
  await page.goto("/");
  await acceptNecessaryOnly(page);
  const cards = page.getByTestId("family-picker").locator(":scope > li");
  await expect(cards).toHaveCount(4);
  const vh = page.viewportSize()!.height;
  for (const key of ["PERGOLAS", "SCREENS", "STORES_BANNES", "MOUSTIQUAIRES"]) {
    const card = page.getByTestId(`home-${key}`);
    await expect(card.locator("svg.panel-sketch")).toBeVisible();
    const box = (await card.boundingBox())!;
    expect(box.y + box.height, `${key} dans le premier écran`).toBeLessThanOrEqual(vh + 1);
  }
  expect(await noOverflow(page)).toBe(true);
  await shot(page, "accueil-quatre-familles");
  // toute la carte mène à la famille (clic au centre du dessin, hors du titre)
  for (const [key, path] of [["PERGOLAS", "/pergolas"], ["SCREENS", "/screens"], ["STORES_BANNES", "/stores-bannes"], ["MOUSTIQUAIRES", "/moustiquaires"]] as const) {
    await page.goto("/");
    const sketch = (await page.getByTestId(`home-${key}`).locator("svg.panel-sketch").boundingBox())!;
    await page.mouse.click(sketch.x + sketch.width / 2, sketch.y + sketch.height / 2);
    await expect(page, key).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByTestId("collection")).toBeVisible();
  }
});

test("navigation latérale (ordinateur) : familles, modèles et rubrique active", async ({ page }) => {
  test.skip(!isDesktop(page), "navigation latérale affichée à partir de 1024 px (menu mobile vérifié à part)");
  await page.goto("/stores-bannes");
  await acceptNecessaryOnly(page);
  const side = page.getByTestId("site-sidebar");
  await expect(side).toBeVisible();
  const family = side.getByRole("link", { name: "Stores bannes", exact: true });
  await expect(family).toHaveAttribute("aria-current", "page");
  await expect(family).toHaveAttribute("data-active", "true");
  // famille de la page dépliée : ses modèles sont listés
  for (const n of ["Casablanca", "Corsica", "Jamaica", "Madera"]) await expect(side.getByRole("link", { name: n, exact: true })).toBeVisible();
  await expect(side.locator('[aria-current="page"]')).toHaveCount(1);
  // configurateur d'un modèle : le modèle est la rubrique active
  await page.goto("/configurateur/corsica");
  await expect(side.getByRole("link", { name: "Corsica", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(side.getByRole("link", { name: "Stores bannes", exact: true })).not.toHaveAttribute("aria-current", "page");
  // une autre famille depuis la navigation latérale
  await side.getByRole("link", { name: "Moustiquaires", exact: true }).click();
  await expect(page).toHaveURL(/\/moustiquaires$/);
  await expect(side.getByRole("link", { name: "Moustiquaires", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(side.getByRole("link", { name: "MoskiFold 2", exact: true })).toBeVisible();
  // rubriques de service
  await side.getByRole("link", { name: "Options et accessoires" }).click();
  await expect(page).toHaveURL(/\/accessoires$/);
  await expect(side.getByRole("link", { name: "Options et accessoires" })).toHaveAttribute("aria-current", "page");
  // en-tête : services et bouton d'action « Configurer mon projet »
  await expect(page.locator("header").getByRole("link", { name: "Configurer mon projet" })).toBeVisible();
  await shot(page, "navigation-laterale");
});

test("menu mobile : familles, modèles et services ; un modèle s'ouvre depuis le menu", async ({ page }) => {
  test.skip(isDesktop(page), "menu mobile affiché sous 1024 px (navigation latérale vérifiée à part)");
  await page.goto("/");
  await acceptNecessaryOnly(page);
  await expect(page.getByTestId("site-sidebar")).toBeHidden();
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  const menu = page.getByRole("navigation", { name: "Navigation mobile" });
  await expect(menu).toBeVisible();
  for (const n of ["Pergolas", "Screens", "Stores bannes", "Moustiquaires", "Malaga", "HelioRoof Screen", "Jamaica", "MoskiFold 2", "Installation et guides", "Contact", "Devis"]) await expect(menu).toContainText(n);
  await expect(menu).not.toContainText("Références");
  await expect(menu.getByRole("link", { name: /Configurer mon projet/ })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  await shot(page, "menu-mobile");
  // Échap ferme le menu et rend le focus au bouton
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(page.getByRole("button", { name: "Ouvrir le menu" })).toBeFocused();
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await menu.getByRole("link", { name: "Sevilla", exact: true }).click();
  await expect(page).toHaveURL(/\/pergolas\/sevilla$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sevilla");
  await expect(menu).toBeHidden();
});

test("modèle retiré : page explicative et gammes actuelles ; renommage : redirection vers le nouveau nom", async ({ page }) => {
  const r = await page.goto("/pergolas/helio-horizon");
  expect(r?.status()).toBe(200);
  await acceptNecessaryOnly(page);
  const retired = page.getByTestId("retired-product");
  await expect(retired.getByRole("heading", { level: 1 })).toHaveText("Ce modèle n'est plus proposé");
  for (const n of ["Malaga", "Marbella", "Sevilla"]) await expect(retired.getByRole("heading", { name: n })).toBeVisible();
  await expect(retired).not.toContainText(OLD_NAMES);
  await shot(page, "modele-retire");
  // le configurateur retiré ne propose aucune conversion : on choisit une gamme et on recommence
  await page.goto("/configurateur/helio-horizon");
  await expect(page.getByTestId("retired-product")).toContainText("Ce configurateur concernait un modèle retiré");
  await expect(page.getByTestId("system-configurator")).toHaveCount(0);
  await page.getByTestId("retired-product").locator('a[href="/configurateur/marbella"]').click();
  await expect(page).toHaveURL(/\/configurateur\/marbella$/);
  await expect(page.getByTestId("system-configurator")).toHaveAttribute("data-family", "marbella");

  // renommage du même produit : 308 puis fiche au nouveau nom
  const redirect = await page.request.get("/stores-bannes/helio-riviera", { maxRedirects: 0 });
  expect(redirect.status()).toBe(308);
  await page.goto("/stores-bannes/helio-riviera");
  await expect(page).toHaveURL(/\/stores-bannes\/casablanca$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Casablanca");
  await page.goto("/configurateur/helio-ombra");
  await expect(page).toHaveURL(/\/configurateur\/helioscreen$/);
});

test("configurateur : largeur, avancée, teinte et toile modifient réellement le dessin du projet", async ({ page }) => {
  // store banne : géométrie et teinte du coffre
  await openConfigurator(page, "casablanca");
  const drawing = page.getByTestId("project-drawing");
  await expect(page.getByTestId("vis-tab-project")).toHaveAttribute("aria-selected", "true");
  await expect(drawing).toHaveAttribute("data-kind", "awning");
  await expect(drawing).toHaveAttribute("data-view", "three_quarter");
  const before = await drawing.innerHTML();
  await setDim(page, "dim-width", 5000);
  await expect(drawing).toHaveAttribute("data-width-mm", "5000");
  await expect(drawing.locator('[data-part="dimension"]').filter({ hasText: "largeur 5 m" })).toHaveCount(1);
  expect(await drawing.innerHTML(), "le tracé change avec la largeur").not.toBe(before);
  // curseur et boutons − / + de la même cote
  await page.getByTestId("dim-width-slider").fill("3500");
  await expect(page.locator("#dim-width")).toHaveValue("3500");
  await expect(drawing).toHaveAttribute("data-width-mm", "3500");
  await page.getByRole("button", { name: /^Largeur : augmenter de/ }).click();
  await expect(drawing).toHaveAttribute("data-width-mm", "3510");
  await page.getByRole("button", { name: /^Largeur : diminuer de/ }).click();
  await expect(page.locator("#dim-width")).toHaveValue("3500");
  // avancée : valeurs fabriquées en boutons ; une grande avancée demande une largeur minimale
  await page.getByTestId("dim-depth-values").getByText("3,1 m", { exact: true }).click();
  await expect(stepIssues(page, "dims")).toContainText("Avancée 3,1 m : largeur minimale 3,51 m");
  await setDim(page, "dim-width", 4200);
  await expect(page.getByTestId("step-dims")).not.toContainText("Impossible");
  await expect(drawing).toHaveAttribute("data-depth-mm", "3100");
  await expect(drawing).toHaveAttribute("data-width-mm", "4200");
  // vues du dessin ; pas de vue « Intérieur » ni d'« Ambiance nuit »
  for (const [label, view] of [["Face", "front"], ["Dessus", "top"], ["Trois quarts", "three_quarter"]] as const) {
    await page.getByRole("group", { name: "Vues du dessin" }).getByRole("button", { name: label, exact: true }).click();
    await expect(drawing).toHaveAttribute("data-view", view);
  }
  await expect(page.getByRole("button", { name: /Intérieur|Ambiance nuit/ })).toHaveCount(0);
  await goStep(page, "pose");
  const colorBefore = await drawingAttr(page, "structure-color");
  await page.getByLabel("Teinte de structure").selectOption({ label: "RAL 8014" });
  await expect(drawing).not.toHaveAttribute("data-structure-color", colorBefore!);
  await expect(drawing).toHaveAttribute("data-structure-color", /^#[0-9a-f]{6}$/i);
  // l'onglet « Photos » ne suit pas la configuration (indiqué)
  await page.getByTestId("vis-tab-photos").click();
  await expect(page.getByTestId("photos-note")).toContainText("ne changent pas avec vos choix");
  await expect(drawing).toBeHidden();
  await page.getByTestId("vis-tab-project").click();
  await expect(drawing).toBeVisible();
  // export de l'image du projet
  const download = page.waitForEvent("download");
  await page.getByTestId("export-drawing").click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
  await shot(page, "configurateur-dessin-store");

  // screen : hauteur et toile
  await openConfigurator(page, "helioscreen");
  await expect(drawing).toHaveAttribute("data-kind", "screen");
  await setDim(page, "dim-height", 2600);
  await expect(drawing).toHaveAttribute("data-height-mm", "2600");
  await setDim(page, "dim-width", 2400);
  await expect(drawing).toHaveAttribute("data-width-mm", "2400");
  await goStep(page, "pose");
  const fabricBefore = await drawingAttr(page, "fabric-color");
  await page.locator("#fabric").selectOption({ label: "Soltis VEOZIP (10 coloris)" });
  await expect(drawing).not.toHaveAttribute("data-fabric-color", fabricBefore!);
  await expect(page.getByTestId("view-3d-toggle")).toBeEnabled();

  // pergola sur mesure : la largeur (le long du mur) et l'avancée sont deux cotes distinctes du dessin
  await openConfigurator(page, "marbella");
  await expect(drawing).toHaveAttribute("data-kind", "pergola");
  await setDim(page, "dim-width", 3600);
  await setDim(page, "dim-depth", 5000);
  await expect(drawing).toHaveAttribute("data-depth-mm", "5000");
  await expect(drawing.locator('[data-part="dimension"]').filter({ hasText: "largeur 3,6 m" })).toHaveCount(1);
  await expect(drawing.locator('[data-part="dimension"]').filter({ hasText: "projection 5 m" })).toHaveCount(1);
  // attribut de largeur du dessin = largeur saisie (et non l'avancée)
  await expect(drawing, "data-width-mm d'une pergola = largeur saisie").toHaveAttribute("data-width-mm", "3600");
  expect(await noOverflow(page)).toBe(true);
  await shot(page, "configurateur-dessin-pergola");
});

test("configurateur : un éclairage LED choisi apparaît sur le dessin (data-led)", async ({ page }) => {
  await openConfigurator(page, "marbella");
  const drawing = page.getByTestId("project-drawing");
  await expect(drawing).toHaveAttribute("data-led", "off");
  await goStep(page, "equip");
  for (const code of ["led_perimeter", "led_blades", "led_spots"]) {
    const box = page.getByTestId(`option-${code}`).getByRole("checkbox");
    await box.check();
    await expect(drawing, `option ${code} cochée seule : LED dessinée`).toHaveAttribute("data-led", "on");
    await box.uncheck();
    await expect(drawing).toHaveAttribute("data-led", "off");
  }
  await page.getByTestId("option-led_perimeter").getByRole("checkbox").check();
  await expect(drawing).toHaveAttribute("data-led", "on");
  await expect(drawing.locator('[data-part="led"]').first()).toBeAttached();
  await shot(page, "configurateur-led");
});

test("Sevilla : pergola à toiture toile, sans lames ; moustiquaire et screen de toiture : dessin 2D seul", async ({ page }) => {
  await openConfigurator(page, "sevilla");
  const drawing = page.getByTestId("project-drawing");
  await expect(drawing).toHaveAttribute("data-kind", "pergola");
  await expect(drawing.locator('[data-part="roof-fabric"]')).toHaveCount(1);
  await expect(drawing.locator('[data-part="blade"]')).toHaveCount(0);
  await goStep(page, "pose");
  // adossée seulement
  await expect(page.getByTestId("step-pose").getByRole("radio")).toHaveCount(1);
  await expect(page.getByRole("radio", { name: /Adossée/ })).toBeChecked();
  const fabric = await drawingAttr(page, "fabric-color");
  await page.locator("#fabric").selectOption({ label: "Toile Serge 600" });
  await expect(drawing).not.toHaveAttribute("data-fabric-color", fabric!);
  await shot(page, "configurateur-sevilla");

  await openConfigurator(page, "moskifold-2");
  await expect(drawing).toHaveAttribute("data-kind", "insect");
  await expect(page.getByTestId("view-3d-toggle")).toBeDisabled();
  await setDim(page, "dim-width", 4200);
  await expect(drawing).toHaveAttribute("data-width-mm", "4200");
  await goStep(page, "pose");
  const mesh = await drawingAttr(page, "fabric-color");
  await page.getByLabel("Toile moustiquaire").selectOption({ label: "Toile noire" });
  await expect(drawing).not.toHaveAttribute("data-fabric-color", mesh!);
  await shot(page, "configurateur-moustiquaire");

  await openConfigurator(page, "helioroof-screen");
  await expect(drawing).toHaveAttribute("data-kind", "roof_screen");
  await expect(page.getByTestId("view-3d-toggle")).toBeDisabled();
});

test("Malaga : tailles fabriquées, puis demande hors gamme sans commande en ligne ; hors gamme d'un modèle sur mesure", async ({ page }) => {
  await openConfigurator(page, "malaga");
  const sizes = page.getByTestId("fixed-sizes");
  await expect(sizes.getByRole("radio")).toHaveCount(5);
  await expect(page.locator("#dim-width")).toHaveCount(0);
  await sizes.getByText(/3,50 m × 4,3 m/).click();
  await expect(page.getByTestId("project-drawing")).toHaveAttribute("data-depth-mm", "4300");
  await expect(page.getByTestId("system-recap")).toContainText("3,50 m × 4,3 m (avancée)");
  await sizes.getByText("Autre dimension — étude hors gamme sur devis").click();
  await setDim(page, "dim-width", 4000);
  await setDim(page, "dim-depth", 5200);
  await expect(page.getByTestId("step-dims")).not.toContainText("Impossible");
  await expect(page.getByTestId("system-recap")).toContainText("demande hors gamme");
  await goStep(page, "recap");
  await expect(stepIssues(page, "recap").first()).toContainText("Demande hors gamme : ce modèle est fabriqué dans des tailles définies");
  await expect(page.getByTestId("online-order")).toHaveAttribute("data-orderable", "false");
  await expect(page.getByTestId("add-to-cart")).toHaveCount(0);
  await shot(page, "configurateur-malaga-hors-gamme");

  // modèle sur mesure : cotes libres seulement après la demande d'étude hors gamme
  await openConfigurator(page, "marbella");
  await setDim(page, "dim-width", 4500);
  await expect(stepIssues(page, "dims")).toContainText("Largeur : de 1 m à 4 m");
  await page.getByTestId("out-of-range").getByRole("checkbox").check();
  await expect(page.getByTestId("step-dims")).not.toContainText("Impossible");
  await goStep(page, "recap");
  await expect(stepIssues(page, "recap").first()).toContainText("Demande hors gamme : vos cotes sont étudiées au devis");
  await expect(page.getByTestId("online-order")).toHaveAttribute("data-orderable", "false");
});

test("étapes Précédent / Suivant ; choix conservés après un aller-retour vers la fiche ; Recommencer", async ({ page }) => {
  await openConfigurator(page, "marbella");
  const steps = page.getByTestId("config-steps");
  await expect(steps.getByRole("button")).toHaveText([/1\s*Dimensions/, /2\s*Pose et finitions/, /3\s*Équipements/, /4\s*Récapitulatif et devis/]);
  await setDim(page, "dim-width", 3200);
  await page.getByTestId("step-next").click();
  // une seule étape visible
  await expect(page.getByTestId("step-pose")).toBeVisible();
  await expect(page.getByTestId("step-dims")).toHaveCount(0);
  await expect(steps.getByRole("button", { name: /Pose et finitions/ })).toHaveAttribute("aria-current", "step");
  await page.getByRole("radio", { name: /Adossée/ }).check();
  await page.getByTestId("step-next").click();
  await expect(page.getByTestId("step-equip")).toBeVisible();
  await page.getByTestId("option-frost_sensor").getByRole("checkbox").check();
  await page.getByTestId("step-prev").click();
  await expect(page.getByTestId("step-pose")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Adossée/ })).toBeChecked();
  await page.getByTestId("step-prev").click();
  await expect(page.locator("#dim-width")).toHaveValue("3200");

  // liens du configurateur : fiche, tous les modèles, autres modèles
  const links = page.getByTestId("config-links");
  await expect(links.getByRole("link", { name: "Tous les modèles pergolas" })).toHaveAttribute("href", "/pergolas");
  await expect(links.getByRole("link", { name: "Malaga" })).toHaveAttribute("href", /malaga/);
  await links.getByRole("link", { name: "Fiche Marbella" }).click();
  await expect(page).toHaveURL(/\/pergolas\/marbella$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/configurateur\/marbella$/);
  await expect(page.getByText("Vos choix précédents pour Marbella ont été conservés")).toBeVisible();
  await expect(page.locator("#dim-width")).toHaveValue("3200");
  await goStep(page, "pose");
  await expect(page.getByRole("radio", { name: /Adossée/ })).toBeChecked();
  await goStep(page, "equip");
  await expect(page.getByTestId("option-frost_sensor").getByRole("checkbox")).toBeChecked();
  await shot(page, "configurateur-choix-conserves");

  // Recommencer : confirmation (configuration non enregistrée), puis valeurs par défaut
  await goStep(page, "recap");
  page.once("dialog", (d) => { expect(d.message()).toContain("n'est pas enregistrée"); void d.accept(); });
  await page.getByTestId("config-reset").click();
  await expect(page.getByTestId("step-dims")).toBeVisible();
  await expect(page.locator("#dim-width")).not.toHaveValue("3200");
  await expect(page.getByText("Vos choix précédents pour Marbella ont été conservés")).toHaveCount(0);
});

test("prise de mesures : contrôle des cotes du modèle, report dans son configurateur", async ({ page }) => {
  await page.goto("/guides/prise-de-mesures");
  await acceptNecessaryOnly(page);
  const tool = page.getByTestId("measure-tool");
  await tool.getByText("Store banne", { exact: true }).click();
  await tool.getByLabel("2. Modèle").selectOption({ label: "Corsica" });
  await tool.getByLabel("Largeur (mm)").fill("4500");
  await tool.getByLabel("Avancée (mm)").fill("3100");
  await expect(page.getByTestId("measure-check")).toHaveCount(0);
  await shot(page, "prise-de-mesures");
  await page.getByTestId("measure-report").click();
  await expect(page).toHaveURL(/\/configurateur\/corsica$/);
  await expect(page.getByText("Vos choix précédents pour Corsica ont été conservés")).toBeVisible();
  await expect(page.locator("#dim-width")).toHaveValue("4500");
  await expect(page.getByTestId("dim-depth-values").getByRole("radio", { name: "3,1 m" })).toBeChecked();
  await expect(page.getByTestId("project-drawing")).toHaveAttribute("data-width-mm", "4500");
  await expect(page.getByTestId("project-drawing")).toHaveAttribute("data-depth-mm", "3100");

  // mesure hors de la gamme documentée : signalée, reportée en demande hors gamme
  await page.goto("/guides/prise-de-mesures");
  await tool.getByText("Moustiquaire", { exact: true }).click();
  await tool.getByLabel("2. Modèle").selectOption({ label: "MoskiFold" });
  await tool.getByLabel("Largeur (mm)").fill("5200");
  await tool.getByLabel("Hauteur (mm)").fill("2100");
  await expect(page.getByTestId("measure-check")).toContainText("hors de la gamme documentée");
  await page.getByTestId("measure-report").click();
  await expect(page).toHaveURL(/\/configurateur\/moskifold$/);
  await expect(page.getByTestId("out-of-range").getByRole("checkbox")).toBeChecked();
  await expect(page.locator("#dim-width")).toHaveValue("5200");
});

test("pages accessoires, références, guides et modes de paiement : contenu, aucun nom interdit, aucun débordement", async ({ page }) => {
  await page.goto("/accessoires");
  await acceptNecessaryOnly(page);
  for (const s of ["telecommandes", "domotique", "capteurs", "eclairage", "fermetures", "vent"]) await expect(page.getByTestId(`acc-${s}`)).toBeVisible();
  await expect(page.getByTestId("acc-telecommandes")).toContainText("Télécommande radio");
  await expect(page.getByTestId("acc-domotique")).toContainText("Box domotique — commande par smartphone");
  await expect(page.getByTestId("acc-capteurs")).toContainText("Capteur de vent (ou vent-soleil)");
  await expect(page.getByTestId("acc-eclairage")).toContainText("Éclairage LED");
  await shot(page, "accessoires");

  // sans réalisation ni photo de fabrication authentique publiée : rubrique absente de la navigation et en 404
  for (const u of ["/references", "/realisations", "/savoir-faire"]) expect((await page.goto(u))?.status(), u).toBe(404);
  await page.goto("/");
  await expect(page.locator('a[href="/references"]')).toHaveCount(0);

  await page.goto("/guides");
  await expect(page.getByTestId("documents-library")).toBeVisible();
  await expect(page.locator("main").locator('a[href="/guides/prise-de-mesures"]').first()).toBeVisible();
  await expect(page.locator("main").locator('a[href="/guides/choisir-toile-et-motorisation"]').first()).toBeVisible();

  await page.goto("/modes-de-paiement");
  const methods = page.getByTestId("payment-methods").locator(":scope > li");
  await expect(methods).toHaveCount(5);
  for (const li of await methods.all()) await expect(li).toHaveAttribute("data-state", /^(planned|simulated|active)$/);
  await expect(page.getByTestId("payment-methods")).not.toContainText("Acompte et solde sur devis");
  await shot(page, "modes-de-paiement");

  const pages = ["/", "/pergolas", "/screens", "/stores-bannes", "/moustiquaires", "/pergolas/malaga", "/pergolas/sevilla", "/screens/helioroof-screen", "/stores-bannes/madera", "/moustiquaires/moskifold-2", "/configurateur/moskifold", "/configurateur/jamaica", "/accessoires", "/references", "/guides", "/guides/prise-de-mesures", "/guides/choisir-toile-et-motorisation", "/modes-de-paiement", "/pergolas/helio-horizon"];
  for (const path of pages) {
    await page.goto(path);
    const text = await page.locator("body").innerText();
    expect(text, path).not.toMatch(PUBLIC_FORBIDDEN_NAMES);
    expect(await page.content(), `${path} (source HTML)`).not.toMatch(PUBLIC_FORBIDDEN_NAMES);
    expect(text, path).not.toMatch(OLD_NAMES);
    expect(await noOverflow(page), `${path} : débordement horizontal`).toBe(true);
  }
});
