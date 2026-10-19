import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { FamilyCard } from "@/components/catalog/family-card";
import { listFamilies, priceFrom } from "@/server/catalog/queries";

export const metadata: Metadata = { title: "Pergolas bioclimatiques", description: "Gammes de pergolas bioclimatiques en aluminium : toit manuel ou motorisé, 7 dimensions, finitions anthracite, blanc ou noir, adossée ou autoportée." };

const ROOF = [["", "Tous les toits"], ["manual", "Toit manuel"], ["motorized", "Toit motorisé"]] as const;
const SORT = [["reco", "Recommandé"], ["price_asc", "Prix croissant"], ["price_desc", "Prix décroissant"]] as const;

export default async function PergolasPage(props: PageProps<"/pergolas">) {
  const sp = await props.searchParams;
  const roof = typeof sp.toit === "string" ? sp.toit : "";
  const finish = typeof sp.finition === "string" ? sp.finition : "";
  const dim = typeof sp.dimension === "string" ? sp.dimension : "";
  const sort = typeof sp.tri === "string" ? sp.tri : "reco";
  const all = await listFamilies(["PERGOLA_STANDARD", "PERGOLA_CUSTOM"]);
  const finishes = [...new Map(all.flatMap((f) => f.finishes.map((x) => [x.finishCode, x.finish] as const))).values()];
  const dims = [...new Map(all.flatMap((f) => f.dimensions.map((x) => [x.dimensionCode, x.dimension] as const))).values()];
  let list = all.filter((f) => (!roof || f.roof === roof) && (!finish || f.finishes.some((x) => x.finishCode === finish)) && (!dim || f.dimensions.some((x) => x.dimensionCode === dim)));
  if (sort === "price_asc") list = [...list].sort((a, b) => (priceFrom(a) ?? Infinity) - (priceFrom(b) ?? Infinity));
  if (sort === "price_desc") list = [...list].sort((a, b) => (priceFrom(b) ?? -1) - (priceFrom(a) ?? -1));
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: "Pergolas" }]} />
      <h1 className="mt-4 font-display text-4xl">Pergolas bioclimatiques</h1>
      <p className="mt-2 text-stone-700 max-w-2xl">Choisissez le niveau d'équipement, puis configurez implantation, dimension, finition et fermetures. Les prix affichés sont ceux de la configuration de base la moins chère.</p>
      <form method="get" className="mt-6 card p-4 grid gap-3 sm:grid-cols-4" aria-label="Filtres">
        <div><label className="label" htmlFor="toit">Toit</label><select id="toit" name="toit" defaultValue={roof} className="input">{ROOF.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="label" htmlFor="finition">Finition</label><select id="finition" name="finition" defaultValue={finish} className="input"><option value="">Toutes</option>{finishes.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}</select></div>
        <div><label className="label" htmlFor="dimension">Dimension</label><select id="dimension" name="dimension" defaultValue={dim} className="input"><option value="">Toutes</option>{dims.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}</select></div>
        <div><label className="label" htmlFor="tri">Tri</label><select id="tri" name="tri" defaultValue={sort} className="input">{SORT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="sm:col-span-4 flex gap-2"><button className="btn-primary" type="submit">Appliquer</button><Link href="/pergolas" className="btn-ghost">Réinitialiser</Link></div>
      </form>
      {list.length === 0 ? (
        <div className="mt-10 card p-10 text-center"><p className="font-display text-2xl">Aucune gamme ne correspond à ces filtres.</p><p className="mt-2 text-stone-700">Essayez une autre finition ou dimension, ou <Link href="/configurateur/sur-mesure" className="underline">passez par le sur-mesure</Link>.</p></div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {list.map((f) => <FamilyCard key={f.slug} f={f} href={f.kind === "PERGOLA_CUSTOM" ? "/configurateur/sur-mesure" : `/pergolas/${f.slug}`} finishCode={finish || "ANTHRACITE"} />)}
        </div>
      )}
    </div>
  );
}
