import "server-only";
import { prisma } from "@/lib/prisma";
import type { DocumentAudience } from "@/generated/prisma/enums";
import { latestPerGroup } from "@/server/documents/versions";

export interface PublicDocument {
  id: string;
  groupKey: string;
  version: number;
  title: string;
  kind: string;
  summary: string;
  audience: DocumentAudience;
  dataStatus: string;
  publishedAt: Date | null;
  href: string | null;
  familyName: string | null;
  familySlug: string | null;
  variantSku: string | null;
}

function flatten(d: { id: string; groupKey: string; version: number; title: string; kind: string; summary: string; audience: DocumentAudience; dataStatus: string; publishedAt: Date | null; variantSku: string | null; media: { path: string; externalUrl?: string | null } | null; family: { name: string; slug: string } | null }): PublicDocument {
  return { id: d.id, groupKey: d.groupKey, version: d.version, title: d.title, kind: d.kind, summary: d.summary, audience: d.audience, dataStatus: d.dataStatus, publishedAt: d.publishedAt, href: d.media?.externalUrl || d.media?.path || null, familyName: d.family?.name ?? null, familySlug: d.family?.slug ?? null, variantSku: d.variantSku };
}

/**
 * Documents visibles sur une fiche produit : PUBLIÉS, audience PUBLIC, dernière version de
 * chaque groupe. Un brouillon ou une version en relecture n'apparaît jamais, une version
 * archivée non plus.
 */
export async function publicDocumentsForFamily(familyId: string): Promise<PublicDocument[]> {
  const rows = await prisma.document.findMany({
    where: { familyId, status: "PUBLISHED", audience: "PUBLIC" },
    include: { media: { select: { path: true, externalUrl: true } }, family: { select: { name: true, slug: true } } },
    orderBy: [{ kind: "asc" }, { title: "asc" }, { version: "desc" }],
  });
  return latestPerGroup(rows).map(flatten);
}

/** Familles (identifiants) présentes dans les commandes d'un client : par SKU de ligne, puis par instantané de configuration. */
export async function familyIdsOrderedBy(userId: string): Promise<string[]> {
  const lines = await prisma.orderLine.findMany({ where: { order: { userId } }, select: { sku: true, configurationSnapshot: true } });
  const skus = [...new Set(lines.map((l) => l.sku).filter((s): s is string => !!s))];
  const slugs = new Set<string>();
  for (const l of lines) {
    const snap = l.configurationSnapshot as { input?: { familySlug?: string; segments?: Record<string, { closureFamilySlug?: string }>; options?: Array<{ familySlug?: string }> } } | null;
    const input = snap?.input;
    if (input?.familySlug) slugs.add(input.familySlug);
    for (const seg of Object.values(input?.segments ?? {})) if (seg?.closureFamilySlug) slugs.add(seg.closureFamilySlug);
    for (const o of input?.options ?? []) if (o?.familySlug) slugs.add(o.familySlug);
  }
  const [bySku, bySlug] = await Promise.all([
    skus.length ? prisma.variant.findMany({ where: { sku: { in: skus } }, select: { familyId: true } }) : Promise.resolve([]),
    slugs.size ? prisma.productFamily.findMany({ where: { slug: { in: [...slugs] } }, select: { id: true } }) : Promise.resolve([]),
  ]);
  return [...new Set([...bySku.map((v) => v.familyId), ...bySlug.map((f) => f.id)])];
}

/**
 * Espace documentaire du compte client : documents PUBLIÉS d'audience PUBLIC ou CUSTOMER,
 * rattachés aux familles commandées (ou à aucune famille : documents généraux), dernière version par groupe.
 */
export async function customerDocuments(userId: string): Promise<PublicDocument[]> {
  const familyIds = await familyIdsOrderedBy(userId);
  const rows = await prisma.document.findMany({
    where: { status: "PUBLISHED", audience: { in: ["PUBLIC", "CUSTOMER"] }, OR: [{ familyId: null }, { familyId: { in: familyIds } }] },
    include: { media: { select: { path: true, externalUrl: true } }, family: { select: { name: true, slug: true } } },
    orderBy: [{ familyId: "asc" }, { kind: "asc" }, { title: "asc" }, { version: "desc" }],
  });
  return latestPerGroup(rows).map(flatten);
}
