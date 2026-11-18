import { test, expect } from "./fixtures";
import { acceptNecessaryOnly, fillQuote, goStep, setDim, uid } from "./helpers";
import { IN_FORCE_GRID_SQL, one, publicCell, publicPricesActive } from "./db";

/**
 * Cas signalé le 2026-11-18 : HelioLux (SOLID) murale 3 700 × 3 990 mm, hauteur 2 450 mm, RAL 9010 mat, ouvert par
 * « Configurer » (?depart=1). Montant attendu recalculé ici depuis la base (cellule de la tranche supérieure de la grille
 * murale, TVA 20 %, arrondi TTC 99 € si la grille l'active) — indépendant du moteur. Un ancien brouillon local (toile de
 * l'ancien système) doit être signalé par son champ, avec un lien vers l'étape, et corrigeable.
 */
const fmt = (minor: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(minor / 100);
const amountRe = (minor: number) => new RegExp(`^${fmt(minor).replace(/\s/g, "\\s")}\\s?€\\s?TTC$`);

async function expectedTtc(): Promise<number | null> {
  const cell = await publicCell("sevilla", "murale", 3990, 3700, { widthMm: 1500, dimMm: 2000 });
  if (cell == null) return null;
  const rounding = (await one<{ r: string }>(`SELECT l."saleRounding" AS r FROM "SupplierPriceList" l WHERE ${IN_FORCE_GRID_SQL} AND l."familySlug" = 'sevilla' AND l."variantKey" = 'murale' LIMIT 1`))?.r === "NEAREST_99_TTC";
  const ttc0 = cell + Math.floor((cell * 2000 + 5000) / 10_000);
  const lower = Math.floor((ttc0 - 9900) / 10_000) * 10_000 + 9900;
  return rounding && ttc0 >= 9900 ? (lower + 10_000 - ttc0 <= ttc0 - lower ? lower + 10_000 : lower) : ttc0;
}

async function configure(page: import("@playwright/test").Page) {
  await goStep(page, "pose");
  await page.getByRole("radio", { name: /Adossée/ }).check();
  await page.getByTestId("finish-swatches").locator('[data-finish="RAL_9010_MAT"] input').check();
  await goStep(page, "dims");
  await setDim(page, "dim-width", 3700);
  await setDim(page, "dim-depth", 3990);
  await setDim(page, "dim-height", 2450);
}

test("HelioLux 3,70 × 3,99 m murale : montant numérique, cohérent au récapitulatif et dans le nouveau devis", async ({ page }) => {
  await page.goto("/configurateur/sevilla?depart=1");
  await acceptNecessaryOnly(page);
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await configure(page);
  const price = page.getByTestId("system-price");
  const expected = (await publicPricesActive()) ? await expectedTtc() : null;
  if (expected == null) {
    // sans grille de vente active (CI) : jamais bloqué pour cette configuration valide
    await expect(price).not.toHaveAttribute("data-price-status", "blocked");
    return;
  }
  await expect(price).toHaveAttribute("data-price-status", "priced");
  await expect(page.getByTestId("system-price-amount")).toHaveText(amountRe(expected));
  // changements rapides de dimensions : le dernier état seul compte
  for (const v of [3000, 4000, 2500, 3990]) await setDim(page, "dim-depth", v);
  await expect(page.getByTestId("system-price-amount")).toHaveText(amountRe(expected));
  await expect(page.locator("#dim-width")).toHaveValue("3700");
  await expect(page.locator("#dim-depth")).toHaveValue("3990");
  await goStep(page, "recap");
  await expect(page.getByTestId("system-recap")).toContainText("3,99 m");
  await expect(page.getByTestId("system-price-amount")).toHaveText(amountRe(expected));
  const number = await fillQuote(page, `cas-heliolux-${uid()}@test.invalid`);
  const q = await one<{ ttc: string; w: string; d: string }>(`SELECT snapshot->'result'->'priceBreakdown'->>'totalTtcMinor' AS ttc, snapshot->'input'->>'widthMm' AS w, snapshot->'input'->>'depthMm' AS d FROM "Quote" WHERE number = $1`, [number]);
  expect(q).toEqual({ ttc: String(expected), w: "3700", d: "3990" });
});

test("HelioLux : ancien brouillon (toile de l'ancien système) — champ nommé, lien vers l'étape, correction puis prix", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("heliostores:configuration:sevilla", JSON.stringify({ input: { kind: "system", familySlug: "sevilla", widthMm: 3700, depthMm: 3990, heightMm: 2450, mounting: "wall", finishCode: "RAL_9010_MAT", fabricCode: "serge_600", options: [], sides: {}, installation: "self", delivery: { countryCode: "FR" } }, at: "2026-11-18T10:00:00.000Z", since: "2026-10-30T10:00:00.000Z" })));
  await page.goto("/configurateur/sevilla?depart=1");
  await acceptNecessaryOnly(page);
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  const price = page.getByTestId("system-price");
  await expect(price).toHaveAttribute("data-price-status", "blocked");
  // le point bloquant est nommé dans le cadre de prix (visible à toutes les étapes), avec sa nature et son étape
  const blocker = page.getByTestId("price-blockers").locator("li");
  await expect(blocker).toHaveCount(1);
  await expect(blocker).toHaveAttribute("data-kind", "stale");
  await expect(blocker).toContainText("Ancien choix à refaire");
  await expect(blocker).toContainText("toile");
  await expect(page.getByTestId("step-alert-pose")).toHaveText(/1/);
  await expect(page.getByTestId("revision-notice")).toBeVisible();
  await blocker.getByTestId("price-blocker-fix").click();
  await expect(page.getByTestId("step-pose")).toBeVisible();
  // la liste n'affiche pas une toile valide à la place du choix périmé
  await expect(page.locator("#fabric option:checked")).toContainText("plus proposé");
  await page.locator("#fabric").selectOption("solid_white");
  await expect(price).toHaveAttribute("data-price-status", /^(priced|no_table)$/);
  await expect(page.getByTestId("price-blockers")).toHaveCount(0);
  await expect(page.getByTestId("step-alert-pose")).toHaveCount(0);
  const expected = (await publicPricesActive()) ? await expectedTtc() : null;
  if (expected != null) await expect(page.getByTestId("system-price-amount")).toHaveText(amountRe(expected));
});
