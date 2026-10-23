/**
 * Statut des guides d'installation (contenu dans src/server/content/install-guides.ts) : DRAFT → VALIDATED (validation
 * technique enregistrée : qui, quand, note) → PUBLISHED. Un guide non publié n'est visible que dans l'administration.
 */
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { INSTALL_GUIDES, installGuide } from "@/server/content/install-guides";

export type GuideStatus = "DRAFT" | "VALIDATED" | "PUBLISHED";
export const GUIDE_STATUS_FR: Record<GuideStatus, string> = { DRAFT: "Brouillon", VALIDATED: "Validé techniquement", PUBLISHED: "Publié" };

export async function guideStatuses(): Promise<Map<string, { status: GuideStatus; validatedBy: string | null; validatedAt: Date | null; note: string }>> {
  const rows = await prisma.installGuideStatus.findMany();
  return new Map(INSTALL_GUIDES.map((g) => {
    const r = rows.find((x) => x.slug === g.slug);
    return [g.slug, { status: (r?.status as GuideStatus) ?? "DRAFT", validatedBy: r?.validatedBy ?? null, validatedAt: r?.validatedAt ?? null, note: r?.note ?? "" }];
  }));
}

export async function isPublished(slug: string): Promise<boolean> {
  return (await prisma.installGuideStatus.findUnique({ where: { slug }, select: { status: true } }))?.status === "PUBLISHED";
}

export class GuideError extends Error {}

/** Validation technique : nom de la personne qui a vérifié le guide contre la notice, et sa note. */
export async function setGuideStatus(slug: string, status: GuideStatus, by: { email: string; validator?: string; note?: string }) {
  const g = installGuide(slug);
  if (!g) throw new GuideError("Guide inconnu.");
  const cur = (await prisma.installGuideStatus.findUnique({ where: { slug } }))?.status ?? "DRAFT";
  if (status === "VALIDATED" && (!by.validator || by.validator.trim().length < 3)) throw new GuideError("Indiquez qui a vérifié le guide par rapport à la notice officielle.");
  if (status === "PUBLISHED" && cur !== "VALIDATED") throw new GuideError("Seul un guide validé techniquement peut être publié.");
  if (status === "PUBLISHED" && g.sections.every((s) => !s.steps?.length)) throw new GuideError("Guide sans étape documentée : publication impossible.");
  const data = status === "VALIDATED" ? { status, validatedBy: `${by.validator!.trim()} (saisi par ${by.email})`, validatedAt: new Date(), note: by.note?.trim() ?? "" } : status === "DRAFT" ? { status, validatedBy: null, validatedAt: null } : { status };
  await prisma.installGuideStatus.upsert({ where: { slug }, create: { slug, ...data }, update: data });
  await audit({ actorEmail: by.email, action: "guide.status", entity: "InstallGuideStatus", entityId: slug, before: { status: cur }, after: { status, validator: by.validator ?? null } });
}

/** Visuels autorisés de la médiathèque, par clé de provenance (publiés uniquement). */
export async function guideMedia(keys: string[]) {
  if (!keys.length) return new Map<string, { path: string; alt: string }>();
  const media = await prisma.media.findMany({ where: { status: "PUBLISHED", OR: keys.map((k) => ({ provenance: { path: ["key"], equals: k } })) }, select: { path: true, alt: true, provenance: true } });
  return new Map(media.map((m) => [String((m.provenance as { key?: string } | null)?.key ?? ""), { path: m.path, alt: m.alt }]));
}
