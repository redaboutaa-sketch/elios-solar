import Link from "next/link";
import { ChevronDown, Phone, ShoppingBag, UserRound } from "lucide-react";
import { BRAND, NAV_SERVICES } from "@/config/brand";
import type { NavCategory } from "@/server/catalog/navigation";
import { MobileMenu } from "./mobile-menu";
import { Logo } from "@/components/brand/logo";

/** Données de navigation transmises par le layout (sérialisables, partagées avec le menu mobile). */
export type HeaderCategory = Pick<NavCategory, "key" | "label" | "href" | "intro" | "items">;

const navLink = "inline-flex items-center gap-1 rounded-md py-2 text-sand-50 hover:text-sage-300";
const darkBtn = "btn px-3 text-sand-50 hover:bg-white/10";

export function Header({ cartCount = 0, signedIn = false, isAdmin = false, categories = [], phone = null }: { cartCount?: number; signedIn?: boolean; isAdmin?: boolean; categories?: HeaderCategory[]; phone?: string | null }) {
  return (
    <header className="sticky top-0 z-40 surface-night border-b border-white/10">
      {process.env.SITE_INDEXABLE !== "true" && (
        <div className="bg-brand-900 text-sand-50 text-center text-xs py-1 px-2">Préproduction — paiement en ligne en mode test.</div>
      )}
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <MobileMenu categories={categories} services={NAV_SERVICES} />
          <Link href="/" aria-label={`${BRAND.name} — accueil`} className="inline-flex items-center rounded-md py-1"><Logo className="h-7 sm:h-9" priority /></Link>
        </div>
        <nav aria-label="Navigation principale" className="hidden lg:flex items-center gap-6 text-sm font-medium">
          {categories.map((c) => (
            <div key={c.key} className="relative group">
              <Link href={c.href} className={navLink} aria-haspopup="true">{c.label} <ChevronDown className="size-3.5" aria-hidden="true" /></Link>
              <div className="absolute left-0 top-full pt-2 invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity">
                <ul className="card p-2 w-80 text-ink font-normal">
                  {c.items.map((p) => (
                    <li key={p.slug}><Link href={p.href} className="block rounded-lg px-3 py-2 hover:bg-brand-50"><span className="font-medium">{p.name}</span>{p.shortDescription && <span className="block text-xs text-stone-700">{p.shortDescription}</span>}</Link></li>
                  ))}
                  <li className={c.items.length > 0 ? "border-t border-sand-200 mt-1 pt-1" : ""}><Link href={c.href} className="block rounded-lg px-3 py-2 font-medium text-brand-700 hover:bg-brand-50">Voir la famille</Link></li>
                </ul>
              </div>
            </div>
          ))}
          <span className="h-5 w-px bg-white/20" aria-hidden="true" />
          {NAV_SERVICES.filter((n) => n.href !== "/devis").map((n) => (
            <Link key={n.href} href={n.href} className={navLink}>{n.label}</Link>
          ))}
          <Link href="/devis" className="btn bg-sage-400 text-night hover:bg-sage-300 py-2 px-4 text-xs font-semibold">Devis</Link>
        </nav>
        <div className="flex items-center gap-1">
          {phone && <a href={`tel:${phone.replace(/\s+/g, "")}`} className={`${darkBtn} hidden xl:inline-flex`} aria-label={`Appeler ${phone}`}><Phone className="size-4" aria-hidden="true" />{phone}</a>}
          {isAdmin && <Link href="/admin" className={`${darkBtn} text-xs hidden sm:inline-flex`}>Administration</Link>}
          <Link href={signedIn ? "/compte" : "/compte/connexion"} className={darkBtn} aria-label={signedIn ? "Mon compte" : "Se connecter"}>
            <UserRound className="size-5" aria-hidden="true" />
            <span className="hidden sm:inline">{signedIn ? "Compte" : "Connexion"}</span>
          </Link>
          <Link href="/panier" className={`${darkBtn} relative`} aria-label={`Panier, ${cartCount} article${cartCount > 1 ? "s" : ""}`}>
            <ShoppingBag className="size-5" aria-hidden="true" />
            <span className="hidden sm:inline">Panier</span>
            {cartCount > 0 && <span className="absolute -top-0.5 right-0 rounded-full bg-sage-400 text-night text-[11px] font-semibold leading-5 min-w-5 text-center px-1">{cartCount}</span>}
          </Link>
        </div>
      </div>
    </header>
  );
}
