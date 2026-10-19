import Link from "next/link";
import { ArrowRight, Sun, Droplets, Layers, Wrench } from "lucide-react";
import { PergolaArt, AwningArt, ClosureArt, colorOf } from "@/components/illustrations/pergola";
import { TerraceScene } from "@/components/illustrations/scene";
import { Price } from "@/components/ui/price";
import { DemoBadge } from "@/components/ui/demo-badge";
import { listFamilies, priceFrom } from "@/server/catalog/queries";
import { BRAND } from "@/config/brand";
import { artKind } from "@/components/illustrations/art-kind";
import { RangeCard } from "@/components/catalog/range-card";
import { loadCatalog } from "@/server/catalog/load";
import { rangeHighlights } from "@/server/catalog/highlights";

export default async function HomePage() {
  const [pergolas, accessories, awnings, catalog] = await Promise.all([listFamilies(["PERGOLA_STANDARD", "PERGOLA_CUSTOM"]), listFamilies(["SIDE_CLOSURE", "OPTION"]), listFamilies(["AWNING"]), loadCatalog()]);
  const demo = pergolas.some((f) => f.dataStatus === "DEMO");
  return (
    <>
      <section className="relative isolate overflow-hidden bg-sand-100">
        <div className="container-x grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,46%)_minmax(0,54%)] lg:items-center py-10 lg:py-12">
          <div className="relative z-10 py-4 lg:py-16">
            <p className="text-copper-600 text-sm font-medium tracking-[0.18em] uppercase">Pergolas bioclimatiques · stores bannes · fermetures</p>
            <h1 className="mt-4 font-display text-5xl sm:text-6xl xl:text-7xl leading-[1.02] font-medium">Votre terrasse, pensée pour toutes les saisons.</h1>
            <p className="mt-6 text-lg sm:text-xl text-stone-800 max-w-xl">Configurez votre pergola en huit étapes : gamme, implantation, dimensions, finitions, fermetures côté par côté et options, avec un prix calculé en direct. Devis et accompagnement pour le sur mesure.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/configurateur" className="btn-accent text-base px-6 py-3.5">Configurer ma pergola <ArrowRight className="size-4" aria-hidden="true" /></Link>
              <Link href="/comparer" className="btn-secondary text-base px-6 py-3.5">Comparer les gammes</Link>
            </div>
            {demo && <p className="mt-5 text-xs text-stone-700">Préproduction : prix et références de démonstration. <DemoBadge /></p>}
          </div>
          <div className="relative min-w-0 w-full rounded-2xl overflow-hidden shadow-soft" style={{ aspectRatio: "5 / 3" }}>
            <TerraceScene lighting closures={{ left: "glass", right: "screen" }} className="absolute inset-0 w-full h-full" title="Terrasse au crépuscule avec pergola bioclimatique, paroi vitrée et store vertical" />
          </div>
        </div>
      </section>

      <section className="container-x py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl">Trois gammes, une architecture.</h2>
            <p className="mt-2 text-stone-700 max-w-2xl">Toit manuel ou motorisé, éclairage inclus ou en option, un à trois rails pour les fermetures : choisissez le niveau d'équipement puis composez côté par côté.</p>
          </div>
          <Link href="/comparer" className="btn-ghost">Comparer en détail</Link>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {pergolas.map((f) => <RangeCard key={f.slug} f={f} highlights={rangeHighlights(catalog, f.slug)} />)}
        </div>
      </section>

      <section className="bg-sand-100 py-16">
        <div className="container-x grid gap-8 md:grid-cols-4">
          {[
            [Sun, "Lames orientables", "Soleil, ombre ou ventilation : orientez les lames selon l'heure ; motorisées sur les gammes Pro et Max."],
            [Droplets, "Toit étanche", "Lames fermées, les gouttières intégrées évacuent l'eau par les poteaux."],
            [Layers, "Fermetures modulaires", "Parois vitrées, persiennes et stores ZIP par ouverture, ajoutables plus tard après vérification de compatibilité."],
            [Wrench, "Montage au choix", "Par vos soins avec notice, ou par un installateur partenaire chiffré selon la configuration."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Sun;
            return <div key={String(t)}><I className="size-7 text-copper-600" aria-hidden="true" /><h3 className="mt-3 font-display text-xl">{String(t)}</h3><p className="mt-1 text-sm text-stone-700">{String(d)}</p></div>;
          })}
        </div>
      </section>

      <section className="container-x py-16 grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl">Fermetures et accessoires</h2>
          <p className="mt-2 text-stone-700">Chaque accessoire n'est proposé que pour les dimensions, finitions et gammes compatibles. Les cas non confirmés passent par un devis.</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {accessories.slice(0, 6).map((f) => (
              <li key={f.slug}>
                <Link href={`/accessoires/${f.slug}`} className="flex items-center gap-4 card p-3 hover:border-ink">
                  <ClosureArt kind={artKind(f.slug)} className="w-24 h-auto rounded-lg shrink-0" />
                  <div><p className="font-medium">{f.name}</p><p className="text-xs text-stone-700">{f.shortDescription}</p>{priceFrom(f) && <p className="text-xs mt-1">dès <Price cents={priceFrom(f)!} className="font-semibold" /></p>}</div>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/accessoires" className="btn-secondary mt-6">Tous les accessoires</Link>
        </div>
        <div>
          <h2 className="font-display text-3xl">Stores bannes</h2>
          <p className="mt-2 text-stone-700">Coffre intégral motorisé, éclairage et télécommande inclus. Seules les combinaisons largeur × avancée réellement fabriquées sont proposées.</p>
          {awnings.map((f) => (
            <Link key={f.slug} href={`/stores-bannes/${f.slug}`} className="mt-6 block card overflow-hidden hover:border-ink">
              <AwningArt className="w-full h-auto" />
              <div className="p-5 flex items-center justify-between"><span className="font-display text-xl">{f.name}</span>{priceFrom(f) && <span className="text-sm">À partir de <Price cents={priceFrom(f)!} className="font-semibold" /></span>}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-anthracite text-sand-50 py-16">
        <div className="container-x grid gap-8 md:grid-cols-3">
          {[
            ["Étude de votre projet", "Dimensions, implantation, autorisation d'urbanisme : nos conseillers valident la faisabilité avant commande.", "/devis", "Demander un devis"],
            ["Prix transparent", "Pergola, fermetures, options, montage et livraison sont chiffrés ligne par ligne et recalculés côté serveur.", "/configurateur", "Voir le configurateur"],
            ["Un projet, une configuration", "Sauvegardez, dupliquez et partagez vos configurations ; reprenez-les depuis votre compte ou le panier.", "/compte/projets", "Mes projets"],
          ].map(([t, d, href, cta]) => (
            <div key={t}><h2 className="font-display text-2xl">{t}</h2><p className="mt-2 text-sand-200">{d}</p><Link href={href!} className="mt-4 inline-flex items-center gap-1 underline underline-offset-4">{cta} <ArrowRight className="size-4" aria-hidden="true" /></Link></div>
          ))}
        </div>
      </section>
      <section className="container-x py-10 text-sm text-stone-700">
        <p>{BRAND.name} est un nom d'affichage provisoire. Aucun avis client, label ou chiffre de ventes n'est affiché tant qu'il n'est pas vérifiable. Visuels : rendus originaux en attendant des photographies autorisées.</p>
      </section>
      <div className="hidden"><PergolaArt structure={colorOf("ANTHRACITE")} /></div>
    </>
  );
}
