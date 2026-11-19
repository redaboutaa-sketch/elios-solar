import { test, expect, type Page } from "@playwright/test";
import { acceptNecessaryOnly, goStep } from "../e2e/helpers";

/**
 * Contrôles PUBLICS non destructifs (production ou environnement isolé) : pages principales, médias, prix d'appel
 * rouverts par « Configurer », configurations représentatives sans erreur technique présentée comme « sur devis »,
 * protection de l'administration. Aucune écriture, aucune IP simulée, aucune connexion.
 * Une absence d'erreur console ne suffit jamais : chaque parcours vérifie un résultat attendu visible.
 */
const PRODUCTS = [
  ["pergolas", "malaga"], ["pergolas", "marbella"], ["pergolas", "sevilla"],
  ["screens", "helioscreen"], ["screens", "helioroof-screen"],
  ["stores-bannes", "casablanca"], ["stores-bannes", "corsica"], ["stores-bannes", "jamaica"], ["stores-bannes", "madera"],
  ["moustiquaires", "moskifold-2"],
] as const;
const PAGES = ["/", "/pergolas", "/screens", "/stores-bannes", "/moustiquaires", "/accessoires", "/guides", "/guides/prise-de-mesures", "/devis", "/contact", "/aide", "/mentions-legales", "/confidentialite", "/cookies", "/livraison-installation"];

/** Médias de la page : aucune réponse en erreur, aucune image chargée cassée (images différées non chargées ignorées). */
async function checkMedia(page: Page, failures: string[]) {
  await page.evaluate(async () => { window.scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 400)); window.scrollTo(0, 0); });
  const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc));
  expect([...failures, ...broken], "médias en erreur").toEqual([]);
}

for (const path of PAGES) {
  test(`page ${path} : 200, titre principal, médias chargés, aucun message d'erreur technique`, async ({ page }) => {
    const failures: string[] = [];
    page.on("response", (r) => { if (/\/(api\/media|_next\/image|media)\//.test(r.url()) && r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await acceptNecessaryOnly(page);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Erreur technique|Application error|Internal Server Error/);
    await checkMedia(page, failures);
    // logo : retour à l'accueil
    await expect(page.locator('header a[href="/"]').first()).toBeVisible();
  });
}

for (const [cat, slug] of PRODUCTS) {
  test(`fiche ${slug} : prix d'appel rouvert à l'identique par « Configurer », aucun blocage ni erreur au départ`, async ({ page }) => {
    const failures: string[] = [];
    page.on("response", (r) => { if (/\/(api\/media|_next\/image)\//.test(r.url()) && r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
    expect((await page.goto(`/${cat}/${slug}`))?.status()).toBe(200);
    await acceptNecessaryOnly(page);
    await checkMedia(page, failures);
    const from = page.getByTestId("from-price");
    const hasFrom = await from.isVisible().catch(() => false);
    const norm = (s: string | null) => (s ?? "").replace(/[  ]/g, " ").trim();
    // montant annoncé lu sur la fiche, AVANT d'ouvrir le configurateur
    const announced = hasFrom ? norm(await from.locator("strong").textContent()) : "";
    await page.goto(`/configurateur/${slug}?depart=1`);
    await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
    const price = page.getByTestId("system-price");
    // jamais une panne présentée comme un devis, jamais un blocage sur la configuration de départ
    await expect(price).not.toHaveAttribute("data-price-status", /^(error|blocked)$/);
    if (!hasFrom) { test.info().annotations.push({ type: "prix d'appel", description: "aucun prix d'appel publié (modèle sur devis)" }); return; }
    await expect(page.getByTestId("system-price-amount")).toBeVisible();
    expect(norm(await page.getByTestId("system-price-amount").textContent())).toBe(announced);
  });
}

test("navigation des étapes, Retour du navigateur et actualisation : étape et choix conservés", async ({ page }) => {
  await page.goto("/configurateur/marbella");
  await acceptNecessaryOnly(page);
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await goStep(page, "pose");
  await page.getByRole("radio", { name: /Adossée/ }).check();
  await goStep(page, "equip");
  await page.goBack();
  await expect(page.getByTestId("step-pose")).toBeVisible();
  await page.reload();
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await expect(page.getByTestId("step-pose")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Adossée/ })).toBeChecked();
});

test("administration et espace client protégés : redirection vers la connexion, documents privés inaccessibles", async ({ request }) => {
  for (const p of ["/admin", "/admin/tarifs", "/admin/devis", "/compte"]) {
    const r = await request.get(p, { maxRedirects: 0 });
    expect([302, 303, 307, 308], p).toContain(r.status());
    expect(r.headers()["location"] ?? "", p).toContain("/compte/connexion");
  }
  for (const p of ["/api/devis/inexistant/pdf", "/api/devis/inexistant/visuel", "/api/media/quotes/inexistant.png"]) {
    expect([401, 403, 404], p).toContain((await request.get(p)).status());
  }
  // aucune donnée fournisseur (coût, marge, remise) dans les pages publiques
  const html = await (await request.get("/pergolas/sevilla")).text();
  expect(html).not.toMatch(/marginBps|discountBps|CATALOGUE_FOURNISSEUR|prix d'achat|coût fournisseur/i);
});
