import Link from "next/link";
import { ArrowRight, ChevronDown, Phone, ShoppingBag, UserRound } from "lucide-react";
import { BRAND, NAV_SERVICES } from "@/config/brand";
import type { NavCategory } from "@/server/catalog/navigation";
import { MobileMenu } from "./mobile-menu";
import { HeaderShell } from "./header-shell";
import { Logo } from "@/components/brand/logo";
import { FamilySketch } from "@/components/illustrations/sketches";
import type { CategoryKey } from "@/domain/categories";

/** Données de navigation transmises par le layout (sérialisables, partagées avec le menu mobile). */
export type HeaderCategory = Pick<NavCategory, "key" | "label" | "href" | "intro" | "items">;

const navLink = "inline-flex items-center gap-1 whitespace-nowrap py-2 text-sand-50 hover:text-sage-300 border-b border-transparent";
const darkBtn = "btn px-3 text-sand-50 hover:bg-white/10";

export function Header({ cartCount = 0, signedIn = false, isAdmin = false, categories = [], phone = null }: { cartCount?: number; signedIn?: boolean; isAdmin?: boolean; categories?: HeaderCategory[]; phone?: string | null }) {
  return (
    <HeaderShell>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-[3px] focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink">Aller au contenu</a>
      {process.env.SITE_INDEXABLE !== "true" && (
        <div className="preprod-banner bg-brand-900 text-sand-50 text-center text-xs py-1 px-2">Préproduction — paiement en ligne en mode test.</div>
      )}
      <div className="header-bar">
        <div className="container-x relative flex h-[var(--bar-h)] items-center justify-between gap-4 transition-[height] duration-300">
          <div className="flex items-center gap-2">
            <MobileMenu categories={categories} services={NAV_SERVICES} />
            <Link href="/" aria-label={`${BRAND.name} — accueil`} className="inline-flex items-center py-1"><Logo className="h-7 sm:h-8 xl:h-9" priority /></Link>
          </div>
          <nav aria-label="Navigation principale" className="hidden lg:flex items-center gap-6 text-sm font-medium">
            <div className="group/sol">
              <Link href="/#solutions" className={`${navLink} group-hover/sol:border-sage-300 group-focus-within/sol:border-sage-300`}>Nos solutions <ChevronDown className="size-3.5 transition-transform duration-200 group-hover/sol:rotate-180 group-focus-within/sol:rotate-180" aria-hidden="true" /></Link>
              {/* panneau « Nos solutions » : toute la largeur, une colonne par famille */}
              <div className="invisible absolute inset-x-0 top-full -translate-y-1 opacity-0 transition-[opacity,transform] duration-200 group-hover/sol:visible group-hover/sol:translate-y-0 group-hover/sol:opacity-100 group-focus-within/sol:visible group-focus-within/sol:translate-y-0 group-focus-within/sol:opacity-100">
                <div className="mx-4 border border-sand-200 bg-white text-ink shadow-lift sm:mx-6 lg:mx-8">
                  <ul className="grid grid-cols-3 divide-x divide-sand-200">
                    {categories.map((c) => (
                      <li key={c.key} className="sketch-trigger p-6">
                        <Link href={c.href} tabIndex={-1} aria-hidden="true" className="block bg-sand-50 px-6 py-3"><FamilySketch kind={c.key as CategoryKey} animated={false} sun={false} className="mx-auto h-28 w-auto" /></Link>
                        <Link href={c.href} className="mt-4 flex items-center justify-between font-display text-lg font-semibold hover:text-brand-700">{c.label}<ArrowRight className="size-4 text-brand-700" aria-hidden="true" /></Link>
                        <ul className="mt-2 space-y-0.5 text-sm font-normal">
                          {c.items.map((p) => <li key={p.slug}><Link href={p.href} className="block py-1 text-stone-800 hover:text-brand-700">{p.name}</Link></li>)}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            {NAV_SERVICES.map((n) => (
              <Link key={n.href} href={n.href} className={navLink}>{n.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            {phone && <a href={`tel:${phone.replace(/\s+/g, "")}`} className={`${darkBtn} hidden 2xl:inline-flex`} aria-label={`Appeler ${phone}`}><Phone className="size-4" aria-hidden="true" />{phone}</a>}
            {isAdmin && <Link href="/admin" className={`${darkBtn} text-xs hidden sm:inline-flex lg:hidden 2xl:inline-flex`}>Administration</Link>}
            <Link href={signedIn ? "/compte" : "/compte/connexion"} className={darkBtn} aria-label={signedIn ? "Mon compte" : "Se connecter"}>
              <UserRound className="size-5" aria-hidden="true" />
              <span className="hidden sm:inline lg:hidden xl:inline">{signedIn ? "Compte" : "Connexion"}</span>
            </Link>
            <Link href="/panier" className={`${darkBtn} relative`} aria-label={`Panier, ${cartCount} article${cartCount > 1 ? "s" : ""}`}>
              <ShoppingBag className="size-5" aria-hidden="true" />
              <span className="hidden sm:inline lg:hidden xl:inline">Panier</span>
              {cartCount > 0 && <span className="absolute -top-0.5 right-0 rounded-full bg-sage-400 text-night text-[11px] font-semibold leading-5 min-w-5 text-center px-1">{cartCount}</span>}
            </Link>
            <Link href="/configurateur" className="btn ml-2 hidden lg:inline-flex bg-sage-400 px-4 py-2 text-sm font-semibold text-night hover:bg-sage-300 whitespace-nowrap"><span className="xl:hidden">Configurer</span><span className="hidden xl:inline">Configurer mon projet</span></Link>
          </div>
        </div>
      </div>
    </HeaderShell>
  );
}
