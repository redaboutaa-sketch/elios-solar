import type { Attribution } from "@/domain/attribution";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/mail/outbox";

export async function createContactRequest(input: { kind: "contact" | "callback"; name: string; email: string; phone?: string; message?: string; preferredSlot?: string; attribution?: Attribution | null }) {
  const row = await prisma.contactRequest.create({ data: { kind: input.kind, name: input.name.trim(), email: input.email.trim().toLowerCase(), phone: input.phone?.trim() || null, message: input.message?.trim().slice(0, 4000) || null, preferredSlot: input.preferredSlot?.trim() || null, attribution: (input.attribution ?? undefined) as never } });
  const admin = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (admin) await enqueueEmail({ to: admin, subject: input.kind === "callback" ? "Demande de rappel" : "Nouveau message de contact", template: "contact-admin-notification", payload: { name: row.name, email: row.email, phone: row.phone, message: row.message ?? "(demande de rappel)", preferredSlot: row.preferredSlot }, dedupeKey: `contact-admin:${row.id}` });
  await enqueueEmail({ to: row.email, subject: "Nous avons bien reçu votre message", template: "contact-ack", payload: { name: row.name }, dedupeKey: `contact-ack:${row.id}` });
  return row;
}
