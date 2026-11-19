import { defineConfig, devices } from "@playwright/test";

/**
 * Recette (skills /recette-site, /audit-tarifs, /controle-production) : contrôles reproductibles complémentaires de la
 * suite tests/e2e. Deux modes, choisis explicitement :
 *   RECETTE_MODE=isolated   → environnement isolé (scripts/recette/env.sh), écritures permises (devis de test) ;
 *   RECETTE_MODE=production → domaine public, LECTURE SEULE : aucun devis, message, commande ni paiement ; aucune IP simulée.
 * Aucune relance automatique ; rapport JSON dans RECETTE_REPORT_DIR.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3410";
const reportDir = process.env.RECETTE_REPORT_DIR ?? "private/recette/last";

export default defineConfig({
  testDir: "tests/recette",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  failOnFlakyTests: true,
  reporter: [["list"], ["json", { outputFile: `${reportDir}/playwright-recette.json` }], ["html", { open: "never", outputFolder: `${reportDir}/playwright-recette-html` }]],
  outputDir: `${reportDir}/playwright-recette-traces`,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
});
