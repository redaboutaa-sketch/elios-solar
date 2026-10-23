import { AttributionCapture } from "@/components/analytics/attribution";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CookieBanner, ConsentGatedScript } from "@/components/consent/cookie-banner";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { findActiveCart } from "@/server/cart/service";
import { getSiteSettings } from "@/server/catalog/queries";
import { publicNavigation } from "@/server/catalog/navigation";
import { ChatWidget } from "@/components/chat/chat-widget";
import { advisorsOnline } from "@/server/chat/service";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [session, guestKey, settings] = await Promise.all([getSession(), getGuestKey(), getSiteSettings()]);
  const [cart, chatOnline, categories] = await Promise.all([findActiveCart({ userId: session?.user.id, guestKey }), advisorsOnline().catch(() => false), publicNavigation()]);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const analyticsSrc = settings?.analyticsEnabled && settings.analyticsScriptUrl ? settings.analyticsScriptUrl : null;
  return (
    <>
      <Header cartCount={cart?.lines.reduce((s, l) => s + l.qty, 0) ?? 0} signedIn={!!session} isAdmin={role === "ADMIN" || role === "MANAGER"} categories={categories} phone={settings?.phone ?? null} />
      <main id="contenu" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
      <Footer settings={settings} categories={categories} />
      <CookieBanner analyticsAvailable={!!analyticsSrc} />
      <ConsentGatedScript src={analyticsSrc} />
      <AttributionCapture />
      <ChatWidget enabled={settings?.chatEnabled ?? true} initialOnline={chatOnline} />
    </>
  );
}
