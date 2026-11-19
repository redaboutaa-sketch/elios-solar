import { test, expect } from "./fixtures";
import { acceptNecessaryOnly, chooseFabric, fillQuote, goStep, setDim, uid } from "./helpers";
import { IN_FORCE_GRID_SQL, one, publicCell, publicPricesActive } from "./db";

/**
 * Cas signalés le 2026-11-18 et le 2026-11-19 : HelioLux (SOLID) murale 3 700 × 3 990 mm, hauteur 2 450 mm, ouvert par
 * « Configurer » (?depart=1). Montant attendu recalculé ici depuis la base (cellule de la tranche supérieure de la grille
 * murale, TVA 20 %, arrondi TTC 99 € si la grille l'active, jamais sur un sous-total partiel) — indépendant du moteur.
 * Un ancien brouillon (toile serge_100 de l'ancienne fiche) est signalé par son nom, corrigé en une action, et ne revient
 * pas après actualisation. Aucune toile n'est présélectionnée pour un nouveau projet (pas de valeur par défaut documentée).
 */
const fmt = (minor: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(minor / 100);
const amountRe = (minor: number) => new RegExp(`^${fmt(minor).replace(/\s/g, "\\s")}\\s?€\\s?TTC$`);
const KEY = "heliostores:configuration:sevilla";

/** TTC attendu : `complete` = total arrondi (si la grille l'active) ; sinon sous-total sans arrondi. */
async function expectedTtc(complete = true): Promise<number | null> {
  const cell = await publicCell("sevilla", "murale", 3990, 3700, { widthMm: 1500, dimMm: 2000 });
  if (cell == null) return null;
  const rounding = (await one<{ r: string }>(`SELECT l."saleRounding" AS r FROM "SupplierPriceList" l WHERE ${IN_FORCE_GRID_SQL} AND l."familySlug" = 'sevilla' AND l."variantKey" = 'murale' LIMIT 1`))?.r === "NEAREST_99_TTC";
  const ttc0 = cell + Math.floor((cell * 2000 + 5000) / 10_000);
  const lower = Math.floor((ttc0 - 9900) / 10_000) * 10_000 + 9900;
  return complete && rounding && ttc0 >= 9900 ? (lower + 10_000 - ttc0 <= ttc0 - lower ? lower + 10_000 : lower) : ttc0;
}

async function configure(page: import("@playwright/test").Page, finish = "RAL_7016_MAT") {
  await goStep(page, "pose");
  await page.getByRole("radio", { name: /Adossée/ }).check();
  await page.getByTestId("finish-swatches").locator(`[data-finish="${finish}"] input`).check();
  await goStep(page, "dims");
  await setDim(page, "dim-width", 3700);
  await setDim(page, "dim-depth", 3990);
  await setDim(page, "dim-height", 2450);
}

test("HelioLux nouveau projet : aucune toile présélectionnée, prix affiché, devis après choix explicite ; montant identique dans le devis", async ({ page }) => {
  await page.goto("/configurateur/sevilla?depart=1");
  await acceptNecessaryOnly(page);
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await configure(page);
  const price = page.getByTestId("system-price");
  // aucune toile cochée, aucune valeur cachée
  await goStep(page, "pose");
  await expect(page.getByTestId("fabric-required")).toBeVisible();
  await expect(page.getByTestId("fabric-choices").locator("input:checked")).toHaveCount(0);
  await expect(page.getByTestId("fabric-selected")).toHaveText("—");
  const expected = (await publicPricesActive()) ? await expectedTtc() : null;
  if (expected != null) {
    await expect(price).toHaveAttribute("data-price-status", "priced");
    await expect(page.getByTestId("system-price-amount")).toHaveText(amountRe(expected));
    await expect(page.getByTestId("price-required")).toContainText("Choisissez une toile");
  } else {
    await expect(price).not.toHaveAttribute("data-price-status", "error");
  }
  await expect(page.getByTestId("step-alert-pose")).toHaveText(/1/);
  await chooseFabric(page, "Toile PVC gris aluminium (702N opaque)");
  await expect(page.getByTestId("fabric-selected")).toHaveText("Toile PVC gris aluminium (702N opaque)");
  await expect(page.getByTestId("price-required")).toHaveCount(0);
  await expect(page.getByTestId("step-alert-pose")).toHaveCount(0);
  if (expected == null) return;
  await expect(page.getByTestId("system-price-label")).toHaveText("Prix TTC");
  // changements rapides de dimensions : le dernier état seul compte
  await goStep(page, "dims");
  for (const v of [3000, 4000, 2500, 3990]) await setDim(page, "dim-depth", v);
  await expect(page.getByTestId("system-price-amount")).toHaveText(amountRe(expected));
  await goStep(page, "recap");
  await expect(page.getByTestId("system-recap")).toContainText("3,99 m");
  const number = await fillQuote(page, `cas-heliolux-${uid()}@test.invalid`);
  const q = await one<{ ttc: string; w: string; d: string; f: string }>(`SELECT snapshot->'result'->'priceBreakdown'->>'totalTtcMinor' AS ttc, snapshot->'input'->>'widthMm' AS w, snapshot->'input'->>'depthMm' AS d, snapshot->'input'->>'fabricCode' AS f FROM "Quote" WHERE number = $1`, [number]);
  expect(q).toEqual({ ttc: String(expected), w: "3700", d: "3990", f: "solid_alu_grey" });
});

test("HelioLux avec HelioSlide VERRE à l'avant : sous-total pergola, fermeture à chiffrer, jamais présenté comme prix complet", async ({ page }) => {
  await page.goto("/configurateur/sevilla?depart=1");
  await acceptNecessaryOnly(page);
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await configure(page);
  await chooseFabric(page, "Toile PVC blanche (602N opaque)");
  await goStep(page, "equip");
  await page.locator("#side-front").selectOption("sliding_glass");
  const expected = (await publicPricesActive()) ? await expectedTtc(false) : null;
  const price = page.getByTestId("system-price");
  if (expected == null) { await expect(price).not.toHaveAttribute("data-price-status", "blocked"); return; }
  await expect(price).toHaveAttribute("data-partial", "true");
  await expect(page.getByTestId("system-price-label")).toHaveText("Sous-total pergola TTC");
  await expect(page.getByTestId("system-price-amount")).toHaveText(amountRe(expected));
  await expect(page.getByTestId("price-pending")).toContainText(/fermeture vitrée.*côté avant — à chiffrer, compatibilité à confirmer/);
  await expect(page.getByTestId("config-price-bar")).toContainText("Sous-total pergola TTC");
});

test("HelioLux : ancien brouillon (toile serge_100 de l'ancienne fiche) — nommé, corrigé en une action, absent après actualisation", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ input: { kind: "system", familySlug: "sevilla", widthMm: 3700, depthMm: 3990, heightMm: 2450, mounting: "wall", finishCode: "RAL_7016_MAT", fabricCode: "serge_100", controlCode: "radio_included", options: [], sides: { front: "sliding_glass" }, installation: "self", delivery: { countryCode: "FR" } }, at: "2026-11-19T08:00:00.000Z" })), KEY);
  await page.goto("/configurateur/sevilla?depart=1");
  await acceptNecessaryOnly(page);
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  const price = page.getByTestId("system-price");
  await expect(price).toHaveAttribute("data-price-status", "blocked");
  // aucun montant pour une toile fictive
  await expect(page.getByTestId("system-price-amount")).toHaveCount(0);
  const blocker = page.getByTestId("price-blockers").locator("li");
  await expect(blocker).toHaveCount(1);
  await expect(blocker).toHaveAttribute("data-kind", "stale");
  await expect(blocker).toContainText("Toile Serge 100");
  await expect(page.getByTestId("revision-notice")).toBeVisible();
  await blocker.getByTestId("price-blocker-fix").click();
  await expect(page.getByTestId("step-pose")).toBeVisible();
  // ancien choix nommé ; aucune toile valide présentée comme sélectionnée
  await expect(page.getByTestId("fabric-stale")).toContainText("Toile Serge 100 (ancienne fiche HelioLux)");
  await expect(page.getByTestId("fabric-choices").locator("input:checked")).toHaveCount(0);
  await expect(page.getByTestId("fabric-choices").locator("[data-fabric]")).toHaveCount(3);
  await chooseFabric(page, "Toile PVC beige (602N opaque)");
  await expect(page.getByTestId("fabric-stale")).toHaveCount(0);
  await expect(page.getByTestId("price-blockers")).toHaveCount(0);
  await expect(page.getByTestId("step-alert-pose")).toHaveCount(0);
  await expect(page.getByTestId("revision-notice")).toHaveCount(0);
  // autres choix conservés
  await expect(page.getByTestId("finish-selected")).toContainText("7016");
  const expected = (await publicPricesActive()) ? await expectedTtc(false) : null;
  if (expected != null) {
    await expect(price).toHaveAttribute("data-price-status", "priced");
    await expect(page.getByTestId("system-price-label")).toHaveText("Sous-total pergola TTC");
    await expect(page.getByTestId("system-price-amount")).toHaveText(amountRe(expected));
  }
  // la configuration active ne contient plus l'ancienne valeur, y compris après actualisation
  await expect.poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "{}").input?.fabricCode, KEY)).toBe("solid_beige");
  await page.reload();
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await expect(page.getByTestId("price-blockers")).toHaveCount(0);
  await goStep(page, "pose");
  await expect(page.getByTestId("fabric-choices").locator('[data-fabric="solid_beige"] input')).toBeChecked();
  await goStep(page, "dims");
  await expect(page.locator("#dim-width")).toHaveValue("3700");
  await expect(page.locator("#dim-depth")).toHaveValue("3990");
});

test("HelioLux : fermeture enregistrée d'un autre système — visible comme ancien choix, jamais affichée « ouvert »", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ input: { kind: "system", familySlug: "sevilla", widthMm: 3700, depthMm: 3990, heightMm: 2450, mounting: "wall", finishCode: "RAL_7016_MAT", fabricCode: "solid_white", controlCode: "radio_included", options: [], sides: { left: "veranda_fts" }, installation: "self" }, at: "2026-11-19T08:00:00.000Z" })), KEY);
  await page.goto("/configurateur/sevilla");
  await acceptNecessaryOnly(page);
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await expect(page.getByTestId("price-blockers").locator("li")).toContainText("côté gauche (veranda_fts)");
  await goStep(page, "equip");
  await expect(page.locator("#side-left option:checked")).toContainText("plus proposé");
  await page.locator("#side-left").selectOption("");
  await expect(page.getByTestId("price-blockers")).toHaveCount(0);
});
