import Link from "next/link";
import { BRAND, PUBLIC_SECTIONS } from "@/config/brand";
import { CookiePreferencesButton } from "@/components/consent/cookie-banner";
import { Logo } from "@/components/brand/logo";
import { commercialContact } from "@/domain/commercial-contact";

interface FooterSettings { postalCode?: string | null; city?: string | null; countryCode?: string | null; contactEmail?: string | null }
interface FooterCategory { key: string; label: string; href: string; items: ReadonlyArray<{ slug: string; name: string; href: string }> }

/** Pied de page : coordonnées commerciales issues de SiteSettings (marque, localité, e-mail ; ni téléphone ni rue). */
export function Footer({ settings, categories = [] }: { settings?: FooterSettings | null; categories?: ReadonlyArray<FooterCategory> }) {
  const cols = [
    { title: "Nos produits", links: [...categories.map((c) => [c.href, c.label] as const), ["/accessoires", "Options et accessoires"] as const, ...(PUBLIC_SECTIONS.references ? [["/references", "Références"] as const] : [])] },
    { title: "Accompagnement", links: [["/devis", "Demander un devis"], ["/contact", "Conseil & contact"], ["/rappel", "Être rappelé"], ["/livraison-installation", "Livraison & installation"], ["/modes-de-paiement", "Modes de paiement"], ["/guides", "Guides et installation"], ["/aide", "Centre d'aide"]] as const },
    { title: "Informations", links: [["/mentions-legales", "Mentions légales"], ["/cgv", "Conditions générales de vente"], ["/confidentialite", "Confidentialité"], ["/cookies", "Cookies"]] as const },
  ];
  const contact = commercialContact(settings, BRAND.name);
  return (
    <footer className="mt-auto surface-night">
      <div className="container-x py-12 grid gap-10 md:grid-cols-4">
        <div>
          <Logo className="h-10" />
          <p className="mt-3 text-sm text-sand-200">{BRAND.tagline}.</p>
          <address className="mt-4 space-y-0.5 text-xs not-italic text-sand-300" data-testid="footer-contact">
            <p>{contact.name}</p>
            {contact.locality && <p>{contact.locality}</p>}
            {contact.email && <p><a href={`mailto:${contact.email}`} className="hover:text-sage-300 hover:underline">{contact.email}</a></p>}
          </address>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-sm font-semibold mb-3 text-sage-300">{c.title}</p>
            <ul className="space-y-2 text-sm text-sand-200">
              {c.links.map(([href, label]) => (
                <li key={href}><Link href={href} className="hover:text-white hover:underline">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-x py-4 flex flex-col gap-2 text-xs text-sand-300">
          <p>Visuels non contractuels.</p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
            <p>© {new Date().getFullYear()} {BRAND.name}.{process.env.SITE_INDEXABLE !== "true" ? " Préproduction : identité juridique du vendeur en cours de validation." : ""}</p>
            <span className="[&_button:hover]:text-white"><CookiePreferencesButton /></span>
          </div>
        </div>
      </div>
    </footer>
  );
}
