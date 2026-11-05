"use server";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { processOutbox } from "@/server/mail/transport";
import { actorOf, back } from "@/server/admin/form";

export async function retryEmailAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  const item = await prisma.emailOutbox.findUnique({ where: { id }, select: { status: true, attempts: true, template: true } });
  if (!item) back("/admin/emails", "E-mail introuvable", "err");
  if (item.status === "SENT") back("/admin/emails", "Cet e-mail a déjà été envoyé.", "err");
  await prisma.emailOutbox.update({ where: { id }, data: { status: "PENDING", nextAttemptAt: new Date() } });
  await audit({ ...actorOf(session), action: "email.retry", entity: "EmailOutbox", entityId: id, before: { status: item.status, attempts: item.attempts }, after: { status: "PENDING", template: item.template } });
  back("/admin/emails", "E-mail remis en file d'attente.");
}

/** Écarte un message en attente (test, ancien ou devenu inutile) : il ne sera jamais envoyé. */
export async function abandonEmailAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  const item = await prisma.emailOutbox.findUnique({ where: { id }, select: { status: true, template: true } });
  if (!item) back("/admin/emails", "E-mail introuvable", "err");
  if (item.status === "SENT" || item.status === "DEAD") back("/admin/emails", "Cet e-mail n'est plus en attente.", "err");
  await prisma.emailOutbox.update({ where: { id }, data: { status: "DEAD", lastError: "abandonné manuellement" } });
  await audit({ ...actorOf(session), action: "email.abandon", entity: "EmailOutbox", entityId: id, before: { status: item.status }, after: { status: "DEAD", template: item.template } });
  back("/admin/emails", "E-mail abandonné : il ne sera pas envoyé.");
}

export async function processOutboxAction() {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const r = await processOutbox();
  await audit({ ...actorOf(session), action: "email.process", entity: "EmailOutbox", after: r });
  back("/admin/emails", `File traitée : ${r.sent} envoyé(s), ${r.failed} échec(s) sur ${r.pending} éligible(s).`, r.failed ? "err" : "ok");
}
