import Link from "@/i18n/link";
import { withholdsSupplierMedia } from "@/domain/system";
import { Check, Info, MessageCircle, Plus, Ruler, FileText, Truck } from "lucide-react";
import { DELIVERY_LEAD_TIME, DELIVERY_TERMS_IN_QUOTE } from "@/domain/delivery";
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
import { defaultSceneModel } from "@/server/catalog/scene-preview";
import { MediaImage } from "@/components/ui/media-image";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, productJsonLd } from "@/server/seo/structured-data";
import { productNature } from "@/server/seo/product-nature";
import { LOCALE_DEFS } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getLocale, getT } from "@/i18n/server";

/** Guides par type de produit (libellés : src/i18n/messages/catalog.ts, product.guides). */
const GUIDES_BY_TYPE: Record<string, string[]> = {
  pergola: ["/guides/choisir-sa-pergola", "/guides/prise-de-mesures", "/guides/preparation-projet"],
  screen: ["/guides/choisir-son-screen-exterieur", "/guides/choisir-toile-et-motorisation", "/guides/prise-de-mesures"],
  roof_blind: ["/guides/choisir-son-screen-exterieur", "/guides/prise-de-mesures"],
  awning: ["/guides/comparer-protections-solaires", "/guides/choisir-toile-et-motorisation", "/guides/prise-de-mesures"],
  insect_screen: ["/guides/choisir-sa-moustiquaire", "/guides/prise-de-mesures"],
};

export async function SystemProductPage({ family: f, category, media: allMedia, docs }: { family: SystemFamily; category: CategoryKey; media: PublishedMedia[]; docs: PublicDocument[] }) {
  // demande d'étude : correspondance avec le système du fabricant non confirmée → aucun visuel du système candidat
  const media = withholdsSupplierMedia(f.rules) ? [] : allMedia;
  const cat = categoryByKey(category)!;
  const msg = await getT("catalog");
  const t = msg.product;
  const catLabel = (await getT("layout")).categories[category];
  const singular = msg.categories[category].singular;
  const intl = LOCALE_DEFS[await getLocale()].intl;
  const m1 = (mm: number) => (mm / 1000).toLocaleString(intl);
  const guideLabels: Record<string, string> = t.guides;
  const usage: Record<string, string> = t.usage;
  const scene = await defaultSceneModel(f.slug);
  const details = media.filter((m) => m.role === "detail" && (m.width ?? 0) >= 500).slice(0, 4);
  const r = f.rules;
  const d = r.dims;
  const path = `${cat.href}/${f.slug}`;
  const nature = productNature(r);
  // aucune offre pour un produit sur devis (jamais de prix 0) ; images : photos et rendus publiés, pas les documents
  const jsonLd = [
    productJsonLd(BRAND.siteUrl, { name: f.name, description: f.shortDescription, path, category: nature ?? singular, images: media.filter((m) => m.nature !== "DOCUMENT" && m.nature !== "VIDEO").slice(0, 3).map((m) => m.path), price: f.fromPrice ? { amountMinor: f.fromPrice.amountMinor, currency: f.fromPrice.currency, taxBasis: f.fromPrice.taxBasis === "TTC" ? "TTC" : f.fromPrice.taxBasis === "HT" ? "HT" : null } : null }),
    breadcrumbJsonLd(BRAND.siteUrl, [{ name: catLabel, path: cat.href }, { name: f.name, path }]),
  ];
  const guides = (GUIDES_BY_TYPE[r.type] ?? []).map((href) => [href, guideLabels[href] ?? href] as const);
  const tabs = [
    {
      id: "description", label: t.tabs.description, content: (
        <div className="prose-shop">
          <p>{f.description}</p>
          <h3>{t.usageTitle}</h3>
          <p>{usage[r.type]}</p>
          <p className="text-sm">{f.fromPrice || f.pricedOnline ? t.priceShown : t.priceQuote} {t.optionPhoto}</p>
        </div>
      ),
    },
    { id: "caracteristiques", label: t.tabs.specs, content: <SourcedSpecTable specs={f.specValues} /> },
    {
      id: "dimensions", label: t.tabs.dimensions, content: (
        <div className="prose-shop" data-testid="system-dimensions">
          <ul>
            <li>{d.width.label} : {dimRangeText(d.width)}{d.width.confirmAboveMm ? fmt(t.beyond, { value: m1(d.width.confirmAboveMm), note: d.width.confirmNote ?? "" }) : ""}</li>
            {d.depth && <li>{d.depth.label} : {dimRangeText(d.depth)}</li>}
            {d.height && <li>{d.height.label} : {dimRangeText(d.height)}{d.height.confirmAboveMm ? fmt(t.beyond, { value: m1(d.height.confirmAboveMm), note: d.height.confirmNote ?? "" }) : ""}</li>}
            {r.depthWidthMin?.map((c) => <li key={c.depthMm}>{fmt(t.depthMinWidth, { depth: m1(c.depthMm), width: m1(c.widthMinMm) })}</li>)}
            {r.controls?.some((c) => c.minWidthMm) && <li>{t.minWidthMotor}</li>}
            {r.modules && <li>{fmt(t.module, { width: m1(r.modules.maxSingleWidthMm), multi: r.modules.multiModule === "documented" ? t.multiDocumented : t.multiUndocumented })}</li>}
          </ul>
          <h3>{t.mountingTitle}</h3>
          <ul>{r.mountings.map((m) => <li key={m.code}>{m.label} ({MOUNTING_FR[m.code]}){m.status === "to_confirm" ? t.toConfirmDash : ""}</li>)}</ul>
          <p className="text-sm">{t.disclaimer3d}</p>
        </div>
      ),
    },
    {
      id: "teintes", label: r.fabrics?.length ? t.tabs.finishesFabrics : t.tabs.finishes, content: (
        <div className="space-y-4" data-testid="system-finishes">
          <ul className="flex flex-wrap gap-2">{r.finishes.map((c) => <li key={c.code} className="flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1.5 text-sm"><span aria-hidden="true" className="size-5 rounded-full border border-sand-300" style={{ background: c.swatch ?? "repeating-linear-gradient(45deg,#ddd,#ddd 3px,#fff 3px,#fff 6px)" }} />{c.label}</li>)}</ul>
          {r.customFinish && <p className="text-sm">{r.customFinish.label} : {r.customFinish.note}.</p>}
          <p className="text-xs text-stone-700">{t.swatchNote}</p>
          {r.fabrics?.length ? <><h3 className="font-medium">{t.fabricsTitle}</h3><ul className="list-disc pl-5 text-sm">{r.fabrics.map((x) => <li key={x.code}>{x.label}{x.status === "to_confirm" ? ` — ${x.note ?? t.toConfirm}` : ""}</li>)}</ul></> : null}
        </div>
      ),
    },
    {
      id: "commande", label: t.tabs.control, content: (
        <div className="prose-shop">
          {r.controls?.length ? <><h3>{t.controlTitle}</h3><ul>{r.controls.map((c) => <li key={c.code}>{c.label}{c.minWidthMm ? fmt(t.systemMinWidth, { cm: c.minWidthMm / 10 }) : ""}{c.cable ? `, ${c.cable}` : ""}{c.status === "to_confirm" ? ` — ${c.note ?? t.toConfirm}` : ""}</li>)}</ul></> : null}
          <h3>{t.installTitle}</h3>
          <ul>{(r.notices ?? []).map((n) => <li key={n}>{n}</li>)}<li>{t.proInstall}</li></ul>
        </div>
      ),
    },
    ...(docs.length ? [{ id: "documents", label: fmt(t.tabs.documents, { count: docs.length }), content: <DocumentList docs={docs} /> }] : []),
    ...(f.faqItems.length ? [{ id: "faq", label: t.tabs.faq, content: <div className="divide-y divide-sand-200">{f.faqItems.map((q) => <details key={q.q} className="py-3"><summary className="cursor-pointer font-medium">{q.q}</summary><p className="mt-2 text-stone-800">{q.a}</p></details>)}</div> }] : []),
  ];
  return (
    <div className="container-x py-6 sm:py-8">
      <Breadcrumbs items={[{ href: cat.href, label: catLabel }, { label: f.name }]} />
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12">
        <div className="min-w-0">
          <SystemGallery name={f.name} media={media} scene={scene} />
          <section className="mt-10 grid gap-4 sm:grid-cols-2" aria-label={t.equipment} data-testid="system-included-options">
            <div className="border border-sand-200 bg-white p-5">
              <h2 className="font-display text-lg font-semibold">{t.included}</h2>
              <ul className="mt-3 space-y-2 text-sm">{r.included.map((i) => <li key={i.label} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /><span>{i.label}{i.status === "to_confirm" ? t.toConfirmParen : ""}{i.description && <span className="block text-xs text-stone-700">{i.description}</span>}</span></li>)}</ul>
            </div>
            <div className="border border-dashed border-sand-300 bg-sand-50 p-5">
              <h2 className="font-display text-lg font-semibold">{t.optional}</h2>
              {r.options.length > 0 ? <ul className="mt-3 space-y-2 text-sm">{r.options.map((o) => <li key={o.code} className="flex gap-2"><Plus className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" /><span>{o.label}{o.status === "to_confirm" ? t.toConfirmQuote : ""}{o.note && o.status !== "to_confirm" ? ` — ${o.note}` : ""}{o.description && <span className="block text-xs text-stone-700">{o.description}</span>}</span></li>)}</ul> : <p className="mt-3 text-sm text-stone-700">{t.noOption}</p>}
              <p className="mt-4 text-xs text-stone-700">{t.optionsNote}</p>
            </div>
          </section>
          <section className="mt-10"><ProductTabs tabs={tabs} /></section>
        </div>
        <aside className="min-w-0 self-start border border-sand-200 bg-white p-6 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
          <p className="eyebrow">{singular}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{f.name}</h1>
          <p className="mt-2 text-stone-800 text-pretty">{f.shortDescription}</p>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-sand-200 pt-4 text-sm">
            <dt className="text-stone-700">{t.range}</dt><dd>{catLabel}</dd>
            <dt className="text-stone-700">{d.width.label}</dt><dd>{dimRangeText(d.width)}</dd>
            {d.depth && <><dt className="text-stone-700">{d.depth.label}</dt><dd>{dimRangeText(d.depth)}</dd></>}
            {d.height && <><dt className="text-stone-700">{d.height.label}</dt><dd>{dimRangeText(d.height)}</dd></>}
          </dl>
          <p data-testid="delivery-lead-time" className="mt-3 flex gap-2 text-sm text-stone-800"><Truck className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" /><span>{DELIVERY_LEAD_TIME} {DELIVERY_TERMS_IN_QUOTE}</span></p>
          {f.fromPrice ? (
            <p data-testid="from-price" className="mt-5 bg-brand-50 p-4 text-sm"><span className="block text-xs text-stone-700">{t.from}</span><strong className="font-display text-3xl font-semibold tabular-nums">{formatSystemPrice(f.fromPrice.amountMinor, f.fromPrice.currency, f.fromPrice.taxBasis)}</strong><span className="mt-1 block text-xs text-stone-700">{t.fromPriceNote}</span></p>
          ) : (
            f.pricedOnline ? <p data-testid="price-configurator" className="mt-5 flex gap-2 bg-brand-50 p-4 text-sm"><Info className="size-4 mt-0.5 shrink-0 text-brand-700" aria-hidden="true" /><span><strong>{t.priceConfigurator}</strong> {t.priceConfiguratorText}</span></p> :
            <p data-testid="price-on-quote" className="mt-5 flex gap-2 bg-brand-50 p-4 text-sm"><Info className="size-4 mt-0.5 shrink-0 text-brand-700" aria-hidden="true" /><span><strong>{t.priceOnQuote}</strong> {t.priceOnQuoteText}</span></p>
          )}
          <Link href={configuratorHref(f.slug)} className="btn-accent w-full mt-5 text-base">{t.configureToSize}</Link>
          <Link href={`/devis?produit=${f.slug}`} className="btn-secondary w-full mt-2">{t.requestQuote}</Link>
          <Link href="/contact" className="btn-ghost w-full mt-2">{t.talkAdvisor}</Link>
        </aside>
      </div>
      <section className="mt-16 border-t border-sand-200 pt-10" aria-labelledby="essentiel" data-testid="product-key-facts">
        <h2 id="essentiel" className="font-display text-display font-semibold">{fmt(t.keyFactsTitle, { name: f.name })}</h2>
        <p className="mt-2 max-w-3xl text-stone-800">{fmt(t.keyFactsIntro, { name: f.name, range: catLabel, nature: nature ? fmt(t.natureSep, { nature: nature.toLowerCase() }) : "" })}</p>
        <div className="mt-6 max-w-4xl overflow-x-auto border border-sand-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{fmt(t.keyFactsCaption, { name: f.name })}</caption>
            <tbody className="divide-y divide-sand-200">
              {nature && <tr><th scope="row" className="w-1/3 p-3 font-medium text-stone-700">{t.productType}</th><td className="p-3">{nature}</td></tr>}
              <tr><th scope="row" className="p-3 font-medium text-stone-700">{t.manufacture}</th><td className="p-3">{r.fixedSizes?.length ? fmt(t.fixedSizes, { list: r.fixedSizes.map((z) => z.label).join(" ; ") }) : t.madeToMeasure}</td></tr>
              <tr><th scope="row" className="p-3 font-medium text-stone-700">{d.width.label}</th><td className="p-3 tabular-nums">{dimRangeText(d.width)}</td></tr>
              {d.depth && <tr><th scope="row" className="p-3 font-medium text-stone-700">{d.depth.label}</th><td className="p-3 tabular-nums">{dimRangeText(d.depth)}{d.depth.note ? ` — ${d.depth.note}` : ""}</td></tr>}
              {d.height && <tr><th scope="row" className="p-3 font-medium text-stone-700">{d.height.label}</th><td className="p-3 tabular-nums">{dimRangeText(d.height)}</td></tr>}
              <tr><th scope="row" className="p-3 font-medium text-stone-700">{t.mounting}</th><td className="p-3">{r.mountings.map((m) => `${m.label}${m.status === "to_confirm" ? t.toConfirmParen : ""}`).join(" ; ")}</td></tr>
              {r.controls?.length ? <tr><th scope="row" className="p-3 font-medium text-stone-700">{t.control}</th><td className="p-3">{r.controls.map((c) => `${c.label}${c.status === "to_confirm" ? t.toConfirmParen : ""}`).join(" ; ")}</td></tr> : null}
              {r.wind?.text && <tr><th scope="row" className="p-3 font-medium text-stone-700">{t.wind}</th><td className="p-3">{r.wind.text}{r.wind.status === "to_confirm" ? t.toConfirmParen : ""}</td></tr>}
              <tr><th scope="row" className="p-3 font-medium text-stone-700">{t.price}</th><td className="p-3">{f.fromPrice ? fmt(t.priceFromStructure, { price: formatSystemPrice(f.fromPrice.amountMinor, f.fromPrice.currency, f.fromPrice.taxBasis) }) : f.pricedOnline ? t.priceConfigurator : t.onQuote}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-700">{t.dimsNote}</p>
        {guides.length > 0 && <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm"><span className="font-medium">{t.guidesLabel}</span>{guides.map(([href, label]) => <Link key={href} href={href} className="link-brand">{label}</Link>)}</p>}
      </section>
      {details.length > 0 && (
        <section className="mt-16 border-t border-sand-200 pt-10" aria-labelledby="en-detail">
          <h2 id="en-detail" className="font-display text-display"><span className="font-normal">{f.name}</span> <span className="font-semibold">{t.inDetail}</span></h2>
          <ul className="mt-8 divide-y divide-sand-200 border-y border-sand-200">
            {details.map((m, k) => (
              <li key={m.id} className={`grid items-center gap-6 py-6 md:gap-10 ${k % 2 ? "md:grid-cols-[1fr_minmax(0,22rem)]" : "md:grid-cols-[minmax(0,22rem)_1fr]"}`}>
                <div className={`relative aspect-[4/3] border border-sand-200 bg-white ${k % 2 ? "md:order-2" : ""}`}><MediaImage media={m} sizes="(min-width: 768px) 22rem, 92vw" className="absolute inset-0 size-full object-contain p-3" /></div>
                <div><h3 className="font-display text-xl font-semibold">{m.caption || m.title}</h3><p className="mt-1 text-sm text-stone-700">{fmt(t.detailFrom, { nature: m.nature === "PHOTO" ? msg.natures.PHOTO : m.nature === "RENDER" ? msg.natures.RENDER : msg.natures.ILLUSTRATION, visible: m.visibleOptions ? fmt(t.detailVisible, { options: m.visibleOptions }) : "" })}</p></div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-16 grid gap-6 border-t border-sand-200 pt-10 sm:grid-cols-3" aria-labelledby="accompagnement">
        <h2 id="accompagnement" className="sr-only">{t.support.title}</h2>
        {[
          [Ruler, t.support.configureTitle, f.fromPrice || f.pricedOnline ? t.support.configurePrice : t.support.configureQuote, configuratorHref(f.slug), t.support.configureCta],
          [FileText, t.support.quoteTitle, t.support.quoteText, `/devis?produit=${f.slug}`, t.support.quoteCta],
          [MessageCircle, t.support.advisorTitle, t.support.advisorText, "/contact", t.support.advisorCta],
        ].map(([Icon, title, d, href, cta]) => { const I = Icon as typeof Ruler; return (
          <div key={String(title)}><I className="size-6 text-brand-700" aria-hidden="true" /><h3 className="mt-3 font-display text-lg font-semibold">{String(title)}</h3><p className="mt-1 text-sm text-stone-700">{String(d)}</p><Link href={String(href)} className="mt-2 inline-block text-sm font-medium text-brand-700 underline-offset-4 hover:underline">{String(cta)}</Link></div>
        ); })}
      </section>
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-sand-300 bg-white/95 backdrop-blur p-3 flex items-center justify-between gap-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div><p className="text-xs text-stone-700">{f.name}</p><p className="text-sm font-semibold">{f.fromPrice ? fmt(t.mobileFrom, { price: formatSystemPrice(f.fromPrice.amountMinor, f.fromPrice.currency, f.fromPrice.taxBasis) }) : f.pricedOnline ? t.priceConfigurator : t.mobileOnQuote}</p></div>
        <Link href={configuratorHref(f.slug)} className="btn-accent">{t.configure}</Link>
      </div>
      <div className="lg:hidden h-20" aria-hidden="true" />
      <JsonLd data={jsonLd} />
    </div>
  );
}
