import { test, expect, newClientContext } from "./fixtures";
import { configureStandard, fillCheckout, shot, uid, loginAdmin } from "./helpers";
import { one } from "./db";

const SKU = "ES-PS1-3X4-ANT-AUT";


test("changer un tarif en administration : appliqué au configurateur, sans altérer une commande passée", async ({ page, browser }) => {
  // 1. une commande payée au prix courant (client invité, contexte séparé)
  const customer = await newClientContext(browser, { viewport: page.viewportSize() });
  const cp = await customer.newPage();
  await configureStandard(cp);
  await cp.getByRole("button", { name: "Ajouter au panier" }).click();
  await cp.waitForURL(/\/panier/);
  await cp.getByRole("link", { name: "Passer la commande" }).click();
  const email = `tarif-${uid()}@test.invalid`;
  await fillCheckout(cp, email);
  await cp.getByRole("button", { name: /paiement simulé/ }).click();
  await cp.waitForURL(/paiement-demo/);
  await cp.getByRole("button", { name: "Simuler un paiement accepté" }).click();
  await cp.waitForURL(/confirmation/);
  await customer.close();
  const order = await one<{ id: string; number: string; totalCents: number }>('SELECT id, number, "totalCents" FROM "Order" WHERE email = $1', [email]);
  const line = await one<{ unitGrossCents: number }>('SELECT "unitGrossCents" FROM "OrderLine" WHERE "orderId" = $1 AND sku = $2', [order!.id, SKU]);
  const original = await one<{ priceCents: number }>('SELECT "priceCents" FROM "Variant" WHERE sku = $1', [SKU]);
  expect(line!.unitGrossCents).toBe(original!.priceCents);

  // 2. l'administrateur change le prix
  await loginAdmin(page);
  await shot(page, "admin-tableau-de-bord");
  await page.goto(`/admin/catalogue/variantes?q=${SKU}`);
  const row = page.locator("tr").filter({ hasText: SKU }).first();
  const newPrice = (original!.priceCents + 10_000) / 100;
  await row.locator('input[name="price"]').fill(String(newPrice));
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForLoadState("networkidle");
  await shot(page, "admin-variantes");
  try {
    const updated = await one<{ priceCents: number }>('SELECT "priceCents" FROM "Variant" WHERE sku = $1', [SKU]);
    expect(updated!.priceCents).toBe(original!.priceCents + 10_000);
    // 3. le configurateur applique le nouveau prix
    await page.goto("/configurateur?gamme=pergola-solis&dimension=3x4&finition=ANTHRACITE&implantation=autoportee");
    await expect(page.locator("#recap").getByText(/Pergola Solis 3 × 4 m/).locator("..").getByText(new RegExp(formatFr(original!.priceCents + 10_000)))).toBeVisible({ timeout: 15_000 });
    // 4. la commande passée est inchangée (côté client et côté administration)
    const lineAfter = await one<{ unitGrossCents: number }>('SELECT "unitGrossCents" FROM "OrderLine" WHERE "orderId" = $1 AND sku = $2', [order!.id, SKU]);
    expect(lineAfter!.unitGrossCents).toBe(original!.priceCents);
    await page.goto(`/admin/commandes/${order!.id}`);
    await expect(page.getByText(order!.number).first()).toBeVisible();
    await expect(page.getByText(new RegExp(formatFr(order!.totalCents))).first()).toBeVisible();
    await shot(page, "admin-commande");
    const audit = await one<{ action: string }>(`SELECT action FROM "AuditLog" WHERE entity = 'Variant' ORDER BY "createdAt" DESC LIMIT 1`);
    expect(audit?.action).toBe("variant.update.price");
  } finally {
    // 5. remise du prix d'origine via l'interface
    await page.goto(`/admin/catalogue/variantes?q=${SKU}`);
    const r2 = page.locator("tr").filter({ hasText: SKU }).first();
    await r2.locator('input[name="price"]').fill(String(original!.priceCents / 100));
    await r2.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForLoadState("networkidle");
  }
  const restored = await one<{ priceCents: number }>('SELECT "priceCents" FROM "Variant" WHERE sku = $1', [SKU]);
  expect(restored!.priceCents).toBe(original!.priceCents);
});

function formatFr(cents: number): string {
  // tolère "19 620 €" comme "19 620,00 €" (séparateurs insécables)
  const sp = "[\\s\\u202f\\u00a0]";
  const base = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.floor(cents / 100)).replace(/[\u202f\u00a0\s]/g, sp);
  const dec = cents % 100 ? `,${String(cents % 100).padStart(2, "0")}` : "(,00)?";
  return `${base}${dec}${sp}€`;
}
