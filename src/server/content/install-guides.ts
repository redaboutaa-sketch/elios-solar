/**
 * Guides d'accompagnement HELIOSTORES (synthèses des notices officielles du fabricant). Ce ne sont PAS des notices :
 * chaque étape et chaque avertissement renvoie à la page de la notice officielle, qui seule fait foi et doit être
 * remise avec le produit. Valeurs et consignes reprises telles quelles ; rien n'est ajouté (fixations, ancrages,
 * charges, opérations électriques ou ordre de montage non écrits par la notice).
 *
 * Statut en base (`InstallGuideStatus`) : brouillon tant qu'aucune validation technique n'est enregistrée ; seul un
 * guide publié est visible du public. Les marques (fabricant, fixations, moteurs) sont remplacées par un renvoi à la
 * notice officielle : le site ne cite ni le fabricant ni le fournisseur.
 */

export interface GuideStep {
  text: string;
  /** page de la notice officielle */
  page: string;
}

export interface GuideSection {
  id: string;
  title: string;
  intro?: string;
  items?: string[];
  steps?: GuideStep[];
  /** avertissements, cités textuellement avec leur page */
  warnings?: GuideStep[];
  /** visuels autorisés (clé de provenance de la médiathèque) ; illustratifs, jamais une instruction */
  media?: Array<{ key: string; caption: string }>;
}

export interface InstallGuide {
  slug: string;
  familySlug: string;
  title: string;
  summary: string;
  /** notice officielle de référence (désignation interne) et documents à remettre */
  officialDocs: Array<{ title: string; pages: string; note?: string }>;
  sections: GuideSection[];
  /** ce qui manque pour un guide complet */
  missing: string[];
}

const RIVIERA: InstallGuide = {
  slug: "casablanca-installation",
  familySlug: "casablanca",
  title: "Casablanca — guide d'installation",
  summary: "Préparer, poser et contrôler un store banne Casablanca : étapes de la notice officielle, points de contrôle et consignes de sécurité.",
  officialDocs: [
    { title: "Documentation technique et d'utilisation du store (instructions de montage, d'utilisation et de sécurité), éd. 5, juin 2019", pages: "29 p.", note: "notice officielle de référence pour la pose" },
    { title: "Notice d'utilisation et d'entretien des stores de terrasse et de balcon", pages: "20 p.", note: "générique ; ne contient pas d'étapes de montage" },
    { title: "Déclaration des performances (EN 13561) et déclaration de conformité (version motorisée)", pages: "1 p. chacune" },
  ],
  sections: [
    {
      id: "avant",
      title: "Avant de commencer",
      intro: "Ce guide accompagne la notice officielle sans la remplacer. Lisez la notice complète avant toute intervention et remettez-la, avec la notice du moteur, à l'utilisateur final.",
      warnings: [
        { text: "« INSTRUCTIONS DE SÉCURITÉ IMPORTANTES – AVERTISSEMENT - LA PROCÉDURE VISÉE DANS CES INSTRUCTIONS EST PERTINENTE POUR LA SÉCURITÉ DES PERSONNES – CONSERVEZ CES INSTRUCTIONS »", page: "p. 4-5" },
        { text: "« L'installation électrique, la première programmation … ne peuvent être effectuées que par des sociétés agréées spécialisées. »", page: "p. 10" },
        { text: "Le store doit être fixé « aux éléments stables du bâtiment (murs, linteaux, structure en acier, structure en aluminium, menuiserie de fenêtre) » ; murs secs, uniformes et résistants.", page: "p. 9" },
        { text: "« … sa partie la plus basse se situe à au moins 2200 mm du sol ».", page: "p. 10" },
        { text: "« Le produit doit être fixé mécaniquement (les mousses, adhésifs ou matériaux similaires ne sont pas autorisés comme matériaux de fixation). »", page: "socle commun des notices" },
        { text: "« Les travaux en hauteur nécessitant un équipement de protection individuelle contre les chutes de hauteur doivent être effectués par 2 personne au moins ». « Ne vous mettez pas debout sur les éléments du produit. »", page: "socle commun des notices" },
        { text: "« Si la masse du produit dépasse 25 kg, son transfert sur le lieu de montage final doit être effectué par au moins deux personnes. »", page: "p. 8" },
      ],
    },
    {
      id: "support",
      title: "Préparer le projet : support et fixations",
      intro: "Supports admis par la notice (liste indicative : le choix final revient à un concepteur agréé).",
      items: [
        "Béton C20/25 non fissuré, éventuellement avec isolant jusqu'à 25 cm.",
        "Brique pleine Mz NF de 24 cm au minimum, 20 MPa ou plus, plus de 1,8 kg/dm³, mortier M2,5 à M9.",
        "Silico-calcaire plein de 24 cm au minimum, 10 MPa ou plus, plus de 2 kg/dm³ ; silico-calcaire creux de 17,5 cm au minimum, 20 MPa ou plus, plus de 1,4 kg/dm³.",
        "Bois C24 : poutre de 100 mm ou plus, chevron de 70 mm ou plus.",
        "Maçonneries isolées et parpaings creux céramiques : « consultation nécessaire avec un concepteur agréé ». Blocs en béton cellulaire : « substrat non recommandé ».",
        "Béton C20/25 à C50/60 non fissuré : chevilles M10x110 A4 posées au mortier d'injection ; profondeur de pose dans le béton 80 mm ; distance minimale au bord 45 mm (cheville M10) ; épaisseur minimale du support 150 mm. Produits de fixation recommandés : voir la notice officielle.",
        "Maçonnerie (Porotherm, brique pleine ou béton) avec isolant de 15 cm au plus : chevilles 16/170 M12 avec douille treillis 20x200 posées au mortier d'injection (références : notice officielle).",
        "Nombre de supports selon la largeur : tableau de la notice, p. 11 (non repris ici) ; le supplément technique indique 2 supports jusqu'à 4,10 m et 3 de 4,10 à 6 m.",
      ],
      warnings: [
        { text: "« La liste … n'ayant qu'une valeur indicative … doit être sélectionnée par un concepteur agréé. »", page: "p. 9" },
        { text: "Avant le montage, dégager la zone (fils électriques compris) et vérifier le tracé des réseaux enterrés aux points de fixation.", page: "socle commun des notices" },
      ],
    },
    {
      id: "pieces",
      title: "Identifier les pièces et l'outillage",
      items: [
        "Composition (figure p. 7) : store à coffre, support mural, support au plafond ou support au chevron selon la pose.",
        "Outils (p. 10) : forets, perceuse à percussion, escabeau/échafaudage, tournevis, marteau, double-mètre, crayon/marqueur, niveau, clés polygonales/plates, clés Allen, chevilles.",
        "Préparation (p. 10) : déballer et contrôler les éléments, vérifier la capacité portante, préparer l'outillage.",
      ],
      media: [{ key: "alu-casa-07", caption: "Coffre fermé en vue transparente (visuel du fabricant, illustratif)." }, { key: "alu-casa-11", caption: "Articulation d'un bras (visuel du fabricant, illustratif)." }],
    },
    {
      id: "pose-murale",
      title: "Pose murale",
      media: [{ key: "alu-casa-13", caption: "Schéma coté de la pose murale (visuel du fabricant ; les figures d'étapes sont dans la notice, p. 12-14)." }],
      steps: [
        { text: "Tracer au niveau ; présenter le premier support à l'endroit marqué au dos de la cassette, « sur l'axe » des supports de bras ; marquer les trous.", page: "p. 12" },
        { text: "Percer, cheviller, serrer le support.", page: "p. 12" },
        { text: "Implanter les autres supports à partir du premier, « dans un même niveau et dans un même plan » ; percer, cheviller, visser.", page: "p. 12-13" },
        { text: "Poser le store, cassette serrée contre les supports : « vérifiez la linéarité des supports muraux - la surface du mur doit avoir la même épaisseur dans l'endroit de fixations ».", page: "p. 13" },
        { text: "Visser la poutre de structure.", page: "p. 13" },
        { text: "Ouvrir légèrement le store ; contrôler au niveau que les bras se plient dans le même plan ; régler avec « la vis interne M5 dans les supports des bras ».", page: "p. 13-14" },
        { text: "Inclinaison : dérouler complètement, desserrer « la vis interne et les vis à tête creuse M10 qui protègent l'élément amovible de supports muraux » ; vis hexagonale de réglage : dévisser pour diminuer l'angle, visser pour l'augmenter ; resserrer et vérifier l'horizontalité de la poutre avant.", page: "p. 14" },
      ],
    },
    {
      id: "pose-plafond-chevrons",
      title: "Pose au plafond ou sur chevrons",
      media: [{ key: "alu-casa-14", caption: "Schéma coté de la pose au plafond (visuel du fabricant)." }, { key: "alu-casa-12", caption: "Schéma coté de la pose sur chevrons (visuel du fabricant)." }],
      steps: [
        { text: "Plafond : supports aux emplacements « marqués par des autocollants en couleur … dans la partie arrière de la casette », « sur une seule ligne, c'est-à dire à la même distance du mur » ; supports muraux reliés aux supports de plafond « à l'aide des vis M10x35 avec rondelles et écrous ».", page: "p. 15" },
        { text: "Chevrons : fixations pour le bois, sur une seule ligne ; « disposer les supports de toiture droite / gauche en alternance - c'est-à-dire en partant du côté droit du store (quand on regarde du front du store banne) » ; jeu de vis M10x35 avec rondelles et écrous.", page: "p. 15" },
      ],
    },
    {
      id: "electricite",
      title: "Version motorisée : raccordement électrique",
      intro: "Raccordement au réseau d'alimentation et de commande selon un schéma individuel, puis programmation selon la notice du moteur (p. 15-17). Aucune opération électrique n'est décrite ici.",
      warnings: [
        { text: "Raccordement par « un électricien disposant d'une licence d'électricien et ayant une expérience professionnelle ».", page: "p. 15-16" },
        { text: "« faites attention au bon positionnement du câble d'alimentation à l'entrée du produit pour évacuer l'eau qui peut s'écouler sur le câble ».", page: "p. 16" },
        { text: "Coupure thermique du moteur après « quelques minutes », redémarrage après « une douzaine de minutes ».", page: "p. 16" },
        { text: "« Le produit peut être endommagé en cas de dysfonctionnement de la commande centralisée. »", page: "p. 16" },
        { text: "« ne pas démarrer le moteur d'entraînement sans vérifier la fixation correcte du produit ».", page: "p. 17" },
        { text: "« vérifiez la performance de la mise à la terre … à chaque nouvel emplacement ».", page: "p. 17" },
        { text: "« Le réglage arbitraire des positions extrêmes par une personne non formée peut entraîner des dommages au produit. »", page: "p. 17" },
      ],
    },
    {
      id: "controle",
      title: "Points de contrôle",
      items: [
        "Supports au même niveau et dans le même plan ; linéarité vérifiée (p. 12-13).",
        "Bras qui se plient dans le même plan (p. 13).",
        "Poutre avant horizontale après réglage de l'inclinaison (p. 14).",
        "Version motorisée : fixation vérifiée avant le premier démarrage ; mise à la terre vérifiée (p. 17).",
        "Manivelle : ouvrir « jusqu'à ce que les bras soient complètement ouverts tout en maintenant la tension de la toile » ; fermer « jusqu'à ce que vous sentiez une faible résistance » (p. 18).",
      ],
      warnings: [
        { text: "« Les transmissions 11: 1 ne disposent pas de protection contre la torsion excessive (dite fin de course mécanique). » Une force excessive à la fermeture peut endommager la toile.", page: "p. 18" },
        { text: "« Ne pas amener à un enroulement de la toile de store dans le sens opposé (à partir du bas du tube d'enroulement) … »", page: "p. 18" },
      ],
    },
    {
      id: "utilisation",
      title: "Utilisation, vent et entretien",
      warnings: [
        { text: "« En cas de vent fort (dépassant la classe de vent déclarée) ou de pluie intense, le produit doit être immédiatement enroulé ».", page: "p. 18" },
        { text: "« … l'automatisation de vent ne protégera jamais le store contre … des rafales de vent dépassant les paramètres de réglage ».", page: "p. 19" },
        { text: "Personne dans la zone « entre le tube d'enroulement et la poutre avant » ; ne rien suspendre ni attacher au store ; ne pas séjourner sous les bras.", page: "p. 19" },
        { text: "« N'exposez pas la toile de store à une humidité prolongée. »", page: "p. 20" },
        { text: "Entretien « au moins une fois par an par des équipes de montage spécialisées » ; nettoyage store déroulé au maximum, eau à 30 °C au plus ; « Ne laissez pas l'eau pénétrer dans le moteur. »", page: "p. 21-23" },
        { text: "« Ne déroulez absolument pas le store lors de fortes pluies … même si la toile … est imperméabilisante ou … en PVC … surcharge des fixations ».", page: "p. 23" },
        { text: "« Lors de différents travaux, déconnecter les circuits principaux de l'alimentation ! La vie est mise en danger ! Sécuriser le dispositif contre un branchement involontaire ! »", page: "notice d'utilisation, p. 14-16" },
      ],
      items: ["Résistance au vent déclarée (EN 13561) : classe 2 (84 Pa) jusqu'à 410 cm de large et 310 cm de projection ; classe 1 (48 Pa) jusqu'à 410 × 360 cm et de 410 à 600 cm de large (déclaration des performances, p. 28)."],
    },
  ],
  missing: [
    "Figures des étapes (notice p. 12-15) : à reproduire avec l'accord explicite du fabricant.",
    "Tableau du nombre de supports selon la largeur (p. 11) et tableau de choix des moteurs (p. 25) : non extraits.",
    "Notice d'installation séparée citée par la version anglaise : non téléchargée.",
    "Notice du moteur (version motorisée) : moteur à définir.",
  ],
};

const OMBRA: InstallGuide = {
  slug: "helioscreen-installation",
  familySlug: "helioscreen",
  title: "HelioScreen — guide d'installation",
  summary: "Préparer, poser et contrôler un screen HelioScreen : étapes de la notice officielle, raccordement à confier à un électricien, consignes de sécurité.",
  officialDocs: [
    { title: "Documentation technique et d'utilisation des screens à coulisses (instructions de montage, d'utilisation et de sécurité), éd. 7, janvier 2022", pages: "33 p.", note: "notice officielle de référence ; seules les sections du modèle 120 standard sont reprises" },
    { title: "Manuel d'utilisation et d'entretien des screens", pages: "20 p.", note: "générique ; ne contient pas d'étapes de montage" },
    { title: "Déclarations des performances (EN 13659)", pages: "1 p. chacune" },
  ],
  sections: [
    {
      id: "avant",
      title: "Avant de commencer",
      intro: "Ce guide accompagne la notice officielle sans la remplacer. Lisez la notice complète avant toute intervention et remettez-la, avec la notice du moteur, à l'utilisateur final.",
      warnings: [
        { text: "« INSTRUCTIONS DE SÉCURITÉ IMPORTANTES – AVERTISSEMENT - LA PROCÉDURE VISÉE DANS CES INSTRUCTIONS EST PERTINENTE POUR LA SÉCURITÉ DES PERSONNES – CONSERVEZ CES INSTRUCTIONS »", page: "p. 5" },
        { text: "« Attention! Les chevilles, vis ou boulons fixant le produit à la structure dépendent du type de substrat, donc, ils ne sont pas attachés au produit et son achat appartient à l'acheteur ou à l'installateur. »", page: "p. 9" },
        { text: "« Lors du transport incorrect du produit (verticalement), le tissu peut se déplacer sur le tube d'enroulement et la poutre inférieure. Par conséquent, la position du matériau sur le tube de rouleau et la poutre inférieure doit être vérifiée avant l'installation. »", page: "p. 9" },
        { text: "« Les travaux en hauteur nécessitant un équipement de protection individuelle contre les chutes de hauteur doivent être effectués par 2 personne au moins ».", page: "socle commun des notices" },
      ],
    },
    {
      id: "support",
      title: "Préparer le projet : support et alignement",
      items: [
        "Pose : « Cassette est installé au plafond, au mur ou comme un système autoportant – cassette est maintenue par les guides fixés » (p. 6).",
        "Coffre 126 x 126 mm ; dimensions maximales indiquées par la notice : 4000 x 4000 mm (p. 6-7).",
        "Outils (p. 9) : forets métal et béton, perceuse à percussion, échelle ou échafaudage, tournevis, marteau, mesure, crayon, niveau, clés mâles, outil de coupe.",
      ],
      warnings: [
        { text: "« Dans le cas de linteaux en béton armé ou en brique pleine on utilise des boulons de dilatation aux dimensions adaptées à la capacité de charge… »", page: "p. 9" },
        { text: "« L'axe longitudinal du rail principal du produit doit être de niveau, sinon le produit sera mal enroulé. »", page: "p. 9" },
        { text: "Le fabricant décline toute responsabilité en cas de fonctionnement incorrect « si le substrat ne garantit pas la linéarité et l'horizontalité du montage du profil du guide ».", page: "p. 16" },
        { text: "« Le manque de distance appropriée des guides des éléments auxquels l'installation est fait peut entraîner un mauvais fonctionnement du système et son endommagement mécanique. »", page: "p. 22" },
      ],
      media: [{ key: "alu-r120-04", caption: "Coupe cotée du coffre (visuel du fabricant)." }],
    },
    {
      id: "pose",
      title: "Pose des coulisses et du coffre",
      media: [{ key: "alu-r120-06", caption: "Coulisse en deux parties, vue éclatée (visuel du fabricant ; les photos d'étapes 1 à 9 sont dans la notice, p. 10-15)." }, { key: "alu-r120-08", caption: "Coffre avec trappe de visite ouverte (visuel du fabricant)." }],
      steps: [
        { text: "Supports modulaires : introduire les plaques dans les guides, puis visser le support.", page: "p. 10" },
        { text: "Marquer les points de fixation des guides ; percer.", page: "p. 13 (photos 1-2)" },
        { text: "Régler la verticale du guide ; fixer le guide au support ; poser le second guide.", page: "p. 13-14 (photos 3-5)" },
        { text: "Poser le coffre sur les guides.", page: "p. 14 (photo 6)" },
        { text: "Insérer le profil de guidage sur la glissière (ordre de montage : illustrations 2-3). « REMARQUE! Vérifiez l'emplacement du couvre-joint (1) dans le guide. »", page: "p. 14 (photo 7)" },
        { text: "Profil de guidage dans la coulisse, puis profil de révision ; vis du rail.", page: "p. 15 (photos 8-9)" },
        { text: "Barre de charge : sans lest (FG51-02) ou avec lest possible (FG51-03, entretoises fournies).", page: "p. 22-23" },
      ],
    },
    {
      id: "electricite",
      title: "Raccordement électrique",
      intro: "Raccordement selon le schéma électrique individuel, par un électricien qualifié (p. 24-25). Aucune opération électrique n'est décrite ici.",
      warnings: [
        { text: "230 V~ avec combinateur, classe I : « 230V~3 fils (fil de protection, conducteur neutre et fil de phase) », coupe-circuit adapté et différentiel ; 24 V par convertisseur : voir le tableau de protection de la notice.", page: "p. 24-25" },
        { text: "« … tenez compte des règles de sécurité, par exemple la hauteur minimale du sol sur laquelle un équipement électrique peut être installé. »", page: "p. 24-25" },
        { text: "« Les disjoncteurs différentiels… ne peuvent être le seul moyen de protection. » « Les mesures électriques doivent être effectuées avant la mise en service du produit. »", page: "socle commun des notices" },
        { text: "« Ne démarrez pas le moteur sans avoir vérifié le bon montage du système. » « Une connexion incorrecte du moteur peut endommager le produit ou créer un danger. »", page: "socle commun des notices" },
        { text: "« Le moteur a un interrupteur thermique qui éteindra l'entraînement après environ 4 minutes de fonctionnement continu … vous devez attendre … (environ 16 minutes) pour pouvoir le redémarrer. »", page: "p. 25" },
      ],
    },
    {
      id: "controle",
      title: "Points de contrôle",
      items: [
        "Position de la toile sur le tube et la barre inférieure vérifiée avant la pose (p. 9).",
        "Rail principal de niveau ; guides alignés et à distance correcte des éléments voisins (p. 9, p. 22).",
        "« Vérifiez la certitude de fixation des supports – leur écart peut être dangereux pour les personnes. » (p. 15)",
        "« Après le montage effectué, vérifiez le fonctionnement correct du produit et raccordez les fins de courses conformément à la notice d'utilisation. » (p. 15)",
      ],
    },
    {
      id: "utilisation",
      title: "Utilisation, vent et entretien",
      warnings: [
        { text: "« Il est recommandé d'utiliser l'automatisation du vent… » ; « N'utilisez pas le produit en cas de fortes rafales de vent, de chutes neige, de pluie verglaçante… »", page: "p. 27 ; socle commun" },
        { text: "Le screen doit être relevé complètement et rétracté dans le caisson dès que la vitesse de vent admissible est dépassée, même avec un capteur de vent automatique.", page: "manuel d'utilisation, p. 10" },
        { text: "« Il est interdit que le tissu, avec la barre inférieure, sorte des guides. » « Ne tirez pas sur l'écran vers le haut avec force ».", page: "manuel d'utilisation, p. 8-9" },
        { text: "« En cas de risque de givrage des tendeurs, il faut impérativement désactiver l'automatisation … n'essayez pas d'ouvrir ou de fermer le store. Dans les cas extrêmes, la toile pourrait se déchirer. » « N'enroulez pas un écran mouillé ».", page: "manuel d'utilisation, p. 7" },
        { text: "« Il est possible d'entrer et de séjourner dans la zone du travail … uniquement lors de son ouverture et sa rétention totale. »", page: "p. 26" },
        { text: "« Lors de différents travaux, déconnecter les circuits principaux de l'alimentation ! La vie est mise en danger ! Sécuriser le dispositif contre un branchement involontaire ! »", page: "manuel d'utilisation, p. 14" },
      ],
    },
  ],
  missing: [
    "Photos et illustrations d'étapes (notice p. 10-15) : à reproduire avec l'accord explicite du fabricant.",
    "Notice du moteur, annoncée en fin de document : absente.",
    "Entraxes de fixation, couples de serrage et sections de câble : non chiffrés par la notice pour le modèle 120 standard.",
  ],
};

const pending = (slug: string, familySlug: string, name: string, have: string[], need: string[]): InstallGuide => ({
  slug, familySlug, title: `${name} — guide d'installation`,
  summary: `Guide en attente : aucune notice de montage applicable à ${name} n'est disponible à ce jour.`,
  officialDocs: have.map((t) => ({ title: t, pages: "" })),
  sections: [{ id: "attente", title: "Notice à obtenir", intro: "Aucune étape de montage n'est publiée sans notice officielle applicable à ce modèle.", items: need }],
  missing: need,
});

export const INSTALL_GUIDES: InstallGuide[] = [
  RIVIERA,
  OMBRA,
  pending("malaga-installation", "malaga", "Malaga", ["Documentation technique et d'utilisation du modèle (édition 2025, français)"], ["Notice graphique de montage : document séparé, non publié par le fabricant."]),
  pending("marbella-installation", "marbella", "Marbella", ["Notice de montage du modèle (français, état au 2026-01-01)", "Notice d'utilisation et d'entretien (français)"], ["Synthèse à rédiger à partir de la notice de montage, puis validation technique."]),
  pending("sevilla-installation", "sevilla", "Sevilla", ["Documentation technique du modèle (français, 2021)"], ["Notice de montage graphique et notice d'utilisation propres au modèle."]),
  pending("helioroof-screen-installation", "helioroof-screen", "HelioRoof Screen", ["Documentation technique du store de toiture (français, 2020)"], ["Synthèse à rédiger et validation technique ; confirmation du modèle (un ou deux moteurs)."]),
  pending("madera-installation", "madera", "Madera", ["Notice de montage du modèle (français, 2026)"], ["Synthèse à rédiger et validation technique."]),
];

export const installGuide = (slug: string) => INSTALL_GUIDES.find((g) => g.slug === slug);
