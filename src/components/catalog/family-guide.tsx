import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CategoryKey } from "@/domain/categories";
import { productHref } from "@/domain/categories";
import { dimRangeText } from "@/domain/system";
import type { listSystemFamilies } from "@/server/catalog/systems";
import { productNature } from "@/server/seo/product-nature";

type Item = Awaited<ReturnType<typeof listSystemFamilies>>[number];

/**
 * Contenu éditorial d'une page de famille : usages, aide au choix (calculée depuis les règles documentées de chaque
 * modèle), définitions, prise de mesures, déroulement de la demande, questions fréquentes et guides applicables.
 * Aucune zone desservie, garantie, délai ou prix n'est affirmé ; un point « à confirmer » reste présenté comme tel.
 */
const CONTENT: Record<CategoryKey, { usages: string[]; terms: Array<[string, string]>; faq: Array<[string, React.ReactNode]>; guides: Array<[string, string]> }> = {
  PERGOLAS: {
    usages: ["Couvrir une terrasse contre la maison (pergola adossée) ou dans le jardin (pergola autoportante).", "Doser l'ombre et la ventilation avec une toiture à lames orientables, ou ombrager avec une toiture en toile enroulable.", "Créer un espace extérieur utilisable plus longtemps, sans en faire une pièce close : les fermetures latérales sont étudiées au cas par cas."],
    terms: [["Lames orientables", "Toiture formée de lames en aluminium qui pivotent pour régler l'ombre et la ventilation ; fermées, elles couvrent la terrasse ; l'évacuation de l'eau est décrite sur la fiche de chaque modèle."], ["Toiture en toile", "Toile enroulable tendue entre les profilés : une protection solaire, qui ne protège pas de la pluie."], ["Adossée / autoportante", "Adossée : fixée au mur de la maison, deux poteaux. Autoportante : quatre poteaux, sans appui sur un mur."], ["Avancée", "Distance depuis le mur (ou le côté de référence) jusqu'à l'avant de la pergola."], ["Hauteur libre", "Hauteur de passage sous la structure."]],
    faq: [["Faut-il une autorisation d'urbanisme ?", <>Cela dépend de la surface, de l'implantation et des règles locales. Renseignez-vous auprès de votre mairie avant de commander ; voir notre <Link href="/guides/autorisation-urbanisme" className="link-brand">guide sur l'autorisation d'urbanisme</Link> (France).</>], ["La pose est-elle comprise ?", "La pose, la livraison, les fixations et le raccordement électrique sont étudiés et chiffrés dans votre devis, selon votre projet."], ["Peut-on fermer les côtés ?", "Les fermetures latérales ne sont pas documentées pour tous les modèles : votre souhait est transmis avec la demande et étudié au devis, sans garantie de compatibilité."]],
    guides: [["/guides/choisir-sa-pergola", "Choisir sa pergola"], ["/guides/prise-de-mesures", "Prise de mesures"], ["/guides/preparation-projet", "Préparer son projet"], ["/guides/adossee-ou-autoportee", "Pergola adossée ou autoportante ?"]],
  },
  SCREENS: {
    usages: ["Protéger une baie vitrée ou une façade du soleil et de la chaleur, en gardant la vue vers l'extérieur selon la toile choisie.", "Ombrager une véranda, une verrière ou une toiture vitrée par l'extérieur (screen de toiture)."],
    terms: [["Screen", "Store extérieur à toile tendue, guidée latéralement, qui se déroule depuis un coffre."], ["Guidage zip", "La toile est tenue dans les coulisses par une fermeture à glissière soudée sur ses bords : elle reste tendue et ne laisse pas de jour sur les côtés."], ["Facteur d'ouverture", "Part de la toile laissant passer la lumière et la vue (par exemple 1 % : très occultant)."], ["Pose en niche / en façade", "En niche : entre les tableaux de la baie. En façade : devant la baie, sur le mur."]],
    faq: [["Que faire par vent fort ?", "Le screen doit être relevé dans son coffre au-delà de la vitesse de vent admissible ; un automatisme de vent est recommandé mais ne dispense pas de cette règle."], ["Le screen est-il motorisé ?", "Les screens proposés sont à commande électrique : une alimentation et un raccordement sont à prévoir."], ["La pose est-elle comprise ?", "La pose, la livraison et le raccordement électrique sont étudiés et chiffrés dans votre devis, selon votre projet."]],
    guides: [["/guides/choisir-son-screen-exterieur", "Choisir son screen extérieur"], ["/guides/choisir-toile-et-motorisation", "Choisir sa toile et sa motorisation"], ["/guides/prise-de-mesures", "Prise de mesures"]],
  },
  STORES_BANNES: {
    usages: ["Ombrager une terrasse ou un balcon à la demande, puis replier la toile.", "Choisir le niveau de protection de la toile repliée : coffre, semi-coffre ou sans coffre."],
    terms: [["Coffre", "Boîtier qui enferme la toile et les bras repliés : la toile est protégée des intempéries et de la saleté."], ["Semi-coffre", "La toile repliée est protégée par le dessus ; le dessous reste partiellement ouvert."], ["Sans coffre", "Toile et bras visibles une fois repliés ; un auvent peut protéger le dessus."], ["Avancée", "Longueur de déploiement des bras, du mur jusqu'à la barre de charge."], ["Lambrequin", "Bande de toile qui pend à l'avant du store."]],
    faq: [["Que faire par vent fort ou par pluie ?", "Un store banne est une protection solaire : il doit être replié par vent fort ; les consignes de chaque modèle figurent sur sa fiche et dans sa notice."], ["Manivelle ou moteur ?", "Selon le modèle : certains existent à manivelle ou motorisés, d'autres uniquement motorisés (voir le comparatif)."], ["La pose est-elle comprise ?", "La pose, la livraison, les fixations et le raccordement électrique sont étudiés et chiffrés dans votre devis, selon votre projet."]],
    guides: [["/guides/comparer-protections-solaires", "Comparer les protections solaires"], ["/guides/choisir-toile-et-motorisation", "Choisir sa toile et sa motorisation"], ["/guides/prise-de-mesures", "Prise de mesures"]],
  },
  MOUSTIQUAIRES: {
    usages: ["Laisser une porte-fenêtre ou une baie ouverte sans laisser entrer les insectes.", "Choisir le type d'ouverture selon le passage : plissée pour les portes et baies, avec un seuil bas."],
    terms: [["Moustiquaire plissée", "Toile plissée qui se replie en accordéon sur le côté ; adaptée aux portes-fenêtres et aux baies."], ["Seuil bas", "Rail inférieur de faible hauteur, pour limiter la gêne au passage."], ["Vantail", "Partie mobile : une moustiquaire à deux vantaux s'ouvre depuis le centre."]],
    faq: [["Quels types de moustiquaires proposez-vous ?", "Les modèles plissés sont configurables. Les modèles enroulables, coulissants et à cadre fixe sont en préparation : vous pouvez déjà demander un devis avec vos mesures."], ["Comment prendre les mesures ?", <>Mesurez la largeur et la hauteur de l'ouverture en plusieurs points et retenez la plus petite valeur ; voir le <Link href="/guides/prise-de-mesures" className="link-brand">guide de prise de mesures</Link>.</>]],
    guides: [["/guides/choisir-sa-moustiquaire", "Choisir sa moustiquaire selon l'ouverture"], ["/guides/prise-de-mesures", "Prise de mesures"]],
  },
};

export function modelSummary(f: Item): string {
  const r = f.rules;
  const nature = productNature(r) ?? "";
  const dims = [`${r.dims.width.label.toLowerCase()} ${dimRangeText(r.dims.width)}`, r.dims.depth ? `${r.dims.depth.label.toLowerCase()} ${dimRangeText(r.dims.depth)}` : null, r.dims.height ? `${r.dims.height.label.toLowerCase()} ${dimRangeText(r.dims.height)}` : null].filter(Boolean).join(", ");
  const poses = r.mountings.filter((m) => m.status !== "to_confirm").map((m) => m.label.toLowerCase());
  const made = r.fixedSizes?.length ? "fabriquée en tailles définies" : "sur mesure";
  return `${nature}${nature ? ", " : ""}${made}${poses.length ? `, pose ${poses.join(" ou ")}` : ""} ; ${dims}.`;
}

export function FamilyGuide({ category, items }: { category: CategoryKey; items: Item[] }) {
  const c = CONTENT[category];
  return (
    <div data-testid="family-guide">
      <section className="section-y border-t border-sand-200" aria-labelledby="usages">
        <h2 id="usages" className="font-display text-display font-semibold">Usages</h2>
        <ul className="mt-4 max-w-3xl list-disc space-y-1 pl-5 text-stone-800">{c.usages.map((u) => <li key={u}>{u}</li>)}</ul>
        {items.length > 0 && (
          <>
            <h3 className="mt-8 font-display text-xl font-semibold">Quel modèle pour quel projet ?</h3>
            <ul className="mt-3 max-w-3xl space-y-2 text-stone-800">{items.map((f) => <li key={f.slug}><Link href={productHref(category, f.slug)} className="font-semibold link-brand">{f.name}</Link> : {modelSummary(f)}{f.rules.notices?.[0] && f.rules.notices[0].length < 200 ? ` ${f.rules.notices[0]}` : ""}</li>)}</ul>
            <p className="mt-3 max-w-3xl text-sm text-stone-700">Cotes documentées pour un module ; les points « à confirmer » sont vérifiés au devis.</p>
          </>
        )}
      </section>
      <section className="section-y border-t border-sand-200" aria-labelledby="definitions">
        <h2 id="definitions" className="font-display text-display font-semibold">Les termes à connaître</h2>
        <dl className="mt-4 grid max-w-4xl gap-x-8 gap-y-4 md:grid-cols-2">{c.terms.map(([t, d]) => <div key={t}><dt className="font-semibold">{t}</dt><dd className="mt-1 text-sm text-stone-800">{d}</dd></div>)}</dl>
      </section>
      <section className="section-y border-t border-sand-200" aria-labelledby="deroulement">
        <h2 id="deroulement" className="font-display text-display font-semibold">Mesures et demande de devis</h2>
        <ol className="mt-4 grid max-w-5xl gap-4 md:grid-cols-4">
          {[
            ["Mesurer", <>Relevez vos cotes avec le <Link href="/guides/prise-de-mesures" className="link-brand">guide de prise de mesures</Link> et son outil de contrôle.</>],
            ["Configurer", "Choisissez le modèle, les dimensions, la pose et les équipements : la visualisation suit vos choix. Aucun compte n'est nécessaire pour explorer."],
            ["Envoyer la demande", "Indiquez vos coordonnées ; la configuration et sa visualisation sont jointes à la demande."],
            ["Recevoir le devis", "Un conseiller vérifie la faisabilité et les points à confirmer, puis établit le devis : options, pose et livraison comprises s'il y a lieu."],
          ].map(([t, d], i) => <li key={String(t)} className="border border-sand-200 bg-white p-5"><p className="text-sm font-semibold text-brand-700">Étape {i + 1}</p><p className="mt-1 font-display text-lg font-semibold">{t}</p><p className="mt-1 text-sm text-stone-800">{d}</p></li>)}
        </ol>
      </section>
      <section className="section-y border-t border-sand-200" aria-labelledby="questions">
        <h2 id="questions" className="font-display text-display font-semibold">Questions fréquentes</h2>
        <div className="mt-4 max-w-3xl divide-y divide-sand-200 border-y border-sand-200">{c.faq.map(([q, a]) => <details key={q} className="py-3"><summary className="cursor-pointer font-medium">{q}</summary><div className="mt-2 text-stone-800">{a}</div></details>)}</div>
      </section>
      <section className="section-y border-t border-sand-200" aria-labelledby="guides-lies">
        <h2 id="guides-lies" className="font-display text-display font-semibold">Guides utiles</h2>
        <ul className="mt-4 flex flex-wrap gap-3">{c.guides.map(([href, label]) => <li key={href}><Link href={href} className="btn-secondary">{label} <ArrowRight className="size-4" aria-hidden="true" /></Link></li>)}</ul>
      </section>
    </div>
  );
}
