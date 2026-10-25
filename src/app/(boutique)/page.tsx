import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORIES, configuratorHref, productHref, type CategoryKey } from "@/domain/categories";
import { dimRangeText } from "@/domain/system";
import { formatSystemPrice } from "@/domain/system-pricing";
import { listSystemFamilies } from "@/server/catalog/systems";
import { defaultSceneModel } from "@/server/catalog/scene-preview";
import { publishedMediaFor } from "@/server/media/queries";
import { FamilySketch } from "@/components/illustrations/sketches";
import { MediaImage, smallPathOf } from "@/components/ui/media-image";
import { HeroSlider, type HeroSlide } from "@/components/home/hero-slider";
import { ModelTabs } from "@/components/home/model-tabs";
import { ScenePreview } from "@/components/home/scene-preview";
import type { PublishedMedia } from "@/server/media/types";

const NATURE: Record<string, string> = { PHOTO: "Photographie", RENDER: "Rendu", ILLUSTRATION: "Schéma" };

const STEPS = [
  ["Choisir", "Pergola, screen ou store banne : comparez les modèles et leurs caractéristiques.", "/#solutions"],
  ["Configurer", "Saisissez vos cotes, la pose, la teinte et les équipements ; la 3D et le prix suivent vos choix.", "/configurateur"],
  ["Commander ou demander un devis", "La structure seule se commande en ligne au prix de la grille ; options, pose, livraison et délai sont établis par devis.", "/devis"],
  ["Échanger avec un conseiller", "Un conseiller vérifie la faisabilité, les fixations et les points à confirmer.", "/contact"],
] as const;

type Family = Awaited<ReturnType<typeof listSystemFamilies>>[number];

/** Rendu produit sur fond clair (présentation « catalogue ») : premier rendu de galerie, sinon le visuel principal. */
const productShot = (items: PublishedMedia[]) => items.find((m) => m.role === "gallery" && m.nature === "RENDER" && (m.width ?? 0) >= 600) ?? items.find((m) => m.role === "gallery") ?? items[0] ?? null;

export default async function HomePage() {
  const families = await Promise.all(CATEGORIES.map(async (c) => ({ c, items: await listSystemFamilies(c.key) })));
  const all = families.flatMap(({ c, items }) => items.map((f) => ({ c, f })));
  const media = new Map(await Promise.all(all.map(async ({ f }) => [f.slug, await publishedMediaFor(f.slug)] as const)));
  const heroOf = (f: Family | undefined) => (f?.hero ? { path: f.hero.path, alt: f.hero.alt, width: f.hero.width, height: f.hero.height, provenance: f.hero.provenance, nature: f.hero.nature } : null);
  const byCat = Object.fromEntries(families.map(({ c, items }) => [c.key, items])) as Record<CategoryKey, Family[]>;

  // grand visuel : une vue en situation par famille (visuel principal du premier modèle)
  const slides: HeroSlide[] = families.flatMap(({ c, items }) => {
    const f = items[0]; const h = heroOf(f);
    // composant client : seuls chemin, texte alternatif et dimensions partent au navigateur (jamais la provenance)
    return f && h ? [{ id: f.slug, media: { path: h.path, alt: h.alt, width: h.width, height: h.height, smallPath: smallPathOf(h) }, label: f.name, href: productHref(c.key, f.slug), nature: NATURE[h.nature] ?? h.nature }] : [];
  });
  // panneaux : une famille par panneau, illustrée par son dessin
  const panels = families.map(({ c, items }) => ({ c, items }));

  // aperçu 3D : configuration par défaut du premier modèle de pergola, calculée côté serveur
  const p0 = byCat.PERGOLAS?.[0];
  const sceneModel = p0 ? await defaultSceneModel(p0.slug) : null;
  const sceneShot = p0 ? productShot(media.get(p0.slug) ?? []) : null;

  // composition éditoriale : détails techniques (rôle « detail »), jamais présentés comme des réalisations
  const details = all.flatMap(({ f }) => (media.get(f.slug) ?? []).filter((m) => m.role === "detail" && (m.width ?? 0) >= 800).slice(0, 2).map((m) => ({ ...m, model: f.name }))).slice(0, 4);

  return (
    <>
      {/* Entrée principale (retour client du 2026-10-21) : choisir une famille par son dessin, dès le premier écran.
          Les photographies suivent juste en dessous et restent dans les fiches produit. */}
      <section id="solutions" className="home-entry scroll-mt-16 pb-6 pt-5 sm:pt-7" aria-labelledby="solutions-titre">
        <div className="container-x flex flex-wrap items-end justify-between gap-x-8 gap-y-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">HELIOSTORES · Protection solaire sur mesure</p>
            <h1 id="solutions-titre" className="mt-1.5 font-display text-[clamp(1.5rem,1.05rem+1.9vw,2.6rem)] font-semibold leading-tight text-balance">Donnez une nouvelle dimension à vos extérieurs.</h1>
          </div>
          <p className="hidden max-w-md text-sm text-stone-700 sm:block sm:text-base">Choisissez votre famille : chaque modèle se configure à vos cotes.</p>
        </div>
        <ul className="solution-panels mx-auto mt-4 flex max-w-[110rem] flex-col gap-2 px-4 sm:mt-6 lg:flex-row lg:gap-1" data-testid="family-picker">
          {panels.map(({ c, items }) => {
            const prices = items.map((f) => f.fromPrice).filter((p): p is NonNullable<typeof p> => !!p);
            const min = prices.length ? prices.reduce((a, b) => (b.amountMinor < a.amountMinor ? b : a)) : null;
            return (
              <li key={c.key} className="solution-panel card-link sketch-trigger group relative flex min-w-0 flex-row overflow-hidden border border-sand-200 bg-sand-50 text-ink lg:flex-col" data-testid={`home-${c.key}`}>
                <div className="panel-sketch-zone flex w-[46%] shrink-0 items-center justify-center p-2 sm:w-[42%] sm:p-4 lg:w-auto lg:min-h-0 lg:flex-1 lg:p-8">
                  <FamilySketch kind={c.key} showWall={false} className="panel-sketch size-full max-w-[38rem]" />
                </div>
                <div className="flex min-w-0 flex-col justify-center p-4 pl-1 sm:p-6 lg:justify-start lg:p-8 lg:pt-0">
                  <h2 className="font-display text-xl font-semibold sm:text-2xl lg:text-3xl"><Link href={c.href} className="stretched">{c.label}</Link></h2>
                  <p className="mt-1 text-xs text-stone-800 sm:text-sm">{items.map((f) => f.name).join(" · ") || "Modèles en cours d'intégration"}</p>
                  {min && <p className="mt-1 text-xs text-stone-800 sm:text-sm">À partir de <span className="font-semibold tabular-nums text-brand-700">{formatSystemPrice(min.amountMinor, min.currency, min.taxBasis)}</span></p>}
                  <span className="mt-2 text-xs font-semibold text-brand-700 sm:hidden" aria-hidden="true">Voir les modèles →</span>
                  <span className="panel-cta mt-3 hidden w-fit items-center gap-2 border border-brand-700 px-3 py-1.5 text-xs sm:inline-flex font-semibold uppercase tracking-[0.12em] text-brand-700 group-hover:bg-brand-700 group-hover:text-white group-focus-within:bg-brand-700 group-focus-within:text-white sm:px-4 sm:py-2 sm:text-sm lg:mt-5" aria-hidden="true">Découvrir la gamme <ArrowRight className="size-4" /></span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Photographies en situation (visuels de la documentation produit, jamais présentés comme des réalisations) */}
      <HeroSlider slides={slides}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/90">En situation</p>
        <h2 className="mt-4 max-w-3xl font-display text-display font-semibold text-balance">Pergolas, screens, stores bannes et moustiquaires configurés à vos cotes.</h2>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/configurateur" className="btn-cta px-6 text-base">Configurer mon projet <ArrowRight className="size-4" aria-hidden="true" /></Link>
          <Link href="/devis" className="btn bg-white px-6 text-base text-ink hover:bg-sand-100">Demander un devis</Link>
        </div>
      </HeroSlider>

      {/* A. Nos modèles, par famille */}
      <section className="section-y" aria-labelledby="modeles">
        <div className="container-x">
          <h2 id="modeles" className="font-display text-display"><span className="font-normal">Nos</span> <span className="font-semibold">modèles</span></h2>
          <div className="mt-8">
            <ModelTabs tabs={families.map(({ c, items }) => ({
              key: c.key, label: c.label, content: (
                <ul className={`grid grid-cols-1 gap-px border border-sand-200 bg-sand-200 ${items.length > 1 ? "md:grid-cols-2" : ""}`}>
                  {items.map((f) => {
                    const shot = productShot(media.get(f.slug) ?? []);
                    return (
                      <li key={f.slug} className={`card-link group grid min-w-0 grid-cols-1 bg-white ${items.length > 1 ? "grid-rows-[auto_1fr]" : "md:grid-cols-2"}`}>
                        <div className="relative aspect-[16/10] min-w-0 overflow-hidden bg-white">{shot ? <MediaImage media={shot} sizes="(min-width: 768px) 45vw, 92vw" className="absolute inset-0 size-full object-contain p-6 transition-transform duration-500 group-hover:scale-[1.03]" /> : <span className="grid size-full place-items-center text-sm text-stone-700">Visuel à venir</span>}</div>
                        <div className={`border-t border-sand-200 p-6 md:p-8 ${items.length > 1 ? "" : "md:border-l md:border-t-0 md:self-center"}`}>
                          <h3 className="font-display text-2xl font-semibold"><Link href={productHref(c.key, f.slug)} className="stretched">{f.name}</Link></h3>
                          <p className="mt-2 text-stone-800">{f.shortDescription}</p>
                          <p className="mt-3 text-sm text-stone-700">{f.rules.dims.width.label} {dimRangeText(f.rules.dims.width)}{f.rules.dims.depth ? ` · ${f.rules.dims.depth.label.toLowerCase()} ${dimRangeText(f.rules.dims.depth)}` : ""}</p>
                          <p className="mt-4">{f.fromPrice ? <>À partir de <span className="font-semibold tabular-nums">{formatSystemPrice(f.fromPrice.amountMinor, f.fromPrice.currency, f.fromPrice.taxBasis)}</span></> : "Prix sur devis"}</p>
                          <div className="relative z-10 mt-5 flex flex-wrap gap-2"><Link href={productHref(c.key, f.slug)} className="btn-secondary">Découvrir</Link><Link href={configuratorHref(f.slug)} className="btn-accent">Configurer</Link></div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ),
            }))} />
          </div>
        </div>
      </section>

      {/* B. Composez votre projet : aperçu de la 3D du configurateur, chargée à la demande */}
      {sceneModel && p0 && (
        <section className="section-y bg-sand-100" aria-labelledby="composer">
          <div className="container-x grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div>
              <p className="eyebrow">Configurateur</p>
              <h2 id="composer" className="mt-2 font-display text-display font-semibold">Composez votre projet</h2>
              <p className="mt-4 text-stone-800">Dimensions, pose, teinte et équipements : la vue 3D reprend vos cotes et le prix de la structure suit la grille. La visualisation est indicative ; un conseiller vérifie la faisabilité.</p>
              <div className="mt-6 flex flex-wrap gap-3"><Link href={configuratorHref(p0.slug)} className="btn-accent">Configurer la {p0.name} <ArrowRight className="size-4" aria-hidden="true" /></Link><Link href="/configurateur" className="btn-secondary">Tous les configurateurs</Link></div>
            </div>
            <ScenePreview model={sceneModel} poster={sceneShot ? <div className="relative aspect-[16/10]"><MediaImage media={sceneShot} sizes="(min-width: 1024px) 55vw, 92vw" className="absolute inset-0 size-full object-contain p-6" alt={`${sceneShot.alt} (image fixe)`} /></div> : <div className="aspect-[16/10]" />} />
          </div>
        </section>
      )}

      {/* C. Savoir-faire : détails des produits (documentation, pas des réalisations) */}
      {details.length >= 2 && (
        <section className="section-y" aria-labelledby="details">
          <div className="container-x">
            <h2 id="details" className="max-w-3xl font-display text-display"><span className="font-normal">La précision</span> <span className="font-semibold">dans le détail</span></h2>
            <p className="mt-3 max-w-2xl text-stone-700">Lames, coffres, coulisses et bras : rendus issus de la documentation des produits. Ce ne sont pas des réalisations HELIOSTORES.</p>
            <ul className="mt-10 grid gap-px border border-sand-200 bg-sand-200 sm:grid-cols-2 lg:grid-cols-4">
              {details.map((m) => (
                <li key={m.id} className="reveal bg-white">
                  <figure>
                    <div className="relative aspect-square"><MediaImage media={m} sizes="(min-width: 1024px) 24vw, (min-width: 640px) 46vw, 92vw" className="absolute inset-0 size-full object-contain p-4" /></div>
                    <figcaption className="border-t border-sand-200 px-4 py-3 text-sm"><span className="font-semibold">{m.model}</span><span className="block text-stone-700">{m.caption || m.title} · {NATURE[m.nature] ?? m.nature}</span></figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* D. Accompagnement */}
      <section className="section-y border-t border-sand-200 bg-white" aria-labelledby="parcours">
        <div className="container-x">
          <h2 id="parcours" className="font-display text-display"><span className="font-normal">Votre projet</span> <span className="font-semibold">étape par étape</span></h2>
          <ol className="mt-10 grid gap-px border border-sand-200 bg-sand-200 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, d, href], i) => (
              <li key={t} className="bg-white p-6">
                <span className="font-display text-4xl font-semibold text-sage-700 tabular-nums" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-display text-lg font-semibold"><Link href={href} className="hover:text-brand-700"><span className="sr-only">{i + 1}. </span>{t}</Link></h3>
                <p className="mt-2 text-sm text-stone-700">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* E. Prochaine action */}
      <section className="surface-night" aria-labelledby="cta-final">
        <div className="container-x flex flex-col items-start gap-6 py-14 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="cta-final" className="font-display text-display font-semibold">Un projet en tête ?</h2>
            <p className="mt-2 max-w-xl text-sand-200">Configurez votre produit à vos cotes, ou décrivez votre projet : un conseiller vous répond.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/configurateur" className="btn-cta px-6 text-base">Configurer mon projet <ArrowRight className="size-4" aria-hidden="true" /></Link>
            <Link href="/contact" className="btn border border-white/40 px-6 text-base text-sand-50 hover:bg-white/10">Nous contacter</Link>
          </div>
        </div>
      </section>
    </>
  );
}
