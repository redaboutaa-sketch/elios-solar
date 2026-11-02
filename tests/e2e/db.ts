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
  // grilles des modèles retirés (SB 400 / SB 500, archivés) ignorées : elles ne s'affichent jamais
  const r = await one<{ n: string }>(`SELECT count(*) AS n FROM "SupplierPriceList" l JOIN "ProductFamily" f ON f.slug = l."familySlug" WHERE ${IN_FORCE} AND f.status <> 'ARCHIVED'`);
  return Number(r?.n ?? 0) > 0;
}

/**
 * Montant de la cellule publiée lue pour une cote (unités mineures), ou null — même règle que le moteur de la boutique :
 * lecture exacte (dimension de la grille, largeur ponctuelle ou dans une plage), ou, pour une grille publiée avec la
 * règle « dimension supérieure », valeurs de grille immédiatement supérieures (largeur sous le début de la première
 * plage d'une avancée : non proposée).
 */
export async function publicCell(familySlug: string, variantKey: string, dimMm: number, widthMm: number): Promise<number | null> {
  const list = await one<{ id: string; dimRule: string }>(`SELECT l.id, l."dimRule" FROM "SupplierPriceList" l WHERE ${IN_FORCE} AND l."familySlug" = $1 AND l."variantKey" = $2 ORDER BY l."publishedAt" DESC LIMIT 1`, [familySlug, variantKey]);
  if (!list) return null;
  const cells = await many<{ dimAmm: number; widthMinMm: number; widthMaxMm: number; amountMinor: number }>(`SELECT r."dimAmm", COALESCE(r."widthMinMm", r."widthMaxMm") AS "widthMinMm", r."widthMaxMm", r."amountMinor" FROM "SupplierPriceRow" r WHERE r."listId" = $1 AND r.kind = 'GRID' AND r."amountMinor" IS NOT NULL AND r.status <> 'REJECTED'`, [list.id]);
  if (list.dimRule !== "ROUND_UP") return cells.find((c) => c.dimAmm === dimMm && c.widthMinMm <= widthMm && widthMm <= c.widthMaxMm)?.amountMinor ?? null;
  const dim = [...new Set(cells.map((c) => c.dimAmm))].sort((a, b) => a - b).find((d) => d >= dimMm);
  if (dim == null) return null;
  const row = cells.filter((c) => c.dimAmm === dim).sort((a, b) => a.widthMaxMm - b.widthMaxMm);
  const cell = row.find((c) => c.widthMaxMm >= widthMm);
  if (!cell || (cell === row[0] && cell.widthMinMm < cell.widthMaxMm && widthMm < cell.widthMinMm)) return null;
  return cell.amountMinor;
}

/** Catégories affichant un prix « à partir de » : un modèle avec une grille en vigueur sans élément obligatoire à chiffrer. */
export async function fromPriceCategories(): Promise<Set<string>> {
  const rows = await many<{ category: string }>(`SELECT DISTINCT f.category FROM "SupplierPriceList" l JOIN "ProductFamily" f ON f.slug = l."familySlug" WHERE ${IN_FORCE} AND f.status IN ('PUBLISHED', 'QUOTE_ONLY') AND NOT EXISTS (SELECT 1 FROM "SupplierPriceRow" x WHERE x."listId" = l.id AND x.kind = 'FIXED' AND x.conditions->>'mandatory' = 'true')`);
  return new Set(rows.map((r) => r.category));
}
