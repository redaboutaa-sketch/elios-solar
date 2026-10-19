import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Price } from "@/components/ui/price";
import { DemoBadge } from "@/components/ui/demo-badge";
import { SpecTable } from "@/components/catalog/spec-table";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { RangeComparison } from "@/components/catalog/range-comparison";
import { ProductTabs } from "@/components/catalog/product-tabs";
import { colorOf } from "@/components/illustrations/pergola";
import { getFamily, listFamilies } from "@/server/catalog/queries";
import { loadCatalog } from "@/server/catalog/load";
import { rangeHighlights } from "@/server/catalog/highlights";
import { renderMarkdown } from "@/server/content/render";
import { BRAND } from "@/config/brand";
import { Check } from "lucide-react";

export async function generateMetadata(props: PageProps<"/pergolas/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const f = await getFamily(slug);
  if (!f) return {};
  return { title: f.seoTitle ?? f.name, description: f.seoDescription ?? f.shortDescription, alternates: { canonical: `/pergolas/${f.slug}` } };
}

export default async function PergolaPage(props: PageProps<"/pergolas/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const [f, catalog, fams] = await Promise.all([getFamily(slug), loadCatalog(), listFamilies(["PERGOLA_STANDARD"])]);
  if (!f || f.kind !== "PERGOLA_STANDARD") notFound();
  const finishCode = typeof sp.finition === "string" && f.finishes.some((x) => x.finishCode === sp.finition) ? sp.finition : f.finishes[0]!.finishCode;
  const dimensionCode = typeof sp.dimension === "string" && f.dimensions.some((x) => x.dimensionCode === sp.dimension) ? sp.dimension : (f.dimensions.find((d) => d.dimensionCode === "3x4") ?? f.dimensions[0]!).dimensionCode;
  const mounting = sp.implantation === "adossee" ? "WALL" : "FREESTANDING";
  const fin = f.finishes.find((x) => x.finishCode === finishCode)!.finish;
  const dim = f.dimensions.find((d) => d.dimensionCode === dimensionCode)!.dimension;
  const variant = f.variants.find((v) => { const a = v.attributes as { finishCode: string; dimensionCode: string; mounting: string }; return a.finishCode === finishCode && a.dimensionCode === dimensionCode && a.mounting === (mounting === "WALL" ? "wall" : "freestanding"); });
  const specs = f.specs as Array<{ label: string; value: string; status: string }>;
  const faq = f.faq as Array<{ q: string; a: string }>;
  const included = f.included as string[];
  const h = rangeHighlights(catalog, f.slug);
  const highlights = Object.fromEntries(fams.map((x) => [x.slug, rangeHighlights(catalog, x.slug)]));
  const configureHref = `/configurateur?gamme=${f.slug}&dimension=${dimensionCode}&finition=${finishCode}&implantation=${mounting === "WALL" ? "adossee" : "autoportee"}`;
  const lighting = !!f.lightingIncluded && f.lightingIncluded !== "none";
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: `${f.name} ${BRAND.name}`, description: f.shortDescription, brand: { "@type": "Brand", name: BRAND.name }, ...(variant && f.dataStatus === "SUPPLIER_VERIFIED" ? { offers: { "@type": "Offer", priceCurrency: "EUR", price: (variant.priceCents / 100).toFixed(2), availability: "https://schema.org/PreOrder" } } : {}) };
  const tabs = [
    { id: "description", label: "Description", content: <div className="prose-shop"><p>{f.description}</p><h3>Inclus avec {f.name}</h3><ul>{included.map((i) => <li key={i}>{i}</li>)}</ul>{h && h.closures.length > 0 && <p>Fermetures compatibles : {h.closures.join(", ")}. Options : {h.options.join(", ")}.</p>}</div> },
    { id: "caracteristiques", label: "Caractéristiques", content: <SpecTable specs={specs} /> },
    { id: "montage", label: "Montage & livraison", content: <div className="prose-shop"><p>Montage par vos soins avec notice (à fournir par le fournisseur) ou montage professionnel chiffré dans le configurateur selon la dimension et les fermetures. Fixations, fondations et raccordement électrique non inclus.</p><p>Livraison sur palette, sur rendez-vous ; délai indicatif {variant?.leadTimeDays ?? "—"} jours (donnée de démonstration). Corse et Outre-mer sur devis.</p><p><Link href="/livraison-installation">Détails livraison et installation</Link></p></div> },
    { id: "reglementation", label: "Réglementation", content: <div className="prose-shop" dangerouslySetInnerHTML={{ __html: renderMarkdown("## Autorisation d'urbanisme\n- Jusqu'à 5 m² d'emprise au sol : en général aucune formalité (hors secteur protégé).\n- De 5 à 20 m² : déclaration préalable de travaux.\n- Au-delà de 20 m² : permis de construire.\n\nCes seuils dépendent du plan local d'urbanisme : vérifiez auprès de votre mairie. [Guide complet](/guides/autorisation-urbanisme)") }} /> },
    { id: "garantie", label: "Garantie", content: <div className="prose-shop"><p>Garantie légale de conformité (2 ans) et garantie des vices cachés. Une garantie commerciale sur la structure sera précisée après validation fournisseur (voir blocages de lancement).</p>{f.documents.length === 0 ? <p>Notice de montage et fiche technique : à fournir par le fournisseur.</p> : <ul>{f.documents.map((d) => <li key={d.id}><a href={d.media?.path ?? "#"}>{d.title}</a></li>)}</ul>}</div> },
    ...(faq.length ? [{ id: "faq", label: "Questions", content: <div className="divide-y divide-sand-200">{faq.map((q) => <details key={q.q} className="py-3"><summary className="cursor-pointer font-medium">{q.q}</summary><p className="mt-2 text-stone-800">{q.a}</p></details>)}</div> }] : []),
  ];
  return (
    <div className="container-x py-6 sm:py-8">
      <Breadcrumbs items={[{ href: "/pergolas", label: "Pergolas" }, { label: f.name }]} />
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12">
        <div className="min-w-0">
          <ProductGallery name={f.name} structure={colorOf(fin.structureColor)} blades={colorOf(fin.bladeColor)} mounting={mounting === "WALL" ? "wall" : "freestanding"} lighting={lighting} widthMm={dim.widthMm} lengthMm={dim.lengthMm} dividerThresholdMm={f.dividerThresholdMm ?? 6000} finishSwatch={fin.swatch} />
          <section className="mt-10 grid gap-4 sm:grid-cols-2">
            {[["Toit", f.roof === "motorized" ? "Lames orientables motorisées, télécommande" : "Lames orientables à commande manuelle"], ["Éclairage", h?.lighting ?? ""], ["Fermetures", h?.closures.length ? `${h.closures.join(", ")} — par ouverture` : "Sur devis"], ["Rails d'accessoires", f.accessoryRails ? `${f.accessoryRails} par poutre` : "—"]].map(([t, d]) => (
              <div key={t} className="card p-4 flex gap-3"><Check className="size-5 text-success shrink-0 mt-0.5" aria-hidden="true" /><div><p className="font-medium">{t}</p><p className="text-sm text-stone-700">{String(d).charAt(0).toUpperCase() + String(d).slice(1)}</p></div></div>
            ))}
          </section>
          <section className="mt-10"><ProductTabs tabs={tabs} /></section>
        </div>
        <aside className="min-w-0 lg:sticky lg:top-24 self-start card p-6">
          <p className="text-xs uppercase tracking-wide text-copper-600">{f.generation ?? "Pergola bioclimatique"}</p>
          <h1 className="font-display text-3xl sm:text-4xl mt-1">{f.name}</h1>
          <p className="mt-1 text-stone-700">{f.shortDescription}</p>
          <form method="get" className="mt-5 space-y-4">
            <fieldset><legend className="label">Finition <span className="font-normal text-stone-700">— {fin.label}</span></legend><div className="flex flex-wrap gap-2">{f.finishes.map((x) => <label key={x.finishCode} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm cursor-pointer min-h-11 ${x.finishCode === finishCode ? "border-ink bg-sand-100" : "border-sand-300"}`}><input type="radio" name="finition" value={x.finishCode} defaultChecked={x.finishCode === finishCode} className="sr-only" /><span className="size-5 rounded-full border border-sand-300" style={{ background: x.finish.swatch }} aria-hidden="true" />{x.finish.label}</label>)}</div></fieldset>
            <div><label className="label" htmlFor="dimension">Dimension (largeur × longueur)</label><select id="dimension" name="dimension" defaultValue={dimensionCode} className="input">{f.dimensions.map((d) => <option key={d.dimensionCode} value={d.dimensionCode}>{d.dimension.label}</option>)}</select></div>
            <div><label className="label" htmlFor="implantation">Implantation</label><select id="implantation" name="implantation" defaultValue={mounting === "WALL" ? "adossee" : "autoportee"} className="input"><option value="autoportee">Autoportée (4 poteaux)</option><option value="adossee">Adossée (fixée au mur)</option></select></div>
            <button type="submit" className="btn-secondary w-full">Mettre à jour le prix et les vues</button>
          </form>
          <div className="mt-5 border-t border-sand-200 pt-4">
            {variant ? <p className="text-3xl font-semibold"><Price cents={variant.priceCents} /> <span className="text-sm font-normal text-stone-700">TTC</span></p> : <p className="text-stone-700">Combinaison indisponible.</p>}
            {variant?.compareAtCents && variant.compareAtCents > variant.priceCents && <p className="text-sm text-stone-700 line-through"><Price cents={variant.compareAtCents} /></p>}
            {variant?.dataStatus === "DEMO" && <DemoBadge className="mt-2" />}
            <p className="mt-2 text-xs text-stone-700">Réf. {variant?.sku ?? "—"} · {variant?.stockMode === "MADE_TO_ORDER" ? `fabriquée à la commande, délai indicatif ${variant.leadTimeDays ?? "—"} jours` : "en stock"} · livraison calculée au code postal</p>
          </div>
          <ul className="mt-4 text-sm space-y-1">
            <li className="flex gap-2"><Check className="size-4 text-success mt-0.5 shrink-0" aria-hidden="true" />{included[0]}</li>
            {included[1] && <li className="flex gap-2"><Check className="size-4 text-success mt-0.5 shrink-0" aria-hidden="true" />{included[1]}</li>}
            {included[2] && <li className="flex gap-2"><Check className="size-4 text-success mt-0.5 shrink-0" aria-hidden="true" />{included[2]}</li>}
          </ul>
          <Link href={configureHref} className="btn-accent w-full mt-5 text-base">Configurer et équiper les côtés</Link>
          <Link href={`/devis?gamme=${f.slug}`} className="btn-ghost w-full mt-2">Demander un devis</Link>
          <ul className="mt-5 text-xs text-stone-700 space-y-1"><li>Fixations et raccordement électrique non inclus.</li><li>Autorisation d'urbanisme à vérifier selon la surface.</li></ul>
        </aside>
      </div>
      <section className="mt-16">
        <h2 className="font-display text-3xl">Comparer les gammes</h2>
        <p className="mt-2 text-stone-700">Tableau alimenté par le catalogue et les règles de compatibilité.</p>
        <div className="mt-6"><RangeComparison fams={fams} highlights={highlights} current={f.slug} /></div>
      </section>
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-sand-300 bg-white/95 backdrop-blur p-3 flex items-center justify-between gap-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div><p className="text-xs text-stone-700">{f.name} · {dim.label}</p><p className="font-semibold">{variant ? <Price cents={variant.priceCents} /> : "—"}</p></div>
        <Link href={configureHref} className="btn-accent">Configurer</Link>
      </div>
      <div className="lg:hidden h-20" aria-hidden="true" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
