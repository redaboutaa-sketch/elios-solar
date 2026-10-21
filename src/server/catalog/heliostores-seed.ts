/**
 * Mise en place idempotente du catalogue HELIOSTORES et archivage de l'ancien catalogue de démonstration.
 *
 * - Les familles HELIOSTORES sont créées puis mises à jour (règles, contenus, sources) ; leur statut n'est
 *   jamais réécrit après création (une publication décidée en administration est conservée).
 * - Les données techniques semées (sources fiche / document / site fabricant) sont réécrites ; une valeur
 *   confirmée en administration (SUPPLIER_CONFIRMED) ou saisie manuellement n'est jamais touchée.
 * - L'ancien catalogue de démonstration n'est pas supprimé : il est marqué `legacy`, retiré de la navigation et
 *   archivé, pour que les devis, projets et commandes historiques gardent leurs références.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { HELIOSTORES_FAMILIES, HELIOSTORES_SLUGS } from "./heliostores-data";

export const HELIOSTORES_SEED_TAG = "seed:heliostores";

export async function seedHeliostores(prisma: PrismaClient): Promise<{ families: number; specs: number; documents: number }> {
  let specs = 0;
  for (const f of HELIOSTORES_FAMILIES) {
    const content = {
      name: f.name,
      kind: f.kind,
      category: f.category,
      brand: f.brand,
      manufacturer: f.manufacturer,
      supplierRef: f.supplierRef,
      shortDescription: f.shortDescription,
      description: f.description,
      seoTitle: f.seoTitle,
      seoDescription: f.seoDescription,
      systemRules: f.rules as never,
      openQuestions: f.openQuestions as never,
      faq: f.faq as never,
      included: f.rules.included.map((i) => i.label) as never,
      specs: [] as never,
      mountings: [...new Set(f.rules.mountings.map((m) => m.code).filter((m): m is "wall" | "freestanding" => m === "wall" || m === "freestanding"))].map((m) => (m === "wall" ? "WALL" : "FREESTANDING")) as never,
      dataStatus: "UNKNOWN" as const,
      legacy: false,
      sortOrder: f.sortOrder,
    };
    const row = await prisma.productFamily.upsert({ where: { slug: f.slug }, update: content, create: { slug: f.slug, status: f.status, ...content } });
    await prisma.technicalSpec.deleteMany({ where: { familyId: row.id, createdBy: HELIOSTORES_SEED_TAG } });
    for (const s of f.specs) {
      await prisma.technicalSpec.create({ data: { familyId: row.id, key: s.key, label: s.label, valueNum: s.valueNum ?? null, unit: s.unit ?? null, valueText: s.valueText ?? null, source: s.source, sourceRef: s.sourceRef, note: s.note ?? "", createdBy: HELIOSTORES_SEED_TAG } });
      specs += 1;
    }
  }
  const documents = await withdrawManufacturerDocuments(prisma);
  return { families: HELIOSTORES_FAMILIES.length, specs, documents };
}

/**
 * Documents du fabricant (liens externes) : retirés du site public (décision client du 2026-10-21 : aucune
 * référence au fabricant ni au fournisseur). Les versions semées sont archivées, jamais supprimées ; le registre
 * `heliostores-documents.ts` reste une référence interne.
 */
async function withdrawManufacturerDocuments(prisma: PrismaClient): Promise<number> {
  const r = await prisma.document.updateMany({ where: { createdBy: HELIOSTORES_SEED_TAG, status: { not: "ARCHIVED" } }, data: { status: "ARCHIVED" } });
  return r.count;
}

/**
 * Ancien catalogue (démonstration inspirée d'une référence tierce) : conservé pour l'historique, jamais
 * transposé au catalogue HELIOSTORES. `active` le réactive comme jeu d'essai des tests d'intégration
 * (panier, commande, paiement simulé) — jamais en préproduction.
 */
export async function setLegacyCatalogue(prisma: PrismaClient, legacySlugs: string[], mode: "archived" | "active") {
  const slugs = legacySlugs.filter((s) => !HELIOSTORES_SLUGS.includes(s));
  await prisma.productFamily.updateMany({ where: { slug: { in: slugs } }, data: { legacy: true, category: null, ...(mode === "archived" ? { status: "ARCHIVED" } : {}) } });
  // la grille sur mesure fictive suit l'ancien catalogue : archivée en préproduction, republiée comme jeu d'essai
  if (mode === "archived") await prisma.priceGrid.updateMany({ where: { isDemo: true, status: "PUBLISHED" }, data: { status: "ARCHIVED" } });
  else await prisma.priceGrid.updateMany({ where: { isDemo: true, status: "ARCHIVED", source: { startsWith: "Grille fictive" } }, data: { status: "PUBLISHED" } });
  return slugs.length;
}
