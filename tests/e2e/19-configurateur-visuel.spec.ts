import { test, expect } from "./fixtures";
import { goStep, openConfigurator, setDim } from "./helpers";

/**
 * Configurateur visuel (demande client du 2026-10-31) : une seule configuration alimente champs, dessin, récapitulatif
 * et projet enregistré ; chaque fermeture apparaît aussitôt sur le côté choisi et disparaît quand on la retire ; les
 * teintes sont des pastilles nommées (nom RAL, code, état sélectionné), utilisables au clavier ; le projet restauré
 * redonne le même rendu.
 */
test("HelioMax : teintes, fermetures par côté, dimensions et restauration du projet suivent le même état", async ({ page }) => {
  await openConfigurator(page, "marbella");
  const drawing = page.getByTestId("project-drawing");

  // dimensions : le dessin suit immédiatement
  await setDim(page, "dim-width", 3500);
  await expect(drawing).toHaveAttribute("data-width-mm", "3500");

  // teintes : pastilles nommées, sélection visible et au clavier, rendu mis à jour
  await goStep(page, "pose");
  await page.getByRole("radio", { name: "Autoportante" }).check();
  const swatches = page.getByTestId("finish-swatches");
  const anthracite = swatches.getByRole("radio", { name: /Gris anthracite · RAL 7016/ });
  await anthracite.check();
  await expect(anthracite).toBeChecked();
  await expect(page.getByTestId("finish-selected")).toHaveText(/Gris anthracite · RAL 7016/);
  const before = await drawing.getAttribute("data-structure-color");
  await anthracite.focus();
  await page.keyboard.press("ArrowRight");
  const selected = swatches.locator("[data-selected]");
  await expect(selected).toHaveCount(1);
  await expect(selected.getByRole("radio")).not.toHaveAccessibleName(/RAL 7016/);
  await expect(drawing).not.toHaveAttribute("data-structure-color", before!);
  await expect(selected.locator("svg")).toBeVisible(); // coche : la sélection ne dépend pas de la seule couleur

  // fermetures : ajout et retrait côté par côté, matériaux distincts, compatibilité à confirmer
  await goStep(page, "equip");
  await page.locator("#side-front").selectOption({ label: "HelioSlide VERRE — fermeture vitrée coulissante (à étudier)" });
  await expect(drawing).toHaveAttribute("data-closures", "front:glass");
  await expect(page.getByTestId("side-status-front")).toContainText("compatibilité à confirmer sur devis");
  await page.locator("#side-right").selectOption({ label: "HelioSlide ALU — remplissage coulissant en aluminium (à étudier)" });
  await page.locator("#side-left").selectOption({ label: "Screen latéral HelioScreen (à étudier)" });
  await expect(drawing).toHaveAttribute("data-closures", "front:glass,left:screen,right:slats");
  for (const part of ["closure-glass", "closure-alu", "closure-screen"]) await expect(drawing.locator(`[data-part="${part}"]`).first()).toBeAttached();
  for (const side of ["Avant", "Gauche", "Droite"]) await expect(drawing.locator('[data-part="side-label"]', { hasText: side })).toHaveCount(1);
  await page.locator("#side-front").selectOption({ label: "Ouvert" });
  await expect(drawing).toHaveAttribute("data-closures", "left:screen,right:slats");
  await expect(drawing.locator('[data-part="closure-glass"]')).toHaveCount(0);
  // changements rapides : le dernier choix l'emporte
  for (const v of ["sliding_glass", "", "sliding_panels", "helioscreen"]) await page.locator("#side-right").selectOption(v);
  await expect(drawing).toHaveAttribute("data-closures", "left:screen,right:screen");
  // seul le côté gauche fermé : la vue trois quarts se place à gauche pour le montrer
  await page.locator("#side-right").selectOption("");
  await expect(drawing).toHaveAttribute("data-mirrored", "true");
  await expect(page.getByTestId("represented-items")).toContainText("gauche");

  // passage en pose adossée : le côté mur ne peut pas recevoir de fermeture
  await goStep(page, "pose");
  await page.getByRole("radio", { name: /Adossée/ }).first().check();
  await goStep(page, "equip");
  await expect(page.locator("#side-back")).toHaveCount(0);

  // enregistrement puis restauration : même configuration, même rendu
  const finish = await drawing.getAttribute("data-structure-color");
  await goStep(page, "recap");
  await page.getByLabel(/Nom du projet/).fill("Projet visuel");
  await page.getByRole("button", { name: "Sauvegarder le projet" }).click();
  const share = page.getByRole("link", { name: /\/projets\// });
  await expect(share).toBeVisible();
  const token = (await share.getAttribute("href"))!.split("/projets/")[1]!;
  await page.goto(`/configurateur/marbella?projet=${token}`);
  await page.getByTestId("project-drawing").waitFor();
  await expect(drawing).toHaveAttribute("data-closures", "left:screen");
  await expect(drawing).toHaveAttribute("data-structure-color", finish!);
  await expect(drawing).toHaveAttribute("data-width-mm", "3500");
});

test("aperçu mobile : le rendu suit les choix sans masquer les champs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openConfigurator(page, "marbella");
  await goStep(page, "equip");
  await page.getByTestId("drawing-peek-toggle").click();
  const peek = page.getByTestId("project-drawing-peek");
  await expect(peek).toBeVisible();
  await page.locator("#side-front").selectOption("sliding_glass");
  await expect(peek).toHaveAttribute("data-closures", "front:glass");
  await expect(page.locator("#side-front")).toBeVisible();
  await page.getByRole("button", { name: "Fermer l'aperçu" }).click();
  await expect(peek).toHaveCount(0);
});
