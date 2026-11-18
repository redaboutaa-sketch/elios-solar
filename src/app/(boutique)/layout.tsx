import { AttributionCapture } from "@/components/analytics/attribution";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SiteSidebar } from "@/components/layout/site-sidebar";
import { CookieBanner, ConsentGatedScript } from "@/components/consent/cookie-banner";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { findActiveCart } from "@/server/cart/service";
import { getSiteSettings } from "@/server/catalog/queries";
import { publicNavigation } from "@/server/catalog/navigation";
import { ChatWidget } from "@/components/chat/chat-widget";
import { advisorsOnline } from "@/server/chat/service";
import { activeSeasonalTheme } from "@/domain/seasonal";
import { I18nProvider } from "@/i18n/client";
import { i18nPayload } from "@/i18n/server";
import { PreviewLocaleBanner } from "@/components/layout/locale-switcher";
import { SeasonalFooterGarland, SeasonalHeaderAccent } from "@/components/layout/seasonal-decor";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [session, guestKey, settings, i18n] = await Promise.all([getSession(), getGuestKey(), getSiteSettings(), i18nPayload()]);
  const [cart, chatOnline, categories] = await Promise.all([findActiveCart({ userId: session?.user.id, guestKey }), advisorsOnline().catch(() => false), publicNavigation()]);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const seasonal = activeSeasonalTheme(settings);
  const analyticsSrc = settings?.analyticsEnabled && settings.analyticsScriptUrl ? settings.analyticsScriptUrl : null;
  return (
    <I18nProvider value={i18n}>
      <Header cartCount={cart?.lines.reduce((s, l) => s + l.qty, 0) ?? 0} signedIn={!!session} isAdmin={role === "ADMIN" || role === "MANAGER"} categories={categories} phone={settings?.phone ?? null} accent={<SeasonalHeaderAccent theme={seasonal} />} />
      {i18n.preview && <PreviewLocaleBanner />}
      <div className="site-frame flex-1 lg:grid lg:grid-cols-[auto_minmax(0,1fr)]">
        <SiteSidebar categories={categories} />
        <main id="contenu" tabIndex={-1} className="min-w-0 focus:outline-none">{children}</main>
      </div>
      <SeasonalFooterGarland theme={seasonal} />
      <Footer settings={settings} categories={categories} />
      <CookieBanner analyticsAvailable={!!analyticsSrc} />
      <ConsentGatedScript src={analyticsSrc} />
      <AttributionCapture />
      <ChatWidget enabled={settings?.chatEnabled ?? true} initialOnline={chatOnline} />
    </I18nProvider>
  );
}
