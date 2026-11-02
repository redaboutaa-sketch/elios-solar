import Link from "@/i18n/link";
import { Phone, ShoppingBag, UserRound } from "lucide-react";
import { BRAND, NAV_SERVICES } from "@/config/brand";
import type { NavCategory } from "@/server/catalog/navigation";
import { MobileMenu } from "./mobile-menu";
import { HeaderShell } from "./header-shell";
import { Logo } from "@/components/brand/logo";
import { onlineSalesEnabled } from "@/server/payment/mode";
import { getT } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { LocaleSwitcher } from "./locale-switcher";

/** Données de navigation transmises par le layout (sérialisables, partagées avec le menu mobile). */
export type HeaderCategory = Pick<NavCategory, "key" | "label" | "href" | "intro" | "items">;

const navLink = "inline-flex items-center gap-1 whitespace-nowrap py-2 text-sand-50 hover:text-sage-300 border-b border-transparent";
const darkBtn = "btn px-3 text-sand-50 hover:bg-white/10";

export async function Header({ cartCount = 0, signedIn = false, isAdmin = false, categories = [], phone = null, accent = null }: { cartCount?: number; signedIn?: boolean; isAdmin?: boolean; categories?: HeaderCategory[]; phone?: string | null; accent?: React.ReactNode }) {
  const t = await getT("layout");
  const label = (href: string, fallback: string) => (t.links as Record<string, string>)[href] ?? fallback;
  const services = NAV_SERVICES.map((n) => ({ href: n.href, label: label(n.href, n.label) }));
  const cats = categories.map((c) => ({ ...c, label: (t.categories as Record<string, string>)[c.key] ?? c.label }));
  return (
    <HeaderShell>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-[3px] focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink">{t.skip}</a>
      {process.env.SITE_INDEXABLE !== "true" && (
        <div className="preprod-banner bg-brand-900 text-sand-50 text-center text-xs py-1 px-2">{t.preprod}</div>
      )}
      <div className="header-bar">
        <div className="container-x relative flex h-[var(--bar-h)] items-center justify-between gap-4 transition-[height] duration-300">
          <MobileMenu categories={cats} services={services} />
          {/* Au défilement (data-scrolled), le logo s'agrandit et se centre sur la largeur du bandeau : positionné par
              rapport au conteneur (centré dans la fenêtre), il ne dépend pas de la largeur des boutons latéraux. */}
          <Link href="/" aria-label={fmt(t.homeLabel, { brand: BRAND.name })} data-header-logo className="header-logo max-lg:-ml-2 mr-auto inline-flex min-h-11 items-center rounded-[2px] py-2"><Logo className="h-7 sm:h-8 xl:h-9" priority /></Link>
          <nav aria-label={t.mainNav} className="mr-auto hidden lg:flex items-center gap-6 text-sm font-medium">
            {/* le catalogue (quatre familles, modèles) est dans la navigation latérale : un seul menu de catalogue */}
            {services.map((n) => (
              <Link key={n.href} href={n.href} className={navLink}>{n.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <LocaleSwitcher className="relative hidden lg:block" />
            {phone && <a href={`tel:${phone.replace(/\s+/g, "")}`} className={`${darkBtn} hidden 2xl:inline-flex`} aria-label={fmt(t.call, { phone })}><Phone className="size-4" aria-hidden="true" />{phone}</a>}
            {isAdmin && <Link href="/admin" className={`${darkBtn} text-xs hidden sm:inline-flex lg:hidden 2xl:inline-flex`}>{t.admin}</Link>}
            <Link href={signedIn ? "/compte" : "/compte/connexion"} className={darkBtn} aria-label={signedIn ? t.accountAria : t.signInAria}>
              <UserRound className="size-5" aria-hidden="true" />
              <span className="hidden sm:inline lg:hidden xl:inline">{signedIn ? t.account : t.signIn}</span>
            </Link>
            {(onlineSalesEnabled() || cartCount > 0) && <Link href="/panier" className={`${darkBtn} relative`} aria-label={fmt(cartCount > 1 ? t.cartAriaMany : t.cartAria, { count: cartCount })}>
              <ShoppingBag className="size-5" aria-hidden="true" />
              <span className="hidden sm:inline lg:hidden xl:inline">{t.cart}</span>
              {cartCount > 0 && <span className="absolute -top-0.5 right-0 rounded-full bg-sage-400 text-night text-[11px] font-semibold leading-5 min-w-5 text-center px-1">{cartCount}</span>}
            </Link>}
            <Link href="/configurateur" className="btn-cta ml-2 hidden lg:inline-flex px-4 py-2 text-sm whitespace-nowrap"><span className="xl:hidden">{t.configureShort}</span><span className="hidden xl:inline">{t.configure}</span></Link>
          </div>
        </div>
      </div>
      {accent}
    </HeaderShell>
  );
}
