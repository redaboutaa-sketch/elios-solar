import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PergolaArt, AwningArt, ClosureArt, colorOf } from "@/components/illustrations/pergola";
import { Price } from "@/components/ui/price";
import { DemoBadge } from "@/components/ui/demo-badge";
import { listFamilies, priceFrom } from "@/server/catalog/queries";
import { BRAND } from "@/config/brand";
import { artKind } from "@/components/illustrations/art-kind";

export default async function HomePage() {
  const [pergolas, accessories, awnings] = await Promise.all([listFamilies(["PERGOLA_STANDARD", "PERGOLA_CUSTOM"]), listFamilies(["SIDE_CLOSURE", "OPTION"]), listFamilies(["AWNING"])]);
  const demo = pergolas.some((f) => f.dataStatus === "DEMO");
  return (
    <>
      <section className="container-x pt-10 pb-16 grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-copper-600 text-sm font-medium tracking-wide uppercase">Pergolas bioclimatiques & aménagement extérieur</p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] font-medium">Votre terrasse, pensée pour toutes les saisons.</h1>
          <p className="mt-5 text-lg text-stone-700 max-w-xl">Configurez votre pergola en quelques étapes : gamme, implantation, dimensions, finitions et fermetures latérales, avec un prix calculé en direct. Devis et accompagnement pour les projets sur mesure.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/configurateur" className="btn-accent">Configurer ma pergola <ArrowRight className="size-4" aria-hidden="true" /></Link>
            <Link href="/pergolas" className="btn-secondary">Découvrir les gammes</Link>
          </div>
          {demo && <p className="mt-4 text-xs text-stone-700">Préproduction : prix et références de démonstration. <DemoBadge /></p>}
        </div>
        <div className="card overflow-hidden"><PergolaArt lighting closures={{ left: "glass", front: "screen" }} className="w-full h-auto" title="Pergola bioclimatique avec paroi vitrée et store vertical" /></div>
      </section>

      <section className="bg-sand-100 py-16">
        <div className="container-x">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl">Trois gammes, une architecture</h2>
              <p className="mt-2 text-stone-700">Toit manuel ou motorisé, éclairage inclus ou en option : choisissez le niveau d'équipement, puis composez.</p>
            </div>
            <Link href="/comparer" className="hidden sm:inline-flex btn-ghost">Comparer les gammes</Link>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {pergolas.map((f) => {
              const from = priceFrom(f);
              const structure = colorOf("ANTHRACITE");
              return (
                <Link key={f.slug} href={f.kind === "PERGOLA_CUSTOM" ? "/configurateur/sur-mesure" : `/pergolas/${f.slug}`} className="card overflow-hidden group focus-visible:outline-2">
                  <PergolaArt structure={structure} blades={structure} lighting={f.lightingIncluded !== "none" && !!f.lightingIncluded} className="w-full h-auto" title={`Illustration ${f.name}`} />
                  <div className="p-5">
                    <h3 className="font-display text-xl group-hover:text-copper-600">{f.name}</h3>
                    <p className="mt-1 text-sm text-stone-700">{f.shortDescription}</p>
                    <p className="mt-3 text-sm">{from ? <>À partir de <Price cents={from} className="font-semibold" /></> : <span className="text-stone-700">Sur devis</span>}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container-x py-16 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl">Fermetures et accessoires</h2>
          <p className="mt-2 text-stone-700">Parois vitrées, persiennes, stores verticaux, éclairage et chauffage : chaque accessoire est proposé uniquement pour les dimensions et finitions compatibles.</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {accessories.slice(0, 6).map((f) => (
              <li key={f.slug}>
                <Link href={`/accessoires/${f.slug}`} className="flex items-center gap-4 card p-3 hover:border-ink">
                  <ClosureArt kind={artKind(f.slug)} className="w-24 h-auto rounded-lg shrink-0" />
                  <div><p className="font-medium">{f.name}</p><p className="text-xs text-stone-700">{f.shortDescription}</p></div>
                </Link>
              </li>
            ))}
          </ul>
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
            ["Montage au choix", "Montage par vos soins avec notice, ou montage professionnel chiffré selon la configuration dans les zones couvertes.", "/livraison-installation", "Livraison & installation"],
            ["Un projet, une configuration", "Sauvegardez, dupliquez et partagez vos configurations ; reprenez-les depuis votre compte.", "/compte/projets", "Mes projets"],
          ].map(([t, d, href, cta]) => (
            <div key={t}><h2 className="font-display text-2xl">{t}</h2><p className="mt-2 text-sand-200">{d}</p><Link href={href!} className="mt-4 inline-flex items-center gap-1 underline underline-offset-4">{cta} <ArrowRight className="size-4" aria-hidden="true" /></Link></div>
          ))}
        </div>
      </section>
      <section className="container-x py-12 text-sm text-stone-700">
        <p>{BRAND.name} est un nom d'affichage provisoire. Aucun avis client, label ou chiffre de ventes n'est affiché tant qu'il n'est pas vérifiable.</p>
      </section>
    </>
  );
}

