/**
 * HelioRoof — screen de toiture. Correspondance confirmée par le client le 2026-11-03 : VERANDA V ZiiiP. Données reprises
 * du Supplément technique SCREENS (p. 230–238), de la documentation DT-E 5.7 « Veranda V ZiiiP – Pergola V ZiiiP » (seuls
 * les éléments marqués « version véranda » ou communs aux deux produits) et de la liste de prix 09.2026 (p. 65, 67, 90
 * de l'index). Aucune donnée de la « Veranda » standard ni de VERANDA FTS n'est conservée.
 */
import type { SourceRef } from "@/domain/system";
import type { HelioFamily } from "../heliostores-data";
import { src } from "./shared";
import { SELT_FINISHES, VZIIIP_STANDARD } from "./palette";

export const ROOF_SOURCES = {
  page: src("aluprof-veranda-v-ziiip", "Page fabricant « VERANDA V ZiiiP »", "https://aluprof.com/en/product/veranda-v-ziiip"),
  dte: src("dte-veranda-v-ziiip-en", "Documentation technique DT-E 5.7 « Veranda V ZiiiP – Pergola V ZiiiP » (éd. 3, mars 2021, EN)"),
  dop: src("dop-99-mw-2021", "Déclaration des performances 99/MW/2021 « store banne de véranda (V ZiiiP) »"),
  supp: src("supp-screens", "Supplément technique SCREENS (FR, état 2026-08-03)"),
  priceList: src("liste-prix-2026-09", "Liste des prix des produits finis (09.2026)"),
} as const satisfies Record<string, SourceRef>;

const S = ROOF_SOURCES;
const at = (s: SourceRef, loc: string): SourceRef => ({ ...s, loc });

const helioroof: HelioFamily = {
  slug: "helioroof-screen",
  name: "HelioRoof",
  category: "SCREENS",
  kind: "ROOF_BLIND_SYSTEM",
  status: "QUOTE_ONLY",
  sortOrder: 32,
  brand: "Aluprof",
  manufacturer: "ALUPROF SA",
  supplierRef: "VERANDA V ZiiiP (correspondance confirmée par le client le 2026-11-03)",
  shortDescription: "Screen de toiture motorisé à guidage zip pour véranda et verrière, jusqu'à 5 × 6 m par module.",
  description:
    "HelioRoof est un store de toiture à toile screen guidée par fermeture zip dans ses coulisses, tendue par un système pneumatique. Il se pose au-dessus d'une véranda, d'une verrière ou d'une toiture vitrée inclinée de 0° à 45°. Un module mesure jusqu'à 5 m de largeur et 6 m d'avancée ; plusieurs modules s'assemblent. Le moteur est compris, en commande radio io ou en commande filaire.",
  seoTitle: "Screen de toiture HelioRoof pour véranda",
  seoDescription: "Store de toiture HelioRoof à guidage zip, moteur compris, jusqu'à 5 × 6 m par module. Configurez vos cotes et obtenez votre prix.",
  rules: {
    type: "roof_blind",
    revision: { date: "2026-11-03", note: "caractéristiques remplacées par celles du système correspondant (dimensions, pose, toiles, moteur)" },
    mediaWithheld: "photos enregistrées issues d'un autre système : dessin du modèle en attendant les visuels du système correspondant",
    dims: {
      width: { label: "Largeur", minMm: 2000, maxMm: 5000, sources: [at(S.supp, "p. 230–231 — largeur 2 000 à 5 000 mm"), at(S.priceList, "p. 90 — grille 2 000 à 5 000")] },
      depth: { label: "Avancée", minMm: 2000, maxMm: 6000, sources: [at(S.supp, "p. 230–231 — avancée 2 000 à 6 000 mm"), at(S.priceList, "p. 90 — grille 2 000 à 6 000")] },
    },
    mountings: [
      { code: "roof", label: "Sur la toiture (supports de coulisses sur une sous-structure)", status: "established", sources: [at(S.supp, "p. 235–236 — supports de coulisses et de coffre"), at(S.dte, "p. 14–15")], note: "type de support (A, B, D) établi à l'étude ; chevilles non fournies" },
    ],
    finishes: SELT_FINISHES([at(S.priceList, "p. 67 et 69 — teintes"), at(S.supp, "p. 230 — couleur du cadre")]).map((f) => (VZIIIP_STANDARD.has(f.label) ? { ...f, tier: "standard" as const } : { ...f, tier: "special" as const, status: "to_confirm" as const, note: "teinte avec supplément ; la liste de prix indique aussi « laquage en autres couleurs non disponible » : disponibilité confirmée au devis" })),
    palette: { edition: "nuancier du fabricant, liste de prix 09.2026 et supplément technique Screens", component: "structure et coffre", sources: [at(S.priceList, "p. 67, 69, 90"), at(S.supp, "p. 230")], note: "cinq teintes standard incluses ; autres teintes avec supplément, disponibilité à confirmer" },
    customFinish: { code: "RAL_CUSTOM", label: "Autre teinte RAL (option)", status: "to_confirm", tier: "special", sources: [at(S.priceList, "p. 67, 90 — supplément de 15 % du prix du système")], note: "teinte avec supplément ; disponibilité et délai confirmés au devis" },
    fabrics: [
      { code: "serge_1", label: "Toile screen Serge 1 % (Serge 100)", status: "established", swatch: "#8a8c8b", sources: [at(S.priceList, "p. 90 — toiles disponibles"), at(S.supp, "p. 230"), at(S.dte, "p. 9")], description: "Toile microperforée très occultante (facteur d'ouverture 1 %)." },
      { code: "serge_600", label: "Toile screen Serge 600", status: "established", swatch: "#6f716f", sources: [at(S.priceList, "p. 90"), at(S.supp, "p. 230"), at(S.dte, "p. 9")], description: "Toile microperforée qui conserve la vue vers l'extérieur." },
    ],
    controls: [
      { code: "radio_io", label: "Commande radio io (télécommande, capteurs io)", kind: "electric", status: "established", sources: [at(S.priceList, "p. 90 — moteur radio io compris")], description: "Moteur radio io compris dans le prix ; la télécommande et les capteurs sont en supplément." },
      { code: "wired", label: "Commande filaire (interrupteur)", kind: "electric", status: "established", sources: [at(S.priceList, "p. 90 — moteur filaire compris")], description: "Moteur filaire compris dans le prix ; l'interrupteur et le raccordement électrique sont établis au devis." },
    ],
    included: [
      { label: "Coffre, coulisses à guidage zip et toile screen", sources: [at(S.supp, "p. 230–231")] },
      { label: "Tension pneumatique de la toile", sources: [at(S.supp, "p. 230"), at(S.dte, "p. 9–10")] },
      { label: "Moteur 40 Nm (radio io ou filaire, au choix)", sources: [at(S.priceList, "p. 90"), at(S.dte, "p. 9")] },
      { label: "Supports de coulisses et supports de coffre", sources: [at(S.priceList, "p. 90")] },
      { label: "Une ou deux poutres de stabilisation selon les dimensions", sources: [at(S.supp, "p. 231")] },
    ],
    options: [
      { code: "remote_io", label: "Télécommande radio io", description: "Choisissez le nombre de canaux ; sans télécommande choisie, elle reste à chiffrer.", group: "control", status: "established", pricing: "validated", requiresControls: ["radio_io"], prerequisite: "nécessite la commande radio io", visual: "remote", values: [{ code: "io_1", label: "1 canal" }, { code: "io_5", label: "5 canaux" }], sources: [at(S.priceList, "p. 90 — télécommandes io ; p. 115 — commandes io")] },
      { code: "sensor_io", label: "Capteur météo io", description: "Relève la toile par vent fort (capteur de vent) ou la pilote aussi selon l'ensoleillement (capteur vent et soleil) ; recommandé par le fabricant.", group: "control", status: "established", pricing: "validated", requiresControls: ["radio_io"], prerequisite: "nécessite la commande radio io", visual: "wind_sensor", values: [{ code: "io_wind", label: "vent" }, { code: "io_wind_sun", label: "vent et soleil" }], sources: [at(S.priceList, "p. 90 — « capteurs io » ; p. 116 — capteurs"), at(S.dte, "p. 32 — automatisme de vent recommandé")] },
      { code: "connect_box", label: "Box domotique — commande par smartphone", description: "Box internet qui pilote depuis une application les moteurs radio io.", group: "control", status: "established", pricing: "validated", requiresControls: ["radio_io"], prerequisite: "nécessite la commande radio io", visual: "box", sources: [at(S.priceList, "p. 116 — box (appareils io et RTS)")] },
      { code: "modules", label: "Installation en plusieurs modules", group: "structure", status: "to_confirm", pricing: "quote", sources: [at(S.supp, "p. 230, 237–238 — supports modulaires"), at(S.priceList, "p. 90")], note: "nombre de modules et supports établis au devis" },
    ],
    structure3d: { cassetteMm: [228, 203], tiltDeg: [0, 45] },
    notices: [
      "HelioRoof ne protège pas de la pluie : la toile se relève par pluie, neige ou gel.",
      "Pose sur toiture uniquement (inclinaison de 0° à 45°) : ni pose verticale, ni pose suspendue.",
      "Chevilles et vis de fixation non fournies : elles dépendent du support et sont prévues à l'étude du projet.",
    ],
    wind: { action: "retract", text: "Classe de résistance au vent 3 (déclaration de performances) ; le fabricant recommande un automatisme de vent qui relève la toile par vent fort.", status: "established", sources: [at(S.dop, "classe 3"), at(S.dte, "p. 32, 39")] },
  },
  specs: [
    { key: "width_max", label: "Largeur maximale d'un module", valueNum: 5000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Supplément SCREENS p. 230–231" },
    { key: "projection_max", label: "Avancée maximale", valueNum: 6000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Supplément SCREENS p. 230–231" },
    { key: "tilt", label: "Inclinaison", valueText: "0° à 45°", source: "SUPPLIER_DOCUMENT", sourceRef: "Supplément SCREENS p. 230 ; DT-E 5.7 p. 39" },
    { key: "drive", label: "Moteur", valueText: "électrique 40 Nm, compris (radio io ou filaire)", source: "SUPPLIER_DOCUMENT", sourceRef: "Liste de prix p. 90 ; DT-E 5.7 p. 9" },
    { key: "wind_class_dop", label: "Résistance au vent (EN 13561)", valueText: "classe 3", source: "SUPPLIER_DOCUMENT", sourceRef: "DoP 99/MW/2021" },
  ],
  faq: [
    { q: "Pour quelles toitures ?", a: "Vérandas, verrières et toitures vitrées horizontales ou inclinées jusqu'à 45°. Le store se pose au-dessus de la toiture, sur une sous-structure ; ni pose verticale ni pose suspendue." },
    { q: "Quelle taille maximale ?", a: "5 m de largeur et 6 m d'avancée pour un module ; plusieurs modules peuvent s'assembler." },
    { q: "Le moteur est-il compris ?", a: "Oui : moteur en commande radio io ou en commande filaire, au choix. Télécommande, capteurs et box domotique sont en supplément." },
    { q: "Le prix est-il affiché en ligne ?", a: "Oui, pour les dimensions de la grille de prix : le configurateur affiche le prix HT et TTC. Un élément sans prix établi, la livraison et la pose sont chiffrés sur devis." },
  ],
  openQuestions: [
    { field: "Teintes", question: "La liste de prix (p. 90 de l'index) indique à la fois « laquage en autres couleurs non disponible » et « supplément de 15 % » : quelle règle s'applique ?", sources: ["liste de prix p. 90, 65"], blocks: "teintes hors standard (à confirmer)" },
    { field: "Commande", question: "Télécommandes, capteurs et box compatibles avec chaque moteur (io / filaire) et leur prix pour ce modèle.", sources: ["liste de prix p. 90, 115–116"], blocks: "options de commande (devis)" },
    { field: "Vent", question: "Pression de la classe 3 : 132 Pa (déclaration de performances) ou 110 Pa / 49 km/h (documentation technique) ; seuil du capteur.", sources: ["dop-99-mw-2021", "dte-veranda-v-ziiip-en p. 39"], blocks: "communication sur le vent" },
    { field: "Supports", question: "Prix d'un support supplémentaire (types A à G) pour ce modèle.", sources: ["supp-screens p. 235–238"], blocks: "supports supplémentaires (devis)" },
  ],
};

export const SCREENS_2026: HelioFamily[] = [helioroof];
