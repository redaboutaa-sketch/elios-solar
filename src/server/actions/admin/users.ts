"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { UserRole } from "@/generated/prisma/enums";
import { actorOf, back, fields, firstError, zReq } from "@/server/admin/form";

const PATH = "/admin/utilisateurs";

/** Changement de rôle : réservé aux administrateurs ; on ne peut pas se rétrograder soi-même. */
export async function changeRoleAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN"]);
  const parsed = z.object({ userId: zReq(64), role: z.enum(UserRole) }).safeParse(fields(formData));
  if (!parsed.success) back(PATH, firstError(parsed.error), "err");
  const { userId, role } = parsed.data;
  if (userId === session.user.id && role !== "ADMIN") back(PATH, "Vous ne pouvez pas retirer votre propre rôle d'administrateur.", "err");
  const before = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, deletedAt: true } });
  if (!before) back(PATH, "Utilisateur introuvable", "err");
  if (before.deletedAt) back(PATH, "Compte supprimé : rôle non modifiable.", "err");
  if (before.role === role) back(PATH, "Rôle inchangé.");
  await prisma.user.update({ where: { id: userId }, data: { role } });
  await audit({ ...actorOf(session), action: "user.role", entity: "User", entityId: userId, before: { role: before.role }, after: { role } });
  back(PATH, "Rôle mis à jour.");
}
