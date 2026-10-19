import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CookieBanner, ConsentGatedScript } from "@/components/consent/cookie-banner";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { findActiveCart } from "@/server/cart/service";
import { getSiteSettings } from "@/server/catalog/queries";
import { prisma } from "@/lib/prisma";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [session, guestKey, settings] = await Promise.all([getSession(), getGuestKey(), getSiteSettings()]);
  const cart = await findActiveCart({ userId: session?.user.id, guestKey });
  const rangeRows = await prisma.productFamily.findMany({ where: { kind: { in: ["PERGOLA_STANDARD", "PERGOLA_CUSTOM"] }, status: { in: ["PUBLISHED", "QUOTE_ONLY"] } }, select: { slug: true, name: true, shortDescription: true, kind: true }, orderBy: { sortOrder: "asc" } });
  const ranges = rangeRows.map((r) => ({ slug: r.slug, name: r.name, shortDescription: r.shortDescription, custom: r.kind === "PERGOLA_CUSTOM" }));
  const role = (session?.user as { role?: string } | undefined)?.role;
  const analyticsSrc = settings?.analyticsEnabled && settings.analyticsScriptUrl ? settings.analyticsScriptUrl : null;
  return (
    <>
      <Header cartCount={cart?.lines.reduce((s, l) => s + l.qty, 0) ?? 0} signedIn={!!session} isAdmin={role === "ADMIN" || role === "MANAGER"} ranges={ranges} phone={settings?.phone ?? null} />
      <main id="contenu" className="flex-1">{children}</main>
      <Footer settings={settings} />
      <CookieBanner analyticsAvailable={!!analyticsSrc} />
      <ConsentGatedScript src={analyticsSrc} />
    </>
  );
}
