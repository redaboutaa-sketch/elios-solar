import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Price } from "@/components/ui/price";
import { DemoBadge } from "@/components/ui/demo-badge";
import { SpecTable } from "@/components/catalog/spec-table";
import { PergolaArt, colorOf } from "@/components/illustrations/pergola";
import { getFamily } from "@/server/catalog/queries";
import { BRAND } from "@/config/brand";

export async function generateMetadata(props: PageProps<"/pergolas/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const f = await getFamily(slug);
  if (!f) return {};
  return { title: f.seoTitle ?? f.name, description: f.seoDescription ?? f.shortDescription, alternates: { canonical: `/pergolas/${f.slug}` } };
}

export default async function PergolaPage(props: PageProps<"/pergolas/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const f = await getFamily(slug);
  if (!f || f.kind !== "PERGOLA_STANDARD") notFound();
  const finishCode = typeof sp.finition === "string" && f.finishes.some((x) => x.finishCode === sp.finition) ? sp.finition : f.finishes[0]!.finishCode;
  const dimensionCode = typeof sp.dimension === "string" && f.dimensions.some((x) => x.dimensionCode === sp.dimension) ? sp.dimension : f.dimensions[0]!.dimensionCode;
  const mounting = sp.implantation === "adossee" ? "WALL" : "FREESTANDING";
  const fin = f.finishes.find((x) => x.finishCode === finishCode)!.finish;
  const variant = f.variants.find((v) => { const a = v.attributes as { finishCode: string; dimensionCode: string; mounting: string }; return a.finishCode === finishCode && a.dimensionCode === dimensionCode && a.mounting === (mounting === "WALL" ? "wall" : "freestanding"); });
  const specs = f.specs as Array<{ label: string; value: string; status: string }>;
  const faq = f.faq as Array<{ q: string; a: string }>;
  const included = f.included as string[];
  const configureHref = `/configurateur?gamme=${f.slug}&dimension=${dimensionCode}&finition=${finishCode}&implantation=${mounting === "WALL" ? "adossee" : "autoportee"}`;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: `${f.name} ${BRAND.name}`, description: f.shortDescription, brand: { "@type": "Brand", name: BRAND.name },
    ...(variant && f.dataStatus === "SUPPLIER_VERIFIED" ? { offers: { "@type": "Offer", priceCurrency: "EUR", price: (variant.priceCents / 100).toFixed(2), availability: "https://schema.org/PreOrder" } } : {}),
  };
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ href: "/pergolas", label: "Pergolas" }, { label: f.name }]} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="card overflow-hidden"><PergolaArt structure={colorOf(fin.structureColor)} blades={colorOf(fin.bladeColor)} mounting={mounting === "WALL" ? "wall" : "freestanding"} lighting={!!f.lightingIncluded && f.lightingIncluded !== "none"} className="w-full h-auto" title={`${f.name} en finition ${fin.label}`} /></div>
          <p className="mt-2 text-xs text-stone-700">Illustration schématique de la gamme : les fermetures latérales et accessoires ne sont pas représentés car non inclus. Les visuels photographiques seront ajoutés avec les médias autorisés.</p>
          <section className="mt-10"><h2 className="font-display text-2xl">Description</h2><p className="mt-3 text-stone-800 leading-relaxed">{f.description}</p></section>
          <section className="mt-8"><h2 className="font-display text-2xl">Inclus</h2><ul className="mt-3 list-disc pl-6 text-stone-800">{included.map((i) => <li key={i}>{i}</li>)}</ul></section>
          <section className="mt-8"><h2 className="font-display text-2xl">Caractéristiques</h2><div className="mt-3"><SpecTable specs={specs} /></div></section>
          <section className="mt-8"><h2 className="font-display text-2xl">Documents</h2>{f.documents.length === 0 ? <p className="mt-2 text-sm text-stone-700">Notice de montage et fiche technique : à fournir par le fournisseur (voir blocages de lancement).</p> : <ul className="mt-2">{f.documents.map((d) => <li key={d.id}><a className="underline" href={d.media?.path ?? "#"}>{d.title}</a></li>)}</ul>}</section>
          {faq.length > 0 && <section className="mt-8"><h2 className="font-display text-2xl">Questions fréquentes</h2><div className="mt-3 divide-y divide-sand-200">{faq.map((q) => <details key={q.q} className="py-3"><summary className="cursor-pointer font-medium">{q.q}</summary><p className="mt-2 text-stone-800">{q.a}</p></details>)}</div></section>}
        </div>
        <aside className="lg:sticky lg:top-24 self-start card p-6">
          <h1 className="font-display text-3xl">{f.name}</h1>
          <p className="mt-1 text-stone-700">{f.shortDescription}</p>
          <form method="get" className="mt-5 space-y-4">
            <fieldset><legend className="label">Finition</legend><div className="flex flex-wrap gap-2">{f.finishes.map((x) => <label key={x.finishCode} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm cursor-pointer ${x.finishCode === finishCode ? "border-ink bg-sand-100" : "border-sand-300"}`}><input type="radio" name="finition" value={x.finishCode} defaultChecked={x.finishCode === finishCode} className="sr-only" /><span className="size-4 rounded-full border border-sand-300" style={{ background: x.finish.swatch }} aria-hidden="true" />{x.finish.label}</label>)}</div></fieldset>
            <div><label className="label" htmlFor="dimension">Dimension</label><select id="dimension" name="dimension" defaultValue={dimensionCode} className="input">{f.dimensions.map((d) => <option key={d.dimensionCode} value={d.dimensionCode}>{d.dimension.label}</option>)}</select></div>
            <div><label className="label" htmlFor="implantation">Implantation</label><select id="implantation" name="implantation" defaultValue={mounting === "WALL" ? "adossee" : "autoportee"} className="input"><option value="autoportee">Autoportée (4 poteaux)</option><option value="adossee">Adossée (fixée au mur)</option></select></div>
            <button type="submit" className="btn-secondary w-full">Mettre à jour le prix</button>
          </form>
          <div className="mt-5 border-t border-sand-200 pt-4">
            {variant ? <p className="text-2xl font-semibold"><Price cents={variant.priceCents} /> <span className="text-sm font-normal text-stone-700">TTC, livraison à calculer</span></p> : <p className="text-stone-700">Combinaison indisponible.</p>}
            {variant?.dataStatus === "DEMO" && <DemoBadge className="mt-2" />}
            <p className="mt-1 text-xs text-stone-700">Réf. {variant?.sku ?? "—"} · {variant?.stockMode === "MADE_TO_ORDER" ? `fabriquée à la commande, délai indicatif ${variant.leadTimeDays ?? "—"} jours` : "en stock"}</p>
          </div>
          <Link href={configureHref} className="btn-accent w-full mt-5">Configurer et équiper les côtés</Link>
          <Link href={`/devis?gamme=${f.slug}`} className="btn-ghost w-full mt-2">Demander un devis</Link>
          <ul className="mt-5 text-xs text-stone-700 space-y-1"><li>Fixations et raccordement électrique non inclus.</li><li>Autorisation d'urbanisme à vérifier selon la surface.</li></ul>
        </aside>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
