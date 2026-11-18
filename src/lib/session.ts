import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type Role = "CUSTOMER" | "MANAGER" | "ADMIN";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser(nextPath?: string) {
  const session = await getSession();
  if (!session) redirect(`/compte/connexion${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  return session;
}

export function hasRole(role: string | null | undefined, allowed: Role[]): boolean {
  return !!role && allowed.includes(role as Role);
}

/** Contrôle d'autorisation serveur : à appeler dans chaque action/route d'administration. */
export async function requireRole(allowed: Role[] = ["ADMIN", "MANAGER"]) {
  const session = await getSession();
  if (!session) redirect("/compte/connexion?next=/admin");
  const role = (session.user as { role?: string }).role;
  if (!hasRole(role, allowed)) redirect("/compte?forbidden=1");
  return { session, role: role as Role };
}

export class ForbiddenError extends Error {
  constructor(message = "Accès refusé") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Variante sans redirection pour les actions serveur (lève une erreur). */
export async function assertRole(allowed: Role[] = ["ADMIN", "MANAGER"]) {
  const session = await getSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || !hasRole(role, allowed)) throw new ForbiddenError();
  return { session, role: role as Role };
}
