import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { FamilySketch } from "@/components/illustrations/sketches";
import { MediaImage } from "@/components/ui/media-image";
import { categoryByKey, configuratorHref, productHref, type CategoryKey } from "@/domain/categories";
import { dimRangeText } from "@/domain/system";
import { INSECT_OPENING_FR } from "@/domain/scene-model";
import { formatSystemPrice } from "@/domain/system-pricing";
import type { listSystemFamilies } from "@/server/catalog/systems";
import { publishedMediaFor } from "@/server/media/queries";
import type { PublishedMedia } from "@/server/media/types";
import { FamilyGuide } from "@/components/catalog/family-guide";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/server/seo/structured-data";
import { BRAND } from "@/config/brand";

type Item = Awaited<ReturnType<typeof listSystemFamilies>>[number];

const priceText = (f: Item) => (f.fromPrice ? formatSystemPrice(f.fromPrice.amountMinor, f.fromPrice.currency, f.fromPrice.taxBasis) : null);

const manualPossible = (f: Item) => !!f.rules.controls?.some((c) => c.kind === "manual");
const lighting = (f: Item) => f.rules.options.filter((o) => o.group === "lighting" && !o.wish);

/**
 * Lecture « basique / intermédiaire / équipé » des stores bannes, calculée depuis les règles documentées : elle porte
 * sur l'équipement électrique (manœuvre, éclairage) et n'est PAS un classement du fabricant ; sur la protection de la
 * toile, l'ordre peut s'inverser (indiqué). Un modèle n'est jamais dédoublé en plusieurs produits.
 */
function EquipmentReading({ items }: { items: Item[] }) {
  const awnings = items.filter((f) => f.rules.type === "awning");
  if (awnings.length < 2) return null;
  const manual = awnings.filter(manualPossible);
  const equipped = awnings.filter((f) => !manualPossible(f) && lighting(f).length > 0);
  const cols = [
    { label: "Basique", text: "Manœuvre à la manivelle, sans éclairage.", models: manual },
    { label: "Intermédiaire", text: "Les mêmes stores, motorisés ; commandes et capteurs étudiés au devis.", models: manual },
    { label: "Équipé", text: "Motorisation imposée, éclairage LED possible (de série ou en option selon les documents).", models: equipped },
  ];
  return (
    <section className="section-y border-t border-sand-200" aria-labelledby="lecture" data-testid="levels">
      <h2 id="lecture" className="font-display text-display font-semibold">Lire la gamme</h2>
      <p className="mt-2 max-w-3xl text-stone-700 text-pretty">Une lecture par l'équipement électrique, établie d'après la documentation de chaque modèle : ce n'est pas un classement du fabricant. Pour la protection de la toile repliée, l'ordre change (voir le comparatif) : Casablanca a le coffre le plus fermé.</p>
      <ol className="mt-6 grid gap-4 md:grid-cols-3">
        {cols.map((c) => (
          <li key={c.label} className="rounded-2xl border border-sand-200 bg-white p-5">
            <p className="font-display text-xl font-semibold">{c.label}</p>
            <p className="mt-1 text-sm text-stone-700">{c.text}</p>
            <p className="mt-3 text-sm">{c.models.length ? c.models.map((f, i) => <span key={f.slug}>{i ? ", " : ""}<Link href={productHref(f.category as CategoryKey, f.slug)} className="link-brand">{f.name}</Link></span>) : "—"}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Comparatif des cotes et poses documentées, lorsque la famille compte plusieurs modèles. */
export function Comparison({ items }: { items: Item[] }) {
  const rows: Array<[string, (f: Item) => string]> = [
    [items[0]!.rules.dims.width.label, (f) => dimRangeText(f.rules.dims.width)],
    ...(items.some((f) => f.rules.dims.depth) ? [[items.find((f) => f.rules.dims.depth)!.rules.dims.depth!.label, (f: Item) => (f.rules.dims.depth ? dimRangeText(f.rules.dims.depth) : "—")] as [string, (f: Item) => string]] : []),
    ...(items.some((f) => f.rules.dims.height) ? [[items.find((f) => f.rules.dims.height)!.rules.dims.height!.label, (f: Item) => (f.rules.dims.height ? dimRangeText(f.rules.dims.height) : "—")] as [string, (f: Item) => string]] : []),
    ["Pose", (f) => f.rules.mountings.map((m) => m.label + (m.status === "to_confirm" ? " (à confirmer)" : "")).join(", ")],
    ...(items.some((f) => f.rules.protection) ? [["Protection de la toile", (f: Item) => (f.rules.protection ? `${f.rules.protection.label}${f.rules.protection.status === "to_confirm" ? " — à confirmer" : ""}` : "—")] as [string, (f: Item) => string]] : []),
    ...(items.some((f) => f.rules.controls?.length) ? [["Manœuvre", (f: Item) => (f.rules.controls?.length ? (manualPossible(f) ? (f.rules.controls.some((c) => c.kind === "electric") ? "manivelle ou moteur" : "manivelle") : "motorisée uniquement") : "—")] as [string, (f: Item) => string]] : []),
    ...(items.some((f) => f.rules.type === "awning" || f.rules.type === "pergola") ? [["Éclairage LED", (f: Item) => (lighting(f).length ? lighting(f).map((o) => o.label + (o.status === "to_confirm" ? " (à confirmer)" : "")).join(" ; ") : "non proposé")] as [string, (f: Item) => string]] : []),
    ...(items.some((f) => f.rules.type === "pergola") ? [["Toiture", (f: Item) => (f.rules.roof === "fabric" ? "toile tendue" : "lames orientables")] as [string, (f: Item) => string]] : []),
    ...(items.some((f) => f.rules.fixedSizes?.length) ? [["Fabrication", (f: Item) => (f.rules.fixedSizes?.length ? "tailles définies (prêt à poser)" : "sur mesure")] as [string, (f: Item) => string]] : []),
    ...(items.some((f) => f.rules.insect) ? [["Ouverture", (f: Item) => (f.rules.insect ? INSECT_OPENING_FR[f.rules.insect.opening] + (f.rules.insect.leaves === 2 ? ", deux vantaux" : "") : "—")] as [string, (f: Item) => string]] : []),
    ...(items.some((f) => f.rules.modules) ? [["Plusieurs modules", (f: Item) => (f.rules.modules ? (f.rules.modules.multiModule === "documented" ? "possible, composé au devis" : "non documenté, étude au devis") : "—")] as [string, (f: Item) => string]] : []),
    ["Prix de la structure", (f) => (priceText(f) ? `à partir de ${priceText(f)}` : "sur devis")],
  ];
  return (
    <section className="section-y border-t border-sand-200" aria-labelledby="comparatif">
      <h2 id="comparatif" className="font-display text-display font-semibold">Comparer les modèles</h2>
      <p className="mt-2 max-w-2xl text-stone-700">Cotes et poses documentées pour un module ; les points « à confirmer » sont vérifiés au devis.</p>
      <div className="mt-8 overflow-x-auto border border-sand-200 bg-white">
        <table className={`w-full text-left text-sm ${items.length > 3 ? "min-w-[720px]" : "table-fixed"}`} data-testid="collection-compare">
          <caption className="sr-only">Comparatif des modèles</caption>
          <thead className="bg-sand-100">
            <tr>
              <th scope="col" className="w-[30%] p-3 font-medium text-stone-700 sm:p-4"><span className="sr-only">Caractéristique</span></th>
              {items.map((f) => <th key={f.slug} scope="col" className="p-3 font-display text-base font-semibold sm:p-4 sm:text-lg"><Link href={productHref(f.category as CategoryKey, f.slug)} className="hover:text-brand-700">{f.name}</Link></th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row" className="p-3 align-top font-medium text-stone-700 sm:p-4">{label}</th>
                {items.map((f) => <td key={f.slug} className="p-3 align-top tabular-nums sm:p-4">{value(f)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Rendu produit sur fond clair pour la présentation « catalogue » ; sinon le visuel principal. */
const productShot = (items: PublishedMedia[]) => items.find((m) => m.role === "gallery" && m.nature === "RENDER" && (m.width ?? 0) >= 600) ?? items.find((m) => m.role === "gallery") ?? items[0] ?? null;

/** Page d'une famille publique : bandeau photographique, modèles en grandes présentations, comparatif. */
export async function SystemCollection({ category, items, drafts = [] }: { category: CategoryKey; items: Item[]; drafts?: Array<{ slug: string; name: string; shortDescription: string }> }) {
  const cat = categoryByKey(category)!;
  const shots = new Map(await Promise.all(items.map(async (f) => [f.slug, productShot(await publishedMediaFor(f.slug))] as const)));
  // bandeau pleine largeur : seulement une image assez grande (jamais une miniature agrandie) ; sinon fond uni + dessin
  const banner = items.map((f) => f.hero).find((h) => h && (h.width ?? 0) >= 1400) ?? null;
  return (
    <>
      <section className="relative isolate overflow-hidden bg-night text-white" aria-labelledby="famille-titre">
        {banner && <MediaImage media={banner} sizes="100vw" eager className="absolute inset-0 -z-10 size-full object-cover" />}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(11_15_13/0.8)_0%,rgb(11_15_13/0.45)_55%,rgb(11_15_13/0.2)_100%)]" aria-hidden="true" />
        <div className="container-x grid min-h-[22rem] items-end gap-6 py-10 md:min-h-[26rem] md:grid-cols-[minmax(0,1fr)_auto] md:py-12">
          <div>
            <Breadcrumbs items={[{ label: cat.label }]} tone="light" />
            <h1 id="famille-titre" className="mt-5 font-display text-hero font-semibold">{cat.label}</h1>
            <p className="mt-3 max-w-xl text-lg text-sand-100 text-pretty">{cat.intro} {items.some((f) => f.fromPrice) ? "Le prix s'affiche lorsque vos dimensions figurent dans la grille tarifaire ; sinon, sur devis." : "Prix sur devis : configurez vos dimensions, un conseiller établit votre devis."}</p>
            {items.length > 1 && <p className="mt-4 text-sm text-sand-200">{items.length} modèles · <a href="#comparatif" className="text-white underline underline-offset-4">comparer</a></p>}
          </div>
          <FamilySketch kind={category} tone="light" sun={false} decorative={false} className="sketch-trigger hidden w-56 md:block" />
        </div>
      </section>
      <div className="container-x">
        {items.length === 0 ? (
          <div className="my-12 border border-dashed border-sand-300 bg-white p-10 text-center"><p className="font-display text-2xl">Modèles en cours d'intégration.</p><p className="mt-2 text-stone-700"><Link href="/devis" className="underline">Décrivez votre projet</Link> : un conseiller vous répond.</p></div>
        ) : (
          <ul className="divide-y divide-sand-200" data-testid="collection">
            {items.map((f, i) => (
              <li key={f.slug} className="grid items-center gap-6 py-10 md:grid-cols-2 md:gap-12 md:py-14">
                <Link href={productHref(category, f.slug)} className={`group relative block aspect-[4/3] overflow-hidden border border-sand-200 bg-white ${i % 2 ? "md:order-2" : ""}`} tabIndex={-1} aria-hidden="true">
                  {shots.get(f.slug) ? <MediaImage media={shots.get(f.slug)!} sizes="(min-width: 768px) 46vw, 92vw" className="absolute inset-0 size-full object-contain p-8 transition-transform duration-500 group-hover:scale-[1.03]" /> : <span className="grid size-full place-items-center text-sm text-stone-700">Visuel à venir</span>}
                </Link>
                <div className="min-w-0">
                  <p className="eyebrow">{cat.singular}</p>
                  <h2 className="mt-2 font-display text-display font-semibold"><Link href={productHref(category, f.slug)} className="hover:text-brand-700">{f.name}</Link></h2>
                  <p className="mt-3 text-stone-800 text-pretty">{f.shortDescription}</p>
                  <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-sand-200 pt-4 text-sm">
                    <dt className="text-stone-700">{f.rules.dims.width.label}</dt><dd className="tabular-nums">{dimRangeText(f.rules.dims.width)}</dd>
                    {f.rules.dims.depth && <><dt className="text-stone-700">{f.rules.dims.depth.label}</dt><dd className="tabular-nums">{dimRangeText(f.rules.dims.depth)}</dd></>}
                    {f.rules.dims.height && <><dt className="text-stone-700">{f.rules.dims.height.label}</dt><dd className="tabular-nums">{dimRangeText(f.rules.dims.height)}</dd></>}
                  </dl>
                  <p className="mt-5 text-base" data-testid="collection-price">{priceText(f) ? <>À partir de <span className="font-display text-2xl font-semibold tabular-nums">{priceText(f)}</span></> : "Prix sur devis"}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Link href={productHref(category, f.slug)} className="btn-secondary">Découvrir</Link>
                    <Link href={configuratorHref(f.slug)} className="btn-accent">Configurer <ArrowRight className="size-4" aria-hidden="true" /></Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {items.length > 1 && <Comparison items={items} />}
        <EquipmentReading items={items} />
        {drafts.length > 0 && (
          <section className="section-y border-t border-sand-200" aria-labelledby="en-preparation" data-testid="drafts">
            <h2 id="en-preparation" className="font-display text-display font-semibold">En préparation</h2>
            <p className="mt-2 max-w-2xl text-stone-700">Ces modèles seront configurables dès que leurs caractéristiques seront confirmées. Vous pouvez déjà demander un devis avec vos mesures.</p>
            <ul className="mt-6 grid gap-4 md:grid-cols-3">{drafts.map((d) => <li key={d.slug} className="rounded-2xl border border-dashed border-sand-300 bg-white p-5"><p className="font-display text-xl font-semibold">{d.name}</p><p className="mt-1 text-sm text-stone-700">{d.shortDescription}</p><Link href={`/devis?produit=${d.slug}`} className="btn-secondary mt-4 text-sm">Demander un devis</Link></li>)}</ul>
          </section>
        )}
        <FamilyGuide category={category} items={items} />
      </div>
      <div className="h-6" aria-hidden="true" />
      <JsonLd data={breadcrumbJsonLd(BRAND.siteUrl, [{ name: cat.label, path: cat.href }])} />
    </>
  );
}
