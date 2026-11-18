import type { Metadata } from "next";
import Link from "next/link";
import { GuidePage } from "@/components/guides/guide-page";
import { CATEGORIES, productHref, type CategoryKey } from "@/domain/categories";
import { dimRangeText } from "@/domain/system";
import { listSystemFamilies } from "@/server/catalog/systems";
import { productNature } from "@/server/seo/product-nature";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/server/seo/og";

const TITLE = "Comparer les solutions de protection solaire";
const DESCRIPTION = "Pergola, screen, screen de toiture ou store banne : ce que protège chaque solution, sa pose, ses dimensions et ses consignes de vent, modèle par modèle.";
export const metadata: Metadata = { title: TITLE, description: DESCRIPTION, alternates: { canonical: "/guides/comparer-protections-solaires" }, openGraph: { ...OG_BASE, title: TITLE, description: DESCRIPTION, url: "/guides/comparer-protections-solaires", type: "article", images: [DEFAULT_OG_IMAGE] } };

const COVERS: Record<string, string> = {
  pergola: "Une terrasse, sous une toiture fixe à lames ou en toile",
  screen: "Une baie vitrée ou une façade, par l'extérieur",
  roof_blind: "Une véranda ou une toiture vitrée, par l'extérieur",
  awning: "Une terrasse ou un balcon, à la demande (toile repliable)",
};

/** Comparatif transversal des modèles publiés (hors moustiquaires) : uniquement des données documentées. */
export default async function Page() {
  const all = (await Promise.all(CATEGORIES.filter((c) => c.key !== "MOUSTIQUAIRES").map((c) => listSystemFamilies(c.key)))).flat();
  return (
    <GuidePage path="/guides/comparer-protections-solaires" title={TITLE} intro={DESCRIPTION} related={[["/guides/choisir-sa-pergola", "Choisir sa pergola"], ["/guides/choisir-son-screen-exterieur", "Choisir son screen extérieur"], ["/guides/choisir-toile-et-motorisation", "Choisir sa toile et sa motorisation"], ["/guides/prise-de-mesures", "Prise de mesures"]]}>
      <div className="prose-shop max-w-3xl">
        <h2>Quatre façons de se protéger du soleil</h2>
        <ul>
          <li><strong>La pergola</strong> crée un espace couvert sur la terrasse ; ses lames orientables ou sa toile règlent l&apos;ombre.</li>
          <li><strong>Le screen</strong> se déroule devant une baie ou une façade : il filtre le soleil et la chaleur avant le vitrage.</li>
          <li><strong>Le screen de toiture</strong> ombrage une véranda ou une verrière par l&apos;extérieur.</li>
          <li><strong>Le store banne</strong> ombrage une terrasse à la demande, puis se replie.</li>
        </ul>
        <p>Toutes ces solutions sont des protections solaires : par vent fort, la plupart doivent être repliées ou réglées selon les consignes du modèle, indiquées ci-dessous.</p>
      </div>
      <div className="mt-8 overflow-x-auto border border-sand-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-sm" data-testid="protection-compare">
          <caption className="sr-only">Comparatif des modèles de protection solaire</caption>
          <thead className="bg-sand-100"><tr><th scope="col" className="p-3 font-medium">Modèle</th><th scope="col" className="p-3 font-medium">Type</th><th scope="col" className="p-3 font-medium">Ce qu&apos;il protège</th><th scope="col" className="p-3 font-medium">Dimensions (module)</th><th scope="col" className="p-3 font-medium">Consigne de vent</th></tr></thead>
          <tbody className="divide-y divide-sand-200">
            {all.map((f) => (
              <tr key={f.slug} className="align-top">
                <th scope="row" className="p-3 font-semibold"><Link href={productHref(f.category as CategoryKey, f.slug)} className="link-brand">{f.name}</Link></th>
                <td className="p-3">{productNature(f.rules) ?? "—"}</td>
                <td className="p-3">{COVERS[f.rules.type] ?? "—"}{f.rules.notices?.find((n) => /pluie/i.test(n)) ? <span className="mt-1 block text-xs text-stone-700">{f.rules.notices.find((n) => /pluie/i.test(n))}</span> : null}</td>
                <td className="p-3 tabular-nums">{[`${f.rules.dims.width.label} ${dimRangeText(f.rules.dims.width)}`, f.rules.dims.depth ? `${f.rules.dims.depth.label} ${dimRangeText(f.rules.dims.depth)}` : null, f.rules.dims.height ? `${f.rules.dims.height.label} ${dimRangeText(f.rules.dims.height)}` : null].filter(Boolean).join(" · ")}</td>
                <td className="p-3">{f.rules.wind?.text ? `${f.rules.wind.text}${f.rules.wind.status === "to_confirm" ? " (à confirmer)" : ""}` : "voir la notice du modèle"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-stone-700">Dimensions documentées pour un module ; les valeurs « à confirmer » sont vérifiées au devis.</p>
    </GuidePage>
  );
}
