import { test, expect, newClientContext } from "./fixtures";
import { acceptNecessaryOnly, createAccount, fillQuote, goStep, loginAdmin, openConfigurator, setDim, uid } from "./helpers";
import { one } from "./db";

/**
 * Lacunes de couverture relevées par /recette-site (2026-11-19) : cycle de vie du compte (changement de mot de passe,
 * déconnexion, reconnexion), séparation des comptes clients sur les documents privés, cookies acceptés sans perte de
 * configuration, pages d'administration des e-mails, des contacts et de l'acquisition (état réel du fournisseur d'e-mails).
 * Comptes de test uniquement (@test.invalid), mots de passe aléatoires propres à l'exécution.
 */
const pwd = () => `Rc-${uid()}${uid()}-x9`;

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/compte/connexion?next=/compte");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("compte : changement de mot de passe, déconnexion, ancien mot de passe refusé, nouveau accepté", async ({ page }) => {
  const email = `compte-${uid()}@test.invalid`;
  const first = pwd(), second = pwd();
  await createAccount(page, email, first);
  await page.goto("/compte");
  const form = page.getByRole("form", { name: "Changer mon mot de passe" });
  await form.getByLabel("Mot de passe actuel").fill(first);
  await form.getByLabel(/^Nouveau mot de passe/).fill(second);
  await form.getByLabel("Confirmer le nouveau mot de passe").fill(second);
  await form.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(page.getByText("Mot de passe modifié.")).toBeVisible();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto("/compte");
  await page.waitForURL((u) => u.pathname.startsWith("/compte/connexion"));
  await login(page, email, first);
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
  await login(page, email, second);
  await page.waitForURL((u) => u.pathname === "/compte");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bonjour");
});

test("séparation des comptes : le PDF d'un devis n'est accessible qu'à son titulaire (404 pour un autre client et un visiteur)", async ({ page, browser }) => {
  const emailA = `client-a-${uid()}@test.invalid`;
  await createAccount(page, emailA, pwd());
  await openConfigurator(page, "marbella");
  await goStep(page, "recap");
  const number = await fillQuote(page, emailA);
  const q = await one<{ id: string; userId: string | null }>(`SELECT id, "userId" FROM "Quote" WHERE number = $1`, [number]);
  expect(q?.userId, "devis rattaché au compte connecté").toBeTruthy();
  const own = await page.request.get(`/api/devis/${q!.id}/pdf`);
  expect(own.status()).toBe(200);
  expect(own.headers()["content-type"]).toContain("pdf");
  const ctxB = await newClientContext(browser);
  const b = await ctxB.newPage();
  await createAccount(b, `client-b-${uid()}@test.invalid`, pwd());
  expect((await b.request.get(`/api/devis/${q!.id}/pdf`)).status()).toBe(404);
  expect((await b.request.get(`/api/devis/${q!.id}/visuel`)).status()).toBe(404);
  await b.goto("/compte/devis");
  await expect(b.locator("main")).not.toContainText(number);
  await ctxB.close();
  const anon = await newClientContext(browser);
  expect((await anon.request.get(`/api/devis/${q!.id}/pdf`)).status()).toBe(404);
  await anon.close();
});

test("cookies acceptés après avoir commencé une configuration : choix conservés, y compris après actualisation", async ({ page }) => {
  await page.goto("/configurateur/marbella");
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await setDim(page, "dim-width", 3200);
  await goStep(page, "pose");
  await page.getByRole("radio", { name: /Adossée/ }).check();
  const accept = page.getByRole("button", { name: "Tout accepter" });
  await expect(accept).toBeVisible();
  await accept.click();
  await expect(page.getByTestId("step-pose")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Adossée/ })).toBeChecked();
  await page.reload();
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await expect(page.getByRole("radio", { name: /Adossée/ })).toBeChecked();
  await goStep(page, "dims");
  await expect(page.locator("#dim-width")).toHaveValue("3200");
});

test("administration : file des e-mails (fournisseur réel affiché), contacts et acquisition consultables", async ({ page }) => {
  await loginAdmin(page, "/admin/emails");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // état réel : le fournisseur configuré est affiché, jamais un envoi supposé
  await expect(page.locator("main")).toContainText(`Fournisseur : ${process.env.MAIL_PROVIDER ?? "log"}`);
  for (const path of ["/admin/contacts", "/admin/acquisition"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/Erreur technique|Application error/);
  }
  await acceptNecessaryOnly(page);
});
