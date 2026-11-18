import { auth } from "@/lib/auth";
import { quoteForViewer } from "@/server/quote/visual";
import { buildQuotePdf } from "@/server/pdf/quote-pdf";

/** PDF du devis : titulaire connecté ou administration (404 sinon, sans révéler l'existence du devis). */
export async function GET(req: Request, ctx: RouteContext<"/api/devis/[id]/pdf">) {
  const { id } = await ctx.params;
  const session = await auth.api.getSession({ headers: req.headers });
  const quote = await quoteForViewer(id, session ? { userId: session.user.id, role: (session.user as { role?: string }).role } : null);
  if (!quote) return new Response("Introuvable", { status: 404 });
  const bytes = await buildQuotePdf(quote);
  if (!bytes) return new Response("Aucune configuration jointe à ce devis", { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="devis-${quote.number}.pdf"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
