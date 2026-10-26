import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomInt } from "node:crypto";
import { pool } from "./db";
import { uid } from "./helpers";

/**
 * La protection anti-force brute reste active pendant la recette ; ces parcours vérifient qu'elle bloque réellement,
 * sur des comptes dédiés créés puis supprimés par le test (jamais un compte réel ni un administrateur).
 *
 * Deux topologies :
 * - accès direct (dev, CI) : l'application fait confiance à X-Forwarded-For ; chaque essai utilise une IP de test
 *   (RFC 5737) pour ne pas consommer le quota des autres parcours ;
 * - derrière le proxy (préproduction, production : E2E_BASE_URL en https) : X-Forwarded-For forgé est remplacé par
 *   l'adresse réelle du poste de recette, toutes les requêtes partagent donc une IP. Le verrou par compte est vérifié
 *   avec des essais espacés (sous la limite par IP), et la limite par IP en vérifiant qu'un X-Forwarded-For forgé ne
 *   la contourne pas. Aucune limite n'est relevée et aucun en-tête n'est rendu de confiance pour le test.
 */
const behindProxy = process.env.E2E_BEHIND_PROXY === "1" || /^https:/.test(process.env.E2E_BASE_URL ?? "");
// règle intégrée de la limite par IP : 3 connexions / 10 s par IP et par chemin
const IP_WINDOW_MS = 10_000;
const PACE_MS = behindProxy ? Math.ceil(IP_WINDOW_MS / 3) + 400 : 0;
const created: string[] = [];

const signIn = (request: APIRequestContext, baseURL: string, email: string, password: string, ip: string) =>
  request.post("/api/auth/sign-in/email", { data: { email, password }, headers: { origin: baseURL, "x-forwarded-for": ip }, failOnStatusCode: false });
const signUp = async (request: APIRequestContext, baseURL: string, email: string, password: string, name: string) => {
  created.push(email);
  return request.post("/api/auth/sign-up/email", { data: { email, password, name }, headers: { origin: baseURL, "x-forwarded-for": `198.51.100.${randomInt(1, 254)}` }, failOnStatusCode: false });
};
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  // nettoyage des comptes dédiés (sessions et comptes liés supprimés en cascade)
  if (created.length) await pool.query(`DELETE FROM "user" WHERE email = ANY($1::text[]) AND role = 'CUSTOMER'`, [created]);
});

test("verrou par compte : 5 mots de passe faux, même en changeant d'IP, puis blocage même avec le bon mot de passe", async ({ page, request, baseURL }) => {
  test.setTimeout(90_000);
  const email = `bruteforce-${uid()}@test.invalid`;
  const password = `Correct-${uid()}-horse`;
  expect((await signUp(request, baseURL!, email, password, "Compte test anti-force brute")).status()).toBe(200);
  await pause(PACE_MS);
  const net = randomInt(1, 200);
  for (let i = 0; i < 5; i++) {
    // IP différente à chaque essai (ignorée derrière le proxy) et essais espacés : seule la règle par compte peut bloquer
    const r = await signIn(request, baseURL!, email, `faux-${i}-mot-de-passe`, `203.0.113.${net + i}`);
    expect(r.status(), `essai ${i + 1}`).toBe(401);
    await pause(PACE_MS);
  }
  const locked = await signIn(request, baseURL!, email, password, `203.0.113.${net + 10}`);
  expect(locked.status()).toBe(429);
  expect((await locked.json()).code).toBe("ACCOUNT_LOCKED");
  await pause(PACE_MS);

  // le formulaire affiche le blocage en français, sans révéler si le mot de passe était correct
  await page.goto("/compte/connexion");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText(/Trop de tentatives/)).toBeVisible();
  await expect(page).toHaveURL(/\/compte\/connexion/);
  await pause(PACE_MS);
});

test("limite par IP : au-delà de 3 connexions en 10 s depuis la même IP, réponse 429", async ({ request, baseURL }) => {
  test.setTimeout(60_000);
  if (behindProxy) await pause(IP_WINDOW_MS); // fenêtre de la limite vidée des essais du parcours précédent
  const ip = `198.51.100.${randomInt(1, 254)}`;
  const codes: number[] = [];
  for (let i = 0; i < 4; i++) codes.push((await signIn(request, baseURL!, `inconnu-${uid()}@test.invalid`, "mot-de-passe-faux", ip)).status());
  expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
  expect(codes[3]).toBe(429);
  const other = (await signIn(request, baseURL!, `inconnu-${uid()}@test.invalid`, "mot-de-passe-faux", `198.51.100.${(Number(ip.split(".")[3]) % 254) + 1}`)).status();
  // accès direct : une autre IP n'est pas affectée ; derrière le proxy : changer X-Forwarded-For ne contourne pas la limite
  expect(other).toBe(behindProxy ? 429 : 401);
  if (behindProxy) await pause(IP_WINDOW_MS); // ne pas laisser l'IP du poste de recette bloquée pour les parcours suivants
});

test("un compte sain n'est pas bloqué par les échecs d'un autre compte", async ({ request, baseURL }) => {
  const email = `sain-${uid()}@test.invalid`;
  const password = `Correct-${uid()}-horse`;
  expect((await signUp(request, baseURL!, email, password, "Compte sain")).status()).toBe(200);
  await pause(PACE_MS);
  const ok = await signIn(request, baseURL!, email, password, `203.0.113.${randomInt(220, 254)}`);
  expect(ok.status()).toBe(200);
});
