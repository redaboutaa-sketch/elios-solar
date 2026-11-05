/**
 * Aide immédiate du chat (mode A, sans fournisseur LLM) — module pur, partagé client/serveur et testable sans base.
 *
 * Les réponses sont DÉTERMINISTES et ne reprennent que des informations publiées sur le site : produits du catalogue
 * (nom HELIO, description courte, fiche, configurateur), statut de prix (affiché dans le configurateur ou sur devis,
 * jamais un montant), délai de livraison publié, guides. Aucune référence fournisseur, aucun prix, stock, délai,
 * certification ou compatibilité inventés : ce qui n'est pas couvert est dit et la demande est transmise à l'équipe.
 */

export interface GuideFamily {
  slug: string;
  name: string;
  /** libellé de la famille (« Pergolas ») */
  categoryLabel: string;
  shortDescription: string;
  href: string;
  configuratorHref: string | null;
  /** une grille de vente publiée permet au configurateur d'afficher un prix pour certaines configurations */
  priced: boolean;
  /** caractéristiques en cours de confirmation technique (transcodification du 2026-10-31) */
  toConfirm: boolean;
}

export interface GuideKnowledge {
  families: GuideFamily[];
  /** anciens noms commerciaux (alias internes) → slug ; jamais repris dans une réponse */
  aliases: ReadonlyArray<{ alias: string; slug: string }>;
  deliveryLeadTime: string;
  contactEmail: string | null;
  /** une messagerie réelle est raccordée (sinon aucune réponse par e-mail n'est promise) */
  mailDelivery: boolean;
}

export interface GuideLink { href: string; label: string }

export interface GuideAnswer {
  topic: GuideTopicId | "produit" | "transmission" | "inconnu";
  text: string;
  links: GuideLink[];
  /** la question relève d'un conseiller (commande, paiement, garantie…) ou n'a pas de réponse validée */
  handover: boolean;
}

export const GUIDE_TOPICS = [
  { id: "produits", label: "Nos produits" },
  { id: "prix", label: "Prix et devis" },
  { id: "delais", label: "Délais de livraison" },
  { id: "mesures", label: "Prendre les mesures" },
  { id: "pose", label: "Pose et installation" },
  { id: "couleurs", label: "Couleurs" },
  { id: "fermetures", label: "Fermer les côtés" },
] as const;

export type GuideTopicId = (typeof GUIDE_TOPICS)[number]["id"];

/** Libellé des réponses automatiques (jamais présentées comme un conseiller). */
export const GUIDE_AUTHOR_LABEL = "Aide automatique";
export const GUIDE_DISCLAIMER = "Réponse automatique tirée des informations publiées sur le site";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const KEYWORDS: Array<{ topic: GuideTopicId | "transmission"; re: RegExp }> = [
  // traités par un conseiller : jamais de réponse automatique sur une commande, un paiement ou un litige
  { topic: "transmission", re: /\b(command(e|er|é)|paiement|payer|rembours|factur|garantie|sav|reclamation|panne|annul|retard|livr(e|é) (pas|jamais)|suivi de commande|mon devis)\b/ },
  { topic: "prix", re: /\b(prix|tarif|combien|cout|coute|budget|euros?|€|devis|promo|remise)\b/ },
  { topic: "delais", re: /\b(delai|delais|quand|semaines?|livraison|livrer|livre|expedi)/ },
  { topic: "fermetures", re: /\b(fermer|fermeture|lateral|laterale|vitr|verre|paroi|helioslide|coulissant)/ },
  { topic: "mesures", re: /\b(mesur|dimension|cote|taille|largeur|avancee|hauteur|projection)/ },
  { topic: "pose", re: /\b(pose|poser|install|monter|montage|fixation|poseur)/ },
  { topic: "couleurs", re: /\b(couleur|teinte|ral|coloris|blanc|noir|gris|anthracite)\b/ },
  { topic: "produits", re: /\b(produit|gamme|modele|catalogue|pergola|screen|store|banne|moustiquaire|proposez|vendez)/ },
];

/** Produits cités dans la question (nom public, ancien nom ou slug), dans l'ordre du catalogue. */
export function matchFamilies(question: string, k: GuideKnowledge): GuideFamily[] {
  const q = ` ${norm(question).replace(/[^a-z0-9 ]+/g, " ")} `;
  const hit = (term: string) => q.includes(` ${norm(term).replace(/[^a-z0-9 ]+/g, " ").trim()} `) || q.replace(/ /g, "").includes(norm(term).replace(/[^a-z0-9]+/g, "")) && norm(term).length >= 6;
  const slugs = new Set<string>();
  for (const f of k.families) if (hit(f.name) || hit(f.slug)) slugs.add(f.slug);
  for (const a of k.aliases) if (hit(a.alias)) slugs.add(a.slug);
  return k.families.filter((f) => slugs.has(f.slug));
}

function familyLinks(f: GuideFamily): GuideLink[] {
  return [{ href: f.href, label: `Fiche ${f.name}` }, ...(f.configuratorHref ? [{ href: f.configuratorHref, label: `Configurer ${f.name}` }] : [])];
}

function familyText(f: GuideFamily): string {
  const price = f.priced ? "Le configurateur affiche un prix pour les configurations couvertes par la grille publiée ; les autres sont chiffrées sur devis." : "Prix sur devis, établi à partir de votre configuration.";
  const confirm = f.toConfirm ? " Ses caractéristiques techniques sont en cours de confirmation : dimensions, pose et équipements sont confirmés sur devis." : "";
  return `${f.name} (${f.categoryLabel.toLowerCase()}) : ${f.shortDescription} ${price}${confirm}`;
}

function followUp(k: GuideKnowledge): string {
  return k.mailDelivery
    ? "Pour une réponse personnalisée, écrivez votre question avec votre adresse e-mail : un conseiller vous répond."
    : `Pour une réponse personnalisée, écrivez votre question avec votre adresse e-mail : votre demande est enregistrée et l'équipe vous recontacte${k.contactEmail ? ` (contact : ${k.contactEmail})` : ""}.`;
}

/** Réponse à un thème proposé (bouton « aide immédiate »). */
export function topicAnswer(topic: GuideTopicId, k: GuideKnowledge): GuideAnswer {
  const priced = k.families.filter((f) => f.priced);
  switch (topic) {
    case "produits": {
      const byCat = new Map<string, string[]>();
      for (const f of k.families) byCat.set(f.categoryLabel, [...(byCat.get(f.categoryLabel) ?? []), f.name]);
      const lines = [...byCat].map(([c, names]) => `• ${c} : ${names.join(", ")}`);
      return { topic, handover: false, text: ["Voici les modèles proposés :", ...lines, "Citez un modèle pour en savoir plus, ou ouvrez sa fiche."].join("\n"), links: [{ href: "/configurateur", label: "Configurer mon projet" }] };
    }
    case "prix":
      return {
        topic, handover: false,
        text: [
          "Le prix dépend de votre configuration (modèle, dimensions, pose, équipements) : il est calculé par le configurateur, jamais estimé dans ce chat.",
          priced.length ? `Un prix est affiché pour les configurations couvertes par une grille publiée (${priced.map((f) => f.name).join(", ")}) ; toute autre configuration est chiffrée sur devis.` : "Pour le moment, chaque configuration est chiffrée sur devis.",
          "La livraison et la pose ne sont pas comprises dans un prix affiché en ligne : elles sont indiquées au devis.",
        ].join("\n"),
        links: [{ href: "/configurateur", label: "Configurer et demander un devis" }],
      };
    case "delais":
      return { topic, handover: false, text: `${k.deliveryLeadTime} Les modalités précises de livraison sont indiquées dans le devis.`, links: [{ href: "/livraison-installation", label: "Livraison et installation" }] };
    case "mesures":
      return { topic, handover: false, text: "Le guide de prise de mesures explique quelles cotes relever selon le produit (largeur, avancée, hauteur) et les points à vérifier sur votre façade ou terrasse. Le configurateur indique ensuite les dimensions possibles pour chaque modèle.", links: [{ href: "/guides/prise-de-mesures", label: "Guide de prise de mesures" }] };
    case "pose":
      return { topic, handover: false, text: "Vous pouvez demander la pose dans le configurateur : elle est étudiée et chiffrée au devis selon votre support et l'accès au chantier. Elle n'est pas comprise dans un prix affiché en ligne.", links: [{ href: "/livraison-installation", label: "Livraison et installation" }, { href: "/guides/installation", label: "Guides d'installation" }] };
    case "couleurs":
      return { topic, handover: false, text: "Les teintes proposées dépendent du modèle : le configurateur les présente avec leur nom et leur code RAL, et le visuel se met à jour. Les couleurs à l'écran restent indicatives ; une autre teinte RAL est étudiée au devis lorsque le modèle le prévoit.", links: [{ href: "/configurateur", label: "Voir les teintes dans le configurateur" }] };
    case "fermetures":
      return { topic, handover: false, text: "Les fermetures latérales d'une pergola (HelioSlide VERRE en vitrage coulissant, HelioSlide ALU en panneaux aluminium, screens) se choisissent côté par côté dans le configurateur, quand le modèle les prévoit. Ce sont des souhaits étudiés au devis : la compatibilité, les dimensions et les fixations sont confirmées par l'équipe.", links: [{ href: "/accessoires", label: "Options et accessoires" }] };
  }
}

/**
 * Réponse à une question libre. Ordre : sujet réservé à un conseiller, produits cités, thème reconnu, sinon aucune
 * réponse validée (la demande reste enregistrée pour l'équipe).
 */
export function guideAnswer(question: string, k: GuideKnowledge): GuideAnswer {
  const q = norm(question);
  const families = matchFamilies(question, k);
  const topics = KEYWORDS.filter((x) => x.re.test(q)).map((x) => x.topic);
  if (topics.includes("transmission")) {
    return { topic: "transmission", handover: true, links: [], text: `Une commande, un paiement, la garantie ou le service après-vente sont traités par l'équipe, pas par l'aide automatique. ${followUp(k)}` };
  }
  if (families.length) {
    const head = families.slice(0, 3).map(familyText).join("\n\n");
    const extra = topics.includes("prix") ? "\n\nLe chat ne communique aucun montant : le prix d'une configuration est calculé par le configurateur." : "";
    return { topic: "produit", handover: false, text: `${head}${extra}`, links: families.slice(0, 3).flatMap(familyLinks) };
  }
  const first = topics.find((t): t is GuideTopicId => t !== "transmission");
  if (first) return topicAnswer(first, k);
  return { topic: "inconnu", handover: true, links: [], text: `Je n'ai pas de réponse validée à cette question. ${followUp(k)}` };
}
