import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomInt } from "node:crypto";
import { uid } from "./helpers";

/**
 * La protection anti-force brute reste active pendant la recette ; ce parcours vérifie qu'elle bloque
 * réellement. Chaque essai vise des adresses et des IP propres au test (plage TEST-NET 198.51.100.0/24
 * et 203.0.113.0/24, RFC 5737) pour ne pas consommer le quota des autres parcours.
 */
const signIn = (request: APIRequestContext, baseURL: string, email: string, password: string, ip: string) =>
  request.post("/api/auth/sign-in/email", { data: { email, password }, headers: { origin: baseURL, "x-forwarded-for": ip }, failOnStatusCode: false });

test("verrou par compte : 5 mots de passe faux, même en changeant d'IP, puis blocage même avec le bon mot de passe", async ({ page, request, baseURL }) => {
  const email = `bruteforce-${uid()}@test.invalid`;
  const password = `Correct-${uid()}-horse`;
  const signUp = await request.post("/api/auth/sign-up/email", { data: { email, password, name: "Compte test anti-force brute" }, headers: { origin: baseURL!, "x-forwarded-for": `198.51.100.${randomInt(1, 254)}` }, failOnStatusCode: false });
  expect(signUp.status()).toBe(200);
  const net = randomInt(1, 200);
  for (let i = 0; i < 5; i++) {
    // une IP différente à chaque essai : la limite par IP ne se déclenche pas, le verrou par compte si
    const r = await signIn(request, baseURL!, email, `faux-${i}-mot-de-passe`, `203.0.113.${net + i}`);
    expect(r.status(), `essai ${i + 1}`).toBe(401);
  }
  const locked = await signIn(request, baseURL!, email, password, `203.0.113.${net + 10}`);
  expect(locked.status()).toBe(429);
  expect((await locked.json()).code).toBe("ACCOUNT_LOCKED");

  // le formulaire affiche le blocage en français, sans révéler si le mot de passe était correct
  await page.goto("/compte/connexion");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText(/Trop de tentatives/)).toBeVisible();
  await expect(page).toHaveURL(/\/compte\/connexion/);
});

test("limite par IP : au-delà de 3 connexions en 10 s depuis la même IP, réponse 429", async ({ request, baseURL }) => {
  const ip = `198.51.100.${randomInt(1, 254)}`;
  const codes: number[] = [];
  for (let i = 0; i < 4; i++) codes.push((await signIn(request, baseURL!, `inconnu-${uid()}@test.invalid`, "mot-de-passe-faux", ip)).status());
  expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
  expect(codes[3]).toBe(429);
  // une autre IP n'est pas affectée
  expect((await signIn(request, baseURL!, `inconnu-${uid()}@test.invalid`, "mot-de-passe-faux", `198.51.100.${(Number(ip.split(".")[3]) % 254) + 1}`)).status()).toBe(401);
});

test("un compte sain n'est pas bloqué par les échecs d'un autre compte", async ({ request, baseURL }) => {
  const email = `sain-${uid()}@test.invalid`;
  const password = `Correct-${uid()}-horse`;
  expect((await request.post("/api/auth/sign-up/email", { data: { email, password, name: "Compte sain" }, headers: { origin: baseURL!, "x-forwarded-for": `198.51.100.${randomInt(1, 254)}` }, failOnStatusCode: false })).status()).toBe(200);
  const ok = await signIn(request, baseURL!, email, password, `203.0.113.${randomInt(220, 254)}`);
  expect(ok.status()).toBe(200);
});
