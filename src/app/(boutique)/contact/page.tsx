import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ContactForm } from "@/components/forms/contact-form";
import { getSiteSettings } from "@/server/catalog/queries";
import { BRAND } from "@/config/brand";
import { commercialContact } from "@/domain/commercial-contact";
export const metadata: Metadata = { title: "Contact", description: "Contactez un conseiller HELIOSTORES pour votre projet de pergola, de screen, de store banne ou de moustiquaire.", alternates: { canonical: "/contact" } };
export default async function Page() {
  const c = commercialContact(await getSiteSettings(), BRAND.name);
  return (
    <div className="container-x py-8 max-w-3xl"><Breadcrumbs items={[{ label: "Contact" }]} /><h1 className="mt-4 font-display text-4xl">Contact</h1>
      <address className="mt-2 not-italic text-stone-700" data-testid="contact-direct">
        <p className="font-medium text-ink">{c.name}</p>
        {c.locality && <p>{c.locality}</p>}
        {c.email && <p>Par e-mail : <a href={`mailto:${c.email}`} className="underline">{c.email}</a></p>}
      </address>
      <p className="mt-2 text-sm text-stone-700">Vous pouvez aussi nous écrire avec le formulaire ci-dessous.</p>
      <div className="mt-6"><ContactForm kind="contact" /></div>
    </div>
  );
}
