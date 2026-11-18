import "server-only";
import { headers } from "next/headers";
import { getIP } from "better-auth/api";
import { auth } from "@/lib/auth";

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Limitation simple en mémoire (instance unique sur VPS). Retourne false si la limite est dépassée. */
export async function rateLimit(scope: string, max: number, windowSeconds: number): Promise<boolean> {
  const h = await headers();
  // même résolution d'IP que better-auth (proxys de confiance, IPv6 /64) ; jamais la 1re valeur brute d'une chaîne
  const ip = getIP(h, auth.options) ?? "no-trusted-ip";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  b.count += 1;
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  return b.count <= max;
}
