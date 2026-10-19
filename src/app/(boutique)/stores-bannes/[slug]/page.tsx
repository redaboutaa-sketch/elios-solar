import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SpecTable } from "@/components/catalog/spec-table";
import { AwningArt } from "@/components/illustrations/pergola";
import { getFamily } from "@/server/catalog/queries";
import { Price } from "@/components/ui/price";
import { priceFrom } from "@/server/catalog/queries";

export async function generateMetadata(props: PageProps<"/stores-bannes/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const f = await getFamily(slug);
  return f ? { title: f.name, description: f.shortDescription, alternates: { canonical: `/stores-bannes/${f.slug}` } } : {};
}

export default async function AwningPage(props: PageProps<"/stores-bannes/[slug]">) {
  const { slug } = await props.params;
  const f = await getFamily(slug);
  if (!f || f.kind !== "AWNING") notFound();
  const sizes = [...new Map(f.variants.map((v) => { const a = v.attributes as { widthMm: number; projectionMm: number }; return [`${a.widthMm}x${a.projectionMm}`, a] as const; })).values()];
  const from = priceFrom({ variants: f.variants });
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ href: "/stores-bannes", label: "Stores bannes" }, { label: f.name }]} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="card overflow-hidden"><AwningArt className="w-full h-auto" /></div>
          <section className="mt-8"><h2 className="font-display text-2xl">Description</h2><p className="mt-3 text-stone-800">{f.description}</p></section>
          <section className="mt-8"><h2 className="font-display text-2xl">Inclus</h2><ul className="mt-3 list-disc pl-6">{(f.included as string[]).map((i) => <li key={i}>{i}</li>)}</ul></section>
          <section className="mt-8"><h2 className="font-display text-2xl">Tailles disponibles</h2><p className="mt-2 text-sm text-stone-700">Largeur × avancée (m) — uniquement les combinaisons fabriquées.</p><ul className="mt-3 flex flex-wrap gap-2">{sizes.map((s) => <li key={`${s.widthMm}-${s.projectionMm}`} className="badge bg-sand-100 border border-sand-300">{s.widthMm / 1000} × {s.projectionMm / 1000}</li>)}</ul></section>
          <section className="mt-8"><h2 className="font-display text-2xl">Caractéristiques</h2><div className="mt-3"><SpecTable specs={f.specs as never} /></div></section>
          <section className="mt-8"><h2 className="font-display text-2xl">Questions fréquentes</h2><div className="mt-3 divide-y divide-sand-200">{(f.faq as Array<{ q: string; a: string }>).map((q) => <details key={q.q} className="py-3"><summary className="cursor-pointer font-medium">{q.q}</summary><p className="mt-2">{q.a}</p></details>)}</div></section>
        </div>
        <aside className="lg:sticky lg:top-24 self-start card p-6">
          <h1 className="font-display text-3xl">{f.name}</h1>
          <p className="mt-1 text-stone-700">{f.shortDescription}</p>
          {from && <p className="mt-4 text-2xl font-semibold">À partir de <Price cents={from} /></p>}
          <Link href={`/configurateur/store-banne?gamme=${f.slug}`} className="btn-accent w-full mt-5">Configurer ce store</Link>
          <Link href={`/devis?gamme=${f.slug}`} className="btn-ghost w-full mt-2">Demander un devis</Link>
        </aside>
      </div>
    </div>
  );
}
