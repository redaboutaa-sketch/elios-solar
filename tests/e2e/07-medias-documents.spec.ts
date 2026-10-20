import { test, expect } from "./fixtures";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { acceptNecessaryOnly, shot, uid, loginAdmin } from "./helpers";
import { many, one, pool } from "./db";


async function makePdf(title: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const p = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  p.drawText(title, { x: 50, y: 780, size: 18, font });
  p.drawText("Document de test automatise - aucun contenu fournisseur.", { x: 50, y: 750, size: 11, font });
  return Buffer.from(await doc.save());
}

test("médiathèque et documents : nouvelle version PDF publiée, visible sur la fiche ; galerie fabricant avec nature et crédit", async ({ page }) => {
  const title = `Guide e2e ${uid()}`;
  try {
    await loginAdmin(page);
    // 1. création du document (v1, brouillon, sans fichier)
    await page.goto("/admin/documents");
    await page.locator("#new-title").fill(title);
    await page.locator("#new-kind").selectOption("guide");
    await page.locator("#new-audience").selectOption("PUBLIC");
    await page.locator("#new-family").selectOption({ label: "Pergola SB400" });
    await page.locator("#new-ds").selectOption("DEMO");
    await page.locator("#new-source").fill("Test automatisé");
    await page.locator("#new-summary").fill("Document de démonstration créé par le test de bout en bout.");
    await page.getByRole("button", { name: "Créer le document (v1, brouillon)" }).click();
    await expect(page.getByText("Document créé (version 1, brouillon).")).toBeVisible();
    const row = await one<{ groupKey: string }>('SELECT "groupKey" FROM "Document" WHERE title = $1', [title]);
    const group = page.locator(`details[data-group="${row!.groupKey}"]`);

    // 2. téléversement d'un PDF comme nouvelle version (v2)
    await group.locator('input[type="file"][id^="nv-file-"]').setInputFiles({ name: "guide.pdf", mimeType: "application/pdf", buffer: await makePdf(title) });
    await group.getByRole("button", { name: "Créer la version v2" }).click();
    await expect(page.getByText("Version 2 créée (brouillon).")).toBeVisible();
    const v2 = await one<{ mediaId: string | null; status: string }>('SELECT "mediaId", status FROM "Document" WHERE "groupKey" = $1 AND version = 2', [row!.groupKey]);
    expect(v2?.mediaId).toBeTruthy();
    expect(v2?.status).toBe("DRAFT");
    await shot(page, "admin-documents-version");

    // 3. workflow : relecture puis publication
    await group.getByRole("button", { name: "Soumettre à relecture v2" }).click();
    await expect(page.getByText("Version soumise à relecture.")).toBeVisible();
    await group.getByRole("button", { name: "Valider et publier v2" }).click();
    await expect(page.getByText("Version 2 publiée.")).toBeVisible();
    await shot(page, "admin-documents-publie");
    const audits = await many<{ action: string }>(`SELECT action FROM "AuditLog" WHERE entity = 'Document' AND "entityId" IN (SELECT id FROM "Document" WHERE "groupKey" = $1)`, [row!.groupKey]);
    expect(audits.map((a) => a.action)).toEqual(expect.arrayContaining(["document.create", "document.version.create", "document.status.review", "document.status.published"]));

    // 4. médiathèque : liste avec statuts
    await page.goto("/admin/medias?nature=RENDER");
    await expect(page.getByRole("heading", { name: "Médiathèque" })).toBeVisible();
    await shot(page, "admin-medias");

    // 5. fiche produit : onglet Documents + galerie fabricant (nature et crédit affichés)
    await page.goto("/pergolas/pergola-sb400");
    await acceptNecessaryOnly(page);
    await expect(page.getByTestId("media-nature").first()).toHaveText("Photographie fournisseur");
    await expect(page.getByTestId("media-credit").first()).toContainText("Catalogue THYSENS");
    await page.getByRole("button", { name: /Afficher : Vue de dessous de la toiture/ }).click();
    await expect(page.getByTestId("media-nature").first()).toHaveText("Rendu fabricant");
    await expect(page.getByTestId("media-options").first()).toContainText("non inclus d'office : éclairage LED périphérique (option)");
    await shot(page, "fiche-galerie-rendu");
    await page.getByRole("tab", { name: /^Documents/ }).click();
    const link = page.getByRole("link", { name: title });
    await expect(link).toBeVisible();
    await expect(page.getByTestId("document-list")).toContainText("version 2");
    const href = await link.getAttribute("href");
    const pdf = await page.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    await shot(page, "fiche-documents");
  } finally {
    const docs = await many<{ mediaId: string | null }>('SELECT "mediaId" FROM "Document" WHERE title = $1', [title]);
    await pool.query('DELETE FROM "Document" WHERE title = $1', [title]);
    const ids = docs.map((d) => d.mediaId).filter(Boolean);
    if (ids.length) await pool.query('DELETE FROM "Media" WHERE id = ANY($1)', [ids]);
  }
});
