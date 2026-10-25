import "server-only";
import { prisma } from "@/lib/prisma";
import type { CategoryKey } from "@/domain/categories";
import type { SystemRules } from "@/domain/system";
import type { SpecSource, TechnicalSpecValue } from "@/domain/technical-spec";
import { publicSpecs, publicSystemRules } from "@/domain/public-sanitize";
import { minSystemPrice } from "@/domain/system-pricing";
import { loadPublicSystemPrices } from "@/server/pricing/system-prices";
import { configuratorHref, productHref } from "@/domain/categories";
import { HELIOSTORES_FAMILIES } from "./heliostores-data";
import { canonicalFamilySlug } from "./legacy-slugs";

/** Modèles en préparation d'une famille (brouillons) : nom et description seulement, sans règle ni configurateur. */
export async function listDraftFamilies(category: CategoryKey) {
  const rows = await prisma.productFamily.findMany({ where: { category, legacy: false, status: "DRAFT" }, select: { slug: true, name: true, shortDescription: true }, orderBy: { sortOrder: "asc" } });
  return rows;
}

/**
 * Modèle retiré (nomenclature du 2026-10-25) : la fiche n'est plus publique, mais son ancienne URL mène à une page
 * explicative proposant les gammes actuelles — la configuration enregistrée n'est jamais convertie.
 */
export async function getRetiredFamily(slug: string) {
  const canonical = canonicalFamilySlug(slug);
  const seed = HELIOSTORES_FAMILIES.find((f) => f.slug === canonical && f.retired);
  if (!seed?.retired) return null;
  const rows = await prisma.productFamily.findMany({ where: { slug: { in: seed.retired.suggest }, status: { in: ["PUBLISHED", "QUOTE_ONLY"] }, category: { not: null } }, select: { slug: true, name: true, shortDescription: true, category: true, sortOrder: true }, orderBy: { sortOrder: "asc" } });
  return {
    slug: canonical,
    category: seed.category,
    since: seed.retired.since,
    suggestions: rows.map((r) => ({ slug: r.slug, name: r.name, shortDescription: r.shortDescription, href: productHref(r.category!, r.slug), configHref: configuratorHref(r.slug) })),
  };
}
export type RetiredFamily = NonNullable<Awaited<ReturnType<typeof getRetiredFamily>>>;

/** Familles publiées d'une famille publique, dans l'ordre d'affichage. */
export async function listSystemFamilies(category: CategoryKey) {
  const rows = await prisma.productFamily.findMany({
    where: { category, legacy: false, status: { in: ["PUBLISHED", "QUOTE_ONLY"] } },
    include: { media: { where: { media: { status: "PUBLISHED", nature: { not: "DOCUMENT" } } }, include: { media: true }, orderBy: { sortOrder: "asc" }, take: 1 } },
    orderBy: { sortOrder: "asc" },
  });
  const { tables } = await loadPublicSystemPrices();
  // page publique : ni fabricant, ni marque, ni référence fournisseur, ni règles brutes (sources), ni questions internes
  return rows.map((f) => ({ ...f, brand: null, manufacturer: null, supplierRef: null, systemRules: null, openQuestions: [], rules: publicSystemRules(f.systemRules as unknown as SystemRules), hero: f.media[0]?.media ?? null, fromPrice: minSystemPrice(tables.get(f.slug)) }));
}

/** Fiche d'un système publié de la famille publique demandée (null sinon : brouillon, archive, autre famille). */
export async function getSystemFamily(category: CategoryKey, slug: string) {
  const f = await prisma.productFamily.findUnique({ where: { slug }, include: { technicalSpecs: { orderBy: { createdAt: "asc" } } } });
  if (!f || f.category !== category || f.legacy || !f.systemRules || !["PUBLISHED", "QUOTE_ONLY"].includes(f.status)) return null;
  // page publique : ni fabricant, ni marque, ni référence fournisseur ou de source (conservés pour l'administration)
  const specs: TechnicalSpecValue[] = publicSpecs(f.technicalSpecs.map((s) => ({ key: s.key, label: s.label, valueNum: s.valueNum, unit: s.unit, valueText: s.valueText, source: s.source.toLowerCase() as SpecSource, sourceRef: "", observedAt: null, variantSku: s.variantSku, note: s.note || null })));
  const { tables } = await loadPublicSystemPrices();
  return {
    ...f,
    // remplacées par `specValues` (sans clé interne ni référence de source)
    technicalSpecs: [],
    brand: null,
    manufacturer: null,
    supplierRef: null,
    systemRules: null,
    openQuestions: [],
    rules: publicSystemRules(f.systemRules as unknown as SystemRules),
    fromPrice: minSystemPrice(tables.get(f.slug)),
    specValues: specs,
    faqItems: (f.faq as Array<{ q: string; a: string }>) ?? [],
  };
}
export type SystemFamily = NonNullable<Awaited<ReturnType<typeof getSystemFamily>>>;
