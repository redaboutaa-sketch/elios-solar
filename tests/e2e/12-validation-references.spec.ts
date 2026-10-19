import { test, expect } from "@playwright/test";
import { loginAdmin, shot, uid } from "./helpers";
import { pool } from "./db";

test("validation des références : dossier câble (conflit, manques), puis un dossier de test soumis et rejeté avec historique", async ({ page }) => {
  const id = uid();
  await loginAdmin(page, "/admin/catalogue/validations");
  await expect(page.getByRole("heading", { name: "Validation des références" })).toBeVisible();

  // 1. dossier initial « à vérifier » sur la longueur du câble : rien n'est confirmé
  await page.getByRole("link", { name: /Store banne Ombra — Longueur du câble/ }).first().click();
  await expect(page.getByTestId("divergences")).toContainText("Valeurs divergentes selon les sources");
  await expect(page.getByTestId("missing")).toContainText("Valeur confirmée par le fournisseur");
  await expect(page.getByTestId("spec-candidates")).toContainText("Donnée fictive (démonstration)");
  await expect(page.getByTestId("spec-candidates")).toContainText("Observation sur la référence");
  await expect(page.getByTestId("blockers")).toContainText("Source manquante");
  await expect(page.getByRole("button", { name: "Valider cette version" })).toBeDisabled();
  await expect(page.getByTestId("impact")).toContainText("Configurations enregistrées concernées");
  await shot(page, "validation-cable");

  // 2. dossier de test sur une référence (création → à vérifier → rejet), sans modifier la donnée
  await page.goto("/admin/catalogue/validations/nouveau?type=VARIANT&cible=ES-SV-3M-ANT");
  await page.getByLabel(/^Délai minimum/).fill("12");
  await page.getByLabel("Référence et contexte de la source").fill(`Test e2e ${id} : aucune source réelle`);
  await page.getByRole("button", { name: "Créer le dossier (brouillon)" }).click();
  await expect(page.getByText("Dossier créé en brouillon.")).toBeVisible();
  const dossierId = new URL(page.url()).pathname.split("/").pop()!;
  try {
    await expect(page.getByTestId("diff")).toContainText("Délai minimum");
    await expect(page.getByTestId("checklist")).toContainText("Mise en vente activée (décision séparée, jamais automatique)");
    await page.getByRole("button", { name: "Soumettre (à vérifier)" }).click();
    await expect(page.getByText("Dossier soumis : à vérifier.")).toBeVisible();
    await page.getByLabel(/Commentaire/).fill(`rejet e2e ${id}`);
    await page.getByRole("button", { name: "Rejeter" }).click();
    await expect(page.getByText("Dossier rejeté.")).toBeVisible();
    const history = page.getByTestId("history");
    await expect(history).toContainText("Brouillon → À vérifier");
    await expect(history).toContainText("À vérifier → Rejeté");
    await expect(history).toContainText(`rejet e2e ${id}`);
    await expect(page.getByRole("button", { name: "Valider cette version" })).toHaveCount(0);
    const v = await pool.query('SELECT "leadMinDays" FROM "Variant" WHERE sku = $1', ["ES-SV-3M-ANT"]);
    expect(v.rows[0].leadMinDays).not.toBe(12);
  } finally {
    await pool.query('DELETE FROM "ReferenceValidation" WHERE id = $1', [dossierId]);
  }
});
