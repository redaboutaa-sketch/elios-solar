import "server-only";
import { prisma } from "@/lib/prisma";
import type { PriceSupplement, SystemPriceTable } from "@/domain/system-pricing";
import { PUBLIC_FORBIDDEN_NAMES } from "@/domain/public-sanitize";

import { PUBLIC_PRICE_SOURCE_KEY } from "./source";

export { PUBLIC_PRICE_SOURCE_KEY };

/** Clientèles servies par la boutique (aucun compte professionnel) ; une grille « particuliers » prime sur « toutes ». */
const SHOP_CLIENTELES = ["PARTICULIER", "ALL"] as const;
/**
 * Devise de la boutique : panier, commande et PDF sont libellés en euros (src/lib/money.ts). Une grille dans une autre
 * devise n'alimente jamais le site (aucune conversion) : elle reste chiffrée au devis.
 */
export const SHOP_CURRENCY = "EUR";

/**
 * Grilles publiques par famille : versions de grille (administration → Tarifs) publiées, de nature VENTE, avec devise
 * en euros et base fiscale établie, en vigueur à `now`. Coûts d'achat, brouillons et grilles professionnelles ne sont jamais chargés.
 * Sans grille en vigueur, les systèmes restent chiffrés au devis.
 */
export async function loadPublicSystemPrices(now: Date = new Date()): Promise<{ version: string; tables: Map<string, SystemPriceTable> }> {
  const lists = await prisma.supplierPriceList.findMany({
    where: {
      scope: "GRID", status: "ACTIVE", nature: "SALE", clientele: { in: [...SHOP_CLIENTELES] }, currency: SHOP_CURRENCY, taxBasis: { not: "UNKNOWN" }, familySlug: { not: null },
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
    select: { listId: true, dimAKey: true, dimAmm: true, widthMinMm: true, widthMaxMm: true, amountMinor: true, conditions: true },
  }) : [];
  // suppléments versionnés avec chaque grille (lignes FIXED) ; jamais la référence fournisseur ni la source
  const fixed = picked.length ? await prisma.supplierPriceRow.findMany({ where: { listId: { in: picked.map((l) => l.id) }, kind: "FIXED", status: { not: "REJECTED" } }, select: { listId: true, code: true, label: true, amountMinor: true, conditions: true }, orderBy: { code: "asc" } }) : [];
  for (const l of picked) {
    const supplements = fixed.filter((f) => f.listId === l.id).map((f) => supplementOf(f)).filter((x): x is PriceSupplement => x != null);
    const meta = { currency: l.currency!, taxBasis: l.taxBasis === "UNKNOWN" ? null : l.taxBasis, dimRule: l.dimRule === "ROUND_UP" ? "round_up" as const : "exact" as const, vatRateBps: l.vatRateBps, listVersion: l.version, versionId: l.id, supplements };
    const mine = rows.filter((r) => r.listId === l.id);
    if (!mine.length) continue;
    let t = tables.get(l.familySlug!);
    if (!t) tables.set(l.familySlug!, (t = { ...meta, dimAKey: mine[0]!.dimAKey === "hauteur" ? "hauteur" : "projection", variants: {}, cells: [] }));
    t.variants![l.variantKey] = meta;
    for (const r of mine) {
      const requirement = (r.conditions as { requirement?: string } | null)?.requirement;
      t.cells.push({ variantKey: l.variantKey, dimAmm: r.dimAmm!, widthMinMm: r.widthMinMm ?? r.widthMaxMm!, widthMaxMm: r.widthMaxMm!, amountMinor: r.amountMinor!, ...(requirement ? { requirement } : {}) });
    }
  }
  return { version: picked.map((l) => `${l.id}@${l.version}:${l.updatedAt.getTime()}`).sort().join(",") || "none", tables };
}

/**
 * Ligne FIXED → supplément public : mode (montant, pourcentage, à chiffrer), cibles et règle d'application. Un tarif fixe
 * saisi sans mode (ancien format) n'est jamais appliqué automatiquement (cible « non_configurable »).
 */
export function supplementOf(f: { code: string; label: string; amountMinor: number | null; conditions: unknown }): PriceSupplement | null {
  const c = (f.conditions ?? {}) as { mode?: string; percentBps?: number; applies?: string[]; mandatory?: boolean; rule?: string };
  const mode = c.mode === "percent" || c.mode === "pending" ? c.mode : "fixed";
  if (mode === "fixed" && f.amountMinor == null) return null;
  if (mode === "percent" && (c.percentBps == null || !Number.isInteger(c.percentBps))) return null;
  // public : aucune désignation du fabricant (libellé ou règle) ne quitte l'administration
  const safe = (t: string | undefined) => (t && !PUBLIC_FORBIDDEN_NAMES.test(t) ? t : undefined);
  const rule = safe(c.rule);
  return { code: f.code, label: safe(f.label) ?? "Supplément", mode, amountMinor: mode === "fixed" ? f.amountMinor : null, percentBps: mode === "percent" ? c.percentBps! : null, applies: Array.isArray(c.applies) && c.applies.length ? c.applies : ["non_configurable"], mandatory: !!c.mandatory, ...(rule ? { rule } : {}) };
}
