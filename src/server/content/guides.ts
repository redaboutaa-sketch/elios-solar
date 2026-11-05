/**
 * Guides rédactionnels courts (Markdown), et registre des guides publiés (liste, sitemap, liens). Rédigés à partir de
 * règles générales ou des données documentées des modèles ; aucun délai, prix, zone ou garantie n'y est affirmé.
 */
/** Date de dernière mise à jour éditoriale des guides (date réelle de rédaction). */
export const GUIDES_UPDATED = "2026-10-26";

export const GUIDES: Record<string, { title: string; description: string; body: string }> = {
  "adossee-ou-autoportee": {
    title: "Pergola adossée ou autoportante ?",
    description: "Choisir l'implantation d'une pergola selon le mur, la terrasse et l'usage.",
    body: `## Adossée\nLa pergola est fixée au mur de la maison et repose sur deux poteaux à l'avant. Le mur doit être porteur, plan et libre sur toute la longueur de la poutre (fenêtres, volets, descentes d'eau et débords de toit sont à vérifier). La fixation dépend de la nature du mur : elle est étudiée au devis.\n\n## Autoportante\nLa pergola repose sur quatre poteaux, sans appui sur un mur : elle s'installe sur la terrasse, dans le jardin ou à distance de la maison. Le sol doit pouvoir recevoir les ancrages des poteaux.\n\n## Selon le modèle\nTous les modèles ne proposent pas les deux implantations : la fiche de chaque pergola indique les poses documentées, et le guide « Choisir sa pergola » les compare.\n\n## Mesurer\nRelevez la place disponible, la hauteur sous l'obstacle le plus bas et la pente du sol avec le guide « Prise de mesures » : le configurateur compare ensuite vos cotes aux limites du modèle.`,
  },
  "autorisation-urbanisme": {
    title: "Pergola et autorisation d'urbanisme",
    description: "Déclaration préalable ou permis de construire en France : les seuils usuels et les vérifications à faire en mairie.",
    body: `## En France : les seuils usuels\n- Jusqu'à 5 m² d'emprise au sol : en général aucune formalité, hors secteur protégé.\n- De 5 à 20 m² : déclaration préalable de travaux.\n- Au-delà de 20 m² : permis de construire. En zone urbaine couverte par un plan local d'urbanisme, ce seuil peut être porté à 40 m² pour une extension.\n\nCes seuils varient selon le plan local d'urbanisme, les secteurs protégés et les règlements de copropriété ou de lotissement : vérifiez auprès de votre mairie avant de commander et conservez sa réponse.\n\n## En Belgique\nLes règles d'urbanisme relèvent de chaque région : renseignez-vous auprès du service urbanisme de votre commune.\n\nCe guide est une information générale et ne constitue pas un conseil juridique.`,
  },
};

/** Anciens guides remplacés : redirection permanente directe vers le guide actuel (pas de chaîne). */
export const GUIDE_REDIRECTS: Readonly<Record<string, string>> = {
  "pergola-bioclimatique": "/guides/choisir-sa-pergola",
};

/** Guides publiés (pages dédiées et guides Markdown), dans l'ordre de la page Guides. */
export const PUBLISHED_GUIDES: ReadonlyArray<{ href: string; title: string; description: string }> = [
  { href: "/guides/prise-de-mesures", title: "Prise de mesures", description: "Schémas par famille et type de pose, contrôle des dimensions du modèle et report de vos mesures dans le configurateur." },
  { href: "/guides/preparation-projet", title: "Préparer son projet et prendre les mesures", description: "Emplacement, cotes, hauteur, pente, ancrage, alimentation électrique, orientation, accès et démarches : la liste de contrôle avant de demander un devis." },
  { href: "/guides/choisir-sa-pergola", title: "Choisir sa pergola", description: "Adossée ou autoportante, lames orientables ou toile, tailles définies ou sur mesure." },
  { href: "/guides/choisir-son-screen-exterieur", title: "Choisir son screen extérieur", description: "Baie, façade ou toiture vitrée, pose, toile et consignes de vent." },
  { href: "/guides/choisir-sa-moustiquaire", title: "Choisir sa moustiquaire selon l'ouverture", description: "Plissée, enroulable, coulissante ou à cadre fixe : quel type pour quelle ouverture." },
  { href: "/guides/comparer-protections-solaires", title: "Comparer les solutions de protection solaire", description: "Pergola, screen, screen de toiture ou store banne, modèle par modèle." },
  { href: "/guides/choisir-toile-et-motorisation", title: "Choisir sa toile et sa motorisation", description: "Toiles et manœuvres proposées par modèle, ce qui est compris, et comment choisir." },
  ...Object.entries(GUIDES).map(([slug, g]) => ({ href: `/guides/${slug}`, title: g.title, description: g.description })),
];
