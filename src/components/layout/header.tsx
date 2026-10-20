import Link from "next/link";
import { ChevronDown, Phone, ShoppingBag, UserRound } from "lucide-react";
import { BRAND, NAV } from "@/config/brand";
import { MobileMenu } from "./mobile-menu";
import { Logo } from "@/components/brand/logo";

export interface HeaderRange { slug: string; name: string; shortDescription: string; custom?: boolean }

export function Header({ cartCount = 0, signedIn = false, isAdmin = false, ranges = [], phone = null }: { cartCount?: number; signedIn?: boolean; isAdmin?: boolean; ranges?: HeaderRange[]; phone?: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-sand-200 bg-sand-50/92 backdrop-blur">
      {process.env.SITE_INDEXABLE !== "true" && (
        <div className="bg-anthracite text-sand-50 text-center text-xs py-1 px-2">Préproduction — identité provisoire « {BRAND.name} », catalogue et prix de démonstration, paiement en mode test.</div>
      )}
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MobileMenu items={NAV} ranges={ranges} />
          <Link href="/" aria-label={`${BRAND.name} — accueil`}><Logo /></Link>
        </div>
        <nav aria-label="Navigation principale" className="hidden lg:flex items-center gap-5 text-sm">
          <div className="relative group">
            <Link href="/pergolas" className="inline-flex items-center gap-1 py-2 hover:text-copper-600" aria-haspopup="true">Pergolas <ChevronDown className="size-3.5" aria-hidden="true" /></Link>
            <div className="absolute left-0 top-full pt-2 invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity">
              <ul className="card p-2 w-72">
                {ranges.map((r) => (
                  <li key={r.slug}><Link href={r.custom ? "/configurateur/sur-mesure" : `/pergolas/${r.slug}`} className="block rounded-lg px-3 py-2 hover:bg-sand-100"><span className="font-medium">{r.name}</span><span className="block text-xs text-stone-700">{r.shortDescription}</span></Link></li>
                ))}
                <li className="border-t border-sand-200 mt-1 pt-1"><Link href="/pergolas" className="block rounded-lg px-3 py-2 hover:bg-sand-100">Toutes les pergolas</Link></li>
              </ul>
            </div>
          </div>
          {NAV.filter((n) => n.href !== "/pergolas" && n.href !== "/comparer").map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-copper-600 py-2">{n.label}</Link>
          ))}
          <Link href="/comparer" className="btn-primary py-2 px-4 text-xs">Comparer les gammes</Link>
        </nav>
        <div className="flex items-center gap-1">
          {phone && <a href={`tel:${phone.replace(/\s+/g, "")}`} className="btn-ghost px-3 hidden xl:inline-flex" aria-label={`Appeler ${phone}`}><Phone className="size-4" aria-hidden="true" />{phone}</a>}
          {isAdmin && <Link href="/admin" className="btn-ghost text-xs hidden sm:inline-flex">Administration</Link>}
          <Link href={signedIn ? "/compte" : "/compte/connexion"} className="btn-ghost px-3" aria-label={signedIn ? "Mon compte" : "Se connecter"}>
            <UserRound className="size-5" aria-hidden="true" />
            <span className="hidden sm:inline">{signedIn ? "Compte" : "Connexion"}</span>
          </Link>
          <Link href="/panier" className="btn-ghost px-3 relative" aria-label={`Panier, ${cartCount} article${cartCount > 1 ? "s" : ""}`}>
            <ShoppingBag className="size-5" aria-hidden="true" />
            <span className="hidden sm:inline">Panier</span>
            {cartCount > 0 && <span className="absolute -top-0.5 right-0 rounded-full bg-copper-500 text-white text-[11px] leading-5 min-w-5 text-center px-1">{cartCount}</span>}
          </Link>
        </div>
      </div>
    </header>
  );
}
