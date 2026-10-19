import { test, expect, type Page } from "@playwright/test";
import { acceptNecessaryOnly, createAccount, loginAdmin, uid } from "./helpers";
import { one } from "./db";

// Chromium headless : rendu WebGL logiciel (SwiftShader), comme le parcours 08.
test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

async function setDim(page: Page, label: string, value: number) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(String(value));
  await input.blur();
}

async function fillQuote(page: Page, email: string) {
  const form = page.getByRole("form", { name: "Demande de devis" });
  await form.getByLabel("Prénom").fill("Sam");
  await form.getByLabel("Nom", { exact: true }).fill("Mesure");
  await form.getByLabel("E-mail").fill(email);
  await form.getByLabel("Code postal du projet").fill("69000");
  await form.getByLabel(/J'accepte/).check();
  await form.getByRole("button", { name: "Envoyer la demande de devis" }).click();
  await expect(page.getByTestId("quote-done")).toBeVisible({ timeout: 30_000 });
  return (await page.getByTestId("quote-done").textContent())!.match(/DEV-\d{6}-[A-Z0-9]{6}/)![0];
}

test("sur mesure : vue 3D aux cotes saisies, limites, devis avec visualisation jointe au compte, au PDF et à l'administration", async ({ page, browser }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = `sm3d-${uid()}@test.invalid`;
  await createAccount(page, email, `Mdp-${uid()}-${uid()}`);
  await page.goto("/configurateur/sur-mesure");
  await acceptNecessaryOnly(page);

  await setDim(page, "Largeur (mm)", 3200);
  await setDim(page, "Longueur (mm)", 5100);
  await setDim(page, "Hauteur sous poutre (mm)", 2750);
  await page.getByLabel("Autoportée").check();
  await page.locator("#side-front").selectOption({ label: "Persienne aluminium" });
  await page.getByLabel("Lampe chauffante").check();

  await page.getByTestId("view-3d-toggle").click();
  const scene = page.getByTestId("scene-3d");
  await expect(scene).toBeVisible({ timeout: 20_000 });
  await expect(scene.locator("canvas")).toBeVisible({ timeout: 20_000 });
  const description = page.locator("#scene-3d-description");
  await expect(description).toContainText("largeur 3,2 m × longueur 5,1 m, hauteur 2,75 m");
  await expect(description).toContainText("autoportée");
  await expect(description).toContainText(/persienne avant/);
  await expect(description).toContainText(/lampe chauffante/);
  await expect(page.getByText(/Faisabilité technique à valider sur devis/).first()).toBeVisible();
  await expect(page.getByTestId("scene-3d-to-confirm")).toContainText(/fabrication et assemblage à la cote/);
  // le plan 2D reste affiché (repli et lecture des segments)
  await expect(page.getByRole("img", { name: /Vue en plan/ })).toBeVisible();

  // changement de dimension : la scène suit
  await setDim(page, "Longueur (mm)", 4000);
  await expect(description).toContainText("longueur 4 m");
  // hors bornes : pas de scène, message explicite ; retour dans les bornes : la scène revient
  await setDim(page, "Largeur (mm)", 4500);
  await expect(page.getByTestId("scene-3d-blocked")).toContainText(/Largeur hors bornes/);
  await expect(page.getByTestId("scene-3d")).toHaveCount(0);
  await setDim(page, "Largeur (mm)", 4000);
  await expect(page.getByTestId("scene-3d")).toBeVisible({ timeout: 20_000 });
  await expect(description).toContainText("largeur 4 m");

  const number = await fillQuote(page, email);
  await expect(page.getByTestId("quote-visual-status")).toContainText(/visualisation 3D de votre configuration est jointe/);
  const quote = await one<{ id: string; snapshot: { input: { widthMm: number; lengthMm: number; heightMm: number } } }>('SELECT id, snapshot FROM "Quote" WHERE number = $1', [number]);
  expect(quote!.snapshot.input).toMatchObject({ widthMm: 4000, lengthMm: 4000, heightMm: 2750 });
  const visual = await one<{ kind: string; represented: string[]; disclaimer: string }>('SELECT kind, represented, disclaimer FROM "QuoteVisual" WHERE "quoteId" = $1', [quote!.id]);
  expect(visual!.kind).toBe("SCENE_3D");
  expect(visual!.disclaimer).toMatch(/^Visualisation non contractuelle/);
  expect(visual!.represented).toContain("Hauteur saisie : 2,75 m");

  // compte client : visuel, éléments représentés et PDF
  await page.goto("/compte/devis");
  const card = page.getByTestId("account-quote").filter({ hasText: number });
  const img = card.getByTestId("quote-visual").locator("img");
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  await expect(card).toContainText(/Visualisation non contractuelle/);
  const pdf = await page.request.get(`/api/devis/${quote!.id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).toString("latin1")).toMatch(/\/Subtype \/Image/);

  // anonyme : ni le visuel ni le PDF, même avec l'identifiant
  const anon = await browser.newContext();
  expect((await anon.request.get(`/api/devis/${quote!.id}/visuel`)).status()).toBe(404);
  expect((await anon.request.get(`/api/devis/${quote!.id}/pdf`)).status()).toBe(404);
  await anon.close();

  // administration : même visuel, figé
  const admin = await browser.newContext({ viewport: page.viewportSize() });
  const adminPage = await admin.newPage();
  await loginAdmin(adminPage, `/admin/devis/${quote!.id}`);
  await expect(adminPage.getByTestId("quote-visual")).toContainText(/Visualisation 3D/);
  await expect(adminPage.getByTestId("quote-visual")).toContainText(/Figée le/);
  await admin.close();
  expect(errors).toEqual([]);
});

test("sans WebGL : repli 2D, devis toujours enregistré avec un plan 2D joint", async ({ browser, page }) => {
  const ctx = await browser.newContext({ viewport: page.viewportSize() });
  await ctx.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (/webgl/i.test(type)) return null;
      return (orig as (...a: unknown[]) => RenderingContext | null).call(this, type, ...args);
    } as typeof orig;
  });
  const p = await ctx.newPage();
  await p.goto("/configurateur/sur-mesure");
  await acceptNecessaryOnly(p);
  await p.getByTestId("view-3d-toggle").click();
  await expect(p.getByTestId("scene-3d-unavailable")).toBeVisible({ timeout: 20_000 });
  await expect(p.getByRole("img", { name: /Vue en plan/ })).toBeVisible();
  const number = await fillQuote(p, `sm2d-${uid()}@test.invalid`);
  await expect(p.getByTestId("quote-visual-status")).toContainText(/plan 2D de votre configuration est joint/);
  const v = await one<{ kind: string }>('SELECT v.kind FROM "QuoteVisual" v JOIN "Quote" q ON q.id = v."quoteId" WHERE q.number = $1', [number]);
  expect(v!.kind).toBe("PLAN_2D");
  await ctx.close();
});
