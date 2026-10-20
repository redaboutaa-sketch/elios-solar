import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { QuoteForm } from "@/components/configurator/quote-form";
import { prisma } from "@/lib/prisma";
import { configuratorHref } from "@/domain/categories";

export const metadata: Metadata = { title: "Demander un devis", description: "Devis pour votre pergola, votre screen ou votre store banne HELIOSTORES." };

export default async function Page(props: PageProps<"/devis">) {
  const sp = await props.searchParams;
  const slug = typeof sp.produit === "string" ? sp.produit : null;
  const product = slug ? await prisma.productFamily.findFirst({ where: { slug, legacy: false, category: { not: null }, status: { in: ["PUBLISHED", "QUOTE_ONLY"] } }, select: { slug: true, name: true } }) : null;
  return (
    <div className="container-x py-8 max-w-3xl"><Breadcrumbs items={[{ label: "Devis" }]} /><h1 className="mt-4 font-display text-4xl">Demander un devis</h1>
      <p className="mt-2 text-stone-700">Décrivez votre projet{product ? ` (${product.name})` : ""}. Pour un devis précis, {product ? <Link href={configuratorHref(product.slug)} className="underline">configurez {product.name}</Link> : <Link href="/configurateur" className="underline">configurez votre produit</Link>} puis « Envoyer la demande de devis » : vos cotes, vos choix et la visualisation sont joints automatiquement.</p>
      <div className="mt-6 card p-6"><QuoteForm input={null} kind="general" configurationId={null} /></div>
    </div>
  );
}
