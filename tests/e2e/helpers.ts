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

export async function createAccount(page: Page, email: string, password: string) {
  await page.goto("/compte/inscription");
  await page.getByLabel("Nom complet").fill("Client Test");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/Mot de passe/).fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  // attendre la sortie de la page d'inscription (l'URL /compte/inscription correspond déjà à /compte)
  await page.waitForURL((u) => u.pathname.startsWith("/compte") && !u.pathname.startsWith("/compte/inscription"), { timeout: 20_000 });
}

/** Remplit et envoie le formulaire « Demande de devis » ; retourne le numéro du devis. */
export async function fillQuote(page: Page, email: string, firstName = "Sam") {
  const form = page.getByRole("form", { name: "Demande de devis" });
  await form.getByLabel("Prénom").fill(firstName);
  await form.getByLabel("Nom", { exact: true }).fill("Recette");
  await form.getByLabel("E-mail").fill(email);
  await form.getByLabel("Code postal du projet").fill("69000");
  await form.getByLabel(/J'accepte/).check();
  await form.getByRole("button", { name: "Envoyer la demande de devis" }).click();
  await page.getByTestId("quote-done").waitFor({ timeout: 40_000 });
  return (await page.getByTestId("quote-done").textContent())!.match(/DEV-\d{6}-[A-Z0-9]{6}/)![0];
}

/** Coordonnées fictives du formulaire de commande (paiement simulé). */
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

/** Saisie d'une cote du configurateur (champ en millimètres), validée en quittant le champ. */
export async function setDim(page: Page, id: string, value: number) {
  const input = page.locator(`#${id}`);
  await input.fill(String(value));
  await input.blur();
}

/** Étapes du configurateur en étapes (libellés de la navigation `config-steps`). */
export const STEP = { dims: "step-dims", pose: "step-pose", equip: "step-equip", recap: "step-recap" } as const;
const STEP_LABEL: Record<keyof typeof STEP, RegExp> = { dims: /Dimensions/, pose: /Pose et finitions/, equip: /Équipements/, recap: /Récapitulatif et devis/ };

/** Affiche une étape par la navigation des étapes et attend qu'elle soit la seule visible. */
export async function goStep(page: Page, step: keyof typeof STEP) {
  await page.getByTestId("config-steps").getByRole("button", { name: STEP_LABEL[step] }).click();
  await page.getByTestId(STEP[step]).waitFor({ state: "visible" });
}

/** Ouvre un configurateur sur une session neuve : bannière cookies fermée, dessin du projet affiché. */
export async function openConfigurator(page: Page, slug: string) {
  await page.goto(`/configurateur/${slug}`);
  await acceptNecessaryOnly(page);
  await page.getByTestId("project-drawing").waitFor({ state: "visible" });
  await page.getByTestId(STEP.dims).waitFor({ state: "visible" });
}

/** Points signalés (liste aria-live) de l'étape affichée. */
export const stepIssues = (page: Page, step: keyof typeof STEP) => page.getByTestId(STEP[step]).locator('ul[aria-live="polite"]');

/** Attribut data-* du dessin paramétrique du projet. */
export const drawingAttr = (page: Page, name: string) => page.getByTestId("project-drawing").getAttribute(`data-${name}`);
