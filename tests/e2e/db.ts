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

/** Grilles de vente en vigueur pour la boutique (écran Tarifs) : SQL commun aux requêtes ci-dessous. */
const IN_FORCE = `l.scope = 'GRID' AND l.status = 'ACTIVE' AND l.nature = 'SALE' AND l.currency IS NOT NULL AND l."taxBasis" <> 'UNKNOWN' AND l.clientele IN ('ALL', 'PARTICULIER') AND (l."validFrom" IS NULL OR l."validFrom" <= now()) AND (l."validTo" IS NULL OR l."validTo" > now())`;
export { IN_FORCE as IN_FORCE_GRID_SQL };

/** Prix publics en vigueur (grille de vente publiée) : présents en préproduction, absents en CI. */
export async function publicPricesActive(): Promise<boolean> {
  const r = await one<{ n: string }>(`SELECT count(*) AS n FROM "SupplierPriceList" l WHERE ${IN_FORCE}`);
  return Number(r?.n ?? 0) > 0;
}

/**
 * Montant de la cellule publiée lue pour une cote (unités mineures), ou null : lecture exacte (dimension de la
 * grille, largeur ponctuelle ou dans une plage), sauf grille publiée avec la règle « dimension supérieure ».
 */
export async function publicCell(familySlug: string, variantKey: string, dimMm: number, widthMm: number): Promise<number | null> {
  const r = await one<{ amountMinor: number }>(`SELECT r."amountMinor" FROM "SupplierPriceRow" r JOIN "SupplierPriceList" l ON l.id = r."listId" WHERE ${IN_FORCE} AND l."dimRule" = 'EXACT' AND r.kind = 'GRID' AND r."familySlug" = $1 AND r."variantKey" = $2 AND r."dimAmm" = $3 AND r."widthMinMm" <= $4 AND r."widthMaxMm" >= $4 AND r."amountMinor" IS NOT NULL AND r.status <> 'REJECTED' ORDER BY l."publishedAt" DESC LIMIT 1`, [familySlug, variantKey, dimMm, widthMm]);
  return r?.amountMinor ?? null;
}
