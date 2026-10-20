import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { DataStatus, DocumentAudience, DocumentStatus } from "@/generated/prisma/enums";
import { canTransition } from "@/server/documents/versions";

export class DocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentError";
  }
}

/** Types de documents techniques : publication réservée aux contenus vérifiés fournisseur. */
export const TECHNICAL_KINDS = ["notice", "fiche_technique", "certificat", "garantie"];

export interface DocumentInput {
  title: string;
  kind: string;
  summary?: string;
  audience?: DocumentAudience;
  dataStatus?: DataStatus;
  source?: string;
  notes?: string;
  familyId?: string | null;
  variantSku?: string | null;
  mediaId?: string | null;
}

export function newGroupKey(title: string): string {
  const slug = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${slug || "document"}-${randomBytes(4).toString("hex")}`;
}

/** Crée un nouveau groupe documentaire (version 1, brouillon). */
export async function createDocument(input: DocumentInput, createdBy: string | null) {
  return prisma.document.create({ data: { ...input, groupKey: newGroupKey(input.title), version: 1, status: "DRAFT", createdBy } });
}

/**
 * Crée la version suivante d'un groupe (brouillon) : reprend les métadonnées de la dernière
 * version, sauf celles fournies. Les versions précédentes restent inchangées (une version
 * publiée reste visible jusqu'à la publication de la nouvelle).
 */
export async function createNextVersion(groupKey: string, over: Partial<DocumentInput>, createdBy: string | null) {
  return prisma.$transaction(async (tx) => {
    const last = await tx.document.findFirst({ where: { groupKey }, orderBy: { version: "desc" } });
    if (!last) throw new DocumentError("Groupe documentaire introuvable");
    const pick = <K extends keyof DocumentInput>(k: K) => (over[k] !== undefined ? over[k] : (last as unknown as DocumentInput)[k]);
    return tx.document.create({
      data: {
        groupKey, version: last.version + 1, status: "DRAFT", createdBy,
        title: pick("title")!, kind: pick("kind")!, summary: pick("summary") ?? "", audience: pick("audience"), dataStatus: pick("dataStatus"), source: pick("source") ?? "", notes: pick("notes") ?? "",
        familyId: pick("familyId") ?? null, variantSku: pick("variantSku") ?? null, mediaId: pick("mediaId") ?? null,
      },
    });
  });
}

/**
 * Change le statut d'une version selon le cycle DRAFT → REVIEW → PUBLISHED → ARCHIVED.
 * Publier exige un PDF et, pour un document technique, une donnée vérifiée fournisseur ;
 * les autres versions publiées du même groupe sont archivées.
 */
export async function transitionDocument(id: string, to: DocumentStatus, actor: string | null) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new DocumentError("Document introuvable");
  if (!canTransition(doc.status, to)) throw new DocumentError(`Transition impossible : ${doc.status} → ${to}`);
  if (to === "PUBLISHED") {
    if (!doc.mediaId) throw new DocumentError("Publication impossible : aucun fichier PDF n'est joint à cette version.");
    if (TECHNICAL_KINDS.includes(doc.kind) && doc.dataStatus !== "SUPPLIER_VERIFIED") throw new DocumentError("Publication impossible : un document technique (notice, fiche, certificat, garantie) doit être vérifié fournisseur.");
  }
  return prisma.$transaction(async (tx) => {
    const archived = to === "PUBLISHED" ? await tx.document.findMany({ where: { groupKey: doc.groupKey, status: "PUBLISHED", id: { not: id } }, select: { id: true, version: true } }) : [];
    if (archived.length) await tx.document.updateMany({ where: { id: { in: archived.map((a) => a.id) } }, data: { status: "ARCHIVED" } });
    const now = new Date();
    const data =
      to === "PUBLISHED" ? { status: to, validatedBy: actor, validatedAt: now, publishedAt: now }
      : to === "DRAFT" ? { status: to, validatedBy: null, validatedAt: null }
      : { status: to };
    const updated = await tx.document.update({ where: { id }, data });
    return { before: doc, after: updated, archived };
  });
}
