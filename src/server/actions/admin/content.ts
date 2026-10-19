"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { actorOf, back, fields, firstError, zBool, zInt, zOpt, zReq, zText } from "@/server/admin/form";

const ROLES = ["ADMIN", "MANAGER"] as const;

const pageSchema = z.object({
  slug: zReq(80),
  title: zReq(160),
  body: zText(100_000),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  missingFields: zText(2000).transform((v) => v.split(/[,;\s]+/).map((s) => s.trim()).filter((s) => /^\w{1,40}$/.test(s))),
});

export async function updateContentPageAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const f = fields(formData);
  const path = `/admin/contenus/pages/${encodeURIComponent(f.slug ?? "")}`;
  const parsed = pageSchema.safeParse(f);
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  const { slug, ...data } = parsed.data;
  const before = await prisma.contentPage.findUnique({ where: { slug } });
  if (!before) back("/admin/contenus/pages", "Page introuvable", "err");
  await prisma.contentPage.update({ where: { slug }, data });
  await audit({ ...actorOf(session), action: before.status !== data.status ? `content.${data.status === "PUBLISHED" ? "publish" : "unpublish"}` : "content.update", entity: "ContentPage", entityId: before.id, before: { title: before.title, status: before.status, bodyLength: before.body.length, missingFields: before.missingFields }, after: { title: data.title, status: data.status, bodyLength: data.body.length, missingFields: data.missingFields } });
  back(path, data.status === "PUBLISHED" ? "Page enregistrée et publiée." : "Page enregistrée (brouillon).");
}

/* ------------------------------ Réalisations ------------------------------ */

const realSchema = z.object({
  id: zOpt(64),
  title: zReq(160),
  description: zText(5000),
  location: zOpt(160),
  familySlug: zOpt(80),
  mediaId: zOpt(64),
  published: zBool,
  isDemo: zBool,
  sortOrder: zInt(0, 10_000),
});

export async function saveRealisationAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const path = "/admin/contenus/realisations";
  const parsed = realSchema.safeParse(fields(formData));
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  const { id, ...data } = parsed.data;
  if (data.mediaId && !(await prisma.media.findUnique({ where: { id: data.mediaId }, select: { id: true } }))) back(path, "Média introuvable", "err");
  if (id) {
    const before = await prisma.realisation.findUnique({ where: { id } });
    if (!before) back(path, "Réalisation introuvable", "err");
    await prisma.realisation.update({ where: { id }, data });
    await audit({ ...actorOf(session), action: "realisation.update", entity: "Realisation", entityId: id, before, after: data });
  } else {
    const created = await prisma.realisation.create({ data });
    await audit({ ...actorOf(session), action: "realisation.create", entity: "Realisation", entityId: created.id, after: data });
  }
  back(path, "Réalisation enregistrée.");
}

export async function deleteRealisationAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const id = String(formData.get("id") ?? "");
  const before = await prisma.realisation.findUnique({ where: { id } });
  if (!before) back("/admin/contenus/realisations", "Réalisation introuvable", "err");
  await prisma.realisation.delete({ where: { id } });
  await audit({ ...actorOf(session), action: "realisation.delete", entity: "Realisation", entityId: id, before });
  back("/admin/contenus/realisations", "Réalisation supprimée.");
}

/* ------------------------------ Showroom ------------------------------ */

const showroomSchema = z.object({
  id: zOpt(64),
  name: zReq(160),
  line1: zReq(200),
  postalCode: zReq(10),
  city: zReq(120),
  hours: zText(1000),
  phone: zOpt(30),
  published: zBool,
  isDemo: zBool,
});

export async function saveShowroomAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const path = "/admin/contenus/showroom";
  const parsed = showroomSchema.safeParse(fields(formData));
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  const { id, ...data } = parsed.data;
  if (id) {
    const before = await prisma.showroom.findUnique({ where: { id } });
    if (!before) back(path, "Showroom introuvable", "err");
    await prisma.showroom.update({ where: { id }, data });
    await audit({ ...actorOf(session), action: "showroom.update", entity: "Showroom", entityId: id, before, after: data });
  } else {
    const created = await prisma.showroom.create({ data });
    await audit({ ...actorOf(session), action: "showroom.create", entity: "Showroom", entityId: created.id, after: data });
  }
  back(path, "Showroom enregistré.");
}

export async function deleteShowroomAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const id = String(formData.get("id") ?? "");
  const before = await prisma.showroom.findUnique({ where: { id } });
  if (!before) back("/admin/contenus/showroom", "Showroom introuvable", "err");
  await prisma.showroom.delete({ where: { id } });
  await audit({ ...actorOf(session), action: "showroom.delete", entity: "Showroom", entityId: id, before });
  back("/admin/contenus/showroom", "Showroom supprimé.");
}
