import { NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/session";
import { touchPresence } from "@/server/chat/service";

/** Signal de présence d'un conseiller (ADMIN/MANAGER) : l'écriture est limitée à une par minute. */
export async function POST() {
  const session = await getSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || !hasRole(role, ["ADMIN", "MANAGER"])) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  await touchPresence(session.user.id);
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
