import { test, expect } from "./fixtures";
import { loginAdmin, shot, uid } from "./helpers";
import { pool } from "./db";

test("validation des références : contradiction REFLEKSOL (fiche 4 m / catalogue 7 m), puis un dossier de test soumis et rejeté avec historique", async ({ page }) => {
  const id = uid();
  await loginAdmin(page, "/admin/catalogue/validations");
  await expect(page.getByRole("heading", { name: "Validation des références" })).toBeVisible();

  // 1. dossier initial « à vérifier » sur la largeur maximale du screen : sources divergentes, rien n'est tranché
  await page.getByRole("link", { name: /Screen REFLEKSOL 120 ZiiiP — Largeur maximale/ }).first().click();
  await expect(page.getByTestId("divergences")).toContainText("Valeurs divergentes selon les sources");
  await expect(page.getByTestId("spec-candidates")).toContainText("Fiche du modèle (client)");
  await expect(page.getByTestId("spec-candidates")).toContainText("Document fournisseur");
  await expect(page.getByTestId("spec-candidates")).toContainText("Site du fabricant");
  await expect(page.getByRole("button", { name: "Valider cette version" })).toBeDisabled();
  await shot(page, "validation-refleksol-largeur");

  // 2. dossier de test sur une donnée technique (création → à vérifier → rejet), sans modifier la donnée
  await page.goto(`/admin/catalogue/validations/nouveau?type=FAMILY_SPEC&cible=${encodeURIComponent("pergola-sb400#height_max")}`);
  await page.getByLabel(/^Valeur numérique/).fill("3020");
  await page.getByLabel("Référence et contexte de la source").fill(`Test e2e ${id} : déclaration P/SB400/25 (dimensions maximales 7000 × 4000 × 3020 mm) — à rapprocher de la page fabricant (2,8 m)`);
  await page.getByRole("button", { name: "Créer le dossier (brouillon)" }).click();
  await expect(page.getByText("Dossier créé en brouillon.")).toBeVisible();
  const dossierId = new URL(page.url()).pathname.split("/").pop()!;
  try {
    await expect(page.getByTestId("diff")).toContainText("Valeur numérique");
    await page.getByRole("button", { name: "Soumettre (à vérifier)" }).click();
    await expect(page.getByText("Dossier soumis : à vérifier.")).toBeVisible();
    await page.getByLabel(/Commentaire/).fill(`rejet e2e ${id}`);
    await page.getByRole("button", { name: "Rejeter" }).click();
    await expect(page.getByText("Dossier rejeté.")).toBeVisible();
    const history = page.getByTestId("history");
    await expect(history).toContainText("Brouillon → À vérifier");
    await expect(history).toContainText("À vérifier → Rejeté");
    await expect(history).toContainText(`rejet e2e ${id}`);
    const rows = await pool.query(`SELECT "valueNum" FROM "TechnicalSpec" t JOIN "ProductFamily" f ON f.id = t."familyId" WHERE f.slug = 'pergola-sb400' AND t.key = 'height_max'`);
    expect(rows.rows.map((r) => r.valueNum)).not.toContain(3020);
  } finally {
    await pool.query('DELETE FROM "ReferenceValidation" WHERE id = $1', [dossierId]);
  }
});
