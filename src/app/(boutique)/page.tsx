import Link from "next/link";
import { ArrowRight, MessageCircle, Ruler, FileText, LayoutGrid } from "lucide-react";
import { CATEGORIES, configuratorHref, productHref } from "@/domain/categories";
import { dimRangeText } from "@/domain/system";
import { formatSystemPrice } from "@/domain/system-pricing";
import { listSystemFamilies } from "@/server/catalog/systems";

const smallOf = (m: { path: string; provenance: unknown } | null) => (m ? ((m.provenance as { variants?: { small?: { path?: string } } } | null)?.variants?.small?.path ?? m.path) : null);

export default async function HomePage() {
  const families = await Promise.all(CATEGORIES.map(async (c) => ({ c, items: await listSystemFamilies(c.key) })));
  const heroFamily = families[0]?.items[0] ?? null;
  return (
    <>
      <section className="relative isolate overflow-hidden bg-sand-100">
        <div className="container-x grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,46%)_minmax(0,54%)] lg:items-center py-10 lg:py-14">
          <div className="relative z-10 py-4 lg:py-12">
            <p className="text-brand-700 text-sm font-medium tracking-[0.18em] uppercase">Pergolas · Screens · Stores bannes</p>
            <h1 className="mt-4 font-display text-5xl sm:text-6xl leading-[1.04] font-semibold">Protection solaire sur mesure pour votre terrasse et vos baies.</h1>
            <p className="mt-6 text-lg text-stone-800 max-w-xl">Choisissez votre produit, configurez-le à vos cotes avec une vue 3D indicative, voyez son prix selon vos dimensions, puis recevez votre devis.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/configurateur" className="btn-accent text-base px-6 py-3.5">Configurer mon projet <ArrowRight className="size-4" aria-hidden="true" /></Link>
              <Link href="/devis" className="btn-secondary text-base px-6 py-3.5">Demander un devis</Link>
            </div>
          </div>
          {heroFamily?.hero && (
            <figure className="relative min-w-0 w-full overflow-hidden rounded-2xl bg-white shadow-soft">
              {/* eslint-disable-next-line @next/next/no-img-element -- média de la médiathèque */}
              <img src={heroFamily.hero.path} alt={heroFamily.hero.alt} width={heroFamily.hero.width ?? undefined} height={heroFamily.hero.height ?? undefined} className="aspect-[5/4] w-full object-cover" />
              <figcaption className="px-4 py-2 text-xs text-stone-700">{heroFamily.name}</figcaption>
            </figure>
          )}
        </div>
      </section>

      <section className="container-x py-16" aria-labelledby="familles">
        <h2 id="familles" className="font-display text-3xl sm:text-4xl">Trois familles de produits</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {families.map(({ c, items }) => {
            const first = items[0];
            const img = smallOf(first?.hero ?? null);
            return (
              <article key={c.key} className="card overflow-hidden flex flex-col" data-testid={`home-${c.key}`}>
                <Link href={c.href} className="block aspect-[4/3] bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element -- média de la médiathèque */}
                  {img ? <img src={img} alt={first?.hero?.alt ?? c.label} className="size-full object-cover" loading="lazy" /> : <span className="grid size-full place-items-center text-sm text-stone-700">Visuels à venir</span>}
                </Link>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-2xl"><Link href={c.href}>{c.label}</Link></h3>
                  <p className="mt-1 text-sm text-stone-700">{c.intro}</p>
                  <ul className="mt-3 space-y-1 text-sm">
                    {items.map((f) => <li key={f.slug}><Link href={productHref(c.key, f.slug)} className="underline underline-offset-2">{f.name}</Link> <span className="text-stone-700">— {f.rules.dims.width.label.toLowerCase()} {dimRangeText(f.rules.dims.width)}{f.fromPrice ? `, à partir de ${formatSystemPrice(f.fromPrice.amountMinor, f.fromPrice.currency, f.fromPrice.taxBasis)}` : ""}</span></li>)}
                  </ul>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Link href={c.href} className="btn-secondary">Voir les modèles</Link>
                    {first && <Link href={configuratorHref(first.slug)} className="btn-ghost">Configurer</Link>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-sand-100 py-16" aria-labelledby="parcours">
        <div className="container-x">
          <h2 id="parcours" className="font-display text-3xl">Comment se déroule votre projet</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-4">
            {[
              [LayoutGrid, "1. Choisir", "Pergola, screen ou store banne : comparez les modèles et leurs caractéristiques.", "/pergolas"],
              [Ruler, "2. Configurer", "Saisissez vos cotes, la pose, la teinte et les équipements ; la 3D et le prix suivent vos choix.", "/configurateur"],
              [MessageCircle, "3. Être conseillé", "Un conseiller vérifie la faisabilité, les fixations et les points à confirmer.", "/contact"],
              [FileText, "4. Commander ou demander un devis", "La structure seule se commande en ligne au prix de la grille ; options, pose, livraison et délai sont établis par devis.", "/devis"],
            ].map(([Icon, t, d, href]) => {
              const I = Icon as typeof Ruler;
              return <li key={String(t)}><I className="size-7 text-brand-700" aria-hidden="true" /><h3 className="mt-3 font-display text-xl"><Link href={String(href)}>{String(t)}</Link></h3><p className="mt-1 text-sm text-stone-700">{String(d)}</p></li>;
            })}
          </ol>
        </div>
      </section>
    </>
  );
}
