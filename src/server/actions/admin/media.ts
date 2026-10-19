"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { logger } from "@/lib/logger";
import { MEDIA_NATURES, MEDIA_STATUSES } from "@/server/media/types";
import { actorOf, back, fields, firstError, safeReturn, zInt, zOpt, zOptDate, zReq, zText } from "@/server/admin/form";
import { removeMediaByUrl } from "@/server/media/storage";
import { storeUploadedFile } from "@/server/media/upload";

const PATH = "/admin/medias";
const ASSOC = "/admin/medias/associations";

/** URL vidéo externe : https uniquement, sans identifiants. */
const zHttpsUrl = zOpt(500).refine((v) => {
  if (v == null) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}, "URL https valide attendue");

const meta = z.object({
  alt: zReq(300),
  title: zText(200),
  nature: z.enum(MEDIA_NATURES),
  source: zReq(300),
  license: zReq(200),
  credit: zReq(200),
  rightsNote: zText(1000),
  rightsExpiresAt: zOptDate,
  takenAt: zOptDate,
  visibleOptions: zText(500),
  sortOrder: z.preprocess((v) => (v === "" || v == null ? "0" : v), zInt(-1000, 100_000)),
  externalUrl: zHttpsUrl,
});

function returnPath(fd: FormData, fallback = PATH) {
  return safeReturn(typeof fd.get("returnTo") === "string" ? String(fd.get("returnTo")) : undefined, fallback);
}

export async function uploadMediaAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const ret = returnPath(formData);
  const parsed = meta.safeParse(fields(formData));
  if (!parsed.success) back(ret, `Registre des droits incomplet — ${firstError(parsed.error)}`, "err");
  const data = parsed.data;
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  if (!hasFile) {
    // vidéo hébergée ailleurs : aucune copie locale, seulement l'URL https
    if (!data.externalUrl) back(ret, "Aucun fichier reçu (ou URL de vidéo https).", "err");
    const media = await prisma.media.create({ data: { ...data, nature: "VIDEO", kind: "video", path: data.externalUrl, status: "DRAFT" } });
    await audit({ ...actorOf(session), action: "media.create.video", entity: "Media", entityId: media.id, after: { externalUrl: media.externalUrl, source: media.source, license: media.license, credit: media.credit } });
    back(ret, "Vidéo externe enregistrée (brouillon).");
  }
  const res = await storeUploadedFile(file);
  if (!res.ok) back(ret, res.error, "err");
  const s = res.stored;
  const nature = s.kind === "document" ? "DOCUMENT" : data.nature === "DOCUMENT" || data.nature === "VIDEO" ? "ILLUSTRATION" : data.nature;
  const media = await prisma.media.create({ data: { ...data, nature, externalUrl: null, kind: s.kind, path: s.path, mimeType: s.mimeType, sizeBytes: s.sizeBytes, width: s.width, height: s.height, status: "DRAFT" } });
  await audit({ ...actorOf(session), action: "media.upload", entity: "Media", entityId: media.id, after: { path: media.path, nature, mimeType: s.mimeType, sizeBytes: s.sizeBytes, source: media.source, license: media.license, credit: media.credit } });
  back(ret, "Média téléversé (brouillon) : validez-le puis publiez-le pour l'afficher en boutique.");
}

export async function updateMediaAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const ret = returnPath(formData);
  const parsed = meta.extend({ id: zReq(64) }).safeParse(fields(formData));
  if (!parsed.success) back(ret, firstError(parsed.error), "err");
  const { id, ...data } = parsed.data;
  const before = await prisma.media.findUnique({ where: { id } });
  if (!before) back(ret, "Média introuvable", "err");
  // un fichier PDF reste un document ; une image ne devient pas une vidéo
  if (before.kind === "document") data.nature = "DOCUMENT";
  else if (before.kind === "image" && (data.nature === "VIDEO" || data.nature === "DOCUMENT")) back(ret, "Nature incompatible avec une image.", "err");
  else if (before.kind === "video") data.nature = "VIDEO";
  if (before.kind !== "video") data.externalUrl = null;
  // modifier un média publié le repasse en validation si la nature ou les droits changent
  const rightsChanged = before.nature !== data.nature || before.source !== data.source || before.license !== data.license || before.credit !== data.credit;
  const status = before.status === "PUBLISHED" && rightsChanged ? "VALIDATED" : before.status;
  await prisma.media.update({ where: { id }, data: { ...data, status, ...(before.kind === "video" && data.externalUrl ? { path: data.externalUrl } : {}) } });
  await audit({ ...actorOf(session), action: "media.update", entity: "Media", entityId: id, before: { alt: before.alt, title: before.title, nature: before.nature, source: before.source, license: before.license, credit: before.credit, rightsNote: before.rightsNote, rightsExpiresAt: before.rightsExpiresAt, takenAt: before.takenAt, visibleOptions: before.visibleOptions, sortOrder: before.sortOrder, status: before.status }, after: { ...data, status } });
  back(ret, status !== before.status ? "Enregistré. Nature ou droits modifiés : le média est repassé à « validé », republiez-le." : "Informations du média enregistrées.");
}

/** Transitions de validation : DRAFT → VALIDATED → PUBLISHED ; dépublication ; refus ; remise en brouillon. */
const MEDIA_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ["VALIDATED", "REJECTED"],
  VALIDATED: ["PUBLISHED", "DRAFT", "REJECTED"],
  PUBLISHED: ["VALIDATED", "REJECTED"],
  REJECTED: ["DRAFT"],
};

export async function setMediaStatusAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const ret = returnPath(formData);
  const parsed = z.object({ id: zReq(64), status: z.enum(MEDIA_STATUSES) }).safeParse(fields(formData));
  if (!parsed.success) back(ret, firstError(parsed.error), "err");
  const { id, status } = parsed.data;
  const m = await prisma.media.findUnique({ where: { id } });
  if (!m) back(ret, "Média introuvable", "err");
  if (!(MEDIA_TRANSITIONS[m.status] ?? []).includes(status)) back(ret, `Transition impossible : ${m.status} → ${status}.`, "err");
  if (status === "VALIDATED" || status === "PUBLISHED") {
    const missing = [!m.alt && "texte alternatif", !m.source && "source", !m.license && "licence", !m.credit && "crédit"].filter(Boolean);
    if (missing.length) back(ret, `Validation impossible, registre des droits incomplet : ${missing.join(", ")}.`, "err");
    if (m.rightsExpiresAt && m.rightsExpiresAt <= new Date()) back(ret, "Validation impossible : droits d'utilisation expirés.", "err");
    if (m.nature === "DOCUMENT") back(ret, "Les PDF se publient depuis l'espace Documents.", "err");
  }
  const validation = status === "VALIDATED" && m.status === "DRAFT" ? { validatedBy: session.user.email, validatedAt: new Date() } : status === "DRAFT" || status === "REJECTED" ? { validatedBy: null, validatedAt: null } : {};
  await prisma.media.update({ where: { id }, data: { status, ...validation } });
  await audit({ ...actorOf(session), action: `media.status.${status.toLowerCase()}`, entity: "Media", entityId: id, before: { status: m.status }, after: { status, ...validation } });
  const msg: Record<string, string> = { VALIDATED: "Média validé.", PUBLISHED: "Média publié : visible en boutique sur les fiches associées.", REJECTED: "Média refusé.", DRAFT: "Média remis en brouillon." };
  back(ret, msg[status] ?? "Statut mis à jour.");
}

export async function deleteMediaAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const ret = returnPath(formData);
  const id = String(formData.get("id") ?? "");
  const media = await prisma.media.findUnique({ where: { id }, include: { _count: { select: { products: true, documents: true, realisations: true } } } });
  if (!media) back(ret, "Média introuvable", "err");
  const settingsRef = await prisma.siteSettings.count({ where: { OR: [{ logoMediaId: id }, { faviconMediaId: id }] } });
  const refs = media._count.products + media._count.documents + media._count.realisations + settingsRef;
  if (refs > 0) back(ret, `Suppression impossible : média utilisé ${refs} fois (fiches, documents, réalisations ou réglages).`, "err");
  await prisma.media.delete({ where: { id } });
  await removeMediaByUrl(media.path).catch((e: unknown) => logger.warn({ mediaId: id, err: String(e) }, "fichier média déjà absent"));
  await audit({ ...actorOf(session), action: "media.delete", entity: "Media", entityId: id, before: { path: media.path, mimeType: media.mimeType, source: media.source, license: media.license, credit: media.credit } });
  back(ret, "Média supprimé.");
}

/* --------------------------- Associations produit --------------------------- */

const ROLES = ["hero", "gallery", "detail", "night", "plan", "thumbnail"] as const;
const linkSchema = z.object({
  role: z.enum(ROLES),
  caption: zText(300),
  sortOrder: z.preprocess((v) => (v === "" || v == null ? "0" : v), zInt(0, 10_000)),
  variantSku: zOpt(80),
  finishCode: zOpt(60),
  mounting: zOpt(20).refine((v) => v == null || v === "wall" || v === "freestanding", "Implantation invalide"),
  tags: zText(300).transform((v) => [...new Set(v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20)),
});

export async function linkMediaAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const ret = returnPath(formData, ASSOC);
  const parsed = linkSchema.extend({ familyId: zReq(64), mediaId: zReq(64) }).safeParse(fields(formData));
  if (!parsed.success) back(ret, firstError(parsed.error), "err");
  const d = parsed.data;
  const [family, media] = await Promise.all([
    prisma.productFamily.findUnique({ where: { id: d.familyId }, select: { id: true, finishes: { select: { finishCode: true } }, variants: { select: { sku: true } } } }),
    prisma.media.findUnique({ where: { id: d.mediaId }, select: { id: true, status: true, nature: true } }),
  ]);
  if (!family || !media) back(ret, "Famille ou média introuvable", "err");
  if (media.status !== "PUBLISHED") back(ret, "Seul un média publié peut être associé à une fiche.", "err");
  if (media.nature === "DOCUMENT") back(ret, "Un PDF s'associe depuis l'espace Documents.", "err");
  if (d.finishCode && !family.finishes.some((x) => x.finishCode === d.finishCode)) back(ret, "Finition non proposée pour cette famille.", "err");
  if (d.variantSku && !family.variants.some((v) => v.sku === d.variantSku)) back(ret, "Référence (SKU) inconnue pour cette famille.", "err");
  const pm = await prisma.productMedia.create({ data: d });
  await audit({ ...actorOf(session), action: "media.link", entity: "ProductMedia", entityId: pm.id, after: pm });
  back(ret, "Média associé à la fiche.");
}

export async function updateLinkAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const ret = returnPath(formData, ASSOC);
  const parsed = linkSchema.extend({ id: zReq(64) }).safeParse(fields(formData));
  if (!parsed.success) back(ret, firstError(parsed.error), "err");
  const { id, ...data } = parsed.data;
  const before = await prisma.productMedia.findUnique({ where: { id } });
  if (!before) back(ret, "Association introuvable", "err");
  const after = await prisma.productMedia.update({ where: { id }, data });
  await audit({ ...actorOf(session), action: "media.link.update", entity: "ProductMedia", entityId: id, before, after });
  back(ret, "Association mise à jour.");
}

export async function unlinkMediaAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const ret = returnPath(formData, ASSOC);
  const id = String(formData.get("id") ?? "");
  const pm = await prisma.productMedia.findUnique({ where: { id } });
  if (!pm) back(ret, "Association introuvable", "err");
  await prisma.productMedia.delete({ where: { id } });
  await audit({ ...actorOf(session), action: "media.unlink", entity: "ProductMedia", entityId: id, before: pm });
  back(ret, "Média retiré de la fiche.");
}
