import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { FamilyCard } from "@/components/catalog/family-card";
import { listFamilies, priceFrom } from "@/server/catalog/queries";

export const metadata: Metadata = { title: "Accessoires et fermetures latérales", description: "Parois vitrées, persiennes aluminium, stores verticaux ZIP, bandes LED, chauffage et lanternes compatibles avec nos pergolas." };

export default async function AccessoiresPage(props: PageProps<"/accessoires">) {
  const sp = await props.searchParams;
  const type = typeof sp.type === "string" ? sp.type : "";
  const sort = typeof sp.tri === "string" ? sp.tri : "reco";
  let list = await listFamilies(["SIDE_CLOSURE", "OPTION"]);
  if (type === "fermetures") list = list.filter((f) => f.kind === "SIDE_CLOSURE");
  if (type === "options") list = list.filter((f) => f.kind === "OPTION");
  if (sort === "price_asc") list = [...list].sort((a, b) => (priceFrom(a) ?? Infinity) - (priceFrom(b) ?? Infinity));
  if (sort === "price_desc") list = [...list].sort((a, b) => (priceFrom(b) ?? -1) - (priceFrom(a) ?? -1));
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: "Accessoires" }]} />
      <h1 className="mt-4 font-display text-4xl">Accessoires et fermetures</h1>
      <p className="mt-2 text-stone-700 max-w-2xl">Chaque accessoire s'achète seul après vérification de sa compatibilité avec votre pergola (gamme, dimension, implantation, finition), ou directement depuis le configurateur.</p>
      <form method="get" className="mt-6 card p-4 flex flex-wrap gap-3 items-end" aria-label="Filtres">
        <div><label className="label" htmlFor="type">Type</label><select id="type" name="type" defaultValue={type} className="input"><option value="">Tous</option><option value="fermetures">Fermetures latérales</option><option value="options">Éclairage, chauffage, confort</option></select></div>
        <div><label className="label" htmlFor="tri">Tri</label><select id="tri" name="tri" defaultValue={sort} className="input"><option value="reco">Recommandé</option><option value="price_asc">Prix croissant</option><option value="price_desc">Prix décroissant</option></select></div>
        <button className="btn-primary" type="submit">Appliquer</button><Link href="/accessoires" className="btn-ghost">Réinitialiser</Link>
      </form>
      {list.length === 0 ? <p className="mt-10 card p-10 text-center">Aucun accessoire dans cette catégorie.</p> : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{list.map((f) => <FamilyCard key={f.slug} f={f} href={`/accessoires/${f.slug}`} />)}</div>
      )}
    </div>
  );
}
