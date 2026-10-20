"use server";
import { prisma } from "@/lib/prisma";
import { ensureGuestKey } from "@/server/guest";
import { getSession } from "@/lib/session";

export async function saveConsentAction(input: { analytics: boolean; marketing: boolean; version: string }) {
  const guestKey = await ensureGuestKey();
  const session = await getSession();
  await prisma.consent.create({ data: { guestKey, userId: session?.user.id ?? null, analytics: !!input.analytics, marketing: !!input.marketing, version: String(input.version).slice(0, 20) } });
  return { ok: true };
}
