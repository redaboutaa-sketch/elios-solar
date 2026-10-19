"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { actorOf, back, fields, firstError, zReq } from "@/server/admin/form";

export async function setContactStatusAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const parsed = z.object({ id: zReq(64), status: z.enum(["NEW", "HANDLED"]) }).safeParse(fields(formData));
  if (!parsed.success) back("/admin/contacts", firstError(parsed.error), "err");
  const before = await prisma.contactRequest.findUnique({ where: { id: parsed.data.id }, select: { status: true } });
  if (!before) back("/admin/contacts", "Demande introuvable", "err");
  await prisma.contactRequest.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status } });
  await audit({ ...actorOf(session), action: "contact.status", entity: "ContactRequest", entityId: parsed.data.id, before, after: { status: parsed.data.status } });
  back("/admin/contacts", parsed.data.status === "HANDLED" ? "Demande marquée comme traitée." : "Demande rouverte.");
}
