import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Price } from "@/components/ui/price";
import { listFamilies, priceFrom } from "@/server/catalog/queries";

export const metadata: Metadata = { title: "Comparer les gammes de pergolas", description: "Comparaison des trois gammes standard : toit, éclairage, rails d'accessoires, finitions, dimensions et prix de base." };

export default async function ComparePage() {
  const fams = (await listFamilies(["PERGOLA_STANDARD"])).slice(0, 3);
  const rows: Array<[string, (f: (typeof fams)[number]) => React.ReactNode]> = [
    ["Prix de base (à partir de)", (f) => (priceFrom(f) ? <Price cents={priceFrom(f)!} className="font-semibold" /> : "—")],
    ["Toit", (f) => (f.roof === "motorized" ? "Motorisé, télécommande" : "Manuel (manivelle)")],
    ["Éclairage", (f) => (f.lightingIncluded === "gutter_led" ? "LED de gouttière inclus" : f.lightingIncluded === "blade_led" ? "LED intégré aux lames inclus" : "En option (bandes LED)")],
    ["Rails d'accessoires", (f) => `${f.accessoryRails ?? "—"} par poutre`],
    ["Finitions", (f) => f.finishes.map((x) => x.finish.label).join(", ")],
    ["Dimensions", (f) => f.dimensions.map((d) => d.dimension.label).join(" · ")],
    ["Implantation", (f) => f.mountings.map((m) => (m === "WALL" ? "adossée" : "autoportée")).join(" / ")],
    ["Électricité requise", (f) => (f.roof === "motorized" ? "Oui (230 V)" : "Non")],
    ["Données", (f) => (f.dataStatus === "DEMO" ? "démonstration" : f.dataStatus.toLowerCase())],
  ];
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: "Comparer" }]} />
      <h1 className="mt-4 font-display text-4xl">Comparer les gammes</h1>
      <p className="mt-2 text-stone-700">Tableau alimenté par les données du catalogue. Les caractéristiques non confirmées par le fournisseur sont signalées sur chaque fiche.</p>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm card">
          <thead><tr><th className="p-3 text-left">Critère</th>{fams.map((f) => <th key={f.slug} className="p-3 text-left font-display text-lg"><Link href={`/pergolas/${f.slug}`} className="hover:underline">{f.name}</Link></th>)}</tr></thead>
          <tbody>{rows.map(([label, cell]) => <tr key={label} className="border-t border-sand-200"><th scope="row" className="p-3 text-left font-medium align-top">{label}</th>{fams.map((f) => <td key={f.slug} className="p-3 align-top">{cell(f)}</td>)}</tr>)}</tbody>
          <tfoot><tr className="border-t border-sand-200"><td className="p-3" />{fams.map((f) => <td key={f.slug} className="p-3"><Link href={`/configurateur?gamme=${f.slug}`} className="btn-primary w-full">Configurer</Link></td>)}</tr></tfoot>
        </table>
      </div>
    </div>
  );
}
