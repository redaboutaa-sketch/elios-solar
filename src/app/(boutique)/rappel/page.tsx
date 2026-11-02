import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ContactForm } from "@/components/forms/contact-form";
import { getT } from "@/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  const t = (await getT("forms")).callback;
  return { title: t.metaTitle, description: t.metaDescription, alternates: { canonical: "/rappel" } };
}
export default async function Page() {
  const t = (await getT("forms")).callback;
  return <div className="container-x py-8 max-w-3xl"><Breadcrumbs items={[{ label: t.breadcrumb }]} /><h1 className="mt-4 font-display text-4xl">{t.title}</h1><p className="mt-2 text-stone-700">{t.intro}</p><div className="mt-6"><ContactForm kind="callback" /></div></div>;
}
