import "dotenv/config";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

/**
 * Crée un administrateur de test avec un mot de passe aléatoire propre à l'exécution
 * (jamais journalisé ni commité). Le compte de test précédent est supprimé pour rester reproductible.
 */
export default async function globalSetup() {
  const email = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@test.invalid";
  const password = process.env.E2E_ADMIN_PASSWORD ?? randomBytes(18).toString("base64url");
  process.env.E2E_ADMIN_EMAIL = email;
  process.env.E2E_ADMIN_PASSWORD = password;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('DELETE FROM "user" WHERE email = $1', [email]);
  await pool.end();
  execSync("pnpm exec tsx scripts/bootstrap-admin.ts", { env: { ...process.env, ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_NAME: "Admin E2E" }, stdio: "pipe" });
}
