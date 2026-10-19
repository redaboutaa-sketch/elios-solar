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
    body: `## 1. Objet\nLes présentes conditions régissent les ventes de pergolas, stores et accessoires réalisées par {{legalName}} auprès de consommateurs.\n\n## 2. Prix\nLes prix sont indiqués en euros TTC. Les frais de livraison et de montage sont indiqués distinctement avant validation de la commande.\n\n## 3. Commande et paiement\nLa commande est ferme après confirmation du paiement par notre prestataire. {{paymentTerms}}\n\n## 4. Livraison\n{{deliveryTerms}}\n\n## 5. Droit de rétractation\nConformément au Code de la consommation, le consommateur dispose d'un délai de quatorze jours pour exercer son droit de rétractation, sauf pour les biens confectionnés selon ses spécifications ou nettement personnalisés (pergolas sur mesure).\n\n## 6. Garanties\nGarantie légale de conformité et garantie des vices cachés. {{commercialWarranty}}\n\n## 7. Médiation\n{{mediatorName}}`,
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
    body: `## Livraison\nLivraison en France métropolitaine sur palette, sur rendez-vous. Corse et Outre-mer sur devis. {{deliveryLeadTimes}}\n\n## Montage\nMontage par vos soins avec notice et assistance, ou montage professionnel par un installateur partenaire dans les zones couvertes. {{installationZones}}`,
    missingFields: ["deliveryLeadTimes", "installationZones"],
  },
  {
    slug: "aide",
    title: "Centre d'aide",
    status: "PUBLISHED",
    body: `## Avant la commande\n- Quelle dimension choisir ? Mesurez l'emprise au sol d'extérieur de poteau à extérieur de poteau.\n- Adossée ou autoportée ? Adossée si un mur porteur couvre toute la longueur, sinon autoportée.\n- Faut-il une autorisation ? Au-delà de 5 m² d'emprise, une déclaration préalable est généralement requise ; au-delà de 20 m², un permis de construire. Vérifiez auprès de votre mairie.\n\n## Après la commande\n- Suivi de commande depuis votre compte.\n- Service client : voir la page Contact.`,
    missingFields: [],
  },
] as const;
