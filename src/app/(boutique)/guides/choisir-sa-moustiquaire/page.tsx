import type { Metadata } from "next";
import Link from "next/link";
import { GuidePage } from "@/components/guides/guide-page";
import { productHref, type CategoryKey } from "@/domain/categories";
import { listDraftFamilies, listSystemFamilies } from "@/server/catalog/systems";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/server/seo/og";

const TITLE = "Choisir sa moustiquaire selon l'ouverture";
const DESCRIPTION = "Plissée, enroulable, coulissante ou à cadre fixe : quel type de moustiquaire pour une fenêtre, une porte-fenêtre ou une baie, et quels modèles sont disponibles.";
export const metadata: Metadata = { title: TITLE, description: DESCRIPTION, alternates: { canonical: "/guides/choisir-sa-moustiquaire" }, openGraph: { ...OG_BASE, title: TITLE, description: DESCRIPTION, url: "/guides/choisir-sa-moustiquaire", type: "article", images: [DEFAULT_OG_IMAGE] } };

/** Types d'ouverture : définitions générales ; disponibilité lue dans le catalogue (publié ou en préparation). */
const TYPES = [
  { opening: "pleated", label: "Plissée", use: "Porte-fenêtre, baie ou porte coulissante : la toile se replie en accordéon sur le côté, avec un rail inférieur bas pour le passage." },
  { opening: "roller_vertical", label: "Enroulable verticale", use: "Fenêtre : la toile s'enroule dans un coffre en haut de l'ouverture." },
  { opening: "sliding", label: "Coulissante", use: "Grande baie coulissante : des cadres coulissent sur des rails, comme les vantaux de la baie." },
  { opening: "fixed", label: "Cadre fixe", use: "Fenêtre que l'on ouvre sans y passer : un cadre posé dans l'ouverture, retiré à la main." },
] as const;

const DRAFT_OPENING: Record<string, string> = { moskiup: "roller_vertical", moskislide: "sliding", moskifix: "fixed" };

export default async function Page() {
  const [items, draftRows] = await Promise.all([listSystemFamilies("MOUSTIQUAIRES"), listDraftFamilies("MOUSTIQUAIRES")]);
  // type d'ouverture des modèles en préparation : lu dans le catalogue (le slug suffit, aucune donnée technique publiée)
  const drafts = draftRows.map((d) => ({ ...d, opening: DRAFT_OPENING[d.slug] ?? null }));
  return (
    <GuidePage path="/guides/choisir-sa-moustiquaire" title={TITLE} intro={DESCRIPTION} related={[["/guides/prise-de-mesures", "Prise de mesures"], ["/moustiquaires", "Toutes les moustiquaires"]]}>
      <div className="max-w-4xl overflow-x-auto border border-sand-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm" data-testid="insect-guide">
          <caption className="sr-only">Types de moustiquaires et modèles</caption>
          <thead className="bg-sand-100"><tr><th scope="col" className="p-3 font-medium">Type</th><th scope="col" className="p-3 font-medium">Pour quelle ouverture</th><th scope="col" className="p-3 font-medium">Modèles</th></tr></thead>
          <tbody className="divide-y divide-sand-200">
            {TYPES.map((t) => {
              const pub = items.filter((f) => f.rules.insect?.opening === t.opening);
              return (
                <tr key={t.opening} className="align-top">
                  <th scope="row" className="p-3 font-semibold">{t.label}</th>
                  <td className="p-3">{t.use}</td>
                  <td className="p-3">{pub.length ? pub.map((f, i) => <span key={f.slug}>{i ? ", " : ""}<Link href={productHref(f.category as CategoryKey, f.slug)} className="link-brand">{f.name}</Link>{f.rules.insect?.leaves === 2 ? " (deux vantaux)" : ""}</span>) : <span className="text-stone-700">{drafts.some((d) => d.opening === t.opening) ? "en préparation (devis possible)" : "non proposé"}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="prose-shop mt-8 max-w-3xl">
        <h2>Mesurer l&apos;ouverture</h2>
        <p>Pour une pose dans l&apos;embrasure, mesurez la largeur entre les tableaux et la hauteur entre le linteau et l&apos;appui, à trois endroits, et retenez la plus petite valeur. Pour une pose en applique, mesurez l&apos;encadrement sur lequel la moustiquaire sera fixée. Le <Link href="/guides/prise-de-mesures">guide de prise de mesures</Link> détaille les points de mesure.</p>
        <h2>Modèles en préparation</h2>
        <p>Les modèles enroulables, coulissants et à cadre fixe seront configurables lorsque leurs dimensions seront confirmées. Vous pouvez déjà <Link href="/devis">demander un devis</Link> avec vos mesures : elles sont transmises comme un souhait, sans valoir validation technique.</p>
      </div>
    </GuidePage>
  );
}
