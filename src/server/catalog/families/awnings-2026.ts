/**
 * Stores bannes HelioShade, HelioPro et HelioSquare (noms publics du 2026-10-31 ; anciens noms Corsica, Jamaica, Madera conservés en alias internes). HelioSun reste
 * dans heliostores-data.ts (fiche historique renommée, même produit). Chaque règle cite sa source (documents du fabricant
 * téléchargés le 2026-10-25, inventaire privé : private/heliostores/research/awnings*.json) ; les contradictions sont
 * signalées et validées au devis. Aucun classement « basique / équipé » n'est attribué par le fabricant : la lecture par
 * équipement est construite dans la page de la famille, depuis ces règles. Données publiables : aucun tarif.
 */
import type { SourceRef } from "@/domain/system";
import type { HelioFamily } from "../heliostores-data";
import { finishOf, src } from "./shared";

export const AWNING_SOURCES = {
  brochure: src("brochure-stores-bannes", "Brochure « Nos stores bannes » (FR, 10.2026)"),
  supp: src("supp-stores", "Supplément technique STORES (FR, état 2026-09-01)"),
  notice: src("iuik-awnings", "Notice d'utilisation et d'entretien des stores de terrasse et de balcon (FR, 2026-06-15)"),
  dteCorsica: src("dte-corsica-fr", "DT-E 11.6 Corsica (FR, éd. 10, avril 2024)"),
  dopCorsica: src("dop-06-m-2018", "Déclaration des performances 06/M/2018 Corsica"),
  pageCorsica: src("aluprof-corsica", "Page fabricant « Corsica »", "https://aluprof.com/fr/produit/corsica"),
  dteJamaica: src("dte-jamaica-fr", "DT-E 11.4 Jamaica (FR, éd. 12, avril 2024)"),
  dopJamaica: src("dop-03-m-2018", "Déclaration des performances 03/M/2018 Jamaica"),
  pageJamaica: src("aluprof-jamaica", "Page fabricant « Jamaica »", "https://aluprof.com/fr/produit/jamaica"),
  imMadeira: src("im-madeira-fr", "Notice de montage Madeira (FR, état 2026-08-21)"),
  dopMadeira: src("dop-madeira-21-26", "Déclaration des performances MA/MADEIRA/21/26 (2026-08-17)"),
  pageMadeira: src("aluprof-madeira", "Page fabricant « Madeira »", "https://aluprof.com/fr/produit/madeira"),
  dteLed: src("dte-led-stores", "DT-E 11.16 Kit d'éclairage LED – stores bannes (FR, éd. 2, août 2025)"),
  catalogueClient: src("catalogue-thysens", "Catalogue THYSENS (collection SELT, 161 p.)"),
} as const satisfies Record<string, SourceRef>;

const S = AWNING_SOURCES;
const at = (s: SourceRef, loc: string): SourceRef => ({ ...s, loc });
const DEPTHS = [1600, 2100, 2600, 3100, 3600];

/** Toiles : collections communes aux quatre modèles (≈ 150 motifs) — coloris choisi sur nuancier. */
const FABRIC_COLLECTION = (sources: SourceRef[]) => [{ code: "fabric_collection", label: "Toile de la collection (environ 150 motifs)", status: "established" as const, description: "Coloris et motif choisis sur nuancier avec le conseiller.", sources }];

/** Équipements de commande communs : listes du fabricant SANS règle de compatibilité par moteur → souhaits au devis. */
function commandWishes(sources: SourceRef[]) {
  return [
    { code: "remote_control", label: "Télécommande radio", description: "Émetteur pour piloter le store motorisé ; modèle défini avec le moteur.", group: "control" as const, status: "to_confirm" as const, requiresControlKind: "electric" as const, prerequisite: "nécessite la motorisation", pricing: "quote" as const, visual: "remote" as const, sources },
    { code: "wind_sensor", label: "Capteur de vent (ou vent-soleil)", description: "Replie le store au-delà du seuil réglé ; ne protège pas contre une rafale qui dépasse ses réglages.", group: "control" as const, status: "to_confirm" as const, wish: true, requiresControlKind: "electric" as const, prerequisite: "nécessite la motorisation ; capteur compatible avec le moteur", pricing: "quote" as const, visual: "wind_sensor" as const, sources },
    { code: "shock_sensor", label: "Capteur de vibrations", description: "Fixé à la barre de charge, il commande le repli en cas d'oscillations.", group: "control" as const, status: "to_confirm" as const, wish: true, requiresControlKind: "electric" as const, prerequisite: "nécessite la motorisation ; capteur compatible avec le moteur", pricing: "quote" as const, sources },
    { code: "connect_box", label: "Box domotique — commande par smartphone", description: "Pilote depuis une application un moteur radio compatible ; elle ne rend pas connecté un moteur non compatible.", group: "control" as const, status: "to_confirm" as const, wish: true, requiresControlKind: "electric" as const, prerequisite: "nécessite un moteur radio compatible", pricing: "quote" as const, visual: "box" as const, sources },
  ];
}

const minWidth = (pairs: Array<[number, number]>, sources: SourceRef[]) => pairs.map(([depthMm, widthMinMm]) => ({ depthMm, widthMinMm, sources }));

/* ------------------------------------------------------------------ */
/* HelioShade — semi-coffre, motorisé                                     */
/* ------------------------------------------------------------------ */

const corsica: HelioFamily = {
  slug: "corsica",
  name: "HelioShade",
  category: "STORES_BANNES",
  kind: "AWNING_SYSTEM",
  status: "QUOTE_ONLY",
  sortOrder: 41,
  brand: "Aluprof",
  manufacturer: "ALUPROF SA (usine d'Opole, ex-SELT)",
  supplierRef: "CORSICA (DT-E 11.6)",
  shortDescription: "Store banne à semi-coffre, uniquement motorisé, jusqu'à 7 m de largeur ; éclairage LED possible.",
  description:
    "HelioShade est un store de terrasse à semi-coffre et barre porteuse carrée, proposé uniquement motorisé. En pose murale, le semi-coffre se referme comme un coffre intégral. Il mesure jusqu'à 7 m de largeur et 3,6 m d'avancée, avec deux ou trois bras selon les dimensions. Le profil bas et les bras de 3,1 et 3,6 m peuvent recevoir un éclairage LED.",
  seoTitle: "Store banne HelioShade motorisé à semi-coffre",
  seoDescription: "Store banne HelioShade : semi-coffre, motorisation, jusqu'à 7 × 3,6 m, éclairage LED en option. Configurez et demandez votre devis.",
  rules: {
    type: "awning",
    dims: {
      width: { label: "Largeur", minMm: 2100, maxMm: 7000, sources: [at(S.supp, "p. 51–52"), at(S.dteCorsica, "p. 6")], note: "La brochure indique 2,05 m minimum ; la largeur minimale dépend de l'avancée." },
      depth: { label: "Avancée", minMm: 1600, maxMm: 3600, valuesMm: DEPTHS, sources: [at(S.dteCorsica, "p. 6"), at(S.dopCorsica, "« CORSICA.700x160-210-260-310-360 »"), at(S.supp, "p. 52, 54")] },
    },
    depthWidthMin: minWidth([[1600, 2100], [2100, 2600], [2600, 3100], [3100, 3600], [3600, 4100]], [at(S.dteCorsica, "p. 6 — avancée + 0,5 m"), at(S.supp, "p. 52")]),
    mountings: [
      { code: "wall", label: "Murale", status: "established", sources: [at(S.supp, "p. 55"), at(S.dteCorsica, "p. 6")] },
      { code: "ceiling", label: "Au plafond", status: "established", sources: [at(S.supp, "p. 55")] },
      { code: "rafter", label: "Sur chevrons", status: "established", sources: [at(S.supp, "p. 55")] },
    ],
    finishes: ["RAL 9010 mat", "RAL 9006 mat", "RAL 8014 mat", "RAL 1015 mat", "FSM 71319", "RAL 9005", "RAL 8003", "RAL 7016"].map((c) => finishOf(c, [at(S.brochure, "p. 13 — coloris standard"), at(S.pageCorsica, "couleurs")])).concat([{ ...finishOf("VSR 240", [at(S.brochure, "p. 13")]), swatch: "#5a5550" }]),
    fabrics: FABRIC_COLLECTION([at(S.supp, "p. 51"), at(S.dteCorsica, "p. 6")]),
    controls: [{ code: "electric", label: "Motorisation électrique", kind: "electric", status: "to_confirm", sources: [at(S.brochure, "p. 13 — « proposé exclusivement avec une motorisation électrique »"), at(S.dteCorsica, "p. 6")], note: "modèle de moteur établi au devis" }],
    included: [
      { label: "Semi-coffre (fermé comme un coffre intégral en pose murale)", sources: [at(S.brochure, "p. 13"), at(S.pageCorsica, "description")] },
      { label: "Barre porteuse carrée et joues en aluminium", sources: [at(S.brochure, "p. 13"), at(S.supp, "p. 51")] },
      { label: "Bras à chaînes Flyer (2 ou 3 selon les dimensions)", sources: [at(S.dteCorsica, "p. 6"), at(S.dopCorsica, "tableau")] },
      { label: "Motorisation électrique", sources: [at(S.dteCorsica, "p. 6")] },
    ],
    supports: { label: "Supports muraux", rows: [{ upToMm: 3500, count: 2 }, { upToMm: 4700, count: 3 }, { upToMm: 5900, count: 4 }, { upToMm: 7000, count: 5 }], sources: [at(S.supp, "p. 52")] },
    options: [
      { code: "led_bottom_profile", label: "Éclairage LED dans le profil bas", description: "Bande LED intégrée sous le profil du coffre.", group: "lighting", status: "to_confirm", requiresControlKind: "electric", pricing: "quote", visual: "led_cassette", sources: [at(S.supp, "p. 51 — « possibilité »"), at(S.pageCorsica, "« dans la version standard »"), at(S.dteLed, "p. 6 — compatible uniquement avec le moteur SOMFY")], note: "de série selon la page web, en option selon le supplément technique ; kit compatible avec certains moteurs seulement" },
      { code: "led_arms", label: "Bras éclairés LED", description: "Bras équipés de LED.", group: "lighting", status: "to_confirm", requiresControlKind: "electric", prerequisite: "avancée de 3,1 m ou 3,6 m ; moteur compatible avec le kit d'éclairage", pricing: "quote", visual: "led_arms", sources: [at(S.brochure, "p. 13"), at(S.supp, "p. 83"), at(S.dteLed, "p. 6")], note: "kit d'éclairage compatible avec certains moteurs seulement (désignés par le fabricant)" },
      ...commandWishes([at(S.pageCorsica, "onglet Automatisation (liste sans compatibilité par moteur)"), at(S.dteCorsica, "p. 6")]),
    ],
    wind: { action: "retract", text: "Le store se replie par vent fort. Sa classe de vent dépend des dimensions et du nombre de bras (classe 2 jusqu'à 2,6 m d'avancée ; classe 1 à 0 au-delà selon la largeur) : au-delà, il doit être enroulé.", status: "established", sources: [at(S.dopCorsica, "tableau"), at(S.dteCorsica, "p. 29"), at(S.notice, "p. 11")] },
    protection: { label: "semi-coffre (fermé comme un coffre intégral en pose murale)", level: "semi", status: "established", sources: [at(S.brochure, "p. 13"), at(S.pageCorsica, "description")] },
    structure3d: { tiltDeg: [5, 35], cassetteMm: [260, 230] },
    notices: ["Sans support télescopique ni lambrequin.", "Résistance au vent déclarée selon les dimensions : jusqu'à la classe 0 en 5,9 à 7 m × 3,6 m avec deux bras — un store banne se replie par vent fort."],
  },
  specs: [
    { key: "width_max", label: "Largeur maximale", valueNum: 7000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 11.6 p. 6 ; supplément p. 51" },
    { key: "projection_values", label: "Avancées", valueText: "1,6 / 2,1 / 2,6 / 3,1 / 3,6 m", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 11.6 p. 6 ; DoP 06/M/2018" },
    { key: "tilt", label: "Inclinaison", valueText: "5° à 35°", source: "SUPPLIER_DOCUMENT", sourceRef: "Brochure p. 13 ; supplément p. 51" },
    { key: "wind_class_dop", label: "Résistance au vent (EN 13561)", valueText: "classe 2 jusqu'à 2,6 m d'avancée ; classe 1 ou 0 au-delà selon largeur et bras", source: "SUPPLIER_DOCUMENT", sourceRef: "DoP 06/M/2018 ; DT-E 11.6 p. 29" },
    { key: "cassette", label: "Coffre", valueText: "semi-coffre (« cassette » dans le supplément)", source: "SUPPLIER_DOCUMENT", sourceRef: "Brochure p. 13 ; supplément p. 51, 53" },
  ],
  faq: [
    { q: "HelioShade existe-t-il à la manivelle ?", a: "Non : le fabricant le propose uniquement motorisé." },
    { q: "L'éclairage LED est-il compris ?", a: "Les documents du fabricant divergent (de série ou en option) : il est confirmé et chiffré au devis. Le kit d'éclairage n'est compatible qu'avec certains moteurs, désignés par le fabricant : le moteur est choisi en conséquence au devis." },
    { q: "Quelle largeur minimale ?", a: "L'avancée plus 0,5 m : par exemple 3,1 m de largeur pour 2,6 m d'avancée." },
  ],
  openQuestions: [
    { field: "Éclairage", question: "LED du profil bas : de série ou en option, montage, tension (12 V ou 24 V).", sources: ["supp-stores p. 51", "aluprof-corsica", "dte-led-stores"], blocks: "inclus / option LED" },
    { field: "Moteur", question: "Moteur, télécommande et capteurs fournis par le distributeur.", sources: ["dte-corsica-fr p. 6"], blocks: "équipements inclus" },
    { field: "Tarifs", question: "Aucune grille de prix HelioShade.", sources: [], blocks: "prix affiché" },
  ],
};

/* ------------------------------------------------------------------ */
/* HelioPro — sans coffre, manivelle ou moteur                          */
/* ------------------------------------------------------------------ */

const jamaica: HelioFamily = {
  slug: "jamaica",
  name: "HelioPro",
  category: "STORES_BANNES",
  kind: "AWNING_SYSTEM",
  status: "QUOTE_ONLY",
  sortOrder: 42,
  brand: "Aluprof",
  manufacturer: "ALUPROF SA (usine d'Opole, ex-SELT)",
  supplierRef: "JAMAICA (DT-E 11.4)",
  shortDescription: "Store banne sans coffre, à manivelle ou motorisé, jusqu'à 7 m ; lambrequin, auvent et supports télescopiques en option.",
  description:
    "HelioPro est un store de terrasse sans coffre, sur barre porteuse carrée en acier, à manivelle ou motorisé. Il mesure jusqu'à 7 m de largeur et 3,6 m d'avancée. Un auvent en aluminium peut protéger la toile enroulée ; un lambrequin, des supports télescopiques et des bras éclairés (3,1 et 3,6 m) sont proposés en option.",
  seoTitle: "Store banne HelioPro sans coffre, manuel ou motorisé",
  seoDescription: "Store banne HelioPro jusqu'à 7 × 3,6 m : manivelle ou moteur, lambrequin, auvent et bras LED en option. Configurez et demandez votre devis.",
  rules: {
    type: "awning",
    dims: {
      width: { label: "Largeur", minMm: 2100, maxMm: 7000, sources: [at(S.supp, "p. 17–18"), at(S.dteJamaica, "p. 6")], note: "La brochure indique 2,05 m minimum ; la largeur minimale dépend de l'avancée." },
      depth: { label: "Avancée", minMm: 1600, maxMm: 3600, valuesMm: DEPTHS, confirmAboveMm: 3000, confirmNote: "une page du supplément technique indique 3,0 m maximum, toutes les autres sources 3,6 m", sources: [at(S.dteJamaica, "p. 6"), at(S.dopJamaica, "« JAMAICA.700x160-210-260-310-360 »")] },
    },
    depthWidthMin: minWidth([[1600, 2100], [2100, 2600], [2600, 3100], [3100, 3600], [3600, 4100]], [at(S.dteJamaica, "p. 6 — avancée + 0,5 m"), at(S.supp, "p. 18")]),
    mountings: [
      { code: "wall", label: "Murale", status: "established", sources: [at(S.supp, "p. 23")] },
      { code: "ceiling", label: "Au plafond (sans auvent)", status: "established", sources: [at(S.supp, "p. 20, 23 — l'auvent ne s'utilise pas avec les supports de plafond")] },
      { code: "rafter", label: "Sur chevrons", status: "established", sources: [at(S.supp, "p. 23")] },
    ],
    finishes: ["RAL 9010 mat", "RAL 9006 mat", "RAL 8014 mat", "RAL 1015 mat", "FSM 71319", "RAL 9005", "RAL 7016"].map((c) => finishOf(c, [at(S.brochure, "p. 15 — coloris standard"), at(S.pageJamaica, "couleurs")])),
    fabrics: FABRIC_COLLECTION([at(S.supp, "p. 17")]),
    controls: [
      { code: "crank_1500", label: "Manuelle — manivelle 150 cm", kind: "manual", status: "established", sources: [at(S.dteJamaica, "p. 6")] },
      { code: "crank_1800", label: "Manuelle — manivelle 180 cm", kind: "manual", status: "established", sources: [at(S.dteJamaica, "p. 6")] },
      { code: "crank_2200", label: "Manuelle — manivelle 220 cm", kind: "manual", status: "established", sources: [at(S.dteJamaica, "p. 6")] },
      { code: "electric", label: "Motorisation électrique", kind: "electric", status: "to_confirm", sources: [at(S.brochure, "p. 15"), at(S.dopJamaica, "« operated manually or with electric motor »")], note: "modèle de moteur établi au devis" },
    ],
    included: [
      { label: "Barre porteuse carrée en acier, supports de bras usinés", sources: [at(S.supp, "p. 17")] },
      { label: "Bras à chaînes Flyer (2 ou 3 selon les dimensions)", sources: [at(S.dopJamaica, "tableau"), at(S.supp, "p. 18")] },
    ],
    supports: { label: "Supports muraux", rows: [{ upToMm: 3500, count: 2 }, { upToMm: 4700, count: 3 }, { upToMm: 5900, count: 4 }, { upToMm: 7000, count: 5 }], sources: [at(S.supp, "p. 17")] },
    options: [
      { code: "hood", label: "Auvent en aluminium (protection de la toile enroulée)", group: "structure", status: "established", pricing: "quote", sources: [at(S.brochure, "p. 15"), at(S.supp, "p. 17, 20")], note: "pas avec la pose au plafond" },
      { code: "valance", label: "Lambrequin (3 formes)", group: "other", status: "established", pricing: "quote", sources: [at(S.brochure, "p. 15"), at(S.supp, "p. 17")] },
      { code: "telescopic_supports", label: "Supports télescopiques", description: "Éléments supplémentaires qui augmentent la résistance au vent.", group: "structure", status: "established", pricing: "quote", sources: [at(S.pageJamaica, "« Support télescopique : Standard et Plus »"), at(S.supp, "p. 17")] },
      { code: "led_arms", label: "Bras éclairés LED", group: "lighting", status: "to_confirm", requiresControlKind: "electric", prerequisite: "avancée de 3,1 m ou 3,6 m ; moteur compatible avec le kit d'éclairage", pricing: "quote", visual: "led_arms", sources: [at(S.brochure, "p. 15"), at(S.supp, "p. 83"), at(S.dteLed, "p. 2, 6")], note: "kit d'éclairage compatible avec certains moteurs seulement (désignés par le fabricant)" },
      ...commandWishes([at(S.pageJamaica, "onglet Automatisation (liste sans compatibilité par moteur)"), at(S.dteJamaica, "p. 6")]),
    ],
    wind: { action: "retract", text: "Le store se replie par vent fort ; sa classe de vent dépend des dimensions et du nombre de bras (classe 2 jusqu'à 2,6 m d'avancée, classe 1 en 3,6 m). Les supports télescopiques augmentent la résistance au vent.", status: "established", sources: [at(S.dopJamaica, "tableau"), at(S.dteJamaica, "p. 29"), at(S.pageJamaica, "supports télescopiques")] },
    protection: { label: "sans coffre (auvent en aluminium en option)", level: "none", status: "established", sources: [at(S.brochure, "p. 15"), at(S.supp, "p. 17")] },
    structure3d: { tiltDeg: [5, 40], cassetteMm: [160, 140] },
    notices: ["Sans coffre : la toile enroulée reste apparente, sauf avec l'auvent en option."],
  },
  specs: [
    { key: "width_max", label: "Largeur maximale", valueNum: 7000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 11.4 p. 6 ; supplément p. 17" },
    { key: "projection_values", label: "Avancées", valueText: "1,6 / 2,1 / 2,6 / 3,1 / 3,6 m", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 11.4 p. 6 ; DoP 03/M/2018", note: "le supplément p. 17 indique 3,0 m maximum" },
    { key: "tilt", label: "Inclinaison", valueText: "5° à 40°", source: "SUPPLIER_DOCUMENT", sourceRef: "Brochure p. 15 ; supplément p. 17" },
    { key: "cassette", label: "Coffre", valueText: "sans coffre ; auvent en option", source: "SUPPLIER_DOCUMENT", sourceRef: "Brochure p. 15 ; supplément p. 17" },
  ],
  faq: [
    { q: "HelioPro a-t-il un coffre ?", a: "Non : c'est un store sans coffre. Un auvent en aluminium peut protéger la toile enroulée (pas en pose au plafond)." },
    { q: "Manivelle ou moteur ?", a: "Les deux sont possibles ; le moteur et ses commandes sont définis au devis." },
  ],
  openQuestions: [
    { field: "Avancée", question: "Avancée maximale 3,0 m (supplément p. 17) ou 3,6 m (toutes les autres sources) ?", sources: ["supp-stores p. 17", "dte-jamaica-fr"], blocks: "3,6 m confirmé au devis" },
    { field: "Moteur", question: "Moteur, télécommande et capteurs fournis par le distributeur.", sources: [], blocks: "équipements inclus" },
    { field: "Tarifs", question: "Aucune grille de prix HelioPro.", sources: [], blocks: "prix affiché" },
  ],
};

/* ------------------------------------------------------------------ */
/* HelioSquare — réf. MADEIRA, coffre, motorisé                             */
/* ------------------------------------------------------------------ */

const madera: HelioFamily = {
  slug: "madera",
  name: "HelioSquare",
  category: "STORES_BANNES",
  kind: "AWNING_SYSTEM",
  status: "QUOTE_ONLY",
  sortOrder: 43,
  brand: "Aluprof",
  manufacturer: "ALUPROF SA",
  supplierRef: "MADEIRA (orthographe du fabricant)",
  shortDescription: "Store banne à coffre aux lignes droites, motorisé, jusqu'à 6 m de largeur et 50° d'inclinaison.",
  description:
    "HelioSquare est un store de terrasse à coffre cubique aux lignes droites, proposé uniquement motorisé, avec une manœuvre de secours possible à la manivelle. Il mesure jusqu'à 6 m de largeur et 3,6 m d'avancée, avec une inclinaison de 5° à 50°. Sa pose documentée est murale ; un éclairage LED intégré est annoncé par le fabricant.",
  seoTitle: "Store banne HelioSquare à coffre, motorisé",
  seoDescription: "Store banne HelioSquare : coffre aux lignes droites, motorisé, jusqu'à 6 × 3,6 m, inclinaison jusqu'à 50°. Configurez et demandez votre devis.",
  rules: {
    type: "awning",
    dims: {
      width: { label: "Largeur", minMm: 2050, maxMm: 6000, sources: [at(S.brochure, "p. 5"), at(S.supp, "p. 3"), at(S.imMadeira, "p. 8")] },
      depth: { label: "Avancée", minMm: 1600, maxMm: 3600, valuesMm: DEPTHS, sources: [at(S.imMadeira, "p. 8"), at(S.supp, "p. 4, 8")] },
    },
    depthWidthMin: minWidth([[1600, 2050], [2100, 2550], [2600, 3050], [3100, 3550], [3600, 4100]], [at(S.supp, "p. 4")]),
    mountings: [{ code: "wall", label: "Murale", status: "established", sources: [at(S.supp, "p. 9 — montage mural"), at(S.imMadeira, "§ 6.2")], note: "seule pose documentée" }],
    finishes: ["RAL 9010 mat", "RAL 9006 mat", "RAL 8014 mat", "RAL 1015 mat", "FSM 71319", "RAL 9005", "RAL 7016"].map((c) => finishOf(c, [at(S.brochure, "p. 5 — coloris standard"), at(S.pageMadeira, "couleurs")])),
    fabrics: FABRIC_COLLECTION([at(S.supp, "p. 3")]),
    controls: [{ code: "electric", label: "Motorisation électrique (secours manuel possible)", kind: "electric", status: "to_confirm", sources: [at(S.brochure, "p. 5 — « exclusivement avec une motorisation électrique »"), at(S.supp, "p. 3 — manœuvre de secours par manivelle possible")], note: "moteur établi au devis" }],
    included: [
      { label: "Coffre cubique protégeant la toile", status: "to_confirm", description: "« entièrement fermé » selon la brochure, « demi-coffre » selon la page web", sources: [at(S.brochure, "p. 5"), at(S.pageMadeira, "description")] },
      { label: "Barre porteuse carrée, joues en aluminium, bras à chaînes Flyer", sources: [at(S.supp, "p. 3")] },
      { label: "Motorisation électrique", sources: [at(S.brochure, "p. 5")] },
    ],
    supports: { label: "Supports muraux", rows: [{ upToMm: 3500, count: 2 }, { upToMm: 4700, count: 3 }, { upToMm: 5900, count: 4 }, { upToMm: 6000, count: 5 }], sources: [at(S.supp, "p. 5"), at(S.imMadeira, "p. 10–11")] },
    options: [
      { code: "led_cassette", label: "Éclairage LED intégré au coffre", group: "lighting", status: "to_confirm", requiresControlKind: "electric", pricing: "quote", visual: "led_cassette", sources: [at(S.pageMadeira, "« de série »"), at(S.brochure, "p. 5"), at(S.supp, "p. 3 — « possibilité »")], note: "de série selon la page web et la brochure, en option selon le supplément technique" },
      { code: "led_arms", label: "Bras éclairés LED", group: "lighting", status: "to_confirm", wish: true, requiresControlKind: "electric", pricing: "quote", visual: "led_arms", sources: [at(S.brochure, "p. 5"), at(S.supp, "p. 3")], note: "HelioSquare est absent des listes du kit LED pour bras" },
      ...commandWishes([at(S.pageMadeira, "onglet Automatisation : deux entrées seulement"), at(S.brochure, "p. 5 — automatisme météorologique et domotique possibles")]),
    ],
    wind: { action: "retract", text: "Le store se replie par vent fort ; classe de vent 1 déclarée par le fabricant : il doit être enroulé au-delà.", status: "established", sources: [at(S.dopMadeira, "« Class 1 »"), at(S.notice, "p. 11")] },
    protection: { label: "coffre (intégral selon la brochure, demi-coffre selon la page web)", level: "full", status: "to_confirm", sources: [at(S.brochure, "p. 5"), at(S.pageMadeira, "description")] },
    structure3d: { tiltDeg: [5, 50], cassetteMm: [237, 230] },
    notices: ["Résistance au vent déclarée : classe 1 — un store banne se replie par vent fort."],
  },
  specs: [
    { key: "width_max", label: "Largeur maximale", valueNum: 6000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Brochure p. 5 ; supplément p. 3" },
    { key: "projection_values", label: "Avancées", valueText: "1,6 / 2,1 / 2,6 / 3,1 / 3,6 m", source: "SUPPLIER_DOCUMENT", sourceRef: "Notice de montage p. 8 ; supplément p. 4" },
    { key: "tilt", label: "Inclinaison", valueText: "5° à 50°", source: "SUPPLIER_DOCUMENT", sourceRef: "Brochure p. 5 ; supplément p. 3" },
    { key: "wind_class_dop", label: "Résistance au vent (EN 13561)", valueText: "classe 1", source: "SUPPLIER_DOCUMENT", sourceRef: "DoP MA/MADEIRA/21/26" },
  ],
  faq: [
    { q: "HelioSquare peut-il se poser au plafond ?", a: "La documentation du fabricant ne décrit que la pose murale : une autre pose est étudiée au devis." },
    { q: "L'éclairage LED est-il compris ?", a: "Annoncé de série par la page et la brochure du fabricant, en option par son supplément technique : il est confirmé au devis." },
  ],
  openQuestions: [
    { field: "Coffre", question: "Coffre intégral (brochure) ou demi-coffre (page web) ?", sources: ["brochure-stores-bannes p. 5", "aluprof-madeira"], blocks: "description du coffre" },
    { field: "Éclairage", question: "LED de série ou option ; bras LED disponibles ?", sources: ["aluprof-madeira", "supp-stores p. 3, 83"], blocks: "inclus / option LED" },
    { field: "Documents", question: "Documentation technique (DT-E) et déclaration de performances en français ; disponibilité chez le distributeur (absent du catalogue THYSENS).", sources: [], blocks: "guide, validation" },
    { field: "Tarifs", question: "Aucune grille de prix HelioSquare.", sources: [], blocks: "prix affiché" },
  ],
};

export const AWNINGS_2026: HelioFamily[] = [corsica, jamaica, madera];
