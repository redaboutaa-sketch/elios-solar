/**
 * Pergolas (noms publics du 2026-10-31) : HelioSky (SB 350, ex-Malaga), HelioMax (SB 450, ex-Marbella), HelioLux
 * (ex-Sevilla ; correspondance client SOLID, données actuelles PERGOLA V ZiiiP à confirmer).
 *
 * Trois produits DIFFÉRENTS des anciennes fiches SB 400 / SB 500 (retirées, conservées pour l'historique) : aucune valeur,
 * limite, teinte ni option n'est reprise d'un autre modèle. Chaque règle cite sa source (documents du fabricant
 * téléchargés le 2026-10-25, inventaire privé : private/heliostores/research/pergolas*.json) ; une contradiction entre
 * sources est signalée et validée au devis. Données publiables : aucun tarif.
 */
import type { SourceRef } from "@/domain/system";
import type { HelioFamily } from "../heliostores-data";
import { finishOf, src } from "./shared";
import { ACCESSORY_LABELS } from "@/domain/nomenclature";

export const PERGOLA_SOURCES = {
  pageSB350: src("aluprof-sb-350", "Page fabricant « SB 350 Pergola – ready-made product »", "https://aluprof.com/en/product/pergola-sb-350"),
  dteSB350: src("dte-sb350-fr-2025", "Documentation technique et d'utilisation Pergola SB350, DT-E 5.13 (éd. 4, janvier 2025, FR)"),
  dopSB350: src("dop-sb350-25", "Déclarations des performances P/SB350/25 et PD/SB350/25 (2025-12-05)"),
  suppPergolas: src("supp-pergolas", "Supplément technique PERGOLAS (FR)"),
  brochurePergolas: src("brochure-pergolas-fr", "Brochure « Pergolas » (FR)"),
  catalogueClient: src("catalogue-thysens", "Catalogue THYSENS (collection SELT, 161 p.)"),
  pageSB450: src("aluprof-sb-450", "Page fabricant « SB 450 »", "https://aluprof.com/fr/produit/sb-450"),
  iuikSB450: src("iuik-sb450-fr", "Notice d'utilisation et d'entretien SB 450 (FR, état au 2026-05-12)"),
  imSB450: src("im-sb450-fr", "Notice de montage SB 450 (FR, état au 2026-01-01)"),
  dopSB450: src("dop-sb450-25", "Déclarations des performances P/SB450/25 et PD/SB450/25 (2025-12-05)"),
  pageVZiiiP: src("aluprof-pergola-v-ziiip", "Page fabricant « PERGOLA V ZiiiP »", "https://aluprof.com/en/offer/sunshades/pergolas"),
  dteVZiiiP: src("dte-pergola-v-fr", "Documentation technique DT-E 5.6 « véranda V ZiiiP – Pergola V ZiiiP » (éd. 3, mars 2021, FR)"),
  dopVZiiiP: src("dop-100-mw-2021", "Déclaration des performances 100/MW/2021 « PERGOLA V ZiiiP MT.500x600 »"),
  openSlideIM: src("im-openslide-en", "Notice d'installation MB-OpenSlide (EN, valable au 2026-01-01) et fiche A4 (FR)"),
} as const satisfies Record<string, SourceRef>;

const S = PERGOLA_SOURCES;
const at = (s: SourceRef, loc: string): SourceRef => ({ ...s, loc });

/** Fermetures latérales coulissantes vitrées (MB-OpenSlide) : accessoire, jamais une famille. */
export const OPENSLIDE_WISH_LABEL = ACCESSORY_LABELS.sideClosure;
/** Panneaux coulissants aluminium (Slide) : HelioSlide ALU, accessoire de fermeture, jamais une famille. */
export const SLIDE_WISH_LABEL = ACCESSORY_LABELS.slidingPanels;

/* ------------------------------------------------------------------ */
/* HelioSky — SB 350, produit prêt à poser en tailles fixes              */
/* ------------------------------------------------------------------ */

const MALAGA_DEPTHS = [3400, 3850, 4300, 4750];
const malaga: HelioFamily = {
  slug: "malaga",
  name: "HelioSky",
  category: "PERGOLAS",
  kind: "PERGOLA_SYSTEM",
  status: "QUOTE_ONLY",
  sortOrder: 5,
  brand: "Aluprof",
  manufacturer: "ALUPROF SA / SELT Sp. z o.o. (Opole)",
  supplierRef: "SB 350 (Pergola – ready-made product, DT-E 5.13)",
  shortDescription: "Pergola autoportante à lames orientables, livrée prête à poser en 3,5 m de large et quatre avancées.",
  description:
    "HelioSky est une pergola autoportante sur quatre poteaux, à toiture de lames aluminium plates orientables de 0 à 120°. Elle est fabriquée dans des tailles définies : 3,5 m de largeur, quatre avancées et 2,5 m de hauteur libre, en blanc ou gris anthracite. Le moteur 24 V et la télécommande sont fournis ; une application pour smartphone pilote la toiture en Wi-Fi.",
  seoTitle: "Pergola HelioSky à lames orientables — tailles prêtes à poser",
  seoDescription: "Pergola autoportante HelioSky : lames orientables motorisées, 3,5 m de large, quatre avancées, télécommande et application incluses. Demandez votre devis.",
  rules: {
    type: "pergola",
    roof: "louvres",
    dims: {
      width: { label: "Largeur", minMm: 3500, maxMm: 3500, valuesMm: [3500], sources: [at(S.dteSB350, "p. 8"), at(S.pageSB350, "« Fixed width 3.5m »"), at(S.suppPergolas, "p. 109")] },
      depth: { label: "Avancée", minMm: 3400, maxMm: 4750, valuesMm: MALAGA_DEPTHS, sources: [at(S.dteSB350, "p. 8"), at(S.dopSB350, "« max. dimensions 4750x3500x2665 mm »"), at(S.suppPergolas, "p. 109–110"), at(S.brochurePergolas, "p. 6"), at(S.catalogueClient, "p. 14")], note: "La page web du fabricant indique d'autres valeurs (3,6 / 4,0 / 4,4 / 4,8 m) : l'avancée exacte est confirmée au devis." },
      height: { label: "Hauteur libre", minMm: 2500, maxMm: 2500, valuesMm: [2500], sources: [at(S.dteSB350, "p. 8 — hauteur libre 2 500 mm, cadre 2 665 mm")] },
    },
    fixedSizes: MALAGA_DEPTHS.map((d) => ({ code: `3500x${d}`, label: `3,50 m × ${(d / 1000).toLocaleString("fr-FR")} m (avancée), hauteur libre 2,50 m`, widthMm: 3500, depthMm: d, heightMm: 2500, sources: [at(S.dteSB350, "p. 8")] })),
    mountings: [{ code: "freestanding", label: "Autoportante (quatre poteaux)", status: "established", sources: [at(S.pageSB350, "« free-standing version only »"), at(S.dteSB350, "p. 5"), at(S.catalogueClient, "p. 15")], note: "Un supplément technique évoque une version murale, contredite par toutes les autres sources : non proposée." }],
    finishes: [finishOf("RAL 9016 mat", [at(S.pageSB350, "couleurs"), at(S.brochurePergolas, "p. 6")]), finishOf("RAL 7016 mat", [at(S.pageSB350, "couleurs"), at(S.brochurePergolas, "p. 6")])],
    included: [
      { label: "Toiture à lames aluminium plates, orientables de 0 à 120°", sources: [at(S.suppPergolas, "p. 109"), at(S.brochurePergolas, "p. 6")] },
      { label: "Moteur 24 V et électronique de commande préinstallés", sources: [at(S.dteSB350, "p. 8, 34")] },
      { label: "Télécommande radio fournie (appairée en usine)", sources: [at(S.dteSB350, "p. 28, 37–38"), at(S.pageSB350, "« A remote control is included »")] },
      { label: "Pilotage par application smartphone (Wi-Fi)", sources: [at(S.dteSB350, "p. 34, 38")] },
      { label: "Évacuation des eaux par les gouttières et les poteaux", sources: [at(S.dteSB350, "p. 8–9")] },
    ],
    options: [
      { code: "wind_sensor", label: "Capteur de vent", description: "Recommandé par le fabricant ; le modèle compatible avec l'électronique fournie n'est pas désigné.", supplierRef: "liste d'accessoires de la page fabricant (Somfy, Elero) sans règle de compatibilité avec le contrôleur Blebox", group: "control", status: "to_confirm", wish: true, pricing: "quote", visual: "wind_sensor", sources: [at(S.dteSB350, "p. 33 — « nous vous recommandons fortement l'utilisation du capteur de vent »")] },
    ],
    closureWishes: [{ familySlug: "sliding_glass", label: OPENSLIDE_WISH_LABEL, status: "to_confirm", note: "aucune fermeture latérale n'est documentée pour ce modèle : souhait étudié au devis, sans garantie de compatibilité." }],
    structure3d: { postMm: [130, 130], beamMm: [165, 85], bladeMm: [150, 27] },
    notices: ["HelioSky est fabriquée dans les tailles proposées : pour une autre dimension, demandez une étude hors gamme."],
    wind: { action: "blades", text: "En cas de fortes rafales, les lames doivent être placées en position ouverte ; un automatisme de vent est recommandé. Classe de vent 3. Le comportement automatique d'un capteur n'est pas documenté.", status: "established", sources: [at(S.dteSB350, "p. 9, 34"), at(S.dopSB350, "classe 3")] },
  },
  specs: [
    { key: "width", label: "Largeur", valueNum: 3500, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 5.13 SB350 p. 8" },
    { key: "projection_values", label: "Avancées fabriquées", valueText: "3 400 / 3 850 / 4 300 / 4 750 mm", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 5.13 SB350 p. 8 ; DoP P/SB350/25 ; supplément p. 109–110" },
    { key: "projection_values", label: "Avancées fabriquées", valueText: "3,6 / 4,0 / 4,4 / 4,8 m", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/pergola-sb-350", note: "Deux séries publiées : à confirmer avec le fabricant." },
    { key: "clear_height", label: "Hauteur libre", valueNum: 2500, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 5.13 SB350 p. 8" },
    { key: "blade_pitch", label: "Entraxe des lames", valueNum: 150, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 5.13 SB350 p. 8" },
    { key: "snow", label: "Charge de neige", valueText: "30 kg/m² en couche uniforme", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 5.13 SB350 p. 9" },
    { key: "wind_class", label: "Résistance au vent (EN 13561)", valueText: "classe 3", source: "SUPPLIER_DOCUMENT", sourceRef: "DoP PD/SB350/25" },
    { key: "profiles", label: "Profilés", valueText: "poteau 130 × 130, poutre 85 × 165, lame 195 × 27,5 mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Supplément PERGOLAS p. 110" },
  ],
  faq: [
    { q: "HelioSky existe-t-elle sur mesure ?", a: "Non : HelioSky est fabriquée en 3,5 m de largeur, dans quatre avancées et avec 2,5 m de hauteur libre. Pour une autre dimension, le configurateur vous permet de demander une étude hors gamme, sans garantie de fabrication." },
    { q: "Peut-on l'adosser à un mur ?", a: "Non : la documentation du fabricant décrit une pergola autoportante sur quatre poteaux." },
    { q: "Qu'est-ce qui est fourni ?", a: "La structure et ses lames orientables, le moteur 24 V préinstallé, la télécommande et le pilotage par application en Wi-Fi. Les ancrages, la pose et le raccordement électrique sont étudiés au devis." },
    { q: "Que faire par grand vent ?", a: "Le fabricant demande de placer les lames en position ouverte en cas de fortes rafales et recommande un capteur de vent ; le modèle compatible est confirmé au devis." },
  ],
  openQuestions: [
    { field: "Avancées", question: "Deux séries d'avancées publiées (3,40 / 3,85 / 4,30 / 4,75 m dans la notice, la déclaration de performances et le catalogue ; 3,6 / 4,0 / 4,4 / 4,8 m sur la page web) : laquelle publier ?", sources: ["dte-sb350-fr-2025", "aluprof-sb-350"], blocks: "avancée exacte (devis)" },
    { field: "Capteurs", question: "Capteur de vent compatible avec le contrôleur fourni (électronique Blebox) ; liste d'accessoires sans règle de compatibilité.", sources: ["dte-sb350-fr-2025"], blocks: "capteur (souhait au devis)" },
    { field: "Notice", question: "Notice graphique de montage (document séparé, non publié).", sources: ["dte-sb350-fr-2025"], blocks: "guide d'installation" },
    { field: "Tarifs", question: "Aucune grille de prix SB 350 dans le classeur : prix à fournir.", sources: ["classeur tarifaire (privé)"], blocks: "prix affiché" },
  ],
};

/* ------------------------------------------------------------------ */
/* HelioMax — SB 450, sur mesure                                       */
/* ------------------------------------------------------------------ */

const SB450_RAL = ["RAL 7016", "RAL 9016", "RAL 9001", "RAL 9010", "RAL 1013", "RAL 1015", "RAL 7001", "RAL 7012", "RAL 7015", "RAL 7021", "RAL 7024", "RAL 7035", "RAL 7037", "RAL 9006", "RAL 9007", "RAL 9005", "RAL 8014", "RAL 8016", "RAL 7022", "RAL 7039", "RAL 7043", "RAL 8003"];
const marbella: HelioFamily = {
  slug: "marbella",
  name: "HelioMax",
  category: "PERGOLAS",
  kind: "PERGOLA_SYSTEM",
  status: "QUOTE_ONLY",
  sortOrder: 6,
  brand: "Aluprof",
  manufacturer: "ALUPROF SA",
  supplierRef: "SB 450 (Pergola de terrasse – produit fini)",
  shortDescription: "Pergola bioclimatique sur mesure, autoportante ou adossée, jusqu'à 4 × 6 m, lames orientables motorisées.",
  description:
    "HelioMax est une pergola à lames orientables, autoportante ou adossée, fabriquée à vos dimensions jusqu'à 4 m de largeur et 6 m d'avancée. Le moteur est dissimulé dans la structure et se commande par émetteur radio ou application. Éclairage LED dans les lames ou périphérique, capteurs et fermetures latérales sont étudiés au devis.",
  seoTitle: "Pergola bioclimatique HelioMax sur mesure",
  seoDescription: "Pergola HelioMax à lames orientables, autoportante ou adossée, jusqu'à 4 × 6 m : configurez vos cotes et demandez votre devis.",
  rules: {
    type: "pergola",
    roof: "louvres",
    dims: {
      width: { label: "Largeur", minMm: 1000, maxMm: 4000, sources: [at(S.suppPergolas, "p. 60–62 — B ≤ 4 000 mm"), at(S.brochurePergolas, "p. 4 — minimum 1 m")], note: "Minimum indiqué par la brochure seulement ; selon le type de mur, la largeur maximale descend à 3 996 mm." },
      depth: { label: "Avancée", minMm: 1390, maxMm: 6010, sources: [at(S.suppPergolas, "p. 60–62 — L ≤ 6 010 mm"), at(S.brochurePergolas, "p. 4 — minimum 1,39 m")], note: "L'avancée réelle dépend du nombre de lames (pas de 204 ou 220 mm) : ajustée au devis." },
      height: { label: "Hauteur", minMm: null, maxMm: 3000, confirmAboveMm: 2810, confirmNote: "la brochure indique 2,81 m (hauteur libre), le supplément technique 3,00 m de structure", sources: [at(S.suppPergolas, "p. 59–60"), at(S.brochurePergolas, "p. 4")] },
    },
    mountings: [
      { code: "freestanding", label: "Autoportante", status: "established", sources: [at(S.iuikSB450, "p. 7–10"), at(S.brochurePergolas, "p. 4")] },
      { code: "wall", label: "Adossée (un ou deux murs)", status: "established", sources: [at(S.iuikSB450, "p. 7–10 — types de mur 1 à 4"), at(S.suppPergolas, "p. 59")], note: "type de mur (1 à 4) établi à l'étude du projet" },
    ],
    finishes: SB450_RAL.map((c) => finishOf(`${c} mat`, [at(S.pageSB450, "palette de teintes")])),
    customFinish: { code: "WOOD_DECOR", label: "Décor bois (option)", status: "to_confirm", sources: [at(S.pageSB450, "« * Option avec supplément » : R26, R27, R28, R30, R49, R52")], note: "décor bois en supplément : conditions et délai confirmés au devis" },
    included: [
      { label: "Toiture à lames orientables, motorisée (moteur dissimulé)", sources: [at(S.iuikSB450, "p. 6, 10"), at(S.pageSB450, "description")] },
      { label: "Centrale de commande radio (protocole io)", sources: [at(S.iuikSB450, "p. 10")] },
      { label: "Commande par émetteur sans fil et/ou application dédiée", status: "to_confirm", sources: [at(S.iuikSB450, "p. 12")], description: "la fourniture de l'émetteur et son nombre de canaux ne sont pas documentés" },
      { label: "Gouttière sèche à double pente, évacuation par les poteaux", sources: [at(S.iuikSB450, "p. 6, 11")] },
    ],
    options: [
      { code: "led_blades", label: "Éclairage LED linéaire dans les lames", group: "lighting", status: "established", pricing: "quote", visual: "led_perimeter", sources: [at(S.suppPergolas, "p. 77"), at(S.iuikSB450, "p. 6")], note: "lames de type FLAT ; longueur et nombre de lames équipées établis au devis" },
      { code: "led_spots", label: "Spots LED dans les lames (4 à 12 points)", group: "lighting", status: "established", pricing: "quote", visual: "led_spots", sources: [at(S.suppPergolas, "p. 77")], note: "lames de type FLAT ; nombre de points établi au devis", cumulToConfirmWith: ["led_blades"] },
      { code: "led_perimeter", label: "Éclairage LED périphérique", group: "lighting", status: "established", pricing: "quote", visual: "led_perimeter", sources: [at(S.suppPergolas, "p. 77 — bande LED de couronne")] },
      { code: "weather_sensors", label: "Capteurs de vent, pluie et soleil", description: "Équipements de contrôle supplémentaires prévus par la notice ; modèles compatibles avec la centrale établis au devis.", group: "control", status: "to_confirm", pricing: "quote", visual: "wind_sensor", sources: [at(S.iuikSB450, "p. 12 — « Équipement de contrôle supplémentaire éventuel »")] },
      { code: "frost_sensor", label: "Capteur antigel", description: "Sous 2 °C, il entrouvre les lames (10 %, ou 66 % en cas de neige).", group: "control", status: "to_confirm", pricing: "quote", sources: [at(S.iuikSB450, "p. 6")], note: "inclus ou en option : non précisé par la notice" },
      { code: "intermediate_post", label: "Poteau intermédiaire", group: "structure", status: "to_confirm", pricing: "quote", sources: [at(S.pageSB450, "« poteau intermédiaire pouvant être installé également sur une structure existante »")], note: "position et règles de pose établies au devis" },
      { code: "heating", label: "Chauffage", group: "other", status: "to_confirm", wish: true, pricing: "quote", sources: [at(S.brochurePergolas, "p. 4 — « système de chauffage »")], note: "modèle et puissance non documentés" },
    ],
    closureWishes: [
      { familySlug: "sliding_glass", label: OPENSLIDE_WISH_LABEL, status: "to_confirm", note: "fermeture vitrée citée pour ce modèle par le fabricant, sans détail de raccordement : dimensions et fixations étudiées au devis." },
      { familySlug: "helioscreen", label: "Screen latéral HelioScreen", status: "to_confirm", note: "stores screen latéraux cités par le fabricant : intégration étudiée au devis." },
      { familySlug: "sliding_panels", label: SLIDE_WISH_LABEL, status: "to_confirm", note: "modules coulissants cités par le fabricant : modèle et fixations étudiés au devis." },
    ],
    modules: { maxSingleWidthMm: 4000, multiModule: "not_documented", sources: [at(S.brochurePergolas, "p. 4 — montage modulaire NON")], note: "variantes à une travée documentées" },
    structure3d: { beamMm: [190, 120] },
    wind: { action: "blades", text: "Sans capteur de vent, au-delà des valeurs admissibles pour vos dimensions, il faut ouvrir les lames à 90° et relever les protections latérales ; les protections latérales déployées sont admises jusqu'à 45 km/h. Les fermetures latérales réduisent la résistance au vent.", status: "established", sources: [at(S.iuikSB450, "p. 6, 11")] },
  },
  specs: [
    { key: "width_max", label: "Largeur maximale", valueNum: 4000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Supplément PERGOLAS p. 60–62" },
    { key: "projection_max", label: "Avancée maximale", valueNum: 6010, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Supplément PERGOLAS p. 60–62" },
    { key: "height_max", label: "Hauteur maximale", valueNum: 3000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Supplément PERGOLAS p. 59–60" },
    { key: "height_max", label: "Hauteur maximale", valueNum: 2810, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Brochure Pergolas p. 4", note: "correspond à la hauteur libre du supplément technique" },
    { key: "blade_rotation", label: "Rotation des lames", valueText: "jusqu'à 135° (lame S) ou 110° (lame FLAT)", source: "SUPPLIER_DOCUMENT", sourceRef: "Notice d'utilisation SB 450 p. 6" },
    { key: "drainage", label: "Évacuation", valueText: "jusqu'à 57 l/min (4 points d'évacuation)", source: "SUPPLIER_DOCUMENT", sourceRef: "Notice d'utilisation SB 450 p. 11" },
    { key: "snow", label: "Charge de neige", valueText: "72 kg/m² aux dimensions maximales", source: "SUPPLIER_DOCUMENT", sourceRef: "Notice d'utilisation SB 450 p. 6" },
    { key: "wind_class", label: "Résistance au vent (EN 13561)", valueText: "classe 3 (propriété additionnelle : classe 6)", source: "SUPPLIER_DOCUMENT", sourceRef: "DoP PD/SB450/25" },
  ],
  faq: [
    { q: "Quelles dimensions sont possibles ?", a: "Jusqu'à 4 m de largeur et 6 m d'avancée environ ; l'avancée exacte dépend du nombre de lames et la hauteur maximale (2,81 m ou 3 m selon le document) est confirmée au devis." },
    { q: "Autoportante ou adossée ?", a: "Les deux : HelioMax se pose seule sur ses poteaux ou contre un ou deux murs. Le type de fixation murale est établi à l'étude du projet." },
    { q: "Peut-on fermer les côtés ?", a: "Le fabricant cite des fermetures vitrées coulissantes, des panneaux coulissants et des screens latéraux. Les dimensions et fixations sont étudiées au devis ; les fermetures réduisent la résistance au vent." },
    { q: "Quel éclairage ?", a: "Éclairage LED linéaire ou spots dans les lames, et éclairage périphérique, en option." },
  ],
  openQuestions: [
    { field: "Vent", question: "Valeur de vent publiable : 95 mph (page web), 110 km/h toit fermé (notice), classe 3 (déclaration) avec propriété additionnelle classe 6.", sources: ["aluprof-sb-450", "iuik-sb450-fr", "dop-sb450-25"], blocks: "communication sur le vent" },
    { field: "Commande", question: "Émetteur livré (modèle, nombre de canaux) et capteur antigel : inclus ou option ?", sources: ["iuik-sb450-fr"], blocks: "équipements inclus" },
    { field: "Teintes", question: "Teintes standard et teintes sur demande (la page ne les distingue pas, hors décors bois).", sources: ["aluprof-sb-450"], blocks: "teinte (devis)" },
    { field: "Tarifs", question: "Aucune grille de prix SB 450 dans le classeur : la grille SB 400 / SB 500 ne s'applique pas.", sources: ["classeur tarifaire (privé)"], blocks: "prix affiché" },
  ],
};

/* ------------------------------------------------------------------ */
/* HelioLux (ex-Sevilla) — correspondance client SOLID ; données V ZiiiP à confirmer */
/* ------------------------------------------------------------------ */

const sevilla: HelioFamily = {
  slug: "sevilla",
  name: "HelioLux",
  category: "PERGOLAS",
  kind: "PERGOLA_SYSTEM",
  status: "QUOTE_ONLY",
  sortOrder: 7,
  brand: "Aluprof",
  manufacturer: "SELT Sp. z o.o. (Opole) — ALUPROF",
  // Correspondance client du 2026-10-31 : HelioLux = SOLID. Les règles et caractéristiques ci-dessous viennent de la
  // documentation PERGOLA V ZiiiP (ancienne correspondance) : elles ne sont PAS transférées vers SOLID ni validées pour
  // lui ; dossier de validation technique « helioLux-solid » (docs/product-naming-transco.csv).
  supplierRef: "SOLID (correspondance client du 2026-10-31) — données actuelles issues de PERGOLA V ZiiiP (MT, DT-E 5.6), à confirmer",
  shortDescription: "Pergola adossée à toiture en toile tendue motorisée, jusqu'à 5 × 6 m par module.",
  description:
    "HelioLux est une pergola adossée à toiture en toile enroulable, tendue par des ressorts à gaz et motorisée. Un module mesure jusqu'à 5 m de largeur et 6 m d'avancée ; plusieurs modules s'assemblent en largeur. Elle protège du soleil mais pas de la pluie : la toile s'enroule par pluie, neige, gel ou vent fort.",
  seoTitle: "Pergola toile HelioLux adossée, motorisée",
  seoDescription: "Pergola HelioLux à toiture en toile tendue motorisée, adossée, jusqu'à 5 × 6 m par module. Configurez et demandez votre devis.",
  rules: {
    type: "pergola",
    roof: "fabric",
    dims: {
      width: { label: "Largeur", minMm: 2000, maxMm: 5000, sources: [at(S.dteVZiiiP, "p. 9 — jusqu'à 5 000 mm"), at(S.brochurePergolas, "p. 8 — minimum 2 m")], note: "Minimum indiqué par la brochure seulement." },
      depth: { label: "Avancée", minMm: 2000, maxMm: 6000, sources: [at(S.dteVZiiiP, "p. 9 — jusqu'à 6 000 mm"), at(S.brochurePergolas, "p. 8 — minimum 2 m")] },
      height: { label: "Hauteur des poteaux avant", minMm: null, maxMm: 2450, confirmAboveMm: 2400, confirmNote: "la documentation technique indique 2 450 mm, la page web et la brochure 2,4 m", sources: [at(S.dteVZiiiP, "p. 9"), at(S.brochurePergolas, "p. 8")] },
    },
    mountings: [{ code: "wall", label: "Adossée (deux poteaux avant)", status: "established", sources: [at(S.brochurePergolas, "p. 8 — autoportée NON / adossée OUI"), at(S.dteVZiiiP, "p. 12")] }],
    finishes: ["RAL 9010 mat", "RAL 7016 mat", "RAL 9006 mat", "FSM 71319", "RAL 9005 mat"].map((c) => finishOf(c, [at(S.pageVZiiiP, "teintes sans supplément")])),
    customFinish: { code: "RAL_CUSTOM", label: "Autre teinte RAL (option)", status: "to_confirm", sources: [at(S.pageVZiiiP, "« * Option avec supplément »")], note: "disponibilité confirmée par le fabricant, au devis" },
    fabrics: [
      { code: "serge_100", label: "Toile Serge 100 (facteur d'ouverture 1 %)", status: "established", description: "Toile microperforée très occultante.", swatch: "#8b8a84", sources: [at(S.dteVZiiiP, "p. 9"), at(S.brochurePergolas, "p. 8")] },
      { code: "serge_600", label: "Toile Serge 600", status: "established", description: "Toile microperforée ; facteur d'ouverture indiqué par la brochure seulement.", swatch: "#a7a59d", sources: [at(S.dteVZiiiP, "p. 9")], note: "coloris choisi sur nuancier au devis" },
    ],
    included: [
      { label: "Toiture en toile enroulable, tendue par ressorts à gaz", sources: [at(S.dteVZiiiP, "p. 9")] },
      { label: "Moteur tubulaire 230 V", sources: [at(S.dteVZiiiP, "p. 9")] },
      { label: "Commande par interrupteur ou télécommande", status: "to_confirm", sources: [at(S.dteVZiiiP, "p. 10")], description: "le point de commande fourni n'est pas documenté" },
    ],
    options: [
      { code: "wind_automation", label: "Automatisme de vent", description: "Recommandé par le fabricant ; modèle compatible établi au devis.", group: "control", status: "to_confirm", wish: true, pricing: "quote", visual: "wind_sensor", sources: [at(S.dteVZiiiP, "p. 32 — « Il est recommandé d'utiliser un automatisme de vent »")] },
    ],
    modules: { maxSingleWidthMm: 5000, multiModule: "documented", sources: [at(S.dteVZiiiP, "p. 5, 10 — modules avec deux supports avant communs")] },
    structure3d: { postMm: [68, 68], beamMm: [136, 75] },
    notices: ["Désignation commerciale mise à jour le 2026-10-31 : les caractéristiques techniques présentées sont en cours de confirmation. Dimensions, pose et équipements sont confirmés sur devis.", "HelioLux ne protège pas de la pluie : la toile doit être enroulée par pluie, neige ou gel. L'installation de parois latérales n'est pas prévue par le fabricant."],
    wind: { action: "retract", text: "La toile doit être enroulée dès que le vent dépasse la classe de vent du produit (classe 2) ; un automatisme de vent est recommandé.", status: "established", sources: [at(S.dteVZiiiP, "p. 32, 41"), at(S.dopVZiiiP, "classe 2")] },
  },
  specs: [
    { key: "width_max", label: "Largeur maximale d'un module", valueNum: 5000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 5.6 p. 9" },
    { key: "projection_max", label: "Avancée maximale", valueNum: 6000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 5.6 p. 9" },
    { key: "tilt", label: "Inclinaison", valueText: "10° à 45°", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 5.6 p. 10, 41 ; brochure p. 8", note: "le tableau p. 9 indique 10° à 90°" },
    { key: "wind_class", label: "Résistance au vent (EN 13561)", valueText: "classe 2 (84 Pa)", source: "SUPPLIER_DOCUMENT", sourceRef: "DoP 100/MW/2021", note: "la documentation technique indique 70 Pa / 38 km/h pour la classe 2" },
    { key: "rain", label: "Pluie", valueText: "ne protège pas de la pluie", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 5.6 p. 10" },
  ],
  faq: [
    { q: "HelioLux protège-t-elle de la pluie ?", a: "Non : c'est une protection solaire. Le fabricant demande d'enrouler la toile par pluie, neige, gel ou vent fort." },
    { q: "Peut-on la poser sans mur ?", a: "Non : HelioLux se fixe au mur et repose sur deux poteaux avant." },
    { q: "Peut-on fermer les côtés ?", a: "Non : le fabricant indique que l'installation de parois n'est pas prévue sur ce modèle." },
  ],
  openQuestions: [
    { field: "Modèle", question: "Correspondance client du 2026-10-31 : HelioLux = SOLID, alors que les données publiées (adossée, modules de 5 × 6 m, ressorts à gaz) viennent de PERGOLA V ZiiiP. La page fabricant décrit SOLID comme une pergola toile prête à poser, autoportante ou adossée, 4,0 m de largeur maximale. Fournir la documentation SOLID (dimensions, poses, toile, commande, fermetures) avant de remplacer ces caractéristiques.", sources: ["validation client 2026-10-31", "aluprof-pergolas (page de gamme)"], blocks: "caractéristiques, configurateur et prix" },
    { field: "Vent", question: "Classe 2 : 84 Pa (déclaration de performances) ou 70 Pa / 38 km/h (documentation technique) ? Seuil du capteur de vent.", sources: ["dop-100-mw-2021", "dte-pergola-v-fr"], blocks: "communication sur le vent" },
    { field: "Commande", question: "Télécommande et moteur livrés (protocole, canaux).", sources: ["dte-pergola-v-fr"], blocks: "équipements inclus" },
    { field: "Toiles", question: "Facteur d'ouverture de la toile Serge 600 ; coloris proposés.", sources: ["brochure-pergolas-fr"], blocks: "choix de toile (devis)" },
    { field: "Tarifs", question: "Aucune grille de prix PERGOLA V ZiiiP dans le classeur.", sources: ["classeur tarifaire (privé)"], blocks: "prix affiché" },
  ],
};

export const PERGOLAS_2026: HelioFamily[] = [malaga, marbella, sevilla];
