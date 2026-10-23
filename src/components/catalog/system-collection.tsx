import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { FamilySketch } from "@/components/illustrations/sketches";
import { MediaImage } from "@/components/ui/media-image";
import { categoryByKey, configuratorHref, productHref, type CategoryKey } from "@/domain/categories";
import { dimRangeText } from "@/domain/system";
import { formatSystemPrice } from "@/domain/system-pricing";
import type { listSystemFamilies } from "@/server/catalog/systems";
import { publishedMediaFor } from "@/server/media/queries";
import type { PublishedMedia } from "@/server/media/types";

type Item = Awaited<ReturnType<typeof listSystemFamilies>>[number];

const priceText = (f: Item) => (f.fromPrice ? formatSystemPrice(f.fromPrice.amountMinor, f.fromPrice.currency, f.fromPrice.taxBasis) : null);

/**
 * Niveaux d'équipement d'un modèle (packs du même store) : Essentiel, Confort ; Premium renvoie à un autre modèle,
 * présenté seulement après validation. Les montants ne concernent que la structure de la grille ; le reste est au devis.
 */
function Levels({ items }: { items: Item[] }) {
  const withPacks = items.filter((f) => f.rules.packs?.length);
  if (!withPacks.length) return null;
  return (
    <section className="section-y border-t border-sand-200" aria-labelledby="niveaux" data-testid="levels">
      <h2 id="niveaux" className="font-display text-display font-semibold">Choisir son niveau d'équipement</h2>
      {withPacks.map((f) => (
        <div key={f.slug} className="mt-6">
          <p className="max-w-2xl text-stone-700">{f.name} : {f.rules.packs!.filter((p) => !p.familySlug).length} niveaux d'un même store ; un niveau Premium, sur un autre modèle, est en préparation.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">Niveaux d'équipement {f.name}</caption>
              <thead><tr className="border-b border-sand-300 text-left"><th className="py-2 pr-4 font-medium text-stone-700">Niveau</th><th className="py-2 pr-4 font-medium text-stone-700">Pour qui</th><th className="py-2 pr-4 font-medium text-stone-700">Compris</th><th className="py-2 pr-4 font-medium text-stone-700">Options</th><th className="py-2 pr-4 font-medium text-stone-700">Prix</th></tr></thead>
              <tbody>
                {f.rules.packs!.map((p) => (
                  <tr key={p.code} className="border-b border-sand-200 align-top">
                    <th scope="row" className="py-3 pr-4 font-display text-lg font-semibold">{p.label}{p.familySlug ? <span className="block text-xs font-normal text-stone-700">en préparation</span> : p.status === "to_confirm" ? <span className="block text-xs font-normal text-stone-700">composition à confirmer</span> : null}</th>
                    <td className="py-3 pr-4">{p.summary}</td>
                    <td className="py-3 pr-4">{p.familySlug ? "—" : p.includes.join(", ")}</td>
                    <td className="py-3 pr-4">{p.familySlug ? "—" : (p.optionCodes ?? []).map((c) => f.rules.options.find((o) => o.code === c)?.label).filter(Boolean).join(", ") || "—"}</td>
                    <td className="py-3 pr-4">{p.familySlug ? "—" : p.tier === 1 && priceText(f) ? `structure à partir de ${priceText(f)}` : "sur devis"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-stone-700">Dimensions identiques pour Essentiel et Confort : {f.rules.dims.width.label.toLowerCase()} {dimRangeText(f.rules.dims.width)}{f.rules.dims.depth ? `, ${f.rules.dims.depth.label.toLowerCase()} ${dimRangeText(f.rules.dims.depth)}` : ""}. Éclairage LED non proposé sur ce modèle.</p>
        </div>
      ))}
    </section>
  );
}

/** Comparatif des cotes et poses documentées, lorsque la famille compte plusieurs modèles. */
function Comparison({ items }: { items: Item[] }) {
  const rows: Array<[string, (f: Item) => string]> = [
    [items[0]!.rules.dims.width.label, (f) => dimRangeText(f.rules.dims.width)],
    ...(items.some((f) => f.rules.dims.depth) ? [[items.find((f) => f.rules.dims.depth)!.rules.dims.depth!.label, (f: Item) => (f.rules.dims.depth ? dimRangeText(f.rules.dims.depth) : "—")] as [string, (f: Item) => string]] : []),
    ...(items.some((f) => f.rules.dims.height) ? [[items.find((f) => f.rules.dims.height)!.rules.dims.height!.label, (f: Item) => (f.rules.dims.height ? dimRangeText(f.rules.dims.height) : "—")] as [string, (f: Item) => string]] : []),
    ["Pose", (f) => f.rules.mountings.map((m) => m.label + (m.status === "to_confirm" ? " (à confirmer)" : "")).join(", ")],
    ["Plusieurs modules", (f) => (f.rules.modules ? (f.rules.modules.multiModule === "documented" ? "possible, composé au devis" : "non documenté, étude au devis") : "—")],
    ["Prix de la structure", (f) => (priceText(f) ? `à partir de ${priceText(f)}` : "sur devis")],
  ];
  return (
    <section className="section-y border-t border-sand-200" aria-labelledby="comparatif">
      <h2 id="comparatif" className="font-display text-display font-semibold">Comparer les modèles</h2>
      <p className="mt-2 max-w-2xl text-stone-700">Cotes et poses documentées pour un module ; les points « à confirmer » sont vérifiés au devis.</p>
      <div className="mt-8 overflow-hidden border border-sand-200 bg-white">
        <table className="w-full table-fixed text-left text-sm" data-testid="collection-compare">
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
export async function SystemCollection({ category, items }: { category: CategoryKey; items: Item[] }) {
  const cat = categoryByKey(category)!;
  const shots = new Map(await Promise.all(items.map(async (f) => [f.slug, productShot(await publishedMediaFor(f.slug))] as const)));
  const banner = items[0]?.hero ?? null;
  return (
    <>
      <section className="relative isolate overflow-hidden bg-night text-white" aria-labelledby="famille-titre">
        {banner && <MediaImage media={banner} sizes="100vw" eager className="absolute inset-0 -z-10 size-full object-cover" />}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(11_15_13/0.8)_0%,rgb(11_15_13/0.45)_55%,rgb(11_15_13/0.2)_100%)]" aria-hidden="true" />
        <div className="container-x grid min-h-[22rem] items-end gap-6 py-10 md:min-h-[26rem] md:grid-cols-[minmax(0,1fr)_auto] md:py-12">
          <div>
            <Breadcrumbs items={[{ label: cat.label }]} tone="light" />
            <h1 id="famille-titre" className="mt-5 font-display text-hero font-semibold">{cat.label}</h1>
            <p className="mt-3 max-w-xl text-lg text-sand-100 text-pretty">{cat.intro} Chaque modèle affiche son prix selon vos dimensions.</p>
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
        <Levels items={items} />
      </div>
      <div className="h-6" aria-hidden="true" />
    </>
  );
}
