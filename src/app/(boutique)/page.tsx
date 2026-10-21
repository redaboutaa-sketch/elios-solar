import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORIES, configuratorHref, productHref } from "@/domain/categories";
import { dimRangeText } from "@/domain/system";
import { formatSystemPrice } from "@/domain/system-pricing";
import { listSystemFamilies } from "@/server/catalog/systems";
import { publishedMediaFor } from "@/server/media/queries";
import { FamilySketch } from "@/components/illustrations/sketches";
import { MediaImage } from "@/components/ui/media-image";
import type { PublishedMedia } from "@/server/media/types";

const NATURE_SHORT: Record<string, string> = { PHOTO: "Photographie", RENDER: "Rendu", ILLUSTRATION: "Schéma" };

/** Questions reprises des informations déjà publiées (fiches, CGV provisoires, configurateur). */
const FAQ = [
  { q: "Peut-on commander en ligne ?", a: "Oui pour la structure seule : aux dimensions couvertes par la grille, sans option ni choix à confirmer, la configuration s'ajoute au panier (TVA ajoutée au total). La livraison et la pose s'organisent ensuite avec un conseiller. Dans les autres cas, demandez un devis depuis le configurateur." },
  { q: "Que comprend le prix affiché ?", a: "Le prix affiché est celui de la structure, hors taxes, selon vos dimensions. Les options, la pose et la livraison sont chiffrées au devis." },
  { q: "La vue 3D vaut-elle plan ?", a: "Non. La 3D du configurateur reprend vos cotes à titre indicatif : elle ne constitue ni un plan d'exécution ni une validation structurelle." },
  { q: "Qui vérifie la faisabilité ?", a: "Un conseiller vérifie la faisabilité, les fixations et les points à confirmer avant toute proposition." },
];

const STEPS = [
  ["Choisir", "Pergola, screen ou store banne : comparez les modèles et leurs caractéristiques.", "/pergolas"],
  ["Configurer", "Saisissez vos cotes, la pose, la teinte et les équipements ; la 3D et le prix suivent vos choix.", "/configurateur"],
  ["Commander ou demander un devis", "La structure seule se commande en ligne au prix de la grille ; options, pose, livraison et délai sont établis par devis.", "/devis"],
  ["Être accompagné", "Un conseiller vérifie la faisabilité, les fixations et les points à confirmer.", "/contact"],
] as const;

/** Visuels de documentation pour la composition éditoriale : hors visuel principal (déjà montré avec les modèles). */
function editorial(media: Array<{ slug: string; name: string; items: PublishedMedia[] }>) {
  const out: Array<PublishedMedia & { model: string }> = [];
  for (const f of media) {
    const pick = (role: string, minW: number) => f.items.find((m) => m.role === role && (m.width ?? 0) >= minW && !out.some((o) => o.id === m.id));
    for (const m of [pick("gallery", 900), pick("detail", 800)]) if (m) out.push({ ...m, model: f.name });
  }
  return out.slice(0, 5);
}

export default async function HomePage() {
  const families = await Promise.all(CATEGORIES.map(async (c) => ({ c, items: await listSystemFamilies(c.key) })));
  const models = families.flatMap(({ c, items }) => items.map((f) => ({ c, f })));
  const photos = editorial(await Promise.all(models.map(async ({ f }) => ({ slug: f.slug, name: f.name, items: await publishedMediaFor(f.slug) }))));
  return (
    <>
      {/* A–C : introduction courte puis sélection directe par le dessin du produit */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-sand-50" aria-labelledby="accueil-titre">
        <div className="container-x pt-10 pb-4 sm:pt-14 lg:pt-16 lg:pb-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-end lg:gap-12">
            <div>
              <p className="eyebrow">Pergolas · Screens · Stores bannes</p>
              <h1 id="accueil-titre" className="mt-3 font-display text-hero font-semibold text-balance">Pergolas, screens et stores bannes pour vos espaces extérieurs.</h1>
            </div>
            <div className="lg:pb-2">
              <p className="text-lg text-stone-800 text-pretty">Choisissez votre famille, configurez-la à vos cotes avec une vue 3D indicative et voyez le prix de la structure selon vos dimensions.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/configurateur" className="btn-accent text-base px-6">Configurer mon projet <ArrowRight className="size-4" aria-hidden="true" /></Link>
                <Link href="/devis" className="btn-secondary text-base px-6">Demander un devis</Link>
              </div>
            </div>
          </div>

          <h2 className="sr-only">Choisir une famille de produits</h2>
          <ul className="mt-10 grid gap-3 sm:gap-5 md:grid-cols-3" data-testid="family-picker">
            {families.map(({ c, items }) => {
              const prices = items.map((f) => f.fromPrice).filter((p): p is NonNullable<typeof p> => !!p);
              const min = prices.length ? prices.reduce((a, b) => (b.amountMinor < a.amountMinor ? b : a)) : null;
              return (
                <li key={c.key} className="card-link sketch-trigger group rounded-2xl border border-sand-200 bg-white transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-700/50 hover:shadow-lift" data-testid={`home-${c.key}`}>
                  <div className="grid grid-cols-[minmax(0,42%)_1fr] items-center gap-3 p-3 md:grid-cols-1 md:gap-0 md:p-5">
                    <FamilySketch kind={c.key} className="w-full md:-mt-1 md:px-4" />
                    <div className="min-w-0">
                      <h3 className="font-display text-xl font-semibold lg:text-2xl">
                        <Link href={c.href} className="stretched">{c.label}<ArrowRight className="ml-1.5 inline size-5 align-[-0.15em] text-brand-700 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" /></Link>
                      </h3>
                      <p className="mt-1 text-sm text-stone-700">{items.map((f) => f.name.replace(c.singular, "").trim()).join(" · ") || "Modèles en cours d'intégration"}</p>
                      {min && <p className="mt-2 text-sm text-ink">À partir de <span className="font-semibold tabular-nums">{formatSystemPrice(min.amountMinor, min.currency, min.taxBasis)}</span></p>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* D : modèles réellement disponibles */}
      <section className="section-y" aria-labelledby="modeles">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="eyebrow">Le catalogue</p><h2 id="modeles" className="mt-2 font-display text-display font-semibold">{models.length} modèles, trois familles</h2></div>
            <p className="max-w-md text-stone-700">Chaque modèle se configure à vos cotes ; le prix de la structure suit les dimensions de la grille.</p>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
            {models.map(({ c, f }) => (
              <li key={f.slug} className="reveal card-link group flex flex-col">
                <div className="overflow-hidden rounded-xl bg-white">
                  {f.hero ? <MediaImage media={f.hero} sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 92vw" className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <span className="grid aspect-[4/5] place-items-center text-sm text-stone-700">Visuel à venir</span>}
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700">{c.singular}</p>
                <h3 className="mt-1 font-display text-xl font-semibold"><Link href={productHref(c.key, f.slug)} className="stretched">{f.name}</Link></h3>
                <p className="mt-1 text-sm text-stone-700">{f.rules.dims.width.label} {dimRangeText(f.rules.dims.width)}</p>
                <p className="mt-2 text-sm">{f.fromPrice ? <>À partir de <span className="font-semibold tabular-nums">{formatSystemPrice(f.fromPrice.amountMinor, f.fromPrice.currency, f.fromPrice.taxBasis)}</span></> : "Prix sur devis"}</p>
                <Link href={configuratorHref(f.slug)} className="relative z-10 mt-3 inline-flex w-fit items-center gap-1 text-sm font-medium text-brand-700 underline-offset-4 hover:underline">Configurer <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* E : composition éditoriale (visuels de documentation, pas des réalisations) */}
      {photos.length >= 3 && (
        <section className="section-y bg-sand-100" aria-labelledby="details">
          <div className="container-x">
            <p className="eyebrow">Les produits en détail</p>
            <h2 id="details" className="mt-2 max-w-2xl font-display text-display font-semibold">Lames, coffres, coulisses et bras : la précision du produit.</h2>
            <p className="mt-3 max-w-2xl text-stone-700">Photographies et rendus issus de la documentation des produits. Ce ne sont pas des réalisations HELIOSTORES.</p>
            <ul className="mt-10 grid auto-rows-[11rem] grid-cols-2 gap-3 sm:auto-rows-[14rem] lg:grid-cols-4 lg:gap-4">
              {photos.map((m, i) => (
                <li key={m.id} className={`reveal relative overflow-hidden rounded-xl bg-white ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
                  <figure className="size-full">
                    <MediaImage media={m} sizes={i === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"} className={`size-full ${m.nature === "PHOTO" ? "object-cover" : "object-contain p-3 pb-12"}`} />
                    <figcaption className="absolute inset-x-2 bottom-2 rounded-lg bg-white/92 px-3 py-1.5 text-xs text-stone-800 backdrop-blur"><span className="font-semibold text-ink">{m.model}</span> · {NATURE_SHORT[m.nature] ?? m.nature}<span className="max-sm:hidden"> — {m.caption || m.title}</span></figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* F : parcours projet */}
      <section className="section-y" aria-labelledby="parcours">
        <div className="container-x">
          <p className="eyebrow">Votre projet</p>
          <h2 id="parcours" className="mt-2 font-display text-display font-semibold">Comment se déroule votre projet</h2>
          <ol className="mt-10 grid gap-8 border-t border-sand-300 pt-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, d, href], i) => (
              <li key={t} className="reveal">
                <span className="font-display text-4xl font-semibold text-sage-700 tabular-nums" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-display text-xl font-semibold"><Link href={href} className="hover:text-brand-700"><span className="sr-only">{i + 1}. </span>{t}</Link></h3>
                <p className="mt-2 text-sm text-stone-700">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* H : questions utiles et contact */}
      <section className="section-y bg-white" aria-labelledby="questions">
        <div className="container-x grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <p className="eyebrow">Questions utiles</p>
            <h2 id="questions" className="mt-2 font-display text-display font-semibold">Avant de commencer</h2>
            <p className="mt-3 text-stone-700">D'autres questions ? Consultez le <Link href="/aide" className="link-brand">centre d'aide</Link> ou <Link href="/contact" className="link-brand">écrivez-nous</Link>.</p>
          </div>
          <div className="divide-y divide-sand-200 border-y border-sand-200">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-1">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">{f.q}<span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full border border-sand-300 text-brand-700 transition-transform duration-200 group-open:rotate-45">+</span></summary>
                <p className="pb-4 text-stone-800">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-night" aria-labelledby="cta-final">
        <div className="container-x flex flex-col items-start gap-6 py-14 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="cta-final" className="font-display text-display font-semibold">Un projet en tête ?</h2>
            <p className="mt-2 max-w-xl text-sand-200">Configurez votre produit à vos cotes, ou décrivez votre projet : un conseiller vous répond.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/configurateur" className="btn bg-sage-400 px-6 text-base font-semibold text-night hover:bg-sage-300">Configurer mon projet <ArrowRight className="size-4" aria-hidden="true" /></Link>
            <Link href="/rappel" className="btn border border-white/30 px-6 text-base text-sand-50 hover:bg-white/10">Être rappelé</Link>
          </div>
        </div>
      </section>
    </>
  );
}
