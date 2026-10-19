import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { RangeComparison } from "@/components/catalog/range-comparison";
import { listFamilies } from "@/server/catalog/queries";
import { loadCatalog } from "@/server/catalog/load";
import { rangeHighlights } from "@/server/catalog/highlights";

export const metadata: Metadata = { title: "Comparer les gammes de pergolas", description: "Comparaison des trois gammes standard : toit, éclairage, rails d'accessoires, fermetures compatibles, finitions, dimensions et prix de base." };

export default async function ComparePage() {
  const [fams, catalog] = await Promise.all([listFamilies(["PERGOLA_STANDARD"]), loadCatalog()]);
  const three = fams.slice(0, 3);
  const highlights = Object.fromEntries(three.map((x) => [x.slug, rangeHighlights(catalog, x.slug)]));
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: "Comparer" }]} />
      <h1 className="mt-4 font-display text-4xl">Comparer les gammes</h1>
      <p className="mt-2 text-stone-700">Tableau alimenté par les données du catalogue et les règles de compatibilité. Les caractéristiques non confirmées par le fournisseur sont signalées sur chaque fiche.</p>
      <div className="mt-8"><RangeComparison fams={three} highlights={highlights} /></div>
    </div>
  );
}
