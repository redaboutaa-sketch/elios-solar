import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ContactForm } from "@/components/forms/contact-form";
import { getSiteSettings } from "@/server/catalog/queries";
export const metadata: Metadata = { title: "Contact", description: "Contactez nos conseillers pour votre projet de pergola, store banne ou accessoires." };
export default async function Page() {
  const s = await getSiteSettings();
  return (
    <div className="container-x py-8 max-w-3xl"><Breadcrumbs items={[{ label: "Contact" }]} /><h1 className="mt-4 font-display text-4xl">Contact</h1>
      <p className="mt-2 text-stone-700">{s?.phone ? `Par téléphone : ${s.phone}. ` : "Numéro de téléphone à renseigner dans l'administration. "}{s?.contactEmail ? `Par e-mail : ${s.contactEmail}.` : ""}</p>
      <div className="mt-6"><ContactForm kind="contact" /></div>
    </div>
  );
}
