import "server-only";
import { prisma } from "@/lib/prisma";
import type { SystemPriceTable } from "@/domain/system-pricing";

import { PUBLIC_PRICE_SOURCE_KEY } from "./source";

export { PUBLIC_PRICE_SOURCE_KEY };

/** Clientèles servies par la boutique (aucun compte professionnel) ; une grille « particuliers » prime sur « toutes ». */
const SHOP_CLIENTELES = ["PARTICULIER", "ALL"] as const;

/**
 * Grilles publiques par famille : versions de grille (administration → Tarifs) publiées, de nature VENTE, avec devise
 * et base fiscale, en vigueur à `now`. Coûts d'achat, brouillons et grilles professionnelles ne sont jamais chargés.
 * Sans grille en vigueur, les systèmes restent chiffrés au devis.
 */
export async function loadPublicSystemPrices(now: Date = new Date()): Promise<{ version: string; tables: Map<string, SystemPriceTable> }> {
  const lists = await prisma.supplierPriceList.findMany({
    where: {
      scope: "GRID", status: "ACTIVE", nature: "SALE", clientele: { in: [...SHOP_CLIENTELES] }, currency: { not: null }, taxBasis: { not: "UNKNOWN" }, familySlug: { not: null },
      AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: now } }] }, { OR: [{ validTo: null }, { validTo: { gt: now } }] }],
    },
    orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
    select: { id: true, version: true, familySlug: true, variantKey: true, clientele: true, currency: true, taxBasis: true, dimRule: true, vatRateBps: true, updatedAt: true },
  });
  // une seule version par famille × variante (pas de chevauchement à la publication ; garde-fou : la plus spécifique, puis la plus récente)
  const chosen = new Map<string, (typeof lists)[number]>();
  for (const l of [...lists].sort((a, b) => SHOP_CLIENTELES.indexOf(a.clientele as never) - SHOP_CLIENTELES.indexOf(b.clientele as never))) {
    const k = `${l.familySlug}|${l.variantKey}`;
    if (!chosen.has(k)) chosen.set(k, l);
  }
  const tables = new Map<string, SystemPriceTable>();
  const picked = [...chosen.values()];
  const rows = picked.length ? await prisma.supplierPriceRow.findMany({
    where: { listId: { in: picked.map((l) => l.id) }, kind: "GRID", amountMinor: { not: null }, status: { not: "REJECTED" }, dimAmm: { not: null }, widthMaxMm: { not: null } },
    select: { listId: true, dimAKey: true, dimAmm: true, widthMinMm: true, widthMaxMm: true, amountMinor: true },
  }) : [];
  for (const l of picked) {
    const meta = { currency: l.currency!, taxBasis: l.taxBasis === "UNKNOWN" ? null : l.taxBasis, dimRule: l.dimRule === "ROUND_UP" ? "round_up" as const : "exact" as const, vatRateBps: l.vatRateBps, listVersion: l.version, versionId: l.id };
    const mine = rows.filter((r) => r.listId === l.id);
    if (!mine.length) continue;
    let t = tables.get(l.familySlug!);
    if (!t) tables.set(l.familySlug!, (t = { ...meta, dimAKey: mine[0]!.dimAKey === "hauteur" ? "hauteur" : "projection", variants: {}, cells: [] }));
    t.variants![l.variantKey] = meta;
    for (const r of mine) t.cells.push({ variantKey: l.variantKey, dimAmm: r.dimAmm!, widthMinMm: r.widthMinMm ?? r.widthMaxMm!, widthMaxMm: r.widthMaxMm!, amountMinor: r.amountMinor! });
  }
  return { version: picked.map((l) => `${l.id}@${l.version}:${l.updatedAt.getTime()}`).sort().join(",") || "none", tables };
}
