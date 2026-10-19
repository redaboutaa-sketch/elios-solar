import type { Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

/** État de session admin produit par auth.setup.ts (fichier local, ignoré par git). */
export const ADMIN_STATE = path.join(__dirname, ".auth", "admin.json");

/**
 * Ouvre l'administration avec la session admin de la campagne (aucune nouvelle connexion par
 * formulaire : la limite anti-force brute n'est pas sollicitée par l'enchaînement des parcours).
 */
export async function loginAdmin(page: Page, to = "/admin") {
  const state = JSON.parse(readFileSync(ADMIN_STATE, "utf8")) as { cookies: Parameters<ReturnType<Page["context"]>["addCookies"]>[0] };
  await page.context().addCookies(state.cookies);
  await page.goto(to);
  await page.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 20_000 });
}

export const uid = () => randomBytes(4).toString("hex");

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `tests/e2e/screenshots/${name}-${page.viewportSize()?.width ?? "x"}.png`, fullPage: true });
}

export async function acceptNecessaryOnly(page: Page) {
  const btn = page.getByRole("button", { name: "Tout refuser" });
  await btn.waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

/** Configure une Solis 3x4 anthracite autoportée avec une paroi vitrée fixe à gauche et un code postal. */
export async function configureStandard(page: Page) {
  await page.goto("/configurateur?gamme=pergola-solis&dimension=3x4&finition=ANTHRACITE&implantation=autoportee");
  await acceptNecessaryOnly(page);
  await page.getByRole("button", { name: /^Gauche · 3 m/ }).click();
  await page.getByRole("radio", { name: /Paroi vitrée/ }).check();
  await page.getByRole("button", { name: /^fixe ·/ }).click();
  await page.getByLabel("Code postal de livraison").fill("69000");
  await page.getByTestId("price-confirmation").getByText("Prix confirmé par le serveur").waitFor({ timeout: 15_000 });
}

export async function createAccount(page: Page, email: string, password: string) {
  await page.goto("/compte/inscription");
  await page.getByLabel("Nom complet").fill("Client Test");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/Mot de passe/).fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL(/\/compte/);
}

export async function fillCheckout(page: Page, email: string) {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Prénom").fill("Camille");
  await page.getByLabel("Nom", { exact: true }).fill("Durand");
  await page.getByLabel("Adresse", { exact: true }).fill("12 rue des Lilas");
  await page.getByLabel("Code postal").fill("69000");
  await page.getByLabel("Ville").fill("Lyon");
  await page.getByLabel(/Téléphone/).fill("0612345678");
  await page.getByLabel(/J'ai lu et j'accepte/).check();
}
