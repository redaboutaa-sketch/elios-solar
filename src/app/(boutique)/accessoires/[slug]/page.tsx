import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Price } from "@/components/ui/price";
import { DemoBadge } from "@/components/ui/demo-badge";
import { SpecTable } from "@/components/catalog/spec-table";
import { ClosureArt } from "@/components/illustrations/pergola";
import { artKind } from "@/components/illustrations/art-kind";
import { getFamily, listFamilies } from "@/server/catalog/queries";
import { AccessoryBuyForm } from "@/components/configurator/accessory-buy-form";

export async function generateMetadata(props: PageProps<"/accessoires/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const f = await getFamily(slug);
  return f ? { title: f.name, description: f.shortDescription, alternates: { canonical: `/accessoires/${f.slug}` } } : {};
}

export default async function AccessoryPage(props: PageProps<"/accessoires/[slug]">) {
  const { slug } = await props.params;
  const f = await getFamily(slug);
  if (!f || (f.kind !== "SIDE_CLOSURE" && f.kind !== "OPTION")) notFound();
  const pergolas = await listFamilies(["PERGOLA_STANDARD", "AWNING"]);
  const variants = f.variants.map((v) => ({ sku: v.sku, label: v.label, priceCents: v.priceCents, purchasable: v.purchasable, dataStatus: v.dataStatus, attributes: v.attributes as Record<string, unknown>, stock: v.stockMode === "STOCK" ? Math.max(0, (v.stockQty ?? 0) - v.reservedQty) : null }));
  const targets = pergolas.map((p) => ({ slug: p.slug, name: p.name, kind: p.kind, dimensions: p.dimensions.map((d) => ({ code: d.dimensionCode, label: d.dimension.label, widthMm: d.dimension.widthMm, lengthMm: d.dimension.lengthMm })), finishes: p.finishes.map((x) => ({ code: x.finishCode, label: x.finish.label })), dividerThresholdMm: p.dividerThresholdMm }));
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ href: "/accessoires", label: "Accessoires" }, { label: f.name }]} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="card overflow-hidden"><ClosureArt kind={artKind(f.slug)} className="w-full h-auto" /></div>
          <section className="mt-8"><h2 className="font-display text-2xl">Description</h2><p className="mt-3 text-stone-800">{f.description}</p></section>
          <section className="mt-8"><h2 className="font-display text-2xl">Inclus</h2><ul className="mt-3 list-disc pl-6">{(f.included as string[]).map((i) => <li key={i}>{i}</li>)}</ul></section>
          <section className="mt-8"><h2 className="font-display text-2xl">Caractéristiques</h2><div className="mt-3"><SpecTable specs={f.specs as never} /></div></section>
          <section className="mt-8">
            <h2 className="font-display text-2xl">Références et prix</h2>
            <table className="mt-3 w-full text-sm"><thead><tr className="text-left border-b border-sand-300"><th className="py-2">Référence</th><th>Désignation</th><th className="text-right">Prix TTC</th></tr></thead><tbody>
              {variants.map((v) => <tr key={v.sku} className="border-b border-sand-200"><td className="py-2 font-mono text-xs">{v.sku}</td><td>{v.label}{v.dataStatus === "DEMO" && <DemoBadge label="démo" className="ml-2" />}</td><td className="text-right"><Price cents={v.priceCents} /></td></tr>)}
            </tbody></table>
          </section>
        </div>
        <aside className="lg:sticky lg:top-24 self-start card p-6">
          <h1 className="font-display text-3xl">{f.name}</h1>
          <p className="mt-1 text-stone-700">{f.shortDescription}</p>
          <p className="mt-4 text-sm">Pour équiper une nouvelle pergola, utilisez le <Link href="/configurateur" className="underline">configurateur</Link>. Pour une pergola déjà installée, vérifiez la compatibilité ci-dessous.</p>
          <AccessoryBuyForm family={{ slug: f.slug, name: f.name, kind: f.kind === "SIDE_CLOSURE" ? "side_closure" : "option" }} variants={variants} targets={targets} />
        </aside>
      </div>
    </div>
  );
}
