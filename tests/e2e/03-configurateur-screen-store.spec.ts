import { test, expect, type Page } from "./fixtures";
import { acceptNecessaryOnly, fillQuote, shot, uid } from "./helpers";
import { one, publicCell, publicPricesActive } from "./db";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

async function setDim(page: Page, id: string, value: number) {
  const input = page.locator(`#${id}`);
  await input.fill(String(value));
  await input.blur();
}

test("screen HELIO Ombra : largeur contradictoire signalée, largeur minimale du moteur, 3D et devis", async ({ page }) => {
  await page.goto("/configurateur/helio-ombra");
  await acceptNecessaryOnly(page);
  const issues = page.locator('ul[aria-live="polite"]');
  await setDim(page, "dim-width", 4500);
  await setDim(page, "dim-height", 2600);
  await expect(issues).toContainText("Largeur supérieure à 4 m");
  await expect(issues).toContainText("la fiche transmise indique 4 m");
  await setDim(page, "dim-width", 7200);
  await expect(issues).toContainText("Largeur : de 0,58 m à 7 m");
  await setDim(page, "dim-width", 700);
  await page.getByLabel("Commande", { exact: true }).selectOption({ label: "Motorisation électrique — modèle 5 — largeur min. 73 cm" });
  await expect(issues).toContainText("largeur minimale du système 0,73 m");
  await setDim(page, "dim-width", 2400);
  await expect(issues).not.toContainText("Impossible");
  await page.getByRole("radio", { name: "En niche" }).check();
  await page.getByLabel("Toile").selectOption({ label: "Acrylique — à confirmer" });
  await expect(issues).toContainText("Toile Acrylique");
  await page.getByLabel("Toile").selectOption({ label: "Serge" });
  await page.getByTestId("view-3d-toggle").click();
  await expect(page.locator("[data-testid=scene-3d] canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#scene-3d-description")).toContainText("2,4 × 2,6 m (largeur × hauteur), pose en niche");
  await shot(page, "configurateur-screen-3d");
  const number = await fillQuote(page, `screen-${uid()}@test.invalid`);
  await expect(page.getByTestId("quote-visual-status")).toContainText("visualisation 3D de votre configuration est jointe");
  const q = await one<{ snapshot: { input: { widthMm: number; heightMm: number; mounting: string; fabricCode: string }; result: { systemPrice?: { amountMinor: number } | null } } }>('SELECT snapshot FROM "Quote" WHERE number = $1', [number]);
  expect(q!.snapshot.input).toMatchObject({ widthMm: 2400, heightMm: 2600, mounting: "niche", fabricCode: "serge" });
  // prix : hauteur 2,6 m → 2,75 m, largeur 2,4 m → 2,5 m (dimensions de grille supérieures)
  const expected = (await publicPricesActive()) ? await publicCell("helio-ombra", "", 2750, 2500) : null;
  expect(q!.snapshot.result.systemPrice?.amountMinor ?? null).toBe(expected);
});

test("store banne HELIO Riviera : avancées et largeurs documentées, commande électrique à confirmer, aucune hypothèse héritée", async ({ page }) => {
  await page.goto("/configurateur/helio-riviera");
  await acceptNecessaryOnly(page);
  const issues = page.locator('ul[aria-live="polite"]');
  await setDim(page, "dim-width", 3000);
  await page.locator("#dim-depth").selectOption({ label: "3,1 m" });
  await expect(issues).toContainText("Avancée 3,1 m : largeur minimale 3,51 m");
  await setDim(page, "dim-width", 4200);
  await expect(issues).not.toContainText("Impossible");
  await page.getByRole("radio", { name: "Sur chevrons" }).check();
  await page.getByLabel("Teinte de structure").selectOption({ label: "RAL 8014" });
  await page.getByLabel("Commande", { exact: true }).selectOption({ label: "Motorisation électrique (moteur à définir) — à confirmer" });
  await expect(issues).toContainText("motorisation citée par le catalogue");
  const recap = page.getByTestId("system-recap");
  await expect(recap).toContainText("HELIO Riviera");
  await expect(recap).not.toContainText(/LED|télécommande|câble/);
  await page.getByTestId("view-3d-toggle").click();
  await expect(page.locator("[data-testid=scene-3d] canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#scene-3d-description")).toContainText("sur chevrons");
  await expect(page.getByTestId("scene-3d-to-confirm")).toContainText("nombre de supports");
  await page.getByRole("slider").last().fill("40");
  await shot(page, "configurateur-store-3d");
  await page.getByTestId("view-3d-toggle").click();
  const number = await fillQuote(page, `store-${uid()}@test.invalid`);
  const q = await one<{ snapshot: { result: { issues: Array<{ code: string }>; systemPrice?: { amountMinor: number } | null } } }>('SELECT snapshot FROM "Quote" WHERE number = $1', [number]);
  expect(q!.snapshot.result.issues.map((i) => i.code)).toContain("control_to_confirm");
  // prix : avancée 3,1 m, largeur 4,2 m dans la plage 4,11–4,7 m
  const expected = (await publicPricesActive()) ? await publicCell("helio-riviera", "", 3100, 4700) : null;
  expect(q!.snapshot.result.systemPrice?.amountMinor ?? null).toBe(expected);
});
