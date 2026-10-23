"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { actorOf, back, fields, firstError, safeReturn, zOpt, zReq, zText } from "@/server/admin/form";
import { DATA_STATUSES, DOCUMENT_AUDIENCES, DOCUMENT_KINDS, DOCUMENT_STATUSES } from "@/server/documents/versions";
import { DocumentError, createDocument, createNextVersion, transitionDocument } from "@/server/documents/service";
import { storeUploadedFile } from "@/server/media/upload";

const PATH = "/admin/documents";

const docSchema = z.object({
  title: zReq(200),
  kind: z.enum(DOCUMENT_KINDS),
  summary: zText(2000),
  audience: z.enum(DOCUMENT_AUDIENCES),
  dataStatus: z.enum(DATA_STATUSES),
  source: zText(300),
  notes: zText(2000),
  familyId: zOpt(64),
  variantSku: zOpt(80),
  mediaId: zOpt(64),
});

function ret(fd: FormData) {
  return safeReturn(typeof fd.get("returnTo") === "string" ? String(fd.get("returnTo")) : undefined, PATH);
}

/** PDF joint au formulaire → nouveau média (nature DOCUMENT) dans la médiathèque. */
async function attachPdf(fd: FormData, session: { user: { id: string; email: string } }, title: string, source: string, path: string): Promise<string | null> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  const res = await storeUploadedFile(file, { accept: ["application/pdf"] });
  if (!res.ok) back(path, res.error, "err");
  const s = res.stored;
  const media = await prisma.media.create({ data: { kind: "document", nature: "DOCUMENT", status: "VALIDATED", path: s.path, mimeType: s.mimeType, sizeBytes: s.sizeBytes, alt: title, title, source: source || "Téléversé via l'espace Documents", license: "à préciser", credit: "HELIOSTORES", validatedBy: session.user.email, validatedAt: new Date() } });
  await audit({ ...actorOf(session), action: "media.upload", entity: "Media", entityId: media.id, after: { path: media.path, mimeType: s.mimeType, sizeBytes: s.sizeBytes, via: "documents" } });
  return media.id;
}

async function checkRefs(path: string, d: { familyId: string | null; variantSku: string | null; mediaId: string | null }) {
  if (d.familyId && !(await prisma.productFamily.findUnique({ where: { id: d.familyId }, select: { id: true } }))) back(path, "Famille introuvable", "err");
  if (d.variantSku && !(await prisma.variant.findFirst({ where: { sku: d.variantSku, ...(d.familyId ? { familyId: d.familyId } : {}) }, select: { id: true } }))) back(path, "Référence (SKU) inconnue pour cette famille", "err");
  if (d.mediaId && !(await prisma.media.findFirst({ where: { id: d.mediaId, kind: "document" }, select: { id: true } }))) back(path, "PDF introuvable dans la médiathèque", "err");
}

export async function createDocumentAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const path = ret(formData);
  const parsed = docSchema.safeParse(fields(formData));
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  const d = parsed.data;
  await checkRefs(path, d);
  const uploaded = await attachPdf(formData, session, d.title, d.source, path);
  const doc = await createDocument({ ...d, mediaId: uploaded ?? d.mediaId }, session.user.email);
  await audit({ ...actorOf(session), action: "document.create", entity: "Document", entityId: doc.id, after: doc });
  back(`${PATH}?groupe=${encodeURIComponent(doc.groupKey)}`, "Document créé (version 1, brouillon).");
}

export async function newVersionAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const path = ret(formData);
  const f = fields(formData);
  const parsed = docSchema.partial().extend({ groupKey: zReq(120) }).safeParse(Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "")));
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  // champs laissés vides : repris de la dernière version
  const { groupKey, ...over } = parsed.data;
  const uploaded = await attachPdf(formData, session, over.title ?? "Document", over.source ?? "", path);
  if (uploaded) over.mediaId = uploaded;
  if (over.mediaId) await checkRefs(path, { familyId: null, variantSku: null, mediaId: over.mediaId });
  try {
    const doc = await createNextVersion(groupKey, over, session.user.email);
    await audit({ ...actorOf(session), action: "document.version.create", entity: "Document", entityId: doc.id, after: doc });
    back(`${PATH}?groupe=${encodeURIComponent(groupKey)}`, `Version ${doc.version} créée (brouillon).`);
  } catch (e) {
    if (e instanceof DocumentError) back(path, e.message, "err");
    throw e;
  }
}

export async function updateDocumentAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const path = ret(formData);
  const parsed = docSchema.extend({ id: zReq(64) }).safeParse(fields(formData));
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  const { id, ...d } = parsed.data;
  const before = await prisma.document.findUnique({ where: { id } });
  if (!before) back(path, "Document introuvable", "err");
  if (before.status === "PUBLISHED" || before.status === "ARCHIVED") back(path, "Une version publiée ou archivée n'est pas modifiable : créez une nouvelle version.", "err");
  await checkRefs(path, d);
  const uploaded = await attachPdf(formData, session, d.title, d.source, path);
  const after = await prisma.document.update({ where: { id }, data: { ...d, mediaId: uploaded ?? d.mediaId } });
  await audit({ ...actorOf(session), action: "document.update", entity: "Document", entityId: id, before, after });
  back(path, "Version enregistrée.");
}

export async function setDocumentStatusAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const path = ret(formData);
  const parsed = z.object({ id: zReq(64), status: z.enum(DOCUMENT_STATUSES) }).safeParse(fields(formData));
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  try {
    const { before, after, archived } = await transitionDocument(parsed.data.id, parsed.data.status, session.user.email);
    await audit({ ...actorOf(session), action: `document.status.${after.status.toLowerCase()}`, entity: "Document", entityId: after.id, before: { status: before.status }, after: { status: after.status, version: after.version, validatedBy: after.validatedBy, archivedVersions: archived.map((a) => a.version) } });
    const msg: Record<string, string> = { REVIEW: "Version soumise à relecture.", PUBLISHED: `Version ${after.version} publiée${archived.length ? ` (version${archived.length > 1 ? "s" : ""} ${archived.map((a) => a.version).join(", ")} archivée${archived.length > 1 ? "s" : ""})` : ""}.`, ARCHIVED: "Version archivée.", DRAFT: "Version remise en brouillon." };
    back(path, msg[after.status] ?? "Statut mis à jour.");
  } catch (e) {
    if (e instanceof DocumentError) back(path, e.message, "err");
    throw e;
  }
}

export async function deleteDocumentAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const path = ret(formData);
  const id = String(formData.get("id") ?? "");
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) back(path, "Document introuvable", "err");
  if (doc.status !== "DRAFT") back(path, "Seul un brouillon peut être supprimé (archivez une version publiée).", "err");
  await prisma.document.delete({ where: { id } });
  await audit({ ...actorOf(session), action: "document.delete", entity: "Document", entityId: id, before: doc });
  back(PATH, "Brouillon supprimé.");
}
