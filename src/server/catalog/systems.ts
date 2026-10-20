import "server-only";
import { prisma } from "@/lib/prisma";
import type { CategoryKey } from "@/domain/categories";
import type { SystemRules } from "@/domain/system";
import type { SpecSource, TechnicalSpecValue } from "@/domain/technical-spec";

export interface OpenQuestion { field: string; question: string; sources: string[]; blocks: string }

/** Familles publiées d'une famille publique (Pergolas, Screens, Stores bannes), dans l'ordre d'affichage. */
export async function listSystemFamilies(category: CategoryKey) {
  const rows = await prisma.productFamily.findMany({
    where: { category, legacy: false, status: { in: ["PUBLISHED", "QUOTE_ONLY"] } },
    include: { media: { where: { media: { status: "PUBLISHED", nature: { not: "DOCUMENT" } } }, include: { media: true }, orderBy: { sortOrder: "asc" }, take: 1 } },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((f) => ({ ...f, rules: f.systemRules as unknown as SystemRules, hero: f.media[0]?.media ?? null }));
}

/** Fiche d'un système publié de la famille publique demandée (null sinon : brouillon, archive, autre famille). */
export async function getSystemFamily(category: CategoryKey, slug: string) {
  const f = await prisma.productFamily.findUnique({ where: { slug }, include: { technicalSpecs: { orderBy: { createdAt: "asc" } } } });
  if (!f || f.category !== category || f.legacy || !f.systemRules || !["PUBLISHED", "QUOTE_ONLY"].includes(f.status)) return null;
  const specs: TechnicalSpecValue[] = f.technicalSpecs.map((s) => ({ key: s.key, label: s.label, valueNum: s.valueNum, unit: s.unit, valueText: s.valueText, source: s.source.toLowerCase() as SpecSource, sourceRef: s.sourceRef, observedAt: null, variantSku: s.variantSku, note: s.note || null }));
  return {
    ...f,
    rules: f.systemRules as unknown as SystemRules,
    specValues: specs,
    faqItems: (f.faq as Array<{ q: string; a: string }>) ?? [],
    questions: (f.openQuestions as unknown as OpenQuestion[]) ?? [],
  };
}
export type SystemFamily = NonNullable<Awaited<ReturnType<typeof getSystemFamily>>>;
