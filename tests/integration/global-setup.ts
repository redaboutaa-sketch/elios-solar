import "dotenv/config";
import { execSync } from "node:child_process";

/** Prépare la base de test : migrations + seed (idempotent). Ne touche jamais à la base de dev si DATABASE_URL_TEST est défini. */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_TEST ou DATABASE_URL requis pour les tests d'intégration");
  if (process.env.VITEST_SKIP_DB_SETUP === "1") return;
  const env = { ...process.env, DATABASE_URL: url };
  execSync("pnpm exec prisma migrate deploy", { env, stdio: "inherit" });
  execSync("pnpm exec tsx prisma/seed.ts", { env, stdio: "inherit" });
}
