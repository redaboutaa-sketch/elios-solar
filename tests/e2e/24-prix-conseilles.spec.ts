import { expect, test } from "@playwright/test";
import { createAccount, loginAdmin, uid } from "./helpers";
import { IN_FORCE_GRID_SQL, many, pool } from "./db";

/**
 * « Mes prix conseillés » (administration) et prix d'appel publics. Aucune action d'écriture ici : la préparation et
 * la publication des grilles sont couvertes par tests/integration/market.test.ts. Contrôle : aucun prix public modifié
 * par la consultation ; pages, exports et actions refusés hors administrateurs ; prix d'appel TTC (HT en second),
 * configuration décrite, configurateur ouvert sur cette configuration au même prix ; visuels sans « Visuel à venir ».
 */
const publicPrices = async () => JSON.stringify(await many(`SELECT r."listId", r.kind, r.code, r."dimAmm", r."widthMinMm", r."widthMaxMm", r."amountMinor" FROM "SupplierPriceRow" r JOIN "SupplierPriceList" l ON l.id = r."listId" WHERE ${IN_FORCE_GRID_SQL} ORDER BY 1, 2, 3, 4, 5, 6`));
const norm = (s: string | null) => (s ?? "").replace(/[\s  ]+/g, " ").trim();

test("tableau de bord → Mes prix conseillés : marge cible, relevés, lignes expliquées, sans publication", async ({ page }) => {
  const before = await publicPrices();
  await loginAdmin(page, "/admin");
  await page.getByTestId("dashboard-advice").click();
  await expect(page.getByRole("heading", { level: 1, name: "Mes prix conseillés" })).toBeVisible();
  await expect(page.getByTestId("market-note")).toBeVisible();
  await expect(page.getByTestId("advice-header")).toContainText("Marge brute cible");
  await expect(page.getByTestId("advice-header")).toContainText("Produits réellement comparés");
  // lecture : niveaux A/B/C/D séparés de la fraîcheur et du périmètre ; une ligne par configuration précise
  await expect(page.getByTestId("advice-summary")).toContainText("même système fournisseur");
  const rows = page.locator('[data-testid^="advice-row-"]');
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const r = rows.nth(i);
    await expect(r.getByTestId("advice-current")).toContainText(/TTC|—/);
    await expect(r.getByTestId("advice-status")).toContainText(/Comparaison directe|Positionnement indicatif|Produit seul comparé|Données à actualiser|Données insuffisantes/);
    await r.getByTestId("advice-understand").locator("summary").click();
    await expect(r.getByTestId("advice-understand")).toContainText(/marge|Marge/);
    await expect(r.getByTestId("advice-prepare").or(r.getByTestId("advice-prepare-none"))).toBeVisible();
  }
  // navigation Tarifs
  await page.goto("/admin/tarifs");
  await expect(page.getByRole("link", { name: "Mes prix conseillés" }).first()).toBeVisible();
  expect(await publicPrices()).toBe(before);
});

test("visiteur, client et gestionnaire : Mes prix conseillés refusé", async ({ browser }) => {
  const ctx = await browser.newContext();
  const v = await ctx.newPage();
  await v.goto("/admin/tarifs/prix-conseilles");
  await expect(v).toHaveURL(/\/compte\/connexion/);
  const email = `client-conseil-${uid()}@test.invalid`;
  await createAccount(v, email, `Mdp-${uid()}-${uid()}`);
  await v.goto("/admin/tarifs/prix-conseilles");
  await expect(v).toHaveURL(/\/compte\?forbidden=1/);
  await pool.query(`UPDATE "user" SET role = 'MANAGER' WHERE email = $1`, [email]);
  await v.goto("/admin/tarifs/prix-conseilles");
  expect(await v.content()).not.toContain("Marge brute cible");
  await v.goto("/admin");
  await expect(v.getByTestId("dashboard-advice")).toHaveCount(0);
  await ctx.close();
});

test("prix d'appel : TTC puis HT, configuration décrite, configurateur au même prix ; aucun « Visuel à venir »", async ({ page }) => {
  test.setTimeout(240_000);
  for (const path of ["/", "/pergolas", "/screens", "/stores-bannes", "/moustiquaires"]) {
    await page.goto(path);
    await expect(page.getByText("Visuel à venir", { exact: true })).toHaveCount(0);
  }
  await page.goto("/pergolas");
  const cards = page.getByTestId("collection").locator("li");
  for (let i = 0; i < (await cards.count()); i++) {
    const card = cards.nth(i);
    // sans photo autorisée du modèle exact : illustration de principe qualifiée
    if (await card.getByTestId("study-sketch").count()) await expect(card.getByTestId("principle-caption")).toContainText("Illustration de principe");
  }
  const products = [["pergolas", "malaga"], ["pergolas", "marbella"], ["pergolas", "sevilla"], ["screens", "helioscreen"], ["stores-bannes", "casablanca"]] as const;
  let checked = 0;
  for (const [cat, slug] of products) {
    await page.goto(`/${cat}/${slug}`);
    const fp = page.getByTestId("from-price");
    if (!(await fp.count())) continue; // base sans grille de vente publiée (CI) : prix au devis
    const ttc = norm(await fp.locator("strong").textContent());
    expect(ttc).toMatch(/€ TTC$/);
    await expect(page.getByTestId("from-price-ht")).toContainText("€ HT");
    await expect(page.getByTestId("entry-config")).toContainText("Configuration de départ");
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) ?? "[]");
    const product = (Array.isArray(ld) ? ld : [ld]).flat().find((x: { "@type"?: string }) => x["@type"] === "Product");
    expect(product.offers.priceSpecification.valueAddedTaxIncluded).toBe(true);
    const href = await page.getByRole("link", { name: "Configurer à mes cotes" }).getAttribute("href");
    expect(href).toBe(`/configurateur/${slug}?depart=1`);
    await page.goto(href!);
    expect(norm(await page.locator("body").innerText())).toContain(ttc.replace(/ TTC$/, ""));
    checked++;
  }
  test.info().annotations.push({ type: "prix d'appel vérifiés", description: String(checked) });
});
