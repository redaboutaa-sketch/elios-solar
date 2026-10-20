import { test, expect, type Page, newClientContext } from "./fixtures";
import { configureStandard, fillCheckout, shot, uid, loginAdmin } from "./helpers";
import { one, pool } from "./db";

test.setTimeout(240_000);


async function checkoutInstallments(page: Page, email: string) {
  await configureStandard(page);
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page.waitForURL(/\/panier/);
  await page.getByRole("link", { name: "Passer la commande" }).click();
  await page.waitForURL(/\/commande(\?.*)?$/);
  await fillCheckout(page, email);
  const option = page.getByRole("radio", { name: /Paiement en 3 fois via Simulateur/ });
  await expect(option).toBeVisible();
  await expect(page.getByText("sous réserve d'acceptation par le prestataire", { exact: false })).toBeVisible();
  // jamais « sans frais » sans confirmation contractuelle
  await expect(page.getByTestId("plan-3")).toContainText("frais non confirmés");
  await option.check();
  await shot(page, "paiement-fractionne-choix");
  await page.getByRole("button", { name: "Continuer vers le paiement fractionné" }).click();
  await page.waitForURL(/paiement-fractionne-simule/, { timeout: 30_000 });
  await expect(page.getByText("SIMULATEUR DE PAIEMENT FRACTIONNÉ — aucune transaction, aucun prestataire contacté")).toBeVisible();
  await expect(page.getByTestId("sim-schedule")).toContainText("1re échéance");
}

test("paiement fractionné simulé : activation admin, acceptation puis refus avec repli carte", async ({ page, browser }) => {
  const saved = await one<Record<string, unknown>>('SELECT * FROM "InstallmentSettings" WHERE id = 1');
  try {
    // 1. l'administrateur active le simulateur en test
    await loginAdmin(page);
    await page.goto("/admin/paiement");
    await page.getByLabel("Prestataire", { exact: true }).selectOption("simulator");
    await page.getByLabel("Activé en environnement de test", { exact: true }).check();
    await page.getByLabel(/Activé en production/).uncheck();
    await page.getByLabel("Montant minimum (€)").fill("50");
    await page.getByLabel("Montant maximum (€)").fill("50000");
    await page.getByLabel("Pays de livraison (ISO)").fill("FR");
    await page.getByLabel("Nombres d'échéances").fill("3, 4");
    await page.getByLabel("Frais client (points de base)").fill("0");
    await page.getByLabel("Frais fixes client (€)").fill("0");
    await page.getByLabel(/Sans frais » confirmé/).uncheck();
    await page.getByRole("button", { name: "Enregistrer les réglages" }).click();
    await expect(page.getByText("Réglages du paiement fractionné enregistrés.")).toBeVisible();
    await expect(page.getByTestId("operational")).toContainText("oui");
    await shot(page, "admin-paiement-fractionne");

    // 2. le client paie en 3 fois et le simulateur accepte
    const ctx = await newClientContext(browser, { viewport: page.viewportSize() });
    const cp = await ctx.newPage();
    const email = `fractionne-${uid()}@test.invalid`;
    await checkoutInstallments(cp, email);
    await shot(cp, "paiement-fractionne-simulateur");
    await cp.getByRole("button", { name: "Accepter (simulation)" }).click();
    await cp.waitForURL(/confirmation/);
    await expect(cp.getByRole("heading", { name: /commande est confirmée/ })).toBeVisible();
    await expect(cp.getByTestId("payment-method")).toContainText("Paiement en 3 fois via simulateur");
    await shot(cp, "paiement-fractionne-confirmation");
    const paid = await one<{ status: string; method: string; installments: number; provider: string }>('SELECT o.status, p.method, p.installments, p.provider FROM "Order" o JOIN "Payment" p ON p."orderId" = o.id WHERE o.email = $1 ORDER BY p."createdAt" DESC LIMIT 1', [email]);
    expect(paid).toMatchObject({ status: "PAID", method: "installments", installments: 3, provider: "INSTALLMENTS_SIM" });

    // 3. nouvelle commande : le prestataire refuse ⇒ message de repli carte
    const email2 = `fractionne-refus-${uid()}@test.invalid`;
    await checkoutInstallments(cp, email2);
    await cp.getByRole("button", { name: "Refuser (simulation)" }).click();
    await cp.waitForURL(/annulation/);
    await expect(cp.getByText("Le prestataire n'a pas accepté le paiement fractionné : vous pouvez régler par carte")).toBeVisible();
    await shot(cp, "paiement-fractionne-refus");
    await cp.getByRole("button", { name: "Payer par carte en une fois" }).click();
    await cp.waitForURL(/\/commande\?repli=carte/);
    await expect(cp.getByText(/vous pouvez régler par carte en une fois/)).toBeVisible();
    const failed = await one<{ status: string }>('SELECT status FROM "Order" WHERE email = $1', [email2]);
    expect(failed?.status).toBe("PAYMENT_FAILED");
    await ctx.close();
  } finally {
    if (saved) {
      await pool.query('UPDATE "InstallmentSettings" SET provider=$1, "enabledTest"=$2, "enabledProd"=$3, "merchantEligible"=$4, "minCents"=$5, "maxCents"=$6, countries=$7, "installmentCounts"=$8, "feesBps"=$9, "feesFixedCents"=$10, "feesLabel"=$11, "noFeesConfirmed"=$12, "termsUrl"=$13 WHERE id = 1', [saved.provider, saved.enabledTest, saved.enabledProd, saved.merchantEligible, saved.minCents, saved.maxCents, saved.countries, saved.installmentCounts, saved.feesBps, saved.feesFixedCents, saved.feesLabel, saved.noFeesConfirmed, saved.termsUrl]);
    } else {
      await pool.query('DELETE FROM "InstallmentSettings" WHERE id = 1');
    }
  }
});
