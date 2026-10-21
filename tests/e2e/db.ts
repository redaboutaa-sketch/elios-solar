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

/** Prix publics actifs (version ACTIVE du classeur avec devise) : présents en préproduction, absents en CI. */
export async function publicPricesActive(): Promise<boolean> {
  const r = await one<{ n: string }>(`SELECT count(*) AS n FROM "SupplierPriceList" WHERE "sourceKey" = 'xlsx-situation-des-tarif' AND status = 'ACTIVE' AND currency IS NOT NULL`);
  return Number(r?.n ?? 0) > 0;
}

/** Montant « Prix final HELIOSTORES » d'une cellule de la version active (unités mineures), ou null. */
export async function publicCell(familySlug: string, variantKey: string, dimAmm: number, widthMaxMm: number): Promise<number | null> {
  const r = await one<{ amountMinor: number }>(`SELECT r."amountMinor" FROM "SupplierPriceRow" r JOIN "SupplierPriceList" l ON l.id = r."listId" WHERE l."sourceKey" = 'xlsx-situation-des-tarif' AND l.status = 'ACTIVE' AND r."amountRole" = 'PRIX_FINAL' AND r.kind = 'GRID' AND r."familySlug" = $1 AND r."variantKey" = $2 AND r."dimAmm" = $3 AND r."widthMaxMm" = $4 AND r.status <> 'REJECTED'`, [familySlug, variantKey, dimAmm, widthMaxMm]);
  return r?.amountMinor ?? null;
}
