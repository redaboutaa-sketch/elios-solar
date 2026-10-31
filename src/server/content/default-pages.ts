/** Pages d'information par défaut : brouillons avec champs manquants listés pour l'administration. */
export const CONTENT_PAGES = [
  {
    slug: "mentions-legales",
    title: "Mentions légales",
    status: "DRAFT",
    body: `Ce site est édité par **{{legalName}}** ({{legalForm}}), {{addressLine1}}, {{postalCode}} {{city}} — SIRET {{siret}} — TVA intracommunautaire {{vatNumber}}.\n\nDirecteur de la publication : {{publisherName}}.\n\nHébergement : {{hostingProvider}}.\n\nContact : {{contactEmail}} — {{phone}}.`,
    missingFields: ["legalName", "legalForm", "addressLine1", "postalCode", "city", "siret", "vatNumber", "publisherName", "hostingProvider", "contactEmail", "phone"],
  },
  {
    slug: "cgv",
    title: "Conditions générales de vente",
    status: "DRAFT",
    body: `## 1. Objet\nLes présentes conditions régissent les ventes de pergolas, screens et stores bannes réalisées par {{legalName}} auprès de consommateurs.\n\n## 2. Prix\nLe prix d'une structure est affiché hors taxes, selon la grille tarifaire en vigueur pour les dimensions configurées. Le montant toutes taxes comprises (TVA au taux applicable) est indiqué au panier et avant la validation de la commande. Les options, la pose et la livraison ne sont pas comprises dans une commande en ligne : elles font l'objet d'un devis distinct.\n\n## 3. Commande et paiement\nLa commande est ferme après confirmation du paiement par notre prestataire. {{paymentTerms}}\n\n## 4. Livraison et pose\nLa livraison et la pose ne sont pas comprises dans le prix de la structure. Leurs conditions, leur prix et le délai de fabrication sont confirmés par un conseiller après la commande. {{deliveryTerms}}\n\n## 5. Droit de rétractation\nConformément au Code de la consommation, le consommateur dispose d'un délai de quatorze jours pour exercer son droit de rétractation, sauf pour les biens confectionnés selon ses spécifications ou nettement personnalisés (structures fabriquées à ses dimensions).\n\n## 6. Garanties\nGarantie légale de conformité et garantie des vices cachés. {{commercialWarranty}}\n\n## 7. Médiation\n{{mediatorName}}`,
    missingFields: ["legalName", "paymentTerms", "deliveryTerms", "commercialWarranty", "mediatorName"],
  },
  {
    slug: "confidentialite",
    title: "Politique de confidentialité",
    status: "DRAFT",
    body: `Responsable du traitement : {{legalName}}. Les données collectées (identité, coordonnées, adresse de livraison, configurations, commandes) servent à l'exécution des commandes et devis, au service client et, avec votre consentement, à l'envoi d'informations commerciales.\n\nDurées de conservation : comptes clients jusqu'à suppression du compte ; documents de commande 10 ans (obligations comptables) ; devis 3 ans ; demandes de contact 1 an.\n\nVous pouvez demander l'export ou la suppression de vos données depuis votre compte ou à {{dpoEmail}}.`,
    missingFields: ["legalName", "dpoEmail"],
  },
  {
    slug: "cookies",
    title: "Gestion des cookies",
    status: "PUBLISHED",
    body: `Seuls les cookies strictement nécessaires (session, panier, consentement) sont déposés sans votre accord. Les cookies de mesure d'audience et marketing ne sont activés qu'après votre choix, modifiable à tout moment depuis le pied de page.`,
    missingFields: [],
  },
  {
    slug: "livraison-installation",
    title: "Livraison et installation",
    status: "DRAFT",
    body: `## Livraison\nLa livraison n'est pas comprise dans le prix de la structure : zones desservies, conditions, prix et délais sont confirmés par un conseiller, après la commande ou dans votre devis. {{deliveryLeadTimes}}\n\n## Pose\nPose par vos soins avec la notice, ou pose professionnelle chiffrée sur devis dans les zones couvertes. {{installationZones}}`,
    missingFields: ["deliveryLeadTimes", "installationZones"],
  },
  {
    slug: "aide",
    title: "Centre d'aide",
    status: "PUBLISHED",
    body: `## Avant la demande de devis\n- Quelle dimension choisir ? Mesurez l'emprise au sol d'extérieur de poteau à extérieur de poteau : voir le guide [Prise de mesures](/guides/prise-de-mesures).\n- Adossée ou autoportée ? Adossée si un mur porteur couvre toute la longueur, sinon autoportée : voir [Pergola adossée ou autoportante ?](/guides/adossee-ou-autoportee).\n- Faut-il une autorisation ? En France, au-delà de 5 m² d'emprise, une déclaration préalable est généralement requise ; au-delà de 20 m², un permis de construire (40 m² pour une extension en zone urbaine couverte par un PLU). Vérifiez auprès de votre mairie.\n- Peut-on commander en ligne ? Non : chaque projet est établi sur devis. Configurez votre modèle puis envoyez votre demande ; elle est enregistrée avec une référence.\n\n## Après la demande\n- Un conseiller étudie votre demande et revient vers vous pour préciser les mesures, la livraison et la pose éventuelle.\n- Délai de livraison : entre 4 et 7 semaines selon le lieu de livraison.\n- Service client : voir la page [Contact](/contact).`,
    missingFields: [],
  },
] as const;

/**
 * Empreintes SHA-256 des textes par défaut antérieurs : le seed ne remplace le texte d'une page que s'il est encore
 * identique à l'un d'eux (jamais une page modifiée dans l'administration).
 */
export const PREVIOUS_DEFAULT_BODY_SHA256: Record<string, string[]> = {
  cgv: ["6393dc1712b69462652908bbf65f54f5e9e15836fbc562c93711042bd1b6e434"],
  "livraison-installation": ["6f2ebf980fc0a784c8af094a75ea9acd6b293ccaf778f2e5e4fd2dc8e0bb0c4c"],
  aide: ["2d1f9373c4d3f5d0af0cc6a399a42fc5543c67550c877ce56c20d877c2b579d2", "74c05e2397e25bbfca7a83dcc69afbecb08bf7f93f67b555d0b7f20a83bebd84"],
};
