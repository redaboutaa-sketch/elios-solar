import { getSession, hasRole } from "@/lib/session";
import { installGuide } from "@/server/content/install-guides";
import { GUIDE_STATUS_FR, guideStatuses } from "@/server/guides/status";
import { buildGuidePdf } from "@/server/pdf/guide-pdf";

/** PDF d'un guide : public s'il est publié ; sinon réservé à l'administration (aperçu d'un brouillon). */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const g = installGuide(slug);
  if (!g) return new Response("Introuvable", { status: 404 });
  const st = (await guideStatuses()).get(slug)!;
  if (st.status !== "PUBLISHED") {
    const s = await getSession();
    if (!s || !hasRole((s.user as { role?: string }).role, ["ADMIN", "MANAGER"])) return new Response("Introuvable", { status: 404 });
  }
  const bytes = await buildGuidePdf(g, GUIDE_STATUS_FR[st.status]);
  return new Response(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${slug}.pdf"`, "cache-control": "private, no-store", "x-robots-tag": "noindex" } });
}
