import { test, expect, newClientContext, type Page } from "./fixtures";
import { acceptNecessaryOnly, createAccount, fillQuote, loginAdmin, shot, uid } from "./helpers";
import { one, publicCell, publicPricesActive } from "./db";

// Chromium headless : rendu WebGL logiciel (SwiftShader).
test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

async function setDim(page: Page, id: string, value: number) {
  const input = page.locator(`#${id}`);
  await input.fill(String(value));
  await input.blur();
}

test("HELIO Horizon : règles de cotes, options, fermeture souhaitée, 3D, projet enregistré et devis avec visualisation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // première page de la session avec paramètres de campagne : attribution jointe au devis
  await page.goto("/?utm_source=e2e&utm_campaign=recette-heliostores");
  await acceptNecessaryOnly(page);
  const email = `sb400-${uid()}@test.invalid`;
  await createAccount(page, email, `Mdp-${uid()}-${uid()}`);
  await page.goto("/configurateur/helio-horizon");
  await acceptNecessaryOnly(page);
  const issues = page.locator('ul[aria-live="polite"]');

  await setDim(page, "dim-width", 3600);
  await setDim(page, "dim-depth", 1500);
  await expect(issues).toContainText("disponible par pas de 20 cm");
  await page.getByRole("button", { name: "Utiliser 1600 mm" }).click();
  await expect(issues).not.toContainText("par pas de 20 cm");
  await setDim(page, "dim-depth", 7200);
  await expect(issues).toContainText("Projection : de 1,4 m à 7 m");
  await setDim(page, "dim-width", 4100);
  await expect(issues).toContainText("Largeur : de 1,4 m à 4 m");
  await setDim(page, "dim-width", 3600);
  await setDim(page, "dim-depth", 5000);
  await setDim(page, "dim-height", 2600);
  await expect(issues).not.toContainText("Impossible");

  await page.getByRole("radio", { name: "Autoportante" }).check();
  await page.getByLabel("Teinte de structure").selectOption({ label: "FSM 71319" });
  await page.getByLabel(/HELIO Lumière — spots LED dans les lames/).check();
  await expect(page.getByText(/HELIO Lumière — spots LED dans les lames \(9 points pour ces dimensions\)/)).toBeVisible();
  await page.getByLabel(/HELIO Lumière — bandeau LED périphérique/).check();
  await expect(issues).toContainText("cumul non documenté");
  await page.locator("#side-front").selectOption({ label: "Screen HELIO Ombra (à étudier)" });
  await expect(issues).toContainText("intégration d'un screen HELIO Ombra étudiée au devis");

  const recap = page.getByTestId("system-recap");
  await expect(recap).toContainText("HELIO Horizon");
  await expect(recap).toContainText("5 m");
  // prix : cellule « Prix final HELIOSTORES » autoportante 5 m × 4 m (largeur 3,6 m arrondie à la dimension supérieure)
  const priced = await publicPricesActive();
  const expectedCell = priced ? await publicCell("helio-horizon", "autoportante", 5000, 4000) : null;
  if (priced) {
    expect(expectedCell).not.toBeNull();
    await expect(page.getByTestId("system-price")).toHaveAttribute("data-priced", "true");
    await expect(page.getByTestId("system-price-amount")).toContainText(/€\s?HT/);
    await expect(page.getByTestId("system-price")).toContainText("4 m de largeur × 5 m (projection)");
  } else {
    await expect(page.getByTestId("system-price")).toHaveAttribute("data-priced", "false");
    await expect(page.getByTestId("system-price")).toContainText("Prix sur devis");
    await expect(recap).not.toContainText("€");
  }

  // 3D : même configuration que le devis
  await page.getByTestId("view-3d-toggle").click();
  await expect(page.locator("[data-testid=scene-3d] canvas")).toBeVisible({ timeout: 30_000 });
  const description = page.locator("#scene-3d-description");
  await expect(description).toContainText("largeur 3,6 m × projection 5 m, hauteur 2,6 m");
  await expect(description).toContainText("autoportée");
  await expect(description).toContainText("9 spots LED");
  await expect(page.getByTestId("scene-3d-to-confirm")).toContainText("Screen HELIO Ombra côté avant");
  await setDim(page, "dim-depth", 1500);
  await expect(page.getByTestId("scene-3d-blocked")).toContainText("Vue 3D indisponible");
  await setDim(page, "dim-depth", 5000);
  await expect(page.locator("[data-testid=scene-3d] canvas")).toBeVisible({ timeout: 30_000 });
  await shot(page, "configurateur-sb400-3d");

  // projet enregistré puis repris depuis le compte
  const title = `Terrasse e2e ${uid()}`;
  await page.getByLabel("Nom du projet (facultatif)").fill(title);
  await page.getByRole("button", { name: "Sauvegarder le projet" }).click();
  await expect(page.getByText("Projet enregistré.")).toBeVisible();

  const number = await fillQuote(page, email);
  await expect(page.getByTestId("quote-visual-status")).toContainText("visualisation 3D de votre configuration est jointe");
  const quote = await one<{ id: string; kind: string; snapshot: { result: { priceMode: string; lines: unknown[]; systemPrice?: { amountMinor: number; currency: string; taxBasis: string } | null } }; attribution: { params: Record<string, string> } | null; configurationId: string | null }>('SELECT id, kind, snapshot, attribution, "configurationId" FROM "Quote" WHERE number = $1', [number]);
  expect(quote!.kind).toBe("system");
  expect(quote!.snapshot.result.priceMode).toBe("quote");
  expect(quote!.snapshot.result.lines).toEqual([]);
  // prix recalculé par le serveur : même cellule que l'aperçu
  expect(quote!.snapshot.result.systemPrice?.amountMinor ?? null).toBe(expectedCell);
  if (priced) expect(quote!.snapshot.result.systemPrice).toMatchObject({ currency: "EUR", taxBasis: "HT" });
  expect(quote!.attribution?.params).toMatchObject({ utm_source: "e2e", utm_campaign: "recette-heliostores" });
  expect(quote!.configurationId).toBeTruthy();
  const visual = await one<{ kind: string; represented: string[] }>('SELECT kind, represented FROM "QuoteVisual" WHERE "quoteId" = $1', [quote!.id]);
  expect(visual!.kind).toBe("SCENE_3D");
  expect(visual!.represented).toEqual(expect.arrayContaining([expect.stringMatching(/Spots LED dans les lames : 9 points/), expect.stringMatching(/Sections représentées \(catalogue\)/)]));

  await page.goto("/compte/devis");
  const card = page.getByTestId("account-quote").filter({ hasText: number });
  await expect(card).toContainText(priced ? /HELIO Horizon · structure \d[\d\s\u00a0\u202f]*(,\d+)?\s€\sHT/ : /HELIO Horizon · prix sur devis/);
  await expect.poll(() => card.getByTestId("quote-visual").locator("img").evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  const pdf = await page.request.get(`/api/devis/${quote!.id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect(Buffer.from(await pdf.body()).toString("latin1")).not.toMatch(/aluprof|thysens|refleksol|casablanca|sunbreaker|blebox|elero/i);

  await page.goto("/compte/projets");
  const project = page.locator("li").filter({ hasText: title });
  await expect(project).toContainText(priced ? "structure" : "prix sur devis");
  await project.getByRole("link", { name: "Reprendre" }).click();
  await expect(page.locator("#dim-width")).toHaveValue("3600");
  await expect(page.locator("#dim-depth")).toHaveValue("5000");
  expect(errors).toEqual([]);

  // administration : récapitulatif, origine du prospect, qualification
  const admin = await newClientContext(page.context().browser()!, { viewport: page.viewportSize() });
  const adminPage = await admin.newPage();
  await loginAdmin(adminPage, `/admin/devis/${quote!.id}`);
  await expect(adminPage.getByTestId("quote-recap")).toContainText("HELIO Horizon");
  await expect(adminPage.getByTestId("quote-system-price")).toContainText(priced ? "Prix de la structure affiché au client" : "sur devis");
  await expect(adminPage.getByTestId("quote-attribution")).toContainText("utm_source=e2e");
  await expect(adminPage.getByTestId("quote-qualification")).toHaveText("À qualifier");
  await adminPage.getByLabel("Qualification du prospect").selectOption("QUALIFIED");
  await adminPage.getByRole("button", { name: "Enregistrer" }).click();
  await expect(adminPage.getByTestId("quote-qualification")).toHaveText("Qualifié");
  await shot(adminPage, "admin-devis-systeme");
  await admin.close();
});

test("HELIO Panorama : pas de 25 cm, moteurs et poteaux documentés, modules au devis ; sans WebGL le plan 2D est joint", async ({ browser, page }) => {
  const ctx = await newClientContext(browser, { viewport: page.viewportSize() });
  await ctx.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (/webgl/i.test(type)) return null;
      return (orig as (...a: unknown[]) => RenderingContext | null).call(this, type, ...args);
    } as typeof orig;
  });
  const p = await ctx.newPage();
  await p.goto("/configurateur/helio-panorama");
  await acceptNecessaryOnly(p);
  const issues = p.locator('ul[aria-live="polite"]');
  await setDim(p, "dim-width", 4800);
  await setDim(p, "dim-depth", 2200);
  await expect(issues).toContainText("disponible par pas de 25 cm");
  await setDim(p, "dim-depth", 6250);
  await expect(issues).not.toContainText("Impossible");
  await p.getByLabel("Commande", { exact: true }).selectOption({ label: "Motorisation 24 V — commande radio io uniquement" });
  await p.getByLabel(/Poteau supplémentaire/).check();
  await p.getByLabel("Poteau supplémentaire : valeur").selectOption({ label: "longueur 280 cm" });
  await p.getByLabel(/Installation en plusieurs modules/).check();
  await expect(issues).toContainText("composition (modules, poteaux, gouttières) établie au devis");
  await expect(p.getByTestId("system-recap")).toContainText("Poteau supplémentaire × 1 (longueur 280 cm)");
  await p.getByTestId("view-3d-toggle").click();
  await expect(p.getByTestId("scene-3d-unavailable")).toBeVisible({ timeout: 20_000 });
  const number = await fillQuote(p, `sb500-${uid()}@test.invalid`);
  await expect(p.getByTestId("quote-visual-status")).toContainText("plan 2D de votre configuration est joint");
  const v = await one<{ kind: string }>('SELECT v.kind FROM "QuoteVisual" v JOIN "Quote" q ON q.id = v."quoteId" WHERE q.number = $1', [number]);
  expect(v!.kind).toBe("PLAN_2D");
  await shot(p, "configurateur-sb500-sans-webgl");
  await ctx.close();
});
