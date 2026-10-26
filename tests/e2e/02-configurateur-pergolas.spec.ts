import { test, expect, newClientContext } from "./fixtures";
import { acceptNecessaryOnly, createAccount, fillQuote, goStep, loginAdmin, openConfigurator, setDim, shot, stepIssues, uid } from "./helpers";
import { one, publicCell, publicPricesActive } from "./db";
import { PUBLIC_FORBIDDEN_NAMES, withoutSellerIdentity } from "../../src/domain/public-sanitize";

// Chromium headless : rendu WebGL logiciel (SwiftShader).
test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

test("Marbella : règles de cotes, options, fermeture souhaitée, 3D, projet enregistré et devis avec visualisation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await acceptNecessaryOnly(page);
  const email = `marbella-${uid()}@test.invalid`;
  await createAccount(page, email, `Mdp-${uid()}-${uid()}`);
  await openConfigurator(page, "marbella");

  // 1. dimensions : bornes documentées (blocages affichés dans l'étape), saisie au millimètre
  await setDim(page, "dim-width", 4100);
  await expect(stepIssues(page, "dims")).toContainText("Largeur : de 1 m à 4 m");
  await setDim(page, "dim-depth", 6100);
  await expect(stepIssues(page, "dims")).toContainText("Avancée : de 1,39 m à 6,01 m");
  await setDim(page, "dim-width", 3600);
  await setDim(page, "dim-depth", 5000);
  await setDim(page, "dim-height", 2900);
  await expect(page.getByTestId("step-dims")).not.toContainText("Impossible");

  // 2. pose et teinte
  await page.getByTestId("step-next").click();
  await page.getByRole("radio", { name: "Autoportante" }).check();
  await page.getByLabel("Teinte de structure").selectOption({ label: "RAL 7016 mat" });

  // 3. équipements : éclairage (cumul non documenté), capteurs à confirmer, fermeture vitrée souhaitée
  await page.getByTestId("step-next").click();
  await page.getByTestId("option-led_blades").getByRole("checkbox").check();
  await page.getByTestId("option-led_spots").getByRole("checkbox").check();
  await page.getByTestId("option-weather_sensors").getByRole("checkbox").check();
  await page.getByTestId("option-heating").getByRole("checkbox").check();
  await expect(page.getByTestId("wind-behaviour")).toContainText("ouvrir les lames à 90°");
  await page.locator("#side-front").selectOption({ label: "Fermetures latérales coulissantes (vitrage) (à étudier)" });

  // 4. récapitulatif : points à confirmer, prix de la grille (aucune grille Marbella : sur devis)
  await page.getByTestId("step-next").click();
  const issues = stepIssues(page, "recap").first();
  await expect(issues).toContainText("Hauteur supérieure à 2,81 m");
  // spots + LED linéaire dans les lames : cumul déclaré « à confirmer » par la fiche du modèle
  await expect(issues, "cumul spots LED + LED linéaire signalé").toContainText("cumul non documenté");
  await expect(issues).toContainText("Fermetures latérales coulissantes (vitrage) côté avant");
  await expect(issues).toContainText("Chauffage : souhait noté pour le devis");
  const recap = page.getByTestId("system-recap");
  await expect(recap).toContainText("Marbella");
  await expect(recap).toContainText("5 m");
  await expect(recap).toContainText("Fermeture côté avant");
  const expectedCell = (await publicPricesActive()) ? await publicCell("marbella", "autoportante", 5000, 3600) : null;
  const priced = expectedCell != null;
  if (priced) {
    await expect(page.getByTestId("system-price")).toHaveAttribute("data-priced", "true");
    await expect(page.getByTestId("system-price-amount")).toContainText(/€\s?HT/);
  } else {
    await expect(page.getByTestId("system-price")).toHaveAttribute("data-priced", "false");
    await expect(page.getByTestId("system-price")).toContainText("Prix sur devis");
    await expect(recap).not.toContainText("€");
  }
  await expect(page.getByTestId("online-order")).toHaveAttribute("data-orderable", "false");
  await expect(page.getByTestId("online-order")).toContainText("les options sont chiffrées au devis");

  // 3D : même configuration que le devis
  await page.getByTestId("view-3d-toggle").click();
  await expect(page.locator("[data-testid=scene-3d] canvas")).toBeVisible({ timeout: 30_000 });
  const description = page.locator("#scene-3d-description");
  await expect(description).toContainText("3,6");
  await expect(description).toContainText("5 m");
  await expect(page.getByTestId("scene-3d-to-confirm")).toContainText("côté avant");
  await shot(page, "configurateur-pergola-3d");
  await page.getByTestId("view-drawing-toggle").click();
  await expect(page.getByTestId("project-drawing")).toBeVisible();

  // projet enregistré puis repris depuis le compte
  const title = `Terrasse e2e ${uid()}`;
  await page.getByLabel("Nom du projet (facultatif)").fill(title);
  await page.getByRole("button", { name: "Sauvegarder le projet" }).click();
  await expect(page.getByText("Projet enregistré.")).toBeVisible();

  const number = await fillQuote(page, email);
  await expect(page.getByTestId("quote-visual-status")).toContainText("est jointe au devis");
  const quote = await one<{ id: string; kind: string; snapshot: { input: { familySlug: string; widthMm: number; depthMm: number }; result: { priceMode: string; lines: unknown[]; systemPrice?: { amountMinor: number; currency: string; taxBasis: string } | null } }; configurationId: string | null }>('SELECT id, kind, snapshot, "configurationId" FROM "Quote" WHERE number = $1', [number]);
  expect(quote!.kind).toBe("system");
  expect(quote!.snapshot.input).toMatchObject({ familySlug: "marbella", widthMm: 3600, depthMm: 5000 });
  expect(quote!.snapshot.result.priceMode).toBe("quote");
  expect(quote!.snapshot.result.lines).toEqual([]);
  // prix recalculé par le serveur : même cellule que l'aperçu
  expect(quote!.snapshot.result.systemPrice?.amountMinor ?? null).toBe(expectedCell);
  expect(quote!.configurationId).toBeTruthy();
  const visual = await one<{ kind: string; represented: string[] }>('SELECT kind, represented FROM "QuoteVisual" WHERE "quoteId" = $1', [quote!.id]);
  expect(visual!.kind).toBe("SCENE_3D");
  expect(visual!.represented.length).toBeGreaterThan(0);

  await page.goto("/compte/devis");
  const card = page.getByTestId("account-quote").filter({ hasText: number });
  await expect(card).toContainText(priced ? /Marbella · structure \d/ : /Marbella · prix sur devis/);
  await expect.poll(() => card.getByTestId("quote-visual").locator("img").evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  const pdf = await page.request.get(`/api/devis/${quote!.id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect(withoutSellerIdentity(Buffer.from(await pdf.body()).toString("latin1"))).not.toMatch(PUBLIC_FORBIDDEN_NAMES);

  await page.goto("/compte/projets");
  const project = page.locator("li").filter({ hasText: title });
  await expect(project).toContainText(priced ? "structure" : "prix sur devis");
  await project.getByRole("link", { name: "Reprendre" }).click();
  await expect(page.locator("#dim-width")).toHaveValue("3600");
  await expect(page.locator("#dim-depth")).toHaveValue("5000");
  expect(errors).toEqual([]);

});

test("devis en administration : récapitulatif, origine du prospect, qualification, acceptation, puis paiement du devis par le client", async ({ page }) => {
  // première page de la session avec paramètres de campagne : attribution jointe au devis
  await page.goto("/?utm_source=e2e&utm_campaign=recette-heliostores");
  await acceptNecessaryOnly(page);
  const email = `devis-${uid()}@test.invalid`;
  await createAccount(page, email, `Mdp-${uid()}-${uid()}`);
  await openConfigurator(page, "marbella");
  await setDim(page, "dim-width", 3600);
  await setDim(page, "dim-depth", 5000);
  await goStep(page, "recap");
  const number = await fillQuote(page, email);
  const quote = await one<{ id: string; attribution: { params: Record<string, string> } | null }>('SELECT id, attribution FROM "Quote" WHERE number = $1', [number]);
  expect(quote!.attribution?.params).toMatchObject({ utm_source: "e2e", utm_campaign: "recette-heliostores" });
  const priced = (await publicPricesActive()) && (await publicCell("marbella", "autoportante", 5000, 3600)) != null;

  // administration : récapitulatif, origine du prospect, qualification, acceptation au montant TTC, paiement ouvert
  const admin = await newClientContext(page.context().browser()!, { viewport: page.viewportSize() });
  const adminPage = await admin.newPage();
  await loginAdmin(adminPage, `/admin/devis/${quote!.id}`);
  await expect(adminPage.getByTestId("quote-recap")).toContainText("Marbella");
  await expect(adminPage.getByTestId("quote-system-price")).toContainText(priced ? "Prix de la structure affiché au client" : "sur devis");
  await expect(adminPage.getByTestId("quote-attribution")).toContainText("utm_source=e2e");
  await expect(adminPage.getByTestId("quote-qualification")).toHaveText("À qualifier");
  // un devis non accepté ne peut pas être payé en ligne
  await expect(adminPage.getByTestId("quote-payment").getByRole("button", { name: /Ouvrir le paiement/ })).toHaveCount(0);
  await adminPage.getByLabel("Qualification du prospect").selectOption("QUALIFIED");
  await adminPage.getByLabel("Statut").selectOption("ACCEPTED");
  await adminPage.getByLabel("Montant proposé TTC (€)").fill("4800");
  await adminPage.getByRole("button", { name: "Enregistrer" }).click();
  await expect(adminPage.getByTestId("quote-qualification")).toHaveText("Qualifié");
  const payment = adminPage.getByTestId("quote-payment");
  await payment.getByLabel("Taux de TVA du devis (%)").fill("20");
  await payment.getByRole("button", { name: /Ouvrir le paiement \(4\s800,00\s€\sTTC\)/ }).click();
  await expect(adminPage.getByText(/Paiement ouvert : commande CMD-/)).toBeVisible();
  await shot(adminPage, "admin-devis-systeme");
  const order = await one<{ id: string; totalCents: number; status: string }>('SELECT id, "totalCents", status FROM "Order" WHERE "quoteId" = $1', [quote!.id]);
  expect(order).toMatchObject({ totalCents: 480000, status: "PENDING_PAYMENT" });
  await admin.close();

  // client : règlement du devis accepté (paiement de démonstration), montant fixé par le conseiller
  await page.goto(`/commande/${order!.id}/payer`);
  await expect(page.getByTestId("pay-order")).toBeVisible();
  await expect(page.getByTestId("pay-total")).toContainText(/4\s800,00\s€/);
  await shot(page, "paiement-devis");
  await page.getByRole("button", { name: "Continuer vers le paiement sécurisé" }).click();
  await page.waitForURL(/paiement-demo/);
  await expect(page.getByText("PAIEMENT SIMULÉ — MODE TEST")).toBeVisible();
  await page.getByRole("button", { name: "Simuler un paiement accepté" }).click();
  await page.waitForURL(/confirmation/);
  await expect.poll(async () => (await one<{ status: string }>('SELECT status FROM "Order" WHERE id = $1', [order!.id]))!.status, { timeout: 20_000 }).toBe("PAID");
});

test("Sevilla sans WebGL : toiture toile en modules, souhait d'automatisme ; le dessin du projet est joint au devis", async ({ browser, page }) => {
  const ctx = await newClientContext(browser, { viewport: page.viewportSize() });
  await ctx.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (/webgl/i.test(type)) return null;
      return (orig as (...a: unknown[]) => RenderingContext | null).call(this, type, ...args);
    } as typeof orig;
  });
  const p = await ctx.newPage();
  await openConfigurator(p, "sevilla");
  await setDim(p, "dim-width", 5200);
  await expect(stepIssues(p, "dims")).toContainText("Largeur : de 2 m à 5 m");
  await setDim(p, "dim-width", 4800);
  await setDim(p, "dim-depth", 5500);
  await setDim(p, "dim-height", 2400);
  await expect(p.getByTestId("step-dims")).not.toContainText("Impossible");
  await goStep(p, "pose");
  await p.locator("#fabric").selectOption({ label: "Toile Serge 600" });
  await goStep(p, "equip");
  await p.getByTestId("option-wishes").getByTestId("option-wind_automation").getByRole("checkbox").check();
  await p.getByLabel(/Installation en plusieurs modules/).check();
  await expect(p.getByTestId("wind-behaviour")).toContainText("enroulée");
  await goStep(p, "recap");
  await expect(stepIssues(p, "recap").first()).toContainText("composition (modules, poteaux, gouttières) établie au devis");
  await expect(p.getByTestId("system-recap")).toContainText("Automatisme de vent (étude au devis)");
  await expect(p.getByTestId("system-recap")).toContainText("Toile Serge 600");
  await p.getByTestId("view-3d-toggle").click();
  await expect(p.getByTestId("scene-3d-unavailable")).toBeVisible({ timeout: 20_000 });
  const number = await fillQuote(p, `sevilla-${uid()}@test.invalid`);
  // le dessin 2D (sans WebGL) est l'image jointe au devis
  await expect(p.getByTestId("quote-visual-status")).toContainText("est joint");
  const v = await one<{ kind: string; mime: string }>('SELECT v.kind, v.mime FROM "QuoteVisual" v JOIN "Quote" q ON q.id = v."quoteId" WHERE q.number = $1', [number]);
  expect(v).not.toBeNull();
  expect(["SCENE_3D", "PLAN_2D"]).toContain(v!.kind);
  await shot(p, "configurateur-sevilla-sans-webgl");
  await ctx.close();
});
