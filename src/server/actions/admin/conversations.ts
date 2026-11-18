"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { actorOf, back, fields, firstError, zBool, zReq } from "@/server/admin/form";
import { ChatError, MESSAGE_MAX_LENGTH, assignConversation, postAdvisorMessage, setConversationStatus } from "@/server/chat/service";

const pathFor = (id: string) => `/admin/conversations/${id}`;

export async function replyConversationAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const parsed = z.object({ id: zReq(64), body: zReq(MESSAGE_MAX_LENGTH), internal: zBool }).safeParse(fields(formData));
  if (!parsed.success) back(pathFor(String(formData.get("id") ?? "")), firstError(parsed.error), "err");
  const { id, body, internal } = parsed.data;
  let notified = false;
  try {
    const r = await postAdvisorMessage(id, session.user.id, body, { internal });
    notified = r.notified;
  } catch (e) {
    back(pathFor(id), e instanceof ChatError ? e.message : "Envoi impossible", "err");
  }
  await audit({ ...actorOf(session), action: internal ? "conversation.note" : "conversation.reply", entity: "Conversation", entityId: id, after: { length: body.length, notified } });
  back(pathFor(id), internal ? "Note interne enregistrée." : notified ? "Réponse envoyée (le client est averti par e-mail)." : "Réponse envoyée.");
}

export async function setConversationStatusAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const parsed = z.object({ id: zReq(64), status: z.enum(["OPEN", "WAITING_CUSTOMER", "CLOSED"]) }).safeParse(fields(formData));
  if (!parsed.success) back("/admin/conversations", firstError(parsed.error), "err");
  const before = await prisma.conversation.findUnique({ where: { id: parsed.data.id }, select: { status: true } });
  if (!before) back("/admin/conversations", "Conversation introuvable", "err");
  await setConversationStatus(parsed.data.id, parsed.data.status);
  await audit({ ...actorOf(session), action: "conversation.status", entity: "Conversation", entityId: parsed.data.id, before, after: { status: parsed.data.status } });
  back(pathFor(parsed.data.id), "Statut mis à jour.");
}

export async function assignConversationAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const parsed = z.object({ id: zReq(64), unassign: zBool }).safeParse(fields(formData));
  if (!parsed.success) back("/admin/conversations", firstError(parsed.error), "err");
  const before = await prisma.conversation.findUnique({ where: { id: parsed.data.id }, select: { assignedUserId: true } });
  if (!before) back("/admin/conversations", "Conversation introuvable", "err");
  const assignedUserId = parsed.data.unassign ? null : session.user.id;
  await assignConversation(parsed.data.id, assignedUserId);
  await audit({ ...actorOf(session), action: "conversation.assign", entity: "Conversation", entityId: parsed.data.id, before, after: { assignedUserId } });
  back(pathFor(parsed.data.id), assignedUserId ? "Conversation assignée à vous." : "Conversation désassignée.");
}
