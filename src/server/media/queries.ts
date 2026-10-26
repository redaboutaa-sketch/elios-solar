import "server-only";
import { prisma } from "@/lib/prisma";
import { rankProductMedia } from "@/server/media/rank";
import type { PublishedMedia } from "@/server/media/types";

export type { PublishedMedia } from "@/server/media/types";

export interface MediaContext {
  finishCode?: string | null;
  mounting?: "wall" | "freestanding" | null;
  variantSku?: string | null;
}

/**
 * Médias PUBLIÉS d'une famille (droits non expirés), classés selon la finition / l'implantation
 * affichées puis l'ordre d'affichage. Les brouillons, médias validés non publiés et refusés
 * ne sortent jamais côté boutique.
 */
export async function publishedMediaFor(familySlug: string, ctx: MediaContext = {}): Promise<PublishedMedia[]> {
  const now = new Date();
  const rows = await prisma.productMedia.findMany({
    where: { family: { slug: familySlug }, media: { status: "PUBLISHED", nature: { not: "DOCUMENT" }, OR: [{ rightsExpiresAt: null }, { rightsExpiresAt: { gt: now } }] } },
    include: { media: true },
    orderBy: { sortOrder: "asc" },
  });
  const ranked = rankProductMedia(rows.map((r) => ({ ...r, mediaSortOrder: r.media.sortOrder })), ctx);
  return ranked.map((r) => ({
    id: r.media.id,
    path: r.media.path,
    externalUrl: r.media.externalUrl,
    alt: r.media.alt,
    title: r.media.title,
    nature: r.media.nature,
    caption: r.caption,
    role: r.role,
    // crédit et provenance restent dans la médiathèque : le site public ne cite ni fabricant ni fournisseur
    credit: "",
    visibleOptions: r.media.visibleOptions,
    width: r.media.width,
    height: r.media.height,
    finishCode: r.finishCode,
    mounting: r.mounting,
    smallPath: (r.media.provenance as { variants?: { small?: { path?: string } } } | null)?.variants?.small?.path ?? null,
    mediumPath: (r.media.provenance as { variants?: { medium?: { path?: string } } } | null)?.variants?.medium?.path ?? null,
    sourceLabel: null,
    match: (r.media.provenance as { match?: string } | null)?.match ?? null,
  }));
}
