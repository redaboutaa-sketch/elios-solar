import { test, expect, type Page } from "@playwright/test";
import { acceptNecessaryOnly, chooseFabric, fillQuote, goStep, setDim } from "../e2e/helpers";
import { cellFor, loadReference, READ_ONLY, round99, saleHt, ttcOf, ttcText } from "./reference";

/**
 * Niveau C de /audit-tarifs : montant attendu (référence PDF + politique, calcul indépendant) → montant visible dans le
 * navigateur → montant enregistré dans un NOUVEAU devis (environnement isolé seulement ; en production : lecture seule).
 * Aucun montant n'est écrit dans ce fichier : tout vient de la référence privée (RECETTE_REFERENCE).
 */
const ref = loadReference();
test.skip(!ref, "non testé : référence PDF privée absente (RECETTE_REFERENCE)");

const KEY = "heliostores:configuration:sevilla";

async function openSevilla(page: Page) {
  await page.goto("/configurateur/sevilla?depart=1");
  await acceptNecessaryOnly(page);
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
}
async function configureLux(page: Page, pose: RegExp, w: number, d: number, h = 2450) {
  await goStep(page, "pose");
  await page.getByRole("radio", { name: pose }).check();
  await page.getByTestId("finish-swatches").locator('[data-finish="RAL_9010_MAT"] input').check();
  await goStep(page, "dims");
  await setDim(page, "dim-width", w);
  await setDim(page, "dim-depth", d);
  await setDim(page, "dim-height", h);
}

for (const [pose, variant] of [[/Adossée/, "murale"], [/Autoportante/, "autoportante"]] as const) {
  for (const [w, d] of [[3700, 3990], [1500, 2000]] as const) {
    test(`HelioLux ${variant} ${w} × ${d}, hauteur 2 450 : tranche attendue du PDF, prix complet puis sous-total avec fermeture vitrée`, async ({ page }) => {
      const cell = cellFor(ref!, `heliolux-${variant}-1`, w, d);
      // contrôle de la sélection attendue elle-même (règle commerciale) : 3 700 × 3 990 → 4 000 × 4 000 ; 1 500 × 2 000 → 1 500 × 3 000
      expect([cell.widthMaxMm, cell.dimMm]).toEqual(w === 3700 ? [4000, 4000] : [1500, 3000]);
      const ht = saleHt(ref!, cell);
      const full = round99(ttcOf(ref!, ht));
      await openSevilla(page);
      await configureLux(page, pose, w, d);
      await chooseFabric(page, "Toile PVC blanche (602N opaque)");
      const price = page.getByTestId("system-price");
      await expect(price).toHaveAttribute("data-price-status", "priced");
      await expect(page.getByTestId("system-price-label")).toHaveText("Prix TTC");
      await expect(page.getByTestId("system-price-amount")).toHaveText(ttcText(full));
      // cotes réelles conservées (la tranche facturée n'est jamais affichée au client)
      await goStep(page, "recap");
      await expect(page.getByTestId("system-recap")).toContainText(`${(d / 1000).toLocaleString("fr-FR")} m`);
      // fermeture vitrée à l'avant : sous-total pergola sans arrondi, fermeture listée « à chiffrer »
      await goStep(page, "equip");
      await page.locator("#side-front").selectOption("sliding_glass");
      await expect(page.getByTestId("system-price-label")).toHaveText("Sous-total pergola TTC");
      await expect(page.getByTestId("system-price-amount")).toHaveText(ttcText(ttcOf(ref!, ht)));
      await expect(page.getByTestId("price-pending")).toContainText("à chiffrer, compatibilité à confirmer");
      await page.locator("#side-front").selectOption("");
      await expect(page.getByTestId("system-price-amount")).toHaveText(ttcText(full));
      if (READ_ONLY || w !== 3700) return;
      // environnement isolé : le nouveau devis enregistre le même montant et les cotes réelles
      await goStep(page, "recap");
      const number = await fillQuote(page, `recette-${variant}-${Date.now()}@test.invalid`);
      const { one } = await import("../e2e/db");
      const q = await one<{ ttc: string; w: string; d: string; f: string; gw: string; gd: string }>(`SELECT snapshot->'result'->'priceBreakdown'->>'totalTtcMinor' AS ttc, snapshot->'input'->>'widthMm' AS w, snapshot->'input'->>'depthMm' AS d, snapshot->'input'->>'fabricCode' AS f, snapshot->'result'->'systemPrice'->'grid'->>'widthMm' AS gw, snapshot->'result'->'systemPrice'->'grid'->>'dimMm' AS gd FROM "Quote" WHERE number = $1`, [number]);
      expect(q).toEqual({ ttc: String(full), w: String(w), d: String(d), f: "solid_white", gw: String(cell.widthMaxMm), gd: String(cell.dimMm) });
    });
  }
}

test("HelioLux : ancienne toile serge_100 — aucun montant pour une toile fictive, correction explicite puis prix du PDF", async ({ page }) => {
  const full = round99(ttcOf(ref!, saleHt(ref!, cellFor(ref!, "heliolux-murale-1", 3700, 3990))));
  await page.goto("/");
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ input: { kind: "system", familySlug: "sevilla", widthMm: 3700, depthMm: 3990, heightMm: 2450, mounting: "wall", finishCode: "RAL_7016_MAT", fabricCode: "serge_100", controlCode: "radio_included", options: [], sides: {}, installation: "self" }, at: "2026-11-19T08:00:00.000Z" })), KEY);
  await openSevilla(page);
  await expect(page.getByTestId("system-price")).toHaveAttribute("data-price-status", "blocked");
  await expect(page.getByTestId("system-price-amount")).toHaveCount(0);
  await page.getByTestId("price-blockers").getByTestId("price-blocker-fix").click();
  await expect(page.getByTestId("fabric-stale")).toContainText("Serge 100");
  await expect(page.getByTestId("fabric-choices").locator("input:checked")).toHaveCount(0);
  await chooseFabric(page, "Toile PVC gris aluminium (702N opaque)");
  await expect(page.getByTestId("system-price-amount")).toHaveText(ttcText(full));
  await expect(page.getByTestId("price-blockers")).toHaveCount(0);
});

test("HelioMax murale 2 600 × 3 154 : cellule de structure du PDF dans le détail du prix (centrale radio en supplément)", async ({ page }) => {
  const ht = saleHt(ref!, cellFor(ref!, "heliomax-murale-F", 2600, 3154));
  await page.goto("/configurateur/marbella?depart=1");
  await acceptNecessaryOnly(page);
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await goStep(page, "pose");
  await page.getByRole("radio", { name: /Adossée/ }).check();
  await goStep(page, "dims");
  await setDim(page, "dim-width", 2600);
  await setDim(page, "dim-depth", 3154);
  await expect(page.getByTestId("system-price")).toHaveAttribute("data-price-status", "priced");
  const amount = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: ht % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(ht / 100).replace(/\s/g, "\\s");
  await expect(page.getByTestId("price-breakdown")).toContainText(new RegExp(`${amount}\\s?€`));
});

test("HelioSun (avancée 2,6 m, largeur 4 m) : prix complet = cellule du PDF, politique et arrondi TTC", async ({ page }) => {
  const full = round99(ttcOf(ref!, saleHt(ref!, cellFor(ref!, "heliosun", 4000, 2600))));
  await page.goto("/configurateur/casablanca?depart=1");
  await acceptNecessaryOnly(page);
  await page.locator("[data-testid=system-configurator][data-ready]").waitFor();
  await page.getByTestId("dim-depth-values").getByText("2,6 m", { exact: true }).click();
  await setDim(page, "dim-width", 4000);
  await expect(page.getByTestId("system-price")).toHaveAttribute("data-price-status", "priced");
  await expect(page.getByTestId("system-price-amount")).toHaveText(ttcText(full));
});
