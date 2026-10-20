import Link from "next/link";
import { BRAND } from "@/config/brand";
import { CookiePreferencesButton } from "@/components/consent/cookie-banner";
import { Logo } from "@/components/brand/logo";

export function Footer({ settings }: { settings?: { legalName?: string | null; phone?: string | null; contactEmail?: string | null; city?: string | null } | null }) {
  const cols = [
    { title: "Produits", links: [["/pergolas", "Pergolas"], ["/accessoires", "Accessoires"], ["/stores-bannes", "Stores bannes"], ["/configurateur", "Configurateur"], ["/configurateur/sur-mesure", "Sur mesure"], ["/comparer", "Comparer les gammes"]] },
    { title: "Accompagnement", links: [["/devis", "Demander un devis"], ["/contact", "Contact"], ["/rappel", "Être rappelé"], ["/livraison-installation", "Livraison & installation"], ["/aide", "Centre d'aide"], ["/guides/pergola-bioclimatique", "Guides"]] },
    { title: "Informations", links: [["/mentions-legales", "Mentions légales"], ["/cgv", "Conditions générales de vente"], ["/confidentialite", "Confidentialité"], ["/cookies", "Cookies"], ["/showroom", "Showroom"], ["/realisations", "Réalisations"]] },
  ];
  return (
    <footer className="mt-auto border-t border-sand-200 bg-sand-100">
      <div className="container-x py-12 grid gap-10 md:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-stone-700">{BRAND.tagline}.</p>
          <p className="mt-4 text-xs text-stone-700">{settings?.legalName ? settings.legalName : "Identité du vendeur à renseigner dans l'administration."}{settings?.city ? ` — ${settings.city}` : ""}</p>
          {settings?.phone && <p className="text-xs text-stone-700">{settings.phone}</p>}
          {settings?.contactEmail && <p className="text-xs text-stone-700">{settings.contactEmail}</p>}
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-sm font-semibold mb-3">{c.title}</p>
            <ul className="space-y-2 text-sm text-stone-700">
              {c.links.map(([href, label]) => (
                <li key={href}><Link href={href!} className="hover:text-ink hover:underline">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-sand-200">
        <div className="container-x py-4 flex flex-col sm:flex-row gap-2 sm:items-center justify-between text-xs text-stone-700">
          <p>© {new Date().getFullYear()} {BRAND.name}. Nom d'affichage provisoire.</p>
          <CookiePreferencesButton />
        </div>
      </div>
    </footer>
  );
}
