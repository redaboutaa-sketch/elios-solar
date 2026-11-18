import { test, expect } from "./fixtures";
import { pool } from "./db";
import { shot } from "./helpers";

test("refuser les cookies optionnels : aucun script optionnel chargé", async ({ page }) => {
  await pool.query('UPDATE "SiteSettings" SET "analyticsEnabled" = true, "analyticsScriptUrl" = $1, "updatedAt" = now() WHERE id = 1', ["/api/health?fake-analytics=1"]);
  const loaded: string[] = [];
  page.on("request", (r) => { if (r.url().includes("fake-analytics")) loaded.push(r.url()); });
  try {
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: "Cookies et mesure d'audience" })).toBeVisible();
    await page.getByRole("button", { name: "Tout refuser" }).click();
    await page.goto("/pergolas");
    await page.waitForLoadState("networkidle");
    expect(loaded).toHaveLength(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("es_consent_v") ?? "{}"))).toMatchObject({ prefs: { analytics: false, marketing: false } });
    await page.getByRole("button", { name: "Gérer les cookies" }).click();
    await page.getByRole("checkbox", { name: "Mesure d'audience" }).check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForLoadState("networkidle");
    expect(loaded.length).toBeGreaterThan(0);
  } finally {
    await pool.query('UPDATE "SiteSettings" SET "analyticsEnabled" = false, "analyticsScriptUrl" = NULL, "updatedAt" = now() WHERE id = 1');
  }
});

test("captures des pages principales", async ({ page }) => {
  for (const [path, name] of [["/", "accueil"], ["/pergolas", "collection"], ["/pergolas/marbella", "fiche"], ["/stores-bannes/casablanca", "fiche-store"], ["/moustiquaires", "collection-moustiquaires"], ["/configurateur", "configurateurs"], ["/compte/connexion", "connexion"]]) {
    await page.goto(path!);
    const btn = page.getByRole("button", { name: "Tout refuser" });
    if (await btn.isVisible().catch(() => false)) await btn.click();
    await page.waitForLoadState("networkidle");
    await shot(page, name!);
  }
  // pas de débordement horizontal
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
