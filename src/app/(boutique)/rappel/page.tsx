import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ContactForm } from "@/components/forms/contact-form";
export const metadata: Metadata = { title: "Être rappelé", description: "Laissez vos coordonnées, un conseiller vous rappelle au créneau de votre choix.", alternates: { canonical: "/rappel" } };
export default function Page() {
  return <div className="container-x py-8 max-w-3xl"><Breadcrumbs items={[{ label: "Être rappelé" }]} /><h1 className="mt-4 font-display text-4xl">Demande de rappel</h1><p className="mt-2 text-stone-700">Un conseiller vous rappelle pour étudier votre projet.</p><div className="mt-6"><ContactForm kind="callback" /></div></div>;
}
