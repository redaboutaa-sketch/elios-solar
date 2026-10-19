import Link from "next/link";
import { ShoppingBag, UserRound } from "lucide-react";
import { BRAND, NAV } from "@/config/brand";
import { MobileMenu } from "./mobile-menu";

export function Header({ cartCount = 0, signedIn = false, isAdmin = false }: { cartCount?: number; signedIn?: boolean; isAdmin?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-sand-200 bg-sand-50/90 backdrop-blur">
      {process.env.SITE_INDEXABLE !== "true" && (
        <div className="bg-anthracite text-sand-50 text-center text-xs py-1 px-2">Préproduction — identité provisoire « {BRAND.name} », catalogue et prix de démonstration, paiement en mode test.</div>
      )}
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MobileMenu items={NAV} />
          <Link href="/" className="font-display text-xl tracking-wide" aria-label={`${BRAND.name} — accueil`}>
            <span className="font-semibold">{BRAND.name}</span>
          </Link>
        </div>
        <nav aria-label="Navigation principale" className="hidden lg:flex items-center gap-6 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-copper-600 py-2">{n.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
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
