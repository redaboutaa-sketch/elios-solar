import { test, expect } from "./fixtures";
import { acceptNecessaryOnly, chooseFabric, goStep, uid } from "./helpers";
import { one, pool } from "./db";

/**
 * Projet ANCIEN enregistré côté serveur (fixture représentant une version d'avant la révision HelioLux du 2026-11-03) :
 * toile serge_100, commande et option de l'ancienne fiche, fermeture d'un système inconnu. Chaque ancien choix est
 * nommé et se corrige explicitement ; les choix valides (cotes, pose, teinte) sont conservés ; le projet enregistré
 * n'est jamais modifié sans action du client (aucune conversion silencieuse).
 */
test("projet HelioLux enregistré avant la révision : anciens choix nommés, corrigés un à un, projet en base inchangé", async ({ page }) => {
  const token = `recette-ancien-${uid()}`;
  const input = { kind: "system", familySlug: "sevilla", widthMm: 3700, depthMm: 3990, heightMm: 2450, mounting: "wall", finishCode: "RAL_7016_MAT", fabricCode: "serge_100", controlCode: "radio_io", options: [{ code: "wind_automation" }], sides: { left: "veranda_fts" }, installation: "self", delivery: { countryCode: "FR" } };
  const { rows } = await pool.query(`INSERT INTO "Configuration" (id, "shareToken", kind, title, "engineVersion", "catalogVersion", input, result, "updatedAt", "createdAt") VALUES ($1, $2, 'system', 'Projet ancien (recette)', 'ancien', '2026-10-30', $3, '{}', '2026-10-30T10:00:00Z', '2026-10-30T10:00:00Z') RETURNING id`, [`cfg_${uid()}${uid()}`, token, JSON.stringify(input)]);
  const id = rows[0].id as string;
  try {
    await page.goto(`/configurateur/sevilla?projet=${token}`);
    await acceptNecessaryOnly(page);
    await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
    const price = page.getByTestId("system-price");
    await expect(price).toHaveAttribute("data-price-status", "blocked");
    await expect(page.getByTestId("revision-notice")).toBeVisible();
    const blockers = page.getByTestId("price-blockers").locator("li");
    // toile, commande, option et fermeture : quatre anciens choix nommés (nature « ancien choix à refaire »)
    await expect(blockers).toHaveCount(4);
    for (const k of await blockers.all()) await expect(k).toHaveAttribute("data-kind", "stale");
    await expect(page.getByTestId("price-blockers")).toContainText("Toile Serge 100");
    // corrections explicites, étape par étape
    await chooseFabric(page, "Toile PVC blanche (602N opaque)");
    await expect(page.locator("#control option:checked")).toContainText("plus proposé");
    await page.locator("#control").selectOption("radio_included");
    await goStep(page, "equip");
    await page.getByTestId("stale-option-wind_automation").getByRole("button", { name: "Retirer" }).click();
    await expect(page.locator("#side-left option:checked")).toContainText("plus proposé");
    await page.locator("#side-left").selectOption("");
    await expect(page.getByTestId("price-blockers")).toHaveCount(0);
    await expect(page.getByTestId("revision-notice")).toHaveCount(0);
    await expect(price).not.toHaveAttribute("data-price-status", /^(blocked|error)$/);
    // choix valides conservés
    await goStep(page, "pose");
    await expect(page.getByTestId("finish-selected")).toContainText("7016");
    await expect(page.getByRole("radio", { name: /Adossée/ })).toBeChecked();
    // le projet enregistré n'a pas été converti
    const saved = await one<{ f: string; c: string }>(`SELECT input->>'fabricCode' AS f, input->>'controlCode' AS c FROM "Configuration" WHERE id = $1`, [id]);
    expect(saved).toEqual({ f: "serge_100", c: "radio_io" });
  } finally {
    await pool.query(`DELETE FROM "Configuration" WHERE id = $1`, [id]);
  }
});
