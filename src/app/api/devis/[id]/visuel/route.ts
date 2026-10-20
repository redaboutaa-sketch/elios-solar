import { auth } from "@/lib/auth";
import { quoteForViewer, readQuoteVisual } from "@/server/quote/visual";

/** Visualisation jointe au devis (figée à l'émission) : titulaire connecté ou administration. */
export async function GET(req: Request, ctx: RouteContext<"/api/devis/[id]/visuel">) {
  const { id } = await ctx.params;
  const session = await auth.api.getSession({ headers: req.headers });
  const quote = await quoteForViewer(id, session ? { userId: session.user.id, role: (session.user as { role?: string }).role } : null);
  const v = quote?.visuals[0];
  if (!v) return new Response("Introuvable", { status: 404 });
  const bytes = await readQuoteVisual(v.storageKey);
  if (!bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: { "content-type": v.mime, "content-length": String(bytes.length), "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
