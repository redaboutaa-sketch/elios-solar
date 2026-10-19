import { test, expect, type Page } from "./fixtures";
import { acceptNecessaryOnly, configureStandard, shot } from "./helpers";

// Chromium headless : rendu WebGL logiciel (SwiftShader) pour que le canvas soit réellement créé.
test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

async function recapTotal(page: Page) {
  return (await page.locator("#recap").getByText(/Total TTC/).locator("..").locator("td").last().textContent())?.trim();
}

/** Attend le canvas ou le message d'absence de WebGL ; retourne true si la 3D est active. */
async function waitForScene(page: Page): Promise<boolean> {
  const scene = page.getByTestId("scene-3d");
  await expect(scene).toBeVisible({ timeout: 20_000 });
  const canvas = scene.locator("canvas");
  const unavailable = page.getByTestId("scene-3d-unavailable");
  await expect(canvas.or(unavailable)).toBeVisible({ timeout: 20_000 });
  return canvas.isVisible();
}

test("vue 3D de la pergola : chargement à la demande, vues, nuit, lames, export, sans modifier la configuration", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await configureStandard(page);
  const total = await recapTotal(page);
  expect(total).toMatch(/€/);
  // avant le clic : pas de canvas 3D
  await expect(page.getByTestId("scene-3d")).toHaveCount(0);

  await page.getByTestId("view-3d-toggle").click();
  await expect(page.getByTestId("view-3d-toggle")).toHaveAttribute("aria-pressed", "true");
  const has3d = await waitForScene(page);
  // le plan 2D reste affiché et sélectionnable
  await expect(page.getByRole("img", { name: /Vue en plan/ })).toBeVisible();

  if (has3d) {
    await expect(page.getByText(/Visualisation indicative — ne constitue pas un plan d'exécution/).first()).toBeVisible();
    await expect(page.locator("#scene-3d-description")).toContainText(/paroi vitrée gauche/);
    await page.getByRole("group", { name: "Vues prédéfinies" }).getByRole("button", { name: "Dessus" }).click();
    await expect(page.getByRole("button", { name: "Dessus" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Intérieur" }).click();
    await page.getByRole("button", { name: "Ambiance nuit" }).click();
    await expect(page.getByRole("button", { name: "Ambiance jour" })).toHaveAttribute("aria-pressed", "true");
    const slider = page.getByRole("slider", { name: /Ouverture des lames/ });
    await slider.fill("60");
    await expect(page.getByText("60°")).toBeVisible();
    await page.getByRole("button", { name: "Trois quarts" }).click();
    // rotation à la souris / au doigt sur le canvas
    const box = await page.getByTestId("scene-3d").boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 10, { steps: 5 });
      await page.mouse.up();
    }
    await page.waitForTimeout(500);
    await shot(page, "vue-3d");

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exporter l'image du projet" }).click()]);
    expect(download.suggestedFilename()).toBe("projet-elios-solar.png");
    await expect(page.getByText("Image exportée.")).toBeVisible();
  } else {
    await expect(page.getByTestId("scene-3d-unavailable")).toContainText(/WebGL/);
    await shot(page, "vue-3d");
  }

  // les interactions de visualisation n'ont modifié ni la configuration ni le prix
  expect(await recapTotal(page)).toBe(total);
  await expect(page.locator("#recap").getByText(/Paroi vitrée fixe 3 m – anthracite – Gauche/)).toBeVisible();
  await expect(page.getByTestId("price-confirmation").getByText("Prix confirmé par le serveur")).toBeVisible();

  // retour à l'illustration : le configurateur reste utilisable
  await page.getByRole("button", { name: "Illustration" }).click();
  await expect(page.getByTestId("scene-3d")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("vue 3D d'une Solis Pro 4×6 autoportée : poteaux intermédiaires, éclairage de gouttière et finition bicolore décrits", async ({ page }) => {
  await page.goto("/configurateur?gamme=pergola-solis-pro&dimension=4x6&finition=ANTHRACITE_WHITE_BLADES&implantation=autoportee");
  await acceptNecessaryOnly(page);
  await page.getByTestId("view-3d-toggle").click();
  if (await waitForScene(page)) {
    await expect(page.locator("#scene-3d-description")).toContainText("6 poteaux");
    await expect(page.locator("#scene-3d-description")).toContainText(/LED de gouttière blanc chaud/);
    await expect(page.locator("#scene-3d-description")).toContainText(/anthracite, lames blanches/);
  }
});

test("vue 3D du store banne : déploiement de la toile sans changer le prix", async ({ page }) => {
  await page.goto("/configurateur/store-banne");
  await acceptNecessaryOnly(page);
  const totalCard = page.getByText(/^Total (définitif|estimé)$/).locator("..");
  const before = (await totalCard.locator("p").nth(1).textContent())?.trim();
  await page.getByTestId("view-3d-toggle").click();
  if (await waitForScene(page)) {
    await expect(page.locator("#scene-3d-description")).toContainText(/Store banne/);
    const slider = page.getByRole("slider", { name: /Déploiement de la toile/ });
    await slider.fill("40");
    await expect(page.getByText("40 %")).toBeVisible();
    await page.getByRole("button", { name: "Ambiance nuit" }).click();
    await page.getByRole("button", { name: "Face" }).click();
    await page.waitForTimeout(500);
    await shot(page, "vue-3d-store");
  }
  expect((await totalCard.locator("p").nth(1).textContent())?.trim()).toBe(before);
});
