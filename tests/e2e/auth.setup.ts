import { test as setup, expect } from "@playwright/test";
import { ADMIN_STATE } from "./helpers";

/**
 * Connexion administrateur UNIQUE par campagne, par le vrai formulaire (la limite anti-force brute
 * reste active) ; l'état de session est réutilisé par tous les parcours admin via `loginAdmin`.
 */
setup("connexion administrateur (session réutilisée par la campagne)", async ({ page }) => {
  await page.goto("/compte/connexion?next=/admin");
  await page.getByLabel("E-mail").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Mot de passe").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.context().storageState({ path: ADMIN_STATE });
});
