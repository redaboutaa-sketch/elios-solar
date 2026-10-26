import Link from "next/link";
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

const GUIDES_BY_TYPE: Record<string, Array<[string, string]>> = {
  pergola: [["/guides/choisir-sa-pergola", "Choisir sa pergola"], ["/guides/prise-de-mesures", "Prise de mesures"], ["/guides/preparation-projet", "Préparer son projet"]],
  screen: [["/guides/choisir-son-screen-exterieur", "Choisir son screen extérieur"], ["/guides/choisir-toile-et-motorisation", "Toile et motorisation"], ["/guides/prise-de-mesures", "Prise de mesures"]],
  roof_blind: [["/guides/choisir-son-screen-exterieur", "Choisir son screen extérieur"], ["/guides/prise-de-mesures", "Prise de mesures"]],
  awning: [["/guides/comparer-protections-solaires", "Comparer les protections solaires"], ["/guides/choisir-toile-et-motorisation", "Toile et motorisation"], ["/guides/prise-de-mesures", "Prise de mesures"]],
  insect_screen: [["/guides/choisir-sa-moustiquaire", "Choisir sa moustiquaire"], ["/guides/prise-de-mesures", "Prise de mesures"]],
};

const USAGE: Record<string, string> = {
  pergola: "Couvrir une terrasse, contre la maison ou en espace libre, et régler l'ensoleillement par l'orientation des lames.",
  screen: "Protéger une baie ou une façade du soleil et de la chaleur tout en gardant la vue vers l'extérieur.",
  awning: "Ombrager une terrasse à la demande ; la toile se replie dans le coffre quand le store n'est pas utilisé.",
  roof_blind: "Ombrager une toiture vitrée.",
};

export async function SystemProductPage({ family: f, category, media: allMedia, docs }: { family: SystemFamily; category: CategoryKey; media: PublishedMedia[]; docs: PublicDocument[] }) {
  // demande d'étude : correspondance avec le système du fabricant non confirmée → aucun visuel du système candidat
  const media = f.rules.studyOnly ? [] : allMedia;
  const cat = categoryByKey(category)!;
  const scene = await defaultSceneModel(f.slug);
  const details = media.filter((m) => m.role === "detail" && (m.width ?? 0) >= 500).slice(0, 4);
  const r = f.rules;
  const d = r.dims;
  const path = `${cat.href}/${f.slug}`;
  const nature = productNature(r);
  // aucune offre pour un produit sur devis (jamais de prix 0) ; images : photos et rendus publiés, pas les documents
  const jsonLd = [
    productJsonLd(BRAND.siteUrl, { name: f.name, description: f.shortDescription, path, category: nature ?? cat.singular, images: media.filter((m) => m.nature !== "DOCUMENT" && m.nature !== "VIDEO").slice(0, 3).map((m) => m.path), price: f.fromPrice ? { amountMinor: f.fromPrice.amountMinor, currency: f.fromPrice.currency, taxBasis: f.fromPrice.taxBasis === "TTC" ? "TTC" : f.fromPrice.taxBasis === "HT" ? "HT" : null } : null }),
    breadcrumbJsonLd(BRAND.siteUrl, [{ name: cat.label, path: cat.href }, { name: f.name, path }]),
  ];
  const guides = GUIDES_BY_TYPE[r.type] ?? [];
  const tabs = [
    {
      id: "description", label: "Présentation", content: (
        <div className="prose-shop">
          <p>{f.description}</p>
          <h3>Usage</h3>
          <p>{USAGE[r.type]}</p>
          <p className="text-sm">{f.fromPrice ? "Le prix affiché correspond à la structure aux dimensions choisies ; les options et équipements sont chiffrés sur devis." : "Prix sur devis : la structure, les options, la pose et la livraison sont chiffrées après étude de votre configuration."} Une option visible sur une photo n'est jamais incluse d'office.</p>
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
      id: "teintes", label: r.fabrics?.length ? "Finitions et toiles" : "Finitions", content: (
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
          <SystemGallery name={f.name} media={media} scene={scene} />
          <section className="mt-10 grid gap-4 sm:grid-cols-2" aria-label="Équipement" data-testid="system-included-options">
            <div className="border border-sand-200 bg-white p-5">
              <h2 className="font-display text-lg font-semibold">Inclus</h2>
              <ul className="mt-3 space-y-2 text-sm">{r.included.map((i) => <li key={i.label} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /><span>{i.label}{i.status === "to_confirm" ? " (à confirmer)" : ""}{i.description && <span className="block text-xs text-stone-700">{i.description}</span>}</span></li>)}</ul>
            </div>
            <div className="border border-dashed border-sand-300 bg-sand-50 p-5">
              <h2 className="font-display text-lg font-semibold">En option</h2>
              {r.options.length > 0 ? <ul className="mt-3 space-y-2 text-sm">{r.options.map((o) => <li key={o.code} className="flex gap-2"><Plus className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" /><span>{o.label}{o.status === "to_confirm" ? " — à confirmer au devis" : ""}{o.note && o.status !== "to_confirm" ? ` — ${o.note}` : ""}{o.description && <span className="block text-xs text-stone-700">{o.description}</span>}</span></li>)}</ul> : <p className="mt-3 text-sm text-stone-700">Aucune option documentée.</p>}
              <p className="mt-4 text-xs text-stone-700">Options chiffrées sur devis ; une option visible sur une photo n'est jamais incluse d'office.</p>
            </div>
          </section>
          <section className="mt-10"><ProductTabs tabs={tabs} /></section>
        </div>
        <aside className="min-w-0 self-start border border-sand-200 bg-white p-6 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
          <p className="eyebrow">{cat.singular}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{f.name}</h1>
          <p className="mt-2 text-stone-800 text-pretty">{f.shortDescription}</p>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-sand-200 pt-4 text-sm">
            <dt className="text-stone-700">Gamme</dt><dd>{cat.label}</dd>
            <dt className="text-stone-700">{d.width.label}</dt><dd>{dimRangeText(d.width)}</dd>
            {d.depth && <><dt className="text-stone-700">{d.depth.label}</dt><dd>{dimRangeText(d.depth)}</dd></>}
            {d.height && <><dt className="text-stone-700">{d.height.label}</dt><dd>{dimRangeText(d.height)}</dd></>}
          </dl>
          <p data-testid="delivery-lead-time" className="mt-3 flex gap-2 text-sm text-stone-800"><Truck className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" /><span>{DELIVERY_LEAD_TIME} {DELIVERY_TERMS_IN_QUOTE}</span></p>
          {f.fromPrice ? (
            <p data-testid="from-price" className="mt-5 bg-brand-50 p-4 text-sm"><span className="block text-xs text-stone-700">À partir de</span><strong className="font-display text-3xl font-semibold tabular-nums">{formatSystemPrice(f.fromPrice.amountMinor, f.fromPrice.currency, f.fromPrice.taxBasis)}</strong><span className="mt-1 block text-xs text-stone-700">Prix selon vos dimensions, calculé dans le configurateur ; options, pose et livraison chiffrées au devis.</span></p>
          ) : (
            <p data-testid="price-on-quote" className="mt-5 flex gap-2 bg-brand-50 p-4 text-sm"><Info className="size-4 mt-0.5 shrink-0 text-brand-700" aria-hidden="true" /><span><strong>Prix sur devis.</strong> Configurez vos dimensions pour recevoir votre devis.</span></p>
          )}
          <Link href={configuratorHref(f.slug)} className="btn-accent w-full mt-5 text-base">Configurer à mes cotes</Link>
          <Link href={`/devis?produit=${f.slug}`} className="btn-secondary w-full mt-2">Demander un devis</Link>
          <Link href="/contact" className="btn-ghost w-full mt-2">Parler à un conseiller</Link>
        </aside>
      </div>
      <section className="mt-16 border-t border-sand-200 pt-10" aria-labelledby="essentiel" data-testid="product-key-facts">
        <h2 id="essentiel" className="font-display text-display font-semibold">{f.name} : l&apos;essentiel</h2>
        <p className="mt-2 max-w-3xl text-stone-800">{f.name} fait partie de la gamme {cat.label} HELIOSTORES{nature ? ` : ${nature.toLowerCase()}` : ""}. Les caractéristiques ci-dessous sont celles de la documentation du modèle.</p>
        <div className="mt-6 max-w-4xl overflow-x-auto border border-sand-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Caractéristiques principales de {f.name}</caption>
            <tbody className="divide-y divide-sand-200">
              {nature && <tr><th scope="row" className="w-1/3 p-3 font-medium text-stone-700">Type de produit</th><td className="p-3">{nature}</td></tr>}
              <tr><th scope="row" className="p-3 font-medium text-stone-700">Fabrication</th><td className="p-3">{r.fixedSizes?.length ? `tailles définies : ${r.fixedSizes.map((z) => z.label).join(" ; ")}` : "sur mesure, dans les limites ci-dessous"}</td></tr>
              <tr><th scope="row" className="p-3 font-medium text-stone-700">{d.width.label}</th><td className="p-3 tabular-nums">{dimRangeText(d.width)}</td></tr>
              {d.depth && <tr><th scope="row" className="p-3 font-medium text-stone-700">{d.depth.label}</th><td className="p-3 tabular-nums">{dimRangeText(d.depth)}{d.depth.note ? ` — ${d.depth.note}` : ""}</td></tr>}
              {d.height && <tr><th scope="row" className="p-3 font-medium text-stone-700">{d.height.label}</th><td className="p-3 tabular-nums">{dimRangeText(d.height)}</td></tr>}
              <tr><th scope="row" className="p-3 font-medium text-stone-700">Pose</th><td className="p-3">{r.mountings.map((m) => `${m.label}${m.status === "to_confirm" ? " (à confirmer)" : ""}`).join(" ; ")}</td></tr>
              {r.controls?.length ? <tr><th scope="row" className="p-3 font-medium text-stone-700">Commande</th><td className="p-3">{r.controls.map((c) => `${c.label}${c.status === "to_confirm" ? " (à confirmer)" : ""}`).join(" ; ")}</td></tr> : null}
              {r.wind?.text && <tr><th scope="row" className="p-3 font-medium text-stone-700">Vent</th><td className="p-3">{r.wind.text}{r.wind.status === "to_confirm" ? " (à confirmer)" : ""}</td></tr>}
              <tr><th scope="row" className="p-3 font-medium text-stone-700">Prix</th><td className="p-3">{f.fromPrice ? `à partir de ${formatSystemPrice(f.fromPrice.amountMinor, f.fromPrice.currency, f.fromPrice.taxBasis)} pour la structure` : "sur devis"}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-700">Dimensions en mètres, pour un module. Les valeurs « à confirmer » sont vérifiées au devis.</p>
        {guides.length > 0 && <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm"><span className="font-medium">Guides :</span>{guides.map(([href, label]) => <Link key={href} href={href} className="link-brand">{label}</Link>)}</p>}
      </section>
      {details.length > 0 && (
        <section className="mt-16 border-t border-sand-200 pt-10" aria-labelledby="en-detail">
          <h2 id="en-detail" className="font-display text-display"><span className="font-normal">{f.name}</span> <span className="font-semibold">en détail</span></h2>
          <ul className="mt-8 divide-y divide-sand-200 border-y border-sand-200">
            {details.map((m, k) => (
              <li key={m.id} className={`grid items-center gap-6 py-6 md:gap-10 ${k % 2 ? "md:grid-cols-[1fr_minmax(0,22rem)]" : "md:grid-cols-[minmax(0,22rem)_1fr]"}`}>
                <div className={`relative aspect-[4/3] border border-sand-200 bg-white ${k % 2 ? "md:order-2" : ""}`}><MediaImage media={m} sizes="(min-width: 768px) 22rem, 92vw" className="absolute inset-0 size-full object-contain p-3" /></div>
                <div><h3 className="font-display text-xl font-semibold">{m.caption || m.title}</h3><p className="mt-1 text-sm text-stone-700">{m.nature === "PHOTO" ? "Photographie" : m.nature === "RENDER" ? "Rendu" : "Schéma"} issu de la documentation du produit{m.visibleOptions ? ` ; visible sur l'image, non inclus d'office : ${m.visibleOptions}` : ""}.</p></div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-16 grid gap-6 border-t border-sand-200 pt-10 sm:grid-cols-3" aria-labelledby="accompagnement">
        <h2 id="accompagnement" className="sr-only">Accompagnement</h2>
        {[
          [Ruler, "Configurer à vos cotes", f.fromPrice ? "Dimensions, pose, teinte et équipements, avec visualisation indicative et prix de la structure." : "Dimensions, pose, teinte et équipements, avec visualisation indicative ; la configuration est jointe à votre demande de devis.", configuratorHref(f.slug), "Ouvrir le configurateur"],
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
      <JsonLd data={jsonLd} />
    </div>
  );
}
