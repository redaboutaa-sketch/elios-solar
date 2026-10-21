import "server-only";
import { prisma } from "@/lib/prisma";
import type { SystemPriceTable } from "@/domain/system-pricing";

import { PUBLIC_PRICE_SOURCE_KEY } from "./source";

export { PUBLIC_PRICE_SOURCE_KEY };
/** Seule colonne publiée : « Prix final HELIOSTORES ». La colonne « Prix » source n'est jamais chargée. */
const PUBLIC_ROLE = "PRIX_FINAL";

/**
 * Grilles publiques par famille, lues dans la version ACTIVE du classeur. Sans version active ou sans devise
 * renseignée, aucune grille n'est chargée : les systèmes restent chiffrés au devis.
 */
export async function loadPublicSystemPrices(): Promise<{ version: string; tables: Map<string, SystemPriceTable> }> {
  const list = await prisma.supplierPriceList.findFirst({ where: { sourceKey: PUBLIC_PRICE_SOURCE_KEY, status: "ACTIVE" }, select: { id: true, version: true, currency: true, taxBasis: true, updatedAt: true } });
  const tables = new Map<string, SystemPriceTable>();
  if (!list?.currency) return { version: "none", tables };
  const rows = await prisma.supplierPriceRow.findMany({
    where: { listId: list.id, amountRole: PUBLIC_ROLE, kind: "GRID", amountMinor: { not: null }, status: { not: "REJECTED" }, dimAmm: { not: null }, widthMaxMm: { not: null } },
    select: { familySlug: true, variantKey: true, dimAKey: true, dimAmm: true, widthMinMm: true, widthMaxMm: true, amountMinor: true },
  });
  for (const r of rows) {
    let t = tables.get(r.familySlug);
    if (!t) tables.set(r.familySlug, (t = { currency: list.currency, taxBasis: list.taxBasis === "UNKNOWN" ? null : list.taxBasis, dimAKey: r.dimAKey === "hauteur" ? "hauteur" : "projection", listVersion: list.version, cells: [] }));
    t.cells.push({ variantKey: r.variantKey, dimAmm: r.dimAmm!, widthMinMm: r.widthMinMm ?? r.widthMaxMm!, widthMaxMm: r.widthMaxMm!, amountMinor: r.amountMinor! });
  }
  return { version: `${list.id}@${list.version}:${list.updatedAt.getTime()}`, tables };
}
