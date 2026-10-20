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
import { HELIOSTORES_DOCUMENTS } from "./heliostores-documents";

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
  const documents = await seedHeliostoresDocuments(prisma);
  return { families: HELIOSTORES_FAMILIES.length, specs, documents };
}

/** Documents officiels du fabricant (liens externes) : créés une fois par produit, jamais republiés par-dessus une décision d'administration. */
async function seedHeliostoresDocuments(prisma: PrismaClient): Promise<number> {
  let created = 0;
  for (const d of HELIOSTORES_DOCUMENTS) {
    for (const slug of d.familySlugs) {
      const fam = await prisma.productFamily.findUnique({ where: { slug }, select: { id: true } });
      if (!fam) continue;
      const groupKey = `helio-${d.key}-${slug}`;
      if (await prisma.document.count({ where: { groupKey } })) continue;
      const media = await prisma.media.create({ data: { kind: "document", nature: "DOCUMENT", status: "PUBLISHED", path: "", externalUrl: d.url, mimeType: "application/pdf", alt: d.title, title: d.title, source: d.url, credit: "ALUPROF SA (aluprof.com)", license: "Lien vers le document public du fabricant (non ré-hébergé)", provenance: { key: groupKey, url: d.url, retrievedAt: "2026-10-20", language: d.language } as never } });
      await prisma.document.create({ data: { groupKey, version: 1, familyId: fam.id, mediaId: media.id, title: d.title, kind: d.kind, summary: d.summary, status: "PUBLISHED", audience: "PUBLIC", dataStatus: "OBSERVED", source: d.url, notes: "Lien vers le document du fabricant ; ne pas modifier ni présenter comme un document HELIOSTORES.", publishedAt: new Date("2026-10-20T00:00:00Z"), createdBy: HELIOSTORES_SEED_TAG } });
      created += 1;
    }
  }
  return created;
}

/**
 * Ancien catalogue (démonstration inspirée d'une référence tierce) : conservé pour l'historique, jamais
 * transposé au catalogue HELIOSTORES. `active` le réactive comme jeu d'essai des tests d'intégration
 * (panier, commande, paiement simulé) — jamais en préproduction.
 */
export async function setLegacyCatalogue(prisma: PrismaClient, legacySlugs: string[], mode: "archived" | "active") {
  const slugs = legacySlugs.filter((s) => !HELIOSTORES_SLUGS.includes(s));
  await prisma.productFamily.updateMany({ where: { slug: { in: slugs } }, data: { legacy: true, category: null, ...(mode === "archived" ? { status: "ARCHIVED" } : {}) } });
  if (mode === "archived") await prisma.priceGrid.updateMany({ where: { isDemo: true, status: "PUBLISHED" }, data: { status: "ARCHIVED" } });
  return slugs.length;
}
