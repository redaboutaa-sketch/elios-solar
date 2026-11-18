import { test, expect } from "./fixtures";
import { goStep, openConfigurator, setDim, shot } from "./helpers";
import { publicPricesActive } from "./db";

/**
 * Correspondances confirmées le 2026-11-03 (HelioLux = SOLID, HelioRoof = VÉRANDA V ZiiiP) : un projet enregistré avant
 * la révision du modèle est signalé et jamais converti en silence ; les choix devenus invalides sont nommés et se
 * corrigent explicitement. Modes de commande : différences et suppléments réels présentés, sans choix arbitraire.
 */
test("ancien brouillon HelioLux : avis de revalidation, toile et option périmées signalées, retrait explicite", async ({ page }) => {
  await page.addInitScript(() => {
    const old = { kind: "system", familySlug: "sevilla", widthMm: 3500, depthMm: 5000, heightMm: 2400, mounting: "wall", fabricCode: "serge_600", options: [{ code: "wind_automation" }], sides: {} };
    try { window.localStorage.setItem("heliostores:configuration:sevilla", JSON.stringify({ input: old, at: "2026-10-30T10:00:00.000Z" })); } catch { /* stockage indisponible */ }
  });
  await openConfigurator(page, "sevilla");
  await expect(page.getByTestId("revision-notice")).toContainText("enregistré avant la mise à jour des caractéristiques de HelioLux");
  await expect(page.getByTestId("revision-notice")).toContainText("n'a pas été converti");
  await goStep(page, "pose");
  await expect(page.getByTestId("step-pose")).toContainText("La toile enregistrée (serge_600) n'est plus proposée");
  await page.locator("#fabric").selectOption({ label: "Toile PVC blanche (602N opaque)" });
  await expect(page.getByTestId("step-pose")).not.toContainText("n'est plus proposée");
  await goStep(page, "equip");
  const stale = page.getByTestId("stale-option-wind_automation");
  await expect(stale).toContainText("n'est plus proposée pour ce modèle");
  await stale.getByRole("button", { name: "Retirer" }).click();
  await expect(stale).toHaveCount(0);
  await shot(page, "revalidation-heliolux");
});

test("nouvelle configuration HelioLux : aucun avis de revalidation", async ({ page }) => {
  await openConfigurator(page, "sevilla");
  await expect(page.getByTestId("revision-notice")).toHaveCount(0);
});

test("HelioScreen : comparatif des modes de commande (suppléments réels, fourchette, indisponibilité)", async ({ page }) => {
  test.skip(!(await publicPricesActive()), "aucune grille publiée dans cet environnement : le comparatif n'affiche pas de prix");
  await openConfigurator(page, "helioscreen");
  await setDim(page, "dim-width", 3000);
  await setDim(page, "dim-height", 2400);
  await goStep(page, "pose");
  const modes = page.getByTestId("control-modes");
  await expect(modes).toBeVisible();
  await expect(modes.getByRole("listitem")).toHaveCount(6);
  // un seul moteur convient : supplément affiché ; plusieurs : fourchette sans choix arbitraire
  await expect(page.getByTestId("control-mode-radio_io")).toContainText(/\+\s?\d/);
  await expect(page.getByTestId("control-mode-wired_mech")).toContainText(/entre .* selon le modèle retenu/);
  await expect(modes).not.toContainText(/somfy|situo|maestria|altus|sunilus|varie/i);
  await shot(page, "comparatif-modes-commande");
});
