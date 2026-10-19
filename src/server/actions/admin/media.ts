"use server";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { logger } from "@/lib/logger";
import { actorOf, back, fields, firstError, zReq } from "@/server/admin/form";
import { MAX_MEDIA_BYTES, MEDIA_TYPES, MEDIA_URL_PREFIX, checkSignature, isMediaMime, mediaDir, resolveMediaFile } from "@/server/media/storage";

const PATH = "/admin/medias";
const meta = z.object({ alt: zReq(300), source: zReq(300), license: zReq(200), credit: zReq(200) });

export async function uploadMediaAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const parsed = meta.safeParse(fields(formData));
  if (!parsed.success) back(PATH, `Registre des droits incomplet — ${firstError(parsed.error)}`, "err");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) back(PATH, "Aucun fichier reçu.", "err");
  if (file.size > MAX_MEDIA_BYTES) back(PATH, "Fichier trop volumineux (8 Mo maximum).", "err");
  const mime = file.type;
  if (!isMediaMime(mime)) back(PATH, "Type de fichier refusé (JPEG, PNG, WebP, SVG ou PDF).", "err");
  const buf = Buffer.from(await file.arrayBuffer());
  const bad = checkSignature(buf, mime);
  if (bad) back(PATH, bad, "err");

  let width: number | null = null, height: number | null = null;
  if (mime !== "application/pdf") {
    try {
      const m = await sharp(buf).metadata();
      width = m.width ?? null;
      height = m.height ?? null;
    } catch {
      back(PATH, "Image illisible.", "err");
    }
  }
  const name = `${randomBytes(16).toString("hex")}.${MEDIA_TYPES[mime]}`;
  const dir = mediaDir();
  await mkdir(dir, { recursive: true });
  const full = resolveMediaFile(name);
  if (!full) back(PATH, "Nom de fichier invalide.", "err");
  await writeFile(full, buf, { flag: "wx" });
  const media = await prisma.media.create({
    data: { kind: mime === "application/pdf" ? "document" : "image", path: `${MEDIA_URL_PREFIX}${name}`, mimeType: mime, sizeBytes: file.size, width, height, ...parsed.data },
  });
  await audit({ ...actorOf(session), action: "media.upload", entity: "Media", entityId: media.id, after: { path: media.path, mimeType: mime, sizeBytes: file.size, source: media.source, license: media.license, credit: media.credit } });
  back(PATH, "Média téléversé.");
}

export async function updateMediaAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const parsed = meta.extend({ id: zReq(64) }).safeParse(fields(formData));
  if (!parsed.success) back(PATH, firstError(parsed.error), "err");
  const { id, ...data } = parsed.data;
  const before = await prisma.media.findUnique({ where: { id }, select: { alt: true, source: true, license: true, credit: true } });
  if (!before) back(PATH, "Média introuvable", "err");
  await prisma.media.update({ where: { id }, data });
  await audit({ ...actorOf(session), action: "media.update", entity: "Media", entityId: id, before, after: data });
  back(PATH, "Informations du média enregistrées.");
}

export async function deleteMediaAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  const media = await prisma.media.findUnique({ where: { id }, include: { _count: { select: { products: true, documents: true, realisations: true } } } });
  if (!media) back(PATH, "Média introuvable", "err");
  const settingsRef = await prisma.siteSettings.count({ where: { OR: [{ logoMediaId: id }, { faviconMediaId: id }] } });
  const refs = media._count.products + media._count.documents + media._count.realisations + settingsRef;
  if (refs > 0) back(PATH, `Suppression impossible : média utilisé ${refs} fois (fiches, documents, réalisations ou réglages).`, "err");
  await prisma.media.delete({ where: { id } });
  if (media.path.startsWith(MEDIA_URL_PREFIX)) {
    const full = resolveMediaFile(path.basename(media.path));
    if (full) await unlink(full).catch((e: unknown) => logger.warn({ mediaId: id, err: String(e) }, "fichier média déjà absent"));
  }
  await audit({ ...actorOf(session), action: "media.delete", entity: "Media", entityId: id, before: { path: media.path, mimeType: media.mimeType, source: media.source, license: media.license, credit: media.credit } });
  back(PATH, "Média supprimé.");
}
