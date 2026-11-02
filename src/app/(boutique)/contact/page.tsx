import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ContactForm } from "@/components/forms/contact-form";
import { getSiteSettings } from "@/server/catalog/queries";
import { BRAND } from "@/config/brand";
import { commercialContact } from "@/domain/commercial-contact";
import { getT } from "@/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  const t = (await getT("forms")).contact;
  return { title: t.metaTitle, description: t.metaDescription, alternates: { canonical: "/contact" } };
}
export default async function Page() {
  const t = (await getT("forms")).contact;
  const c = commercialContact(await getSiteSettings(), BRAND.name);
  return (
    <div className="container-x py-8 max-w-3xl"><Breadcrumbs items={[{ label: t.breadcrumb }]} /><h1 className="mt-4 font-display text-4xl">{t.title}</h1>
      <address className="mt-2 not-italic text-stone-700" data-testid="contact-direct">
        <p className="font-medium text-ink">{c.name}</p>
        {c.locality && <p>{c.locality}</p>}
        {c.email && <p>{t.byEmail}<a href={`mailto:${c.email}`} className="underline">{c.email}</a></p>}
      </address>
      <p className="mt-2 text-sm text-stone-700">{t.intro}</p>
      <div className="mt-6"><ContactForm kind="contact" /></div>
    </div>
  );
}
