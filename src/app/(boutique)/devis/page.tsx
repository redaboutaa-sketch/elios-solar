import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { QuoteForm } from "@/components/configurator/quote-form";
export const metadata: Metadata = { title: "Demander un devis", description: "Devis gratuit pour votre pergola standard ou sur mesure, votre store banne ou vos accessoires." };
export default async function Page(props: PageProps<"/devis">) {
  const sp = await props.searchParams;
  return (
    <div className="container-x py-8 max-w-3xl"><Breadcrumbs items={[{ label: "Devis" }]} /><h1 className="mt-4 font-display text-4xl">Demander un devis</h1>
      <p className="mt-2 text-stone-700">Décrivez votre projet{typeof sp.gamme === "string" ? ` (gamme : ${sp.gamme})` : ""}. Pour un devis précis sur une configuration, utilisez le <Link href="/configurateur" className="underline">configurateur</Link> puis « Demander un devis » : la configuration est jointe automatiquement.</p>
      <div className="mt-6 card p-6"><QuoteForm input={null} kind="general" configurationId={null} /></div>
    </div>
  );
}
