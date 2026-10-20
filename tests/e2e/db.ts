import "dotenv/config";
import { Pool } from "pg";
import { execSync } from "node:child_process";

/** Accès base minimal pour les tests navigateur (le client Prisma généré est ESM, non chargeable par Playwright). */
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const r = await pool.query(sql, params);
  return (r.rows[0] as T) ?? null;
}
export async function many<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pool.query(sql, params)).rows as T[];
}
export function runMailWorkerOnce() {
  return execSync("pnpm exec tsx scripts/mail-worker.ts --once", { env: { ...process.env, MAIL_PROVIDER: process.env.E2E_MAIL_PROVIDER ?? process.env.MAIL_PROVIDER ?? "log" }, stdio: "pipe" }).toString();
}
