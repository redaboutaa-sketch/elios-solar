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
  suppPergolas: src("supp-pergolas", "Supplément technique PERGOLAS (FR, état 2026.05.12)"),
  brochurePergolas: src("brochure-pergolas-fr", "Brochure « Pergolas » (FR, 04.2026)"),
  catalogueClient: src("catalogue-thysens", "Catalogue THYSENS (collection SELT, 161 p.)"),
  pageSB450: src("aluprof-sb-450", "Page fabricant « SB 450 »", "https://aluprof.com/fr/produit/sb-450"),
  iuikSB450: src("iuik-sb450-fr", "Notice d'utilisation et d'entretien SB 450 (FR, état au 2026-05-12)"),
  imSB450: src("im-sb450-fr", "Notice de montage SB 450 (FR, état au 2026-01-01)"),
  dopSB450: src("dop-sb450-25", "Déclarations des performances P/SB450/25 et PD/SB450/25 (2025-12-05)"),
  pageVZiiiP: src("aluprof-pergola-v-ziiip", "Page fabricant « PERGOLA V ZiiiP »", "https://aluprof.com/en/offer/sunshades/pergolas"),
  dteVZiiiP: src("dte-pergola-v-fr", "Documentation technique DT-E 5.6 « véranda V ZiiiP – Pergola V ZiiiP » (éd. 3, mars 2021, FR)"),
  dopVZiiiP: src("dop-100-mw-2021", "Déclaration des performances 100/MW/2021 « PERGOLA V ZiiiP MT.500x600 »"),
  priceList: src("liste-prix-2026-09", "Liste des prix des produits finis (09.2026)"),
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
    finishes: [finishOf("RAL 9016 mat", [at(S.pageSB350, "couleurs"), at(S.brochurePergolas, "p. 6")]), finishOf("RAL 7016 mat", [at(S.pageSB350, "couleurs"), at(S.brochurePergolas, "p. 6")])].map((f) => ({ ...f, tier: "standard" as const })),
    palette: { edition: "nuancier du fabricant, brochure Pergolas (04.2026) : deux teintes standard, aucune autre teinte possible", component: "structure et lames", sources: [at(S.brochurePergolas, "p. 6"), at(S.pageSB350, "couleurs")] },
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
    "HelioMax est une pergola à lames orientables, autoportante ou adossée, fabriquée à vos dimensions jusqu'à 4 m de largeur et 6 m d'avancée. Le moteur est dissimulé dans la structure et piloté par une centrale radio et sa télécommande. Éclairage LED dans les lames ou périphérique, capteur pluie et antigel et poteaux supplémentaires se choisissent dans le configurateur ; les fermetures latérales sont étudiées au devis.",
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
    // page SB 450 : 33 teintes sans supplément (seuls les décors bois sont « * Option avec supplément ») ; la brochure
    // (p. 17) précise que la disponibilité dépend du produit et de son tarif → teintes ajoutées le 2026-11-01 à confirmer
    finishes: [...SB450_RAL.map((c) => ({ ...finishOf(`${c} mat`, [at(S.pageSB450, "palette de teintes")]), tier: "standard" as const })),
      ...["FSM 71319 mat", "VSR 240 satin", "VSR 780 mat", "DB 703 mat", "RAL 7038 mat", "RAL 7048 mat", "RAL 7016 STR", "RAL 7021 STR", "RAL 9005 STR", "RAL 9010 STR", "RAL 8003 STR"].map((c) => ({ ...finishOf(c, [at(S.pageSB450, "palette de teintes"), at(S.brochurePergolas, "p. 17 — couleurs standard de la structure")]), tier: "standard" as const, status: "to_confirm" as const, note: "teinte de la palette du modèle, disponibilité confirmée au devis" }))],
    palette: { edition: "nuancier du fabricant, brochure Pergolas (04.2026) et page produit consultée le 2026-10-20", component: "structure et lames", sources: [at(S.pageSB450, "palette de teintes"), at(S.brochurePergolas, "p. 17")], note: "la disponibilité d'une teinte dépend du produit : confirmée au devis" },
    customFinish: { code: "WOOD_DECOR", label: "Décor bois (option)", status: "to_confirm", sources: [at(S.pageSB450, "« * Option avec supplément » : R26, R27, R28, R30, R49, R52")], note: "décor bois en supplément : conditions et délai confirmés au devis" },
    included: [
      { label: "Toiture à lames orientables, motorisée (moteur dissimulé)", sources: [at(S.iuikSB450, "p. 6, 10"), at(S.pageSB450, "description")] },
      { label: "Gouttière sèche à double pente, évacuation par les poteaux", sources: [at(S.iuikSB450, "p. 6, 11")] },
    ],
    options: [
      // centrale radio du moteur : supplément « toujours » ajouté au prix de la structure (liste de prix p. 10–11), présenté
      // dans la décomposition ; la télécommande io est choisie à part (sinon « à choisir », chiffrée entre deux montants)
      { code: "remote_io", label: "Télécommande radio io", description: "Émetteur de la centrale de commande ; choisissez le modèle.", group: "control", status: "established", pricing: "validated", visual: "remote", values: [{ code: "io_1ch", label: "1 canal" }, { code: "io_2modes", label: "2 modes" }, { code: "io_4modes", label: "4 modes" }, { code: "io_screen", label: "à écran" }], sources: [at(S.priceList, "p. 10–11 — centrale radio ; p. 115 — commandes io"), at(S.iuikSB450, "p. 10, 12")] },
      { code: "frost_sensor", label: "Capteur pluie et antigel", description: "Ferme les lames sous la pluie ; sous 2 °C, il les entrouvre (10 %, ou 66 % en cas de neige).", group: "control", status: "established", pricing: "validated", sources: [at(S.priceList, "p. 10–11 — capteur de pluie et antigel"), at(S.iuikSB450, "p. 6, 10")] },
      { code: "led_blades", label: "Éclairage LED linéaire dans les lames", description: "LED blanc chaud ou neutre ; nombre de lames équipées selon l'avancée.", group: "lighting", status: "established", pricing: "validated", visual: "led_perimeter", sources: [at(S.priceList, "p. 20 — éclairage, lame F"), at(S.suppPergolas, "p. 77"), at(S.iuikSB450, "p. 6")], cumulToConfirmWith: ["led_spots"] },
      { code: "led_spots", label: "Spots LED dans les lames", description: "Points lumineux blanc chaud ; nombre selon les dimensions.", group: "lighting", status: "established", pricing: "validated", visual: "led_spots", sources: [at(S.priceList, "p. 20 — éclairage, lame F"), at(S.suppPergolas, "p. 77")], cumulToConfirmWith: ["led_blades"] },
      { code: "led_perimeter", label: "Éclairage LED périphérique", description: "Bande LED dans la couronne, blanc chaud ou neutre.", group: "lighting", status: "established", pricing: "validated", visual: "led_perimeter", sources: [at(S.priceList, "p. 20 — éclairage de la couronne"), at(S.suppPergolas, "p. 77")] },
      { code: "intermediate_post", label: "Poteau supplémentaire", description: "Prix par poteau, pied et liaison compris, selon la hauteur.", group: "structure", status: "established", pricing: "validated", maxQty: 4, sources: [at(S.priceList, "p. 10–11 — poteau supplémentaire"), at(S.pageSB450, "« poteau intermédiaire »")], note: "position établie à l'étude du projet ; au-delà de 4 poteaux, étude au devis" },
      { code: "weather_sensors", label: "Capteurs de vent et de soleil", description: "Équipements de contrôle supplémentaires prévus par la notice ; modèles compatibles avec la centrale établis au devis.", group: "control", status: "to_confirm", wish: true, pricing: "quote", visual: "wind_sensor", sources: [at(S.iuikSB450, "p. 12 — « Équipement de contrôle supplémentaire éventuel »")], note: "aucun capteur de vent ou de soleil tarifé pour ce modèle" },
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
    { field: "Commande", question: "La centrale radio (supplément systématique) est-elle livrée sans émetteur, la télécommande étant obligatoire ?", sources: ["liste-prix-2026-09"], blocks: "sous-total sans télécommande" },
    { field: "Éclairage", question: "Cumul LED lames + spots, contrôleur commun et spots sous 1,50 m d'avancée.", sources: ["liste-prix-2026-09"], blocks: "cumul des éclairages (devis)" },
    { field: "Teintes", question: "Teintes standard et teintes sur demande (la page ne les distingue pas, hors décors bois).", sources: ["aluprof-sb-450"], blocks: "teinte (devis)" },
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
  manufacturer: "ALUPROF SA",
  // Correspondance confirmée par le client (2026-11-03) : HelioLux = Pergola SEVILLA = système SOLID. Données reprises
  // du Supplément technique PERGOLAS (SOLID, p. 123–138), de la brochure Pergolas (p. 7, 12–15) et de la liste de prix
  // 09.2026 (p. 6, 7, 17, 19 de l'index) ; les données de l'ancienne correspondance (PERGOLA V ZiiiP) sont retirées.
  supplierRef: "SOLID (correspondance confirmée par le client le 2026-11-03)",
  shortDescription: "Pergola à toiture en toile PVC plissée motorisée, autoportante ou adossée, jusqu'à 4 × 7 m par module.",
  description:
    "HelioLux est une pergola à toiture en toile enduite PVC qui se replie en plis sur des chariots mobiles : motorisée, elle s'ouvre entièrement ou s'arrête dans n'importe quelle position. Autoportante ou adossée au mur, elle mesure jusqu'à 4 m de largeur et 7 m d'avancée par module ; plusieurs modules s'assemblent. L'eau de pluie est recueillie par une gouttière et évacuée par les poteaux avant. Elle protège de la pluie et du vent, mais pas des chutes de neige.",
  seoTitle: "Pergola toile HelioLux autoportante ou adossée, motorisée",
  seoDescription: "Pergola HelioLux à toiture en toile PVC plissée motorisée, autoportante ou adossée, jusqu'à 4 × 7 m par module. Configurez vos cotes et obtenez votre prix.",
  rules: {
    type: "pergola",
    roof: "fabric",
    revision: { date: "2026-11-03", note: "caractéristiques remplacées par celles du système correspondant (dimensions, poses, toiles, équipements)" },
    mediaWithheld: "photos enregistrées issues d'un autre système : dessin du modèle en attendant les visuels du système correspondant",
    dims: {
      width: { label: "Largeur", minMm: 1500, maxMm: 4000, sources: [at(S.suppPergolas, "p. 123 — largeur jusqu'à 4 000 mm"), at(S.brochurePergolas, "p. 7 — 1,5 à 4 m"), at(S.priceList, "p. 17 — dimensions minimales")], note: "Par module ; plusieurs modules s'assemblent pour une plus grande largeur." },
      depth: { label: "Avancée", minMm: 2000, maxMm: 7000, sources: [at(S.suppPergolas, "p. 123 — avancée jusqu'à 7 000 mm"), at(S.brochurePergolas, "p. 7"), at(S.priceList, "p. 17 — projection minimale 2 000 mm")], note: "La grille de prix commence à 3 m d'avancée : en dessous, prix sur devis." },
      height: { label: "Hauteur libre", minMm: null, maxMm: 3000, confirmAboveMm: 2500, confirmNote: "au-delà de 2,50 m (jusqu'à 3,00 m) : hauteur hors norme avec supplément et exclusions partielles de garantie", sources: [at(S.suppPergolas, "p. 123 — hauteur libre 2 500 mm"), at(S.brochurePergolas, "p. 7"), at(S.priceList, "p. 6 — Solid : 2 501–3 000 mm avec supplément")] },
    },
    mountings: [
      { code: "freestanding", label: "Autoportante (quatre poteaux)", status: "established", sources: [at(S.suppPergolas, "p. 124–125"), at(S.brochurePergolas, "p. 7"), at(S.priceList, "p. 17 — autoportante")] },
      { code: "wall", label: "Adossée (fixations murales et deux poteaux avant)", status: "established", sources: [at(S.suppPergolas, "p. 126–127, 136–137"), at(S.brochurePergolas, "p. 7"), at(S.priceList, "p. 17 — murale")], note: "chevilles et tôle de fixation murale non fournies ; support mural établi à l'étude" },
    ],
    finishes: [...SB450_RAL.map((c) => ({ ...finishOf(`${c} mat`, [at(S.priceList, "p. 7 — teintes des pergolas, incluses")]), tier: "standard" as const })),
      ...["FSM 71319 mat", "VSR 240 satin", "VSR 780 mat", "DB 703 mat", "RAL 7038 mat", "RAL 7048 mat", "RAL 7016 STR", "RAL 7021 STR", "RAL 9005 STR", "RAL 9010 STR", "RAL 8003 STR"].map((c) => ({ ...finishOf(c, [at(S.priceList, "p. 7 — teintes des pergolas, incluses")]), tier: "standard" as const }))],
    palette: { edition: "nuancier du fabricant, liste de prix 09.2026 (teintes des pergolas)", component: "structure", sources: [at(S.priceList, "p. 7")] },
    customFinish: { code: "RAL_CUSTOM", label: "Autre teinte RAL (hors nuancier)", status: "to_confirm", tier: "special", sources: [at(S.priceList, "p. 6 — RAL hors palette : supplément")], note: "teinte avec supplément : délai confirmé au devis" },
    fabrics: [
      { code: "solid_white", label: "Toile PVC blanche (602N opaque)", status: "established", swatch: "#f1f0ea", sources: [at(S.priceList, "p. 17 — toiles disponibles")] },
      { code: "solid_beige", label: "Toile PVC beige (602N opaque)", status: "established", swatch: "#d9ccb4", sources: [at(S.priceList, "p. 17")] },
      { code: "solid_alu_grey", label: "Toile PVC gris aluminium (702N opaque)", status: "established", swatch: "#9ea2a3", sources: [at(S.priceList, "p. 17")] },
    ],
    controls: [
      { code: "radio_included", label: "Commande radio — télécommande 5 canaux incluse", kind: "electric", status: "established", sources: [at(S.priceList, "p. 17 — moteur, commande radio et télécommande 5 canaux inclus"), at(S.suppPergolas, "p. 123 — moteur")], description: "Moteur, récepteur radio et télécommande 5 canaux compris dans le prix." },
    ],
    included: [
      { label: "Structure aluminium, toiture en toile PVC plissée sur chariots mobiles", sources: [at(S.suppPergolas, "p. 123, 130"), at(S.priceList, "p. 17")] },
      { label: "Mécanisme d'entraînement et moteur", sources: [at(S.priceList, "p. 17"), at(S.suppPergolas, "p. 123")] },
      { label: "Commande radio et télécommande 5 canaux", sources: [at(S.priceList, "p. 17")] },
      { label: "Gouttière et évacuation de l'eau par les poteaux avant", sources: [at(S.suppPergolas, "p. 123, 130–131")] },
    ],
    options: [
      { code: "led_alt", label: "Éclairage LED sur une barre mobile sur deux", description: "Plinthe LED, alimentation et commande radio à variation comprises ; prix selon les dimensions.", group: "lighting", status: "established", pricing: "validated", visual: "led_perimeter", excludes: ["led_all"], sources: [at(S.priceList, "p. 19 — éclairage SOLID")] },
      { code: "led_all", label: "Éclairage LED sur chaque barre mobile", description: "Plinthe LED, alimentation et commande radio à variation comprises ; prix selon les dimensions.", group: "lighting", status: "established", pricing: "validated", visual: "led_perimeter", excludes: ["led_alt"], sources: [at(S.priceList, "p. 19 — éclairage SOLID")] },
      { code: "intermediate_post", label: "Poteau supplémentaire", description: "Prix par poteau selon la hauteur.", group: "structure", status: "established", pricing: "validated", maxQty: 4, sources: [at(S.priceList, "p. 17 — poteau supplémentaire")], note: "position établie à l'étude du projet ; au-delà de 4 poteaux, étude au devis" },
      { code: "weather_automation", label: "Automatisme selon la météo (capteurs)", description: "Proposé par le fabricant ; capteurs et fonctionnement précisés au devis.", group: "control", status: "to_confirm", wish: true, pricing: "quote", visual: "wind_sensor", sources: [at(S.suppPergolas, "p. 123 — option d'automatisation en fonction des conditions météorologiques")], note: "modèle de capteur non documenté" },
    ],
    closureWishes: [
      { familySlug: "sliding_glass", label: OPENSLIDE_WISH_LABEL, status: "to_confirm", note: "fermeture vitrée citée pour ce modèle par le fabricant : dimensions, vitrage et fixations étudiés au devis." },
      { familySlug: "sliding_panels", label: SLIDE_WISH_LABEL, status: "to_confirm", note: "modules coulissants cités pour ce modèle : modèle et fixations étudiés au devis." },
      { familySlug: "helioscreen", label: "Screen latéral HelioScreen", status: "to_confirm", note: "stores screen cités comme fermetures possibles : intégration étudiée au devis." },
    ],
    modules: { maxSingleWidthMm: 4000, multiModule: "documented", sources: [at(S.suppPergolas, "p. 125, 127, 131 — extension modulaire"), at(S.priceList, "p. 17 — premier module / module suivant")] },
    structure3d: { postMm: [85, 150], beamMm: [85, 165] },
    notices: ["HelioLux protège de la pluie et du vent, mais pas des chutes de neige.", "Pente de toiture de 5° à 10°, réglée à l'installation selon l'avancée."],
    wind: { action: "not_documented", text: "Classe de résistance au vent non documentée pour ce modèle : confirmée au devis.", status: "to_confirm", sources: [at(S.suppPergolas, "p. 123 — protège de la pluie et du vent")] },
  },
  specs: [
    { key: "width_max", label: "Largeur maximale d'un module", valueNum: 4000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Supplément PERGOLAS p. 123" },
    { key: "projection_max", label: "Avancée maximale", valueNum: 7000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Supplément PERGOLAS p. 123" },
    { key: "clear_height", label: "Hauteur libre standard", valueNum: 2500, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Supplément PERGOLAS p. 123" },
    { key: "tilt", label: "Pente de la toiture", valueText: "5° à 10°", source: "SUPPLIER_DOCUMENT", sourceRef: "Supplément PERGOLAS p. 123 ; brochure p. 7" },
    { key: "rain", label: "Pluie", valueText: "protège de la pluie", source: "SUPPLIER_DOCUMENT", sourceRef: "Supplément PERGOLAS p. 123" },
    { key: "snow", label: "Neige", valueText: "ne protège pas des chutes de neige", source: "SUPPLIER_DOCUMENT", sourceRef: "Supplément PERGOLAS p. 123" },
  ],
  faq: [
    { q: "HelioLux protège-t-elle de la pluie ?", a: "Oui : la toile est étanche et l'eau est évacuée par la gouttière et les poteaux avant. Elle ne protège pas des chutes de neige." },
    { q: "Peut-on la poser sans mur ?", a: "Oui : HelioLux existe en version autoportante et en version adossée au mur." },
    { q: "Peut-on fermer les côtés ?", a: "Des fermetures latérales sont prévues par le fabricant pour ce modèle ; elles sont étudiées au devis." },
    { q: "Le prix est-il affiché en ligne ?", a: "Oui, pour les dimensions de la grille de prix (de 3 à 7 m d'avancée) : le configurateur affiche le prix HT et TTC. Un élément sans prix établi, la livraison et la pose sont chiffrés sur devis." },
  ],
  openQuestions: [
    { field: "Vent et neige", question: "Classe de résistance au vent et charge de neige de SOLID (aucune déclaration de performances dans la documentation).", sources: ["supp-pergolas p. 123"], blocks: "communication sur le vent" },
    { field: "Prix", question: "Prix des avancées de 2 000 à 2 999 mm (la grille commence à 3 000 mm).", sources: ["liste de prix p. 17"], blocks: "prix en ligne sous 3 m d'avancée (devis)" },
    { field: "Teintes", question: "Décors bois pour SOLID (supplément documenté pour SB 400 / SB 450 / SB 550 seulement).", sources: ["liste de prix p. 6–7"], blocks: "décor bois (non proposé)" },
    { field: "Capteurs", question: "Modèle et prix des capteurs météo compatibles avec la commande fournie.", sources: ["supp-pergolas p. 123"], blocks: "automatisme (devis)" },
    { field: "Modules", question: "Nombre maximal de modules et surface maximale.", sources: [], blocks: "grandes largeurs (devis)" },
  ],
};

export const PERGOLAS_2026: HelioFamily[] = [malaga, marbella, sevilla];
