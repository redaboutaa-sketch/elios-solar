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
import { LEGACY_FAMILY_SLUGS } from "./legacy-slugs";

/** Textes commerciaux : modifiables dans l'administration, jamais écrasés ensuite par le seed. */
const COMMERCIAL_KEYS = ["name", "shortDescription", "description", "seoTitle", "seoDescription", "faq"] as const;

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
    const legacySlugs = Object.entries(LEGACY_FAMILY_SLUGS).filter(([, to]) => to === f.slug).map(([from]) => from);
    const existing = await prisma.productFamily.findUnique({ where: { slug: f.slug }, select: { commercialEditedAt: true, legacySlugs: true } });
    const update: Record<string, unknown> = { ...content, legacySlugs: [...new Set([...(existing?.legacySlugs ?? []), ...legacySlugs])] };
    if (existing?.commercialEditedAt) for (const k of COMMERCIAL_KEYS) delete update[k];
    // modèle retiré : toujours archivé et hors navigation (la fiche reste pour l'historique, sans conversion)
    if (f.retired) { update.status = "ARCHIVED"; }
    const row = await prisma.productFamily.upsert({ where: { slug: f.slug }, update: update as never, create: { slug: f.slug, status: f.status, ...content, legacySlugs } });
    await prisma.technicalSpec.deleteMany({ where: { familyId: row.id, createdBy: HELIOSTORES_SEED_TAG } });
    for (const s of f.specs) {
      await prisma.technicalSpec.create({ data: { familyId: row.id, key: s.key, label: s.label, valueNum: s.valueNum ?? null, unit: s.unit ?? null, valueText: s.valueText ?? null, source: s.source, sourceRef: s.sourceRef, note: s.note ?? "", createdBy: HELIOSTORES_SEED_TAG } });
      specs += 1;
    }
  }
  await seedContentPlaceholders(prisma);
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

/**
 * Emplacements préparés (brouillons, jamais publiables tels quels) : réalisations HELIOSTORES et production à fournir
 * par le client — aucune photo, aucun chantier ni témoignage inventé. Créés une seule fois.
 */
async function seedContentPlaceholders(prisma: PrismaClient) {
  if (await prisma.realisation.count({ where: { placeholder: true } })) return;
  const need = "À fournir : photographies autorisées, produit installé, contexte et localisation publiable.";
  const rows = [
    { kind: "REALISATION", title: "Réalisation pergola — à fournir", familySlug: null, description: need },
    { kind: "REALISATION", title: "Réalisation screen — à fournir", familySlug: null, description: need },
    { kind: "REALISATION", title: "Réalisation store banne — à fournir", familySlug: "casablanca", description: need },
    { kind: "PRODUCTION", title: "Fabrication — à fournir", familySlug: null, description: "À fournir : photographies documentées de fabrication ; indiquer le site (atelier HELIOSTORES ou usine d'un partenaire)." },
    { kind: "PRODUCTION", title: "Matériaux — à fournir", familySlug: null, description: "À fournir : profilés, toiles, quincaillerie, avec leur description vérifiée." },
    { kind: "PRODUCTION", title: "Assemblage et contrôle qualité — à fournir", familySlug: null, description: "À fournir : étapes d'assemblage et de contrôle réellement pratiquées, avec photographies." },
  ];
  await prisma.realisation.createMany({ data: rows.map((r, i) => ({ ...r, placeholder: true, published: false, isDemo: false, sortOrder: (i + 1) * 10 })) });
}
