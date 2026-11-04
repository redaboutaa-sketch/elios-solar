import { expect, test } from "@playwright/test";
import { createAccount, loginAdmin, uid } from "./helpers";
import { IN_FORCE_GRID_SQL, many, one, pool } from "./db";

/**
 * Comparatif marché (Administration → Tarifs) : recette complète configuration → comparables → simulation → brouillon,
 * puis contrôle qu'AUCUN prix public n'a changé (grilles de vente en vigueur identiques avant et après). Les données de
 * test sont nettoyées : relevé et proposition archivés, brouillon de grille rejeté. Base sans grille de vente HelioMax
 * (CI) : la partie chiffrée est couverte par les tests d'intégration (tests/integration/market.test.ts).
 */
const publicPrices = async () => JSON.stringify(await many(`SELECT r."listId", r.kind, r.code, r."dimAmm", r."widthMinMm", r."widthMaxMm", r."amountMinor" FROM "SupplierPriceRow" r JOIN "SupplierPriceList" l ON l.id = r."listId" WHERE ${IN_FORCE_GRID_SQL} ORDER BY 1, 2, 3, 4, 5, 6`));

test("configuration → comparables → simulation → brouillon, sans changer un prix public", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "parcours d'écriture : une seule fois par campagne");
  test.setTimeout(180_000);
  const before = await publicPrices();
  const tag = uid();
  await loginAdmin(page, "/admin/tarifs");
  await page.getByRole("link", { name: "Comparatif marché" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Comparatif marché" })).toBeVisible();
  await expect(page.getByTestId("market-note")).toContainText("Aucune action de cette page ne modifie un prix public");

  // politique de coût : créée si aucune n'est en vigueur (base de recette)
  const policy = await one(`SELECT id FROM "CostPolicyVersion" WHERE "validFrom" <= now() LIMIT 1`);
  if (!policy) {
    await page.goto("/admin/tarifs/comparatif-marche/politique");
    const f = page.getByTestId("policy-form");
    await f.getByLabel("Remise revendeur (%) *").fill("37");
    await f.getByLabel("Note (source de la décision)").fill("recette e2e");
    await f.getByRole("button", { name: "Enregistrer une nouvelle version" }).click();
    await expect(page.getByText(/Version \d+ de la politique de coût enregistrée/)).toBeVisible();
    await expect(page.getByTestId("policy-versions")).toContainText("37 %");
  }

  // relevé saisi à la main, corrigé (historique)
  await page.goto("/admin/tarifs/comparatif-marche/releves");
  const form = page.getByTestId("observation-form");
  await form.getByLabel("Revendeur *").fill(`Recette ${tag}`);
  await form.getByLabel("Modèle *").fill("Bioclimatique adossée e2e");
  await form.getByLabel("URL exacte *").fill(`https://example.invalid/e2e-${tag}`);
  await form.getByLabel("Produit HELIOSTORES comparé *").selectOption("marbella");
  await form.getByLabel("Largeur (mm)").fill("4000");
  await form.getByLabel("Avancée / profondeur (mm)").fill("4000");
  await form.getByLabel("Implantation").selectOption("wall");
  await form.getByLabel("Prix constaté (€) *").fill("9000");
  await form.getByLabel("Comparabilité *").selectOption("PARTIAL");
  await form.getByRole("button", { name: "Ajouter le relevé" }).click();
  await expect(page.getByText("Relevé ajouté.")).toBeVisible();
  const obsUrl = page.url();
  const edit = page.getByTestId("observation-edit");
  await edit.getByLabel("Prix constaté (€) *").fill("9100");
  await edit.getByLabel("Motif de la correction *").fill("prix relu");
  await edit.getByRole("button", { name: "Enregistrer la correction" }).click();
  await expect(page.getByText(/Relevé corrigé/)).toBeVisible();
  await expect(page.getByTestId("observation-history").getByRole("row")).toHaveCount(2);

  // étude d'une configuration réelle
  await page.goto("/admin/tarifs/comparatif-marche?produit=marbella&pose=wall&largeur=4000&cote=4000");
  await expect(page.getByTestId("market-offers")).toContainText(`Recette ${tag}`);
  await expect(page.getByTestId("market-offers")).toContainText("comparabilité partielle");
  const priced = await one(`SELECT l.id FROM "SupplierPriceList" l WHERE ${IN_FORCE_GRID_SQL} AND l."familySlug" = 'marbella' AND l."variantKey" = 'murale' LIMIT 1`);
  if (priced) {
    await expect(page.getByTestId("net-cost")).toContainText("établi");
    await expect(page.getByTestId("cost-lines")).toContainText("remise revendeur appliquée");
    await expect(page.getByTestId("contribution")).toContainText(/partielle/);
    // simulation instantanée (navigateur)
    await page.getByTestId("sim-price-input").fill("12000");
    await expect(page.getByTestId("sim-margin")).toContainText("%");
    // export de la simulation
    const csv = await page.request.get(`/admin/tarifs/comparatif-marche/export?type=simulation&produit=marbella&pose=wall&largeur=4000&cote=4000`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("achat net établi");
    // proposition en brouillon, puis brouillon de grille d'une cellule
    const p = page.getByTestId("proposal-form");
    await p.getByLabel("Scénario").selectOption("manuel");
    await p.getByLabel("Prix proposé HT (€)").fill("99999");
    await p.getByRole("button", { name: /Préparer la proposition/ }).click();
    const outcome = page.getByText(/Proposition enregistrée en brouillon|sous le plancher/);
    await expect(outcome).toBeVisible();
    if (await page.getByText("Proposition enregistrée en brouillon").isVisible()) {
      const row = page.getByTestId("proposals").getByRole("row").filter({ hasText: "99 999" }).first();
      await row.getByTestId("draft-grid").click();
      await expect(page.getByText(/Brouillon v\d+ créé \(une cellule modifiée\)/)).toBeVisible();
      await page.getByRole("button", { name: "Rejeter le brouillon" }).click();
      await expect(page.getByText("Brouillon rejeté")).toBeVisible();
      await page.goto("/admin/tarifs/comparatif-marche?produit=marbella&pose=wall&largeur=4000&cote=4000");
      await page.getByTestId("proposals").getByRole("row").filter({ hasText: "99 999" }).first().getByRole("button", { name: "Archiver" }).click();
      await expect(page.getByText("Proposition archivée.")).toBeVisible();
    }
  } else {
    await expect(page.getByTestId("market-versions")).toContainText("aucune grille de vente en vigueur");
  }
  // export des relevés
  const rel = await page.request.get("/admin/tarifs/comparatif-marche/export?type=releves&produit=marbella");
  expect(rel.status()).toBe(200);
  expect(await rel.text()).toContain(`Recette ${tag}`);

  // nettoyage : relevé archivé (historique conservé)
  await page.goto(obsUrl);
  await page.getByRole("button", { name: /Archiver/ }).click();
  await expect(page.getByText(/Relevé archivé/)).toBeVisible();
  expect(await publicPrices()).toBe(before);
});

test("visiteur, client et gestionnaire : comparatif et exports refusés", async ({ browser }) => {
  const ctx = await browser.newContext();
  const v = await ctx.newPage();
  for (const path of ["/admin/tarifs/comparatif-marche", "/admin/tarifs/comparatif-marche/releves", "/admin/tarifs/comparatif-marche/politique"]) {
    await v.goto(path);
    await expect(v).toHaveURL(/\/compte\/connexion/);
  }
  expect((await v.request.get("/admin/tarifs/comparatif-marche/export?type=releves")).status()).toBe(404);
  const email = `client-marche-${uid()}@test.invalid`;
  await createAccount(v, email, `Mdp-${uid()}-${uid()}`);
  await v.goto("/admin/tarifs/comparatif-marche");
  await expect(v).toHaveURL(/\/compte\?forbidden=1/);
  expect((await v.request.get("/admin/tarifs/comparatif-marche/export?type=releves")).status()).toBe(404);
  // gestionnaire (rôle MANAGER) : l'écran Tarifs et ses données restent réservés aux administrateurs
  await pool.query(`UPDATE "user" SET role = 'MANAGER' WHERE email = $1`, [email]);
  await v.goto("/admin/tarifs/comparatif-marche/releves");
  expect(await v.content()).not.toContain("Relevés concurrents");
  expect((await v.request.get("/admin/tarifs/comparatif-marche/export?type=propositions")).status()).toBe(404);
  await ctx.close();
});
