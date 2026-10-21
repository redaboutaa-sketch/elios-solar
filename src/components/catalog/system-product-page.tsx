import Link from "next/link";
import { Check, Info, MessageCircle, Plus, Ruler, FileText } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ProductTabs } from "@/components/catalog/product-tabs";
import { DocumentList } from "@/components/catalog/document-list";
import { SourcedSpecTable } from "@/components/catalog/sourced-spec-table";
import { SystemGallery } from "@/components/catalog/system-gallery";
import { categoryByKey, configuratorHref, type CategoryKey } from "@/domain/categories";
import { MOUNTING_FR, dimRangeText } from "@/domain/system";
import { formatSystemPrice } from "@/domain/system-pricing";
import type { PublishedMedia } from "@/server/media/types";
import type { PublicDocument } from "@/server/documents/queries";
import type { SystemFamily } from "@/server/catalog/systems";
import { BRAND } from "@/config/brand";

const USAGE: Record<string, string> = {
  pergola: "Couvrir une terrasse, contre la maison ou en espace libre, et régler l'ensoleillement par l'orientation des lames.",
  screen: "Protéger une baie ou une façade du soleil et de la chaleur tout en gardant la vue vers l'extérieur.",
  awning: "Ombrager une terrasse à la demande ; la toile se replie dans le coffre quand le store n'est pas utilisé.",
  roof_blind: "Ombrager une toiture vitrée.",
};

export function SystemProductPage({ family: f, category, media, docs }: { family: SystemFamily; category: CategoryKey; media: PublishedMedia[]; docs: PublicDocument[] }) {
  const cat = categoryByKey(category)!;
  const r = f.rules;
  const d = r.dims;
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: f.name, description: f.shortDescription, ...(f.fromPrice ? { offers: { "@type": "AggregateOffer", priceCurrency: f.fromPrice.currency, lowPrice: (f.fromPrice.amountMinor / 100).toFixed(2) } } : {}), image: media.slice(0, 3).map((m) => `${BRAND.siteUrl}${m.path}`) };
  const tabs = [
    {
      id: "description", label: "Description", content: (
        <div className="prose-shop">
          <p>{f.description}</p>
          <h3>Usage</h3>
          <p>{USAGE[r.type]}</p>
          <p className="text-sm">Le prix affiché correspond à la structure aux dimensions choisies ; les options et équipements sont chiffrés sur devis. Une option visible sur une photo n'est jamais incluse d'office.</p>
        </div>
      ),
    },
    { id: "caracteristiques", label: "Caractéristiques", content: <SourcedSpecTable specs={f.specValues} /> },
    {
      id: "dimensions", label: "Dimensions et pose", content: (
        <div className="prose-shop" data-testid="system-dimensions">
          <ul>
            <li>{d.width.label} : {dimRangeText(d.width)}{d.width.confirmAboveMm ? ` — au-delà de ${(d.width.confirmAboveMm / 1000).toLocaleString("fr-FR")} m : ${d.width.confirmNote}, validé au devis.` : ""}</li>
            {d.depth && <li>{d.depth.label} : {dimRangeText(d.depth)}</li>}
            {d.height && <li>{d.height.label} : {dimRangeText(d.height)}{d.height.confirmAboveMm ? ` — au-delà de ${(d.height.confirmAboveMm / 1000).toLocaleString("fr-FR")} m : ${d.height.confirmNote}, validé au devis.` : ""}</li>}
            {r.depthWidthMin?.map((c) => <li key={c.depthMm}>Avancée {(c.depthMm / 1000).toLocaleString("fr-FR")} m : largeur minimale {(c.widthMinMm / 1000).toLocaleString("fr-FR")} m</li>)}
            {r.controls?.some((c) => c.minWidthMm) && <li>La largeur minimale dépend du moteur choisi (voir « Commande »).</li>}
            {r.modules && <li>Module : jusqu'à {(r.modules.maxSingleWidthMm / 1000).toLocaleString("fr-FR")} m de largeur ; plusieurs modules : {r.modules.multiModule === "documented" ? "possible, composition établie au devis" : "non documenté, étude au devis"}</li>}
          </ul>
          <h3>Pose</h3>
          <ul>{r.mountings.map((m) => <li key={m.code}>{m.label} ({MOUNTING_FR[m.code]}){m.status === "to_confirm" ? " — à confirmer" : ""}</li>)}</ul>
          <p className="text-sm">La 3D du configurateur reprend vos cotes à titre indicatif : elle ne constitue ni un plan d'exécution ni une validation structurelle.</p>
        </div>
      ),
    },
    {
      id: "teintes", label: r.fabrics?.length ? "Teintes et toiles" : "Teintes", content: (
        <div className="space-y-4" data-testid="system-finishes">
          <ul className="flex flex-wrap gap-2">{r.finishes.map((c) => <li key={c.code} className="flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1.5 text-sm"><span aria-hidden="true" className="size-5 rounded-full border border-sand-300" style={{ background: c.swatch ?? "repeating-linear-gradient(45deg,#ddd,#ddd 3px,#fff 3px,#fff 6px)" }} />{c.label}</li>)}</ul>
          {r.customFinish && <p className="text-sm">{r.customFinish.label} : {r.customFinish.note}.</p>}
          <p className="text-xs text-stone-700">Pastilles d'aperçu indicatives : vérifiez la teinte sur nuancier. Les couleurs du site HELIOSTORES ne sont pas des teintes de produit.</p>
          {r.fabrics?.length ? <><h3 className="font-medium">Toiles</h3><ul className="list-disc pl-5 text-sm">{r.fabrics.map((x) => <li key={x.code}>{x.label}{x.status === "to_confirm" ? ` — ${x.note ?? "à confirmer"}` : ""}</li>)}</ul></> : null}
        </div>
      ),
    },
    {
      id: "commande", label: "Commande et installation", content: (
        <div className="prose-shop">
          {r.controls?.length ? <><h3>Commande</h3><ul>{r.controls.map((c) => <li key={c.code}>{c.label}{c.minWidthMm ? ` — largeur minimale du système ${c.minWidthMm / 10} cm` : ""}{c.cable ? `, ${c.cable}` : ""}{c.status === "to_confirm" ? ` — ${c.note ?? "à confirmer"}` : ""}</li>)}</ul></> : null}
          <h3>Installation</h3>
          <ul>{(r.notices ?? []).map((n) => <li key={n}>{n}</li>)}<li>Pose professionnelle possible : zones et conditions établies au devis.</li></ul>
        </div>
      ),
    },
    ...(docs.length ? [{ id: "documents", label: `Documents (${docs.length})`, content: <DocumentList docs={docs} /> }] : []),
    ...(f.faqItems.length ? [{ id: "faq", label: "Questions", content: <div className="divide-y divide-sand-200">{f.faqItems.map((q) => <details key={q.q} className="py-3"><summary className="cursor-pointer font-medium">{q.q}</summary><p className="mt-2 text-stone-800">{q.a}</p></details>)}</div> }] : []),
  ];
  return (
    <div className="container-x py-6 sm:py-8">
      <Breadcrumbs items={[{ href: cat.href, label: cat.label }, { label: f.name }]} />
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12">
        <div className="min-w-0">
          <SystemGallery name={f.name} media={media} />
          <section className="mt-10 grid gap-4 sm:grid-cols-2" aria-label="Équipement" data-testid="system-included-options">
            <div className="rounded-xl border border-sand-200 bg-white p-5">
              <h2 className="font-display text-lg font-semibold">Inclus</h2>
              <ul className="mt-3 space-y-2 text-sm">{r.included.map((i) => <li key={i.label} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /><span>{i.label}{i.status === "to_confirm" ? " (à confirmer)" : ""}</span></li>)}</ul>
            </div>
            <div className="rounded-xl border border-dashed border-sand-300 bg-sand-50 p-5">
              <h2 className="font-display text-lg font-semibold">En option</h2>
              {r.options.length > 0 ? <ul className="mt-3 space-y-2 text-sm">{r.options.map((o) => <li key={o.code} className="flex gap-2"><Plus className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" /><span>{o.label}{o.status === "to_confirm" ? " — à confirmer au devis" : ""}{o.note && o.status !== "to_confirm" ? ` — ${o.note}` : ""}</span></li>)}</ul> : <p className="mt-3 text-sm text-stone-700">Aucune option documentée.</p>}
              <p className="mt-4 text-xs text-stone-700">Options chiffrées sur devis ; une option visible sur une photo n'est jamais incluse d'office.</p>
            </div>
          </section>
          <section className="mt-10"><ProductTabs tabs={tabs} /></section>
        </div>
        <aside className="min-w-0 self-start lg:sticky lg:top-24 rounded-2xl border border-sand-200 bg-white p-6 shadow-soft">
          <p className="eyebrow">{cat.singular}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{f.name}</h1>
          <p className="mt-2 text-stone-800 text-pretty">{f.shortDescription}</p>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-sand-200 pt-4 text-sm">
            <dt className="text-stone-700">Référence</dt><dd>{f.supplierRef}</dd>
            <dt className="text-stone-700">{d.width.label}</dt><dd>{dimRangeText(d.width)}</dd>
            {d.depth && <><dt className="text-stone-700">{d.depth.label}</dt><dd>{dimRangeText(d.depth)}</dd></>}
            {d.height && <><dt className="text-stone-700">{d.height.label}</dt><dd>{dimRangeText(d.height)}</dd></>}
          </dl>
          {f.fromPrice ? (
            <p data-testid="from-price" className="mt-5 rounded-xl bg-brand-50 p-4 text-sm"><span className="block text-xs text-stone-700">À partir de</span><strong className="font-display text-3xl font-semibold tabular-nums">{formatSystemPrice(f.fromPrice.amountMinor, f.fromPrice.currency, f.fromPrice.taxBasis)}</strong><span className="mt-1 block text-xs text-stone-700">Prix selon vos dimensions, calculé dans le configurateur ; options, pose et livraison chiffrées au devis.</span></p>
          ) : (
            <p data-testid="price-on-quote" className="mt-5 flex gap-2 rounded-xl bg-brand-50 p-4 text-sm"><Info className="size-4 mt-0.5 shrink-0 text-brand-700" aria-hidden="true" /><span><strong>Prix sur devis.</strong> Configurez vos dimensions pour recevoir votre devis.</span></p>
          )}
          <Link href={configuratorHref(f.slug)} className="btn-accent w-full mt-5 text-base">Configurer à mes cotes</Link>
          <Link href={`/devis?produit=${f.slug}`} className="btn-secondary w-full mt-2">Demander un devis</Link>
          <Link href="/contact" className="btn-ghost w-full mt-2">Parler à un conseiller</Link>
        </aside>
      </div>
      <section className="mt-16 grid gap-6 border-t border-sand-200 pt-10 sm:grid-cols-3" aria-labelledby="accompagnement">
        <h2 id="accompagnement" className="sr-only">Accompagnement</h2>
        {[
          [Ruler, "Configurer à vos cotes", "Dimensions, pose, teinte et équipements, avec vue 3D indicative et prix de la structure.", configuratorHref(f.slug), "Ouvrir le configurateur"],
          [FileText, "Devis pour le reste", "Options, pose, livraison et points à confirmer sont chiffrés par devis.", `/devis?produit=${f.slug}`, "Décrire mon projet"],
          [MessageCircle, "Un conseiller vous accompagne", "Il vérifie la faisabilité, les fixations et les points à confirmer.", "/contact", "Nous contacter"],
        ].map(([Icon, t, d, href, cta]) => { const I = Icon as typeof Ruler; return (
          <div key={String(t)}><I className="size-6 text-brand-700" aria-hidden="true" /><h3 className="mt-3 font-display text-lg font-semibold">{String(t)}</h3><p className="mt-1 text-sm text-stone-700">{String(d)}</p><Link href={String(href)} className="mt-2 inline-block text-sm font-medium text-brand-700 underline-offset-4 hover:underline">{String(cta)}</Link></div>
        ); })}
      </section>
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-sand-300 bg-white/95 backdrop-blur p-3 flex items-center justify-between gap-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div><p className="text-xs text-stone-700">{f.name}</p><p className="text-sm font-semibold">{f.fromPrice ? `À partir de ${formatSystemPrice(f.fromPrice.amountMinor, f.fromPrice.currency, f.fromPrice.taxBasis)}` : "Prix sur devis"}</p></div>
        <Link href={configuratorHref(f.slug)} className="btn-accent">Configurer</Link>
      </div>
      <div className="lg:hidden h-20" aria-hidden="true" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
