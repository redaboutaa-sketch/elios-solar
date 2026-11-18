import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

export const GUEST_COOKIE = "es_guest";

export async function getGuestKey(): Promise<string | null> {
  const c = await cookies();
  return c.get(GUEST_COOKIE)?.value ?? null;
}

/** À appeler uniquement depuis une action serveur ou une route (écriture de cookie). */
export async function ensureGuestKey(): Promise<string> {
  const c = await cookies();
  const existing = c.get(GUEST_COOKIE)?.value;
  if (existing) return existing;
  const key = randomBytes(24).toString("base64url");
  c.set(GUEST_COOKIE, key, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 });
  return key;
}
