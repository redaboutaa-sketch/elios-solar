import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";

export interface EnqueueInput {
  to: string;
  subject: string;
  template: string;
  payload: Record<string, unknown>;
  /** clé d'idempotence (ex. order-confirmation:<orderId>) */
  dedupeKey?: string;
}

/** File persistante : l'e-mail est enregistré en base, envoyé par le worker avec reprises. */
export async function enqueueEmail(input: EnqueueInput) {
  const dedupeKey = input.dedupeKey ?? null;
  if (dedupeKey) {
    const existing = await prisma.emailOutbox.findUnique({ where: { dedupeKey } });
    if (existing) return existing;
  }
  return prisma.emailOutbox.create({
    data: { toEmail: input.to, subject: input.subject, template: input.template, payload: input.payload as never, dedupeKey },
  });
}

export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
}
