import type { Metadata } from "next";
import Link from "next/link";
import { GuidePage } from "@/components/guides/guide-page";
import { Comparison } from "@/components/catalog/system-collection";
import { productHref, type CategoryKey } from "@/domain/categories";
import { listSystemFamilies } from "@/server/catalog/systems";
import { DEFAULT_OG_IMAGE, OG_BASE } from "@/server/seo/og";

const TITLE = "Choisir son screen extérieur";
const DESCRIPTION = "Baie, façade ou toiture vitrée, pose en niche ou en façade, choix de la toile et comportement au vent : les critères pour choisir un screen extérieur.";
export const metadata: Metadata = { title: TITLE, description: DESCRIPTION, alternates: { canonical: "/guides/choisir-son-screen-exterieur" }, openGraph: { ...OG_BASE, title: TITLE, description: DESCRIPTION, url: "/guides/choisir-son-screen-exterieur", type: "article", images: [DEFAULT_OG_IMAGE] } };

/** Aide au choix des screens : critères, toiles documentées et consignes de vent des modèles publiés. */
export default async function Page() {
  const items = await listSystemFamilies("SCREENS");
  const link = (f: (typeof items)[number]) => <Link href={productHref(f.category as CategoryKey, f.slug)} className="link-brand">{f.name}</Link>;
  const facade = items.filter((f) => f.rules.type === "screen");
  const roof = items.filter((f) => f.rules.type === "roof_blind");
  return (
    <GuidePage path="/guides/choisir-son-screen-exterieur" title={TITLE} intro={DESCRIPTION} related={[["/guides/choisir-toile-et-motorisation", "Choisir sa toile et sa motorisation"], ["/guides/prise-de-mesures", "Prise de mesures"], ["/guides/comparer-protections-solaires", "Comparer les protections solaires"]]}>
      <div className="prose-shop max-w-3xl">
        <h2>1. Ce que vous voulez protéger</h2>
        <ul>
          <li><strong>Une baie vitrée ou une façade</strong> : un screen vertical, à toile tendue guidée dans des coulisses latérales{facade.length ? <> ({facade.map((f, i) => <span key={f.slug}>{i ? ", " : ""}{link(f)}</span>)})</> : null}.</li>
          <li><strong>Une véranda, une verrière ou une toiture vitrée</strong> : un screen de toiture, posé à l&apos;extérieur de la toiture{roof.length ? <> ({roof.map((f, i) => <span key={f.slug}>{i ? ", " : ""}{link(f)}</span>)})</> : null}.</li>
        </ul>
        <h2>2. La pose</h2>
        <p><strong>En niche</strong>, le screen se loge entre les tableaux de la baie ; <strong>en façade</strong>, il se fixe sur le mur, devant la baie. Les poses documentées pour chaque modèle :</p>
        <ul>{items.map((f) => <li key={f.slug}>{link(f)} : {f.rules.mountings.map((m) => `${m.label.toLowerCase()}${m.status === "to_confirm" ? " (à confirmer)" : ""}`).join(", ")}.</li>)}</ul>
        <h2>3. La toile</h2>
        <p>Le <strong>facteur d&apos;ouverture</strong> indique la part de la toile qui laisse passer lumière et vue : plus il est faible, plus la toile occulte. Toiles documentées :</p>
        <ul>{items.flatMap((f) => (f.rules.fabrics ?? []).map((x) => <li key={`${f.slug}-${x.code}`}>{f.name} — {x.label}{x.description ? ` : ${x.description}` : ""}{x.status === "to_confirm" ? " (à confirmer)" : ""}</li>))}</ul>
        <h2>4. La commande et le vent</h2>
        <p>Les screens du catalogue sont à commande électrique : prévoyez une alimentation et un raccordement par un électricien. Par vent fort, un screen doit être relevé :</p>
        <ul>{items.filter((f) => f.rules.wind?.text).map((f) => <li key={f.slug}>{link(f)} : {f.rules.wind!.text}</li>)}</ul>
        {items.some((f) => f.rules.notices?.length) && <ul>{items.flatMap((f) => (f.rules.notices ?? []).map((n) => <li key={`${f.slug}-${n}`}>{f.name} : {n}</li>))}</ul>}
      </div>
      {items.length > 1 && <Comparison items={items} />}
    </GuidePage>
  );
}
