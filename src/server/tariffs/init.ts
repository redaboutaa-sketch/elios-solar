/**
 * Initialisation des grilles administrées depuis l'import existant du classeur SITUATION DES TARIF (idempotent) :
 * une grille par produit × variante et par colonne (« Prix final HELIOSTORES », « Prix »).
 *
 * - La colonne « Prix final HELIOSTORES » d'un import publié par décision client (2026-10-21 : vente, devise et base
 *   fiscale renseignées) est reprise publiée, pour les produits publiés seulement ; sinon elle reste en brouillon.
 * - La colonne « Prix » reste un brouillon privé, de nature non établie.
 * Sans import du classeur (CI, base neuve), rien n'est créé.
 */
import { prisma } from "@/lib/prisma";
import { PUBLIC_PRICE_SOURCE_KEY } from "@/server/pricing/source";
import { deriveGridsFromImport, type Actor, type DeriveFromImportResult } from "./grids";

const SYSTEM_ACTOR: Actor = { actorUserId: null, actorEmail: "système:initialisation-tarifs" };

export async function initTariffGrids(actor: Actor = SYSTEM_ACTOR): Promise<{ status: "none" | "done" | "created"; result?: DeriveFromImportResult }> {
  const list = await prisma.supplierPriceList.findFirst({ where: { scope: "IMPORT", sourceKey: PUBLIC_PRICE_SOURCE_KEY, status: { not: "REJECTED" } }, orderBy: { version: "desc" } });
  if (!list) return { status: "none" };
  if (await prisma.supplierPriceList.count({ where: { scope: "GRID", originListId: list.id } })) return { status: "done" };
  const decided = list.status === "ACTIVE" && list.nature === "SALE" && !!list.currency && list.taxBasis !== "UNKNOWN";
  const families = new Map((await prisma.productFamily.findMany({ select: { slug: true, status: true } })).map((f) => [f.slug, f.status]));
  const result = await deriveGridsFromImport(list.id, {
    columns: {
      PRIX_FINAL: decided ? { enabled: true, nature: "SALE", currency: list.currency, taxBasis: list.taxBasis } : { enabled: true, nature: "UNKNOWN", currency: null, taxBasis: "UNKNOWN" },
      PRIX_SOURCE: { enabled: true, nature: "UNKNOWN", currency: null, taxBasis: "UNKNOWN" },
    },
    publishAs: (familySlug, role) => decided && role === "PRIX_FINAL" && ["PUBLISHED", "QUOTE_ONLY"].includes(families.get(familySlug) ?? ""),
  }, actor);
  return { status: "created", result };
}
