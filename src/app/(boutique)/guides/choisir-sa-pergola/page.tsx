import type { Metadata } from "next";
import Link from "next/link";
import { GuidePage } from "@/components/guides/guide-page";
import { Comparison } from "@/components/catalog/system-collection";
import { productHref, type CategoryKey } from "@/domain/categories";
import { listSystemFamilies } from "@/server/catalog/systems";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/server/seo/og";

const TITLE = "Choisir sa pergola";
const DESCRIPTION = "Adossée ou autoportante, lames orientables ou toiture en toile, tailles définies ou sur mesure : les critères pour choisir entre les pergolas du catalogue.";
export const metadata: Metadata = { title: TITLE, description: DESCRIPTION, alternates: { canonical: "/guides/choisir-sa-pergola" }, openGraph: { ...OG_BASE, title: TITLE, description: DESCRIPTION, url: "/guides/choisir-sa-pergola", type: "article", images: [DEFAULT_OG_IMAGE] } };

/** Aide au choix des pergolas : critères généraux et application aux modèles publiés (données documentées). */
export default async function Page() {
  const items = await listSystemFamilies("PERGOLAS");
  const link = (f: (typeof items)[number]) => <Link key={f.slug} href={productHref(f.category as CategoryKey, f.slug)} className="link-brand">{f.name}</Link>;
  const join = (xs: typeof items) => (xs.length ? xs.map((f, i) => <span key={f.slug}>{i ? ", " : ""}{link(f)}</span>) : <span>aucun modèle publié</span>);
  const mount = (code: string) => items.filter((f) => f.rules.mountings.some((m) => m.code === code && m.status !== "to_confirm"));
  return (
    <GuidePage path="/guides/choisir-sa-pergola" title={TITLE} intro={DESCRIPTION} related={[["/guides/prise-de-mesures", "Prise de mesures"], ["/guides/preparation-projet", "Préparer son projet"], ["/guides/adossee-ou-autoportee", "Adossée ou autoportante ?"], ["/guides/autorisation-urbanisme", "Autorisation d'urbanisme"], ["/guides/comparer-protections-solaires", "Comparer les protections solaires"]]}>
      <div className="prose-shop max-w-3xl">
        <h2>1. L&apos;implantation : adossée ou autoportante</h2>
        <p>Une pergola <strong>adossée</strong> est fixée au mur de la maison : le mur doit être porteur et libre sur toute la longueur. Une pergola <strong>autoportante</strong> repose sur quatre poteaux et peut être installée librement sur la terrasse ou dans le jardin.</p>
        <ul><li>Adossée : {join(mount("wall"))}.</li><li>Autoportante : {join(mount("freestanding"))}.</li></ul>
        <h2>2. La toiture : lames orientables ou toile</h2>
        <p>Les <strong>lames orientables</strong> pivotent pour régler l&apos;ombre et la ventilation. Une <strong>toiture en toile</strong> enroulable est une protection solaire : vérifiez sur la fiche du modèle son comportement par pluie et par vent.</p>
        <ul><li>Lames orientables : {join(items.filter((f) => f.rules.roof === "louvres"))}.</li><li>Toiture en toile : {join(items.filter((f) => f.rules.roof === "fabric"))}.</li></ul>
        <h2>3. Les dimensions : tailles définies ou sur mesure</h2>
        <p>Certains modèles sont fabriqués dans des tailles définies ; les autres se configurent au centimètre dans leurs limites. Au-delà, une étude hors gamme peut être demandée, sans garantie de fabrication.</p>
        <ul>{items.map((f) => <li key={f.slug}>{link(f)} : {f.rules.fixedSizes?.length ? `tailles définies (${f.rules.fixedSizes.length})` : "sur mesure"}.</li>)}</ul>
        <h2>4. Le vent et l&apos;usage</h2>
        <ul>{items.filter((f) => f.rules.wind?.text).map((f) => <li key={f.slug}>{link(f)} : {f.rules.wind!.text}</li>)}</ul>
        <h2>5. L&apos;électricité et les démarches</h2>
        <p>Une pergola motorisée a besoin d&apos;une alimentation électrique à proximité ; le raccordement, réalisé par un électricien, est étudié dans votre devis. Selon la surface et les règles locales, une autorisation d&apos;urbanisme peut être nécessaire : renseignez-vous auprès de votre mairie.</p>
      </div>
      {items.length > 1 && <Comparison items={items} />}
    </GuidePage>
  );
}
