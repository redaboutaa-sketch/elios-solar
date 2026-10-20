import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { categoryByKey, configuratorHref, productHref, type CategoryKey } from "@/domain/categories";
import { dimRangeText } from "@/domain/system";
import type { listSystemFamilies } from "@/server/catalog/systems";

type Item = Awaited<ReturnType<typeof listSystemFamilies>>[number];

/** Page d'une famille publique : produits publiés, cotes documentées, accès à la fiche et au configurateur. */
export function SystemCollection({ category, items }: { category: CategoryKey; items: Item[] }) {
  const cat = categoryByKey(category)!;
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: cat.label }]} />
      <h1 className="mt-4 font-display text-4xl">{cat.label}</h1>
      <p className="mt-2 max-w-2xl text-stone-700">{cat.intro} Chaque modèle se configure à vos cotes ; le prix est établi sur devis.</p>
      {items.length === 0 ? (
        <div className="mt-10 card p-10 text-center"><p className="font-display text-2xl">Modèles en cours d'intégration.</p><p className="mt-2 text-stone-700"><Link href="/devis" className="underline">Décrivez votre projet</Link> : un conseiller vous répond.</p></div>
      ) : (
        <ul className="mt-8 grid gap-6 md:grid-cols-2" data-testid="collection">
          {items.map((f) => {
            const small = (f.hero?.provenance as { variants?: { small?: { path?: string } } } | null)?.variants?.small?.path ?? f.hero?.path;
            return (
              <li key={f.slug} className="card overflow-hidden flex flex-col">
                <Link href={productHref(category, f.slug)} className="block aspect-[4/3] bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element -- média de la médiathèque */}
                  {small ? <img src={small} alt={f.hero?.alt ?? f.name} className="size-full object-contain" loading="lazy" /> : <span className="grid size-full place-items-center text-sm text-stone-700">Visuel à venir</span>}
                </Link>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-display text-2xl"><Link href={productHref(category, f.slug)}>{f.name}</Link></h2>
                  <p className="mt-1 text-sm text-stone-700">{f.shortDescription}</p>
                  <ul className="mt-3 text-sm text-stone-800">
                    <li>{f.rules.dims.width.label} : {dimRangeText(f.rules.dims.width)}</li>
                    {f.rules.dims.depth && <li>{f.rules.dims.depth.label} : {dimRangeText(f.rules.dims.depth)}</li>}
                    {f.rules.dims.height && <li>{f.rules.dims.height.label} : {dimRangeText(f.rules.dims.height)}</li>}
                  </ul>
                  <p className="mt-3 text-sm font-medium">Prix sur devis</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Link href={productHref(category, f.slug)} className="btn-secondary">Voir la fiche</Link>
                    <Link href={configuratorHref(f.slug)} className="btn-accent">Configurer</Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-8 text-xs text-stone-700">Visuels : documentation du fabricant et du fournisseur, non représentatifs de réalisations HELIOSTORES.</p>
    </div>
  );
}
