import { test, expect } from "./fixtures";
import { fillQuote, goStep, openConfigurator, setDim, shot, stepIssues, uid } from "./helpers";
import { one, publicCell, publicPricesActive } from "./db";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

test("screen HelioScreen : largeur contradictoire signalée, mode de commande, télécommande selon la commande, toile, 3D et devis", async ({ page }) => {
  await openConfigurator(page, "helioscreen");
  await setDim(page, "dim-width", 7200);
  await expect(stepIssues(page, "dims")).toContainText("Largeur : jusqu'à 7 m");
  await setDim(page, "dim-width", 4500);
  await setDim(page, "dim-height", 2600);
  await expect(page.getByTestId("step-dims")).not.toContainText("Impossible");
  await goStep(page, "recap");
  const issues = stepIssues(page, "recap").first();
  await expect(issues).toContainText("Largeur supérieure à 4 m");
  await expect(issues).toContainText("les sources du fabricant divergent au-delà de 4 m");
  await goStep(page, "dims");
  await setDim(page, "dim-width", 700);
  await goStep(page, "pose");
  // modes de commande compréhensibles ; aucune largeur minimale inventée pour un moteur
  await page.getByLabel("Manœuvre et commande").selectOption({ label: "Filaire — fins de course mécaniques" });
  await goStep(page, "recap");
  await expect(issues).not.toContainText("largeur minimale");
  await goStep(page, "dims");
  await setDim(page, "dim-width", 2400);
  await expect(page.getByTestId("step-dims")).not.toContainText("Impossible");
  await goStep(page, "pose");
  await page.getByRole("radio", { name: "En niche" }).check();
  await page.locator("#fabric").selectOption({ label: "Polyscreen — à confirmer" });
  await goStep(page, "recap");
  await expect(issues).toContainText("Toile Polyscreen");
  await goStep(page, "pose");
  await page.locator("#fabric").selectOption({ label: "Serge 600 (14 coloris)" });
  // télécommande io : réservée à une commande radio io (prérequis affiché), modèle au choix
  await goStep(page, "equip");
  await expect(page.getByTestId("prereq-remote_io")).toContainText("nécessite une commande radio io");
  await expect(page.getByTestId("option-remote_io").getByRole("checkbox")).toBeDisabled();
  await goStep(page, "pose");
  await page.getByLabel("Manœuvre et commande").selectOption({ label: "Radio io — télécommande" });
  await goStep(page, "equip");
  await expect(page.getByTestId("option-remote_io").getByRole("checkbox")).toBeEnabled();
  await page.getByTestId("option-remote_io").getByRole("checkbox").check();
  await page.getByLabel("Télécommande io : valeur").selectOption({ label: "5 canaux" });
  await expect(page.getByTestId("wind-behaviour")).toContainText("entièrement relevé");
  await page.getByTestId("view-3d-toggle").click();
  await expect(page.locator("[data-testid=scene-3d] canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#scene-3d-description")).toContainText("pose en niche");
  await shot(page, "configurateur-screen-3d");
  await goStep(page, "recap");
  const number = await fillQuote(page, `screen-${uid()}@test.invalid`);
  await expect(page.getByTestId("quote-visual-status")).toContainText("est jointe au devis");
  const q = await one<{ snapshot: { input: { familySlug: string; widthMm: number; heightMm: number; mounting: string; fabricCode: string; controlCode: string; options: Array<{ code: string; value?: string }> }; result: { systemPrice?: { amountMinor: number } | null } } }>('SELECT snapshot FROM "Quote" WHERE number = $1', [number]);
  expect(q!.snapshot.input).toMatchObject({ familySlug: "helioscreen", widthMm: 2400, heightMm: 2600, mounting: "niche", fabricCode: "serge_600", controlCode: "radio_io" });
  expect(q!.snapshot.input.options).toEqual([expect.objectContaining({ code: "remote_io", value: "io_5" })]);
  // prix : hauteur 2,6 m et largeur 2,4 m ne sont pas des cotes de la grille (lecture exacte) → prix sur devis
  const expected = (await publicPricesActive()) ? await publicCell("helioscreen", "", 2600, 2400) : null;
  expect(q!.snapshot.result.systemPrice?.amountMinor ?? null).toBe(expected);
});

test("store banne HelioSun : avancées et largeurs documentées, mode de commande motorisé, options soumises à la motorisation", async ({ page }) => {
  await openConfigurator(page, "casablanca");
  await setDim(page, "dim-width", 3000);
  await page.getByTestId("dim-depth-values").getByText("3,1 m", { exact: true }).click();
  await expect(stepIssues(page, "dims")).toContainText("Avancée 3,1 m : largeur minimale 3,51 m");
  await setDim(page, "dim-width", 4200);
  await expect(page.getByTestId("step-dims")).not.toContainText("Impossible");
  await goStep(page, "pose");
  await page.getByRole("radio", { name: "Sur chevrons" }).check();
  await page.getByTestId("finish-swatches").getByRole("radio", { name: /RAL 8014\b/ }).check();
  // manivelle : télécommande et automatisme indisponibles (prérequis : motorisation)
  await goStep(page, "equip");
  await expect(page.getByTestId("prereq-remote_control")).toContainText("Indisponible avec la commande ou la pose choisie");
  await expect(page.getByTestId("option-remote_control").getByRole("checkbox")).toBeDisabled();
  await expect(page.getByTestId("option-wishes").getByTestId("option-weather_automation").getByRole("checkbox")).toBeDisabled();
  await expect(page.getByTestId("wind-behaviour")).toContainText("se replie");
  await goStep(page, "pose");
  await page.getByLabel("Manœuvre et commande").selectOption({ label: "Motorisée — radio io" });
  await goStep(page, "equip");
  await expect(page.getByTestId("option-remote_control").getByRole("checkbox")).toBeEnabled();
  await page.getByTestId("option-remote_control").getByRole("checkbox").check();
  await goStep(page, "recap");
  await expect(stepIssues(page, "recap").first()).toContainText("Télécommande radio");
  const recap = page.getByTestId("system-recap");
  await expect(recap).toContainText("HelioSun");
  await expect(recap).toContainText("Télécommande radio");
  await expect(recap).not.toContainText(/LED|câble/);
  await page.getByTestId("view-3d-toggle").click();
  await expect(page.locator("[data-testid=scene-3d] canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#scene-3d-description")).toContainText("sur chevrons");
  await page.getByTestId("system-visuals").getByRole("slider").last().fill("40");
  await shot(page, "configurateur-store-3d");
  await page.getByTestId("view-drawing-toggle").click();
  const number = await fillQuote(page, `store-${uid()}@test.invalid`);
  const q = await one<{ snapshot: { input: { options: Array<{ code: string }> }; result: { issues: Array<{ code: string }>; systemPrice?: { amountMinor: number } | null } } }>('SELECT snapshot FROM "Quote" WHERE number = $1', [number]);
  expect(q!.snapshot.result.issues.map((i) => i.code)).toContain("option_to_confirm");
  expect(q!.snapshot.result.issues.map((i) => i.code)).not.toContain("control_to_confirm");
  expect(q!.snapshot.input.options.map((o) => o.code)).toEqual(["remote_control"]);
  // prix : avancée 3,1 m, largeur 4,2 m dans une plage de largeurs de la grille
  const expected = (await publicPricesActive()) ? await publicCell("casablanca", "", 3100, 4200) : null;
  expect(q!.snapshot.result.systemPrice?.amountMinor ?? null).toBe(expected);
});
