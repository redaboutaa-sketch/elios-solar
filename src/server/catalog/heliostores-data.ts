/**
 * Catalogue HELIOSTORES — données PUBLIABLES uniquement (aucun tarif, aucun coefficient).
 *
 * Périmètre fixé par le client : trois familles (Pergolas, Screens, Stores bannes) ; fournisseur de référence
 * ALUPROF ; catalogue complémentaire THYSENS (collection SELT). Chaque règle et caractéristique cite sa source ;
 * une contradiction entre sources est conservée (deux valeurs) et ne bloque que le champ concerné.
 * Les tarifs transmis (fiches « AVEC_PRIX », classeur) sont importés à part, en privé (src/server/supplier-prices).
 *
 * Registre des sources et matrice détaillée : docs/heliostores/sources.md.
 *
 * Nomenclature (décision client du 2026-10-22, src/domain/nomenclature.ts) : `name`, descriptions, FAQ et libellés
 * des règles sont PUBLICS et n'emploient que les noms commerciaux HELIOSTORES. Les références du fournisseur
 * restent dans `supplierRef` (famille, moteur, équipement), `manufacturer`, `brand`, les sources et les
 * `sourceRef` des caractéristiques : données internes, retirées de tout ce qui part vers le navigateur.
 */
import type { SourceRef, SystemRules } from "@/domain/system";
import type { CategoryKey } from "@/domain/categories";

/* ------------------------------------------------------------------ */
/* Registre des sources                                                */
/* ------------------------------------------------------------------ */

export const SOURCES = {
  ficheSB400: { id: "fiche-sb400", label: "Fiche technique PERGOLA SB400 (transmise par le client)" },
  ficheSB500: { id: "fiche-sb500", label: "Fiche technique PERGOLA SB500 (transmise par le client)" },
  ficheRefleksol: { id: "fiche-refleksol-120-ziiip", label: "Fiche technique REFLEKSOL 120 ZIIP (transmise par le client)" },
  ficheCasablanca: { id: "fiche-casablanca", label: "Fiche technique STORE BANNE CASABLANCA (transmise par le client)" },
  ficheFts: { id: "fiche-veranda-fts", label: "Fiche technique VERANDA FTS (transmise par le client)" },
  catalogueSB400: { id: "catalogue-sb400", label: "Catalogue PERGOLA SB400 (extrait, 2 p.)" },
  thysens: { id: "catalogue-thysens", label: "Catalogue THYSENS (collection SELT, 161 p.)" },
  aluprofSB400: { id: "aluprof-sb-400", label: "Page fabricant ALUPROF « SB 400 »", url: "https://aluprof.com/en/product/sb-400" },
  aluprofRefleksol: { id: "aluprof-r120-ziiip", label: "Page fabricant ALUPROF « R 120 ZiiiP »", url: "https://aluprof.com/en/product/refleksol-120-ziiip" },
  aluprofCasablanca: { id: "aluprof-casablanca", label: "Page fabricant ALUPROF « CASABLANCA AWNING »", url: "https://aluprof.com/en/product/casablanca-awning" },
  aluprofVeranda: { id: "aluprof-veranda", label: "Page fabricant ALUPROF « Veranda »", url: "https://aluprof.com/en/product/veranda" },
  aluprofSelt: { id: "aluprof-selt", label: "ALUPROF — « Aluprof and Selt join forces » (2025-12-09)", url: "https://aluprof.com/en/company/news/aluprof-and-selt-join-forces" },
  dopSB400: { id: "dop-pd-sb400-25", label: "Déclaration des performances PD/SB400/25 (ALUPROF, 2025-12-05)" },
  dopStructSB400: { id: "dop-p-sb400-25", label: "Déclaration des performances P/SB400/25 — structure (ALUPROF)" },
  dopRefleksol: { id: "dop-52-rz-2024", label: "Déclaration des performances 52/RZ/2024 (SELT) et 30/RZ/2023" },
  dopCasablanca: { id: "dop-08-m-2018", label: "Déclaration des performances 08/M/2018 (SELT)" },
  dteSB400Pro: { id: "dte-sb400pro", label: "Documentation technique et d'utilisation Pergola SB400PRO (ALUPROF, FR)" },
  suppPergolas: { id: "supp-pergolas", label: "Supplément technique PERGOLAS (ALUPROF, FR)" },
  dteLedPergola: { id: "dte-led-pergola", label: "Documentation technique LED de la pergola (ALUPROF, FR)" },
  dteRefleksol: { id: "dte-refleksol", label: "Documentation technique et d'utilisation REFLEKSOL (ALUPROF, FR)" },
  noticeScreens: { id: "iuik-srs-skyroll", label: "Notice d'installation et d'utilisation des screens (ALUPROF, FR)" },
  dteCasablanca: { id: "dte-casablanca", label: "Documentation technique et d'utilisation CASABLANCA, DT-E 11.8 (ALUPROF, éd. 5, juin 2019)" },
  noticeAwnings: { id: "iuik-awnings", label: "Notice d'utilisation des stores de terrasse et de balcon (ALUPROF, FR)" },
  suppStores: { id: "supp-stores", label: "Supplément technique STORES (ALUPROF, FR)" },
  brochureAwnings: { id: "brochure-stores-bannes", label: "Brochure ALUPROF « Stores bannes » (FR)" },
  aluprofCasaAutomation: { id: "aluprof-casablanca-automatisation", label: "Page fabricant ALUPROF « Casablanca » — onglet Automatisation (liste d'accessoires, sans compatibilité par moteur)", url: "https://aluprof.com/fr/produit/casablanca" },
} as const satisfies Record<string, SourceRef>;

const at = (s: SourceRef, loc: string): SourceRef => ({ ...s, loc });
const T = (loc: string) => at(SOURCES.thysens, loc);

/** Données de spécification sourcées (une ligne par source et par valeur). */
export interface SpecSeed {
  key: string;
  label: string;
  valueNum?: number;
  unit?: string;
  valueText?: string;
  source: "CLIENT_SHEET" | "SUPPLIER_DOCUMENT" | "MANUFACTURER_WEBSITE";
  sourceRef: string;
  note?: string;
}

export interface OpenQuestion {
  field: string;
  question: string;
  sources: string[];
  blocks: string;
}

export interface HelioFamily {
  slug: string;
  name: string;
  category: CategoryKey | null;
  kind: "PERGOLA_SYSTEM" | "SCREEN_SYSTEM" | "AWNING_SYSTEM" | "ROOF_BLIND_SYSTEM";
  status: "PUBLISHED" | "QUOTE_ONLY" | "DRAFT";
  sortOrder: number;
  brand: string | null;
  manufacturer: string | null;
  supplierRef: string;
  shortDescription: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  rules: SystemRules;
  specs: SpecSeed[];
  faq: Array<{ q: string; a: string }>;
  openQuestions: OpenQuestion[];
}

/* ------------------------------------------------------------------ */
/* Teintes (codes des sources ; aperçus écran indicatifs)              */
/* ------------------------------------------------------------------ */

const SWATCH: Record<string, string> = {
  "RAL 9016": "#f1f0ea",
  "RAL 7016": "#383e42",
  "FSM 71319": "#4a4c4e",
  "RAL 9010": "#f1ece1",
  "RAL 1015": "#e6d2b5",
  "RAL 8014": "#4a3526",
  "RAL 9006": "#a5a8a6",
  "RAL 9001": "#e9e0d2",
  "RAL 7015": "#4f5358",
  "RAL 7021": "#2f3234",
  "RAL 7012": "#4e5754",
  "RAL 7039": "#6b665e",
  "RAL 7043": "#4e5452",
  "RAL 8003": "#7e4b26",
  "RAL 1013": "#e3d9c6",
  "RAL 7035": "#cbd0cc",
  "RAL 7037": "#7a7b7a",
  "RAL 7024": "#45494e",
  "RAL 9005": "#0e0e10",
  "RAL 9007": "#8f8f8c",
  "RAL 8016": "#4c2f26",
  "RAL 7001": "#8a9597",
  "RAL 7022": "#4b4d46",
  "DB 703": "#4a4b4c",
};

const code = (label: string) => label.replace(/\s+/g, "_").toUpperCase();
function finish(label: string, sources: SourceRef[], note?: string) {
  return { code: code(label), label, status: "established" as const, sources, swatch: SWATCH[label.replace(/ (MAT|SATIN|mat)$/i, "")], note };
}

const SB_STANDARD_COLOURS = (src: SourceRef[]) => [finish("RAL 7016 mat", src), finish("RAL 9016 mat", src), finish("FSM 71319", src)];

/* Palette SELT des éléments laqués (catalogue THYSENS p. 150) */
const SELT_PALETTE = ["RAL 9016", "RAL 7016", "RAL 9006", "RAL 9007", "FSM 71319", "RAL 9010", "RAL 9001", "RAL 1013", "RAL 1015", "RAL 7015", "RAL 7021", "RAL 7012", "RAL 7039", "RAL 7043", "RAL 7035", "RAL 7037", "RAL 7024", "RAL 7001", "RAL 7022", "RAL 9005", "RAL 8003", "RAL 8014", "RAL 8016", "DB 703", "VSR 240", "VSR 780"];

/* ------------------------------------------------------------------ */
/* HELIO Horizon — réf. fournisseur SB 400 (SunBreaker 400)            */
/* ------------------------------------------------------------------ */

const sb400Sheet = SOURCES.ficheSB400;
const sb400: HelioFamily = {
  slug: "helio-horizon",
  name: "HELIO Horizon",
  category: "PERGOLAS",
  kind: "PERGOLA_SYSTEM",
  status: "QUOTE_ONLY",
  sortOrder: 10,
  brand: "SELT by Aluprof",
  manufacturer: "ALUPROF SA (usine d'Opole, ex-SELT)",
  supplierRef: "SB 400 (SunBreaker 400)",
  shortDescription: "Pergola à lames orientables motorisées, murale ou autoportante, jusqu'à 4 × 7 m par module.",
  description:
    "HELIO Horizon est une pergola en aluminium extrudé avec éléments en acier, à toiture de lames orientables motorisées. L'évacuation des eaux est intégrée à la structure. Un module mesure de 1,4 m à 4 m de largeur et de 1,4 m à 7 m de projection, en version murale ou autoportante. Éclairage HELIO Lumière en option (bandeau périphérique ou spots dans les lames), automatisme météo possible.",
  seoTitle: "Pergola HELIO Horizon à lames orientables — prix selon vos dimensions",
  seoDescription: "Pergola bioclimatique HELIO Horizon : lames orientables motorisées, murale ou autoportante, jusqu'à 4 × 7 m. Configurez vos cotes et demandez un devis.",
  rules: {
    type: "pergola",
    dims: {
      width: { label: "Largeur", minMm: 1400, maxMm: 4000, sources: [at(sb400Sheet, "Spécifications"), at(SOURCES.catalogueSB400, "p. 2"), T("p. 11")], note: "Pas de largeur non documenté : cote au centimètre, confirmée au relevé." },
      depth: { label: "Projection", minMm: 1400, maxMm: 7000, stepMm: 200, sources: [at(sb400Sheet, "Spécifications : « disponible tous les 20 cm »"), at(SOURCES.aluprofSB400, "« module projection is a multiple of the blade interval (20 cm) »"), at(SOURCES.catalogueSB400, "p. 2"), T("p. 11")] },
      height: { label: "Hauteur de passage", minMm: null, maxMm: 3020, confirmAboveMm: 2800, confirmNote: "les documents techniques indiquent 2,8 m ou 3,02 m selon le document", sources: [at(SOURCES.aluprofSB400, "Maximum height 2.8 m"), at(SOURCES.catalogueSB400, "p. 1, schéma « max 2.8 m »"), T("p. 10"), at(SOURCES.dopStructSB400, "max. dimensions 7000x4000x3020 mm")], note: "Hauteur minimale non documentée." },
    },
    mountings: [
      { code: "wall", label: "Murale", status: "established", sources: [at(sb400Sheet, "titre"), T("p. 11")] },
      { code: "freestanding", label: "Autoportante", status: "established", sources: [at(sb400Sheet, "titre"), T("p. 11")] },
    ],
    finishes: SB_STANDARD_COLOURS([T("p. 10 — couleurs standard"), at(SOURCES.catalogueSB400, "p. 1")]),
    customFinish: { code: "RAL_CUSTOM", label: "Autre teinte RAL ou finition bois (option)", status: "to_confirm", sources: [T("p. 11 — « painted in any RAL colour (optional) »"), at(SOURCES.aluprofSB400, "32 teintes RAL et finitions bois « option at extra cost »")], note: "teinte hors standard : conditions et délai confirmés au devis" },
    included: [
      { label: "Toiture à lames orientables (rotation 120° ± 2°)", sources: [at(sb400Sheet, "Structure incluse"), at(SOURCES.aluprofSB400, "« angle of rotation is 120°±2° »"), T("p. 11")] },
      { label: "Motorisation électrique 24 V", supplierRef: "Moteur 24 V", sources: [at(sb400Sheet, "Structure incluse")] },
      { label: "Supports muraux", sources: [at(sb400Sheet, "Structure incluse")] },
      { label: "HELIO Pilot — télécommande radio 1 ou 6 canaux", description: "Ouvre, ferme et oriente les lames à distance.", supplierRef: "Commande radio BleBox 1 ou 6 canaux", sources: [at(sb400Sheet, "Structure incluse")] },
      { label: "Évacuation des eaux intégrée à la structure", sources: [T("p. 11")] },
      { label: "Joints noirs (seule teinte de joint proposée)", sources: [at(sb400Sheet, "Spécifications")] },
      { label: "Première révision du moteur", sources: [at(sb400Sheet, "Spécifications")] },
    ],
    options: [
      { code: "led_perimeter", label: "HELIO Lumière — bandeau LED périphérique (COB 3200 K)", description: "Éclairage blanc chaud intégré au pourtour de la structure.", supplierRef: "Éclairage LED périphérique COB 3200 K", group: "lighting", status: "established", sources: [at(sb400Sheet, "Options"), T("p. 11")], cumulToConfirmWith: ["led_spots"] },
      {
        code: "led_spots",
        label: "HELIO Lumière — spots LED dans les lames",
        description: "Points lumineux encastrés dans les lames ; leur nombre dépend des dimensions.",
        supplierRef: "Spots LED dans les lames",
        group: "lighting",
        status: "established",
        note: "spots non modifiables individuellement",
        sources: [at(sb400Sheet, "Tarification des spots — nombre de points"), T("p. 11")],
        spotTable: [
          { depthMinMm: 1400, depthMaxMm: 3590, widthMinMm: 1400, widthMaxMm: 2740, points: 4 },
          { depthMinMm: 1400, depthMaxMm: 3590, widthMinMm: 2750, widthMaxMm: 4000, points: 6 },
          { depthMinMm: 3600, depthMaxMm: 5390, widthMinMm: 1400, widthMaxMm: 2740, points: 6 },
          { depthMinMm: 3600, depthMaxMm: 5390, widthMinMm: 2750, widthMaxMm: 4000, points: 9 },
          { depthMinMm: 5400, depthMaxMm: 7000, widthMinMm: 1400, widthMaxMm: 2740, points: 8 },
          { depthMinMm: 5400, depthMaxMm: 7000, widthMinMm: 2750, widthMaxMm: 4000, points: 12 },
        ],
      },
      { code: "intermediate_post", label: "Poteau intermédiaire", group: "structure", status: "to_confirm", sources: [at(sb400Sheet, "« Poteaux intermédiaires non inclus (en option) »")], note: "option documentée ; nombre et position établis au devis" },
      { code: "overflow_4_gutters", label: "Trop-plein invisible entre gouttières (version 4 gouttières)", group: "structure", status: "to_confirm", sources: [T("p. 11")], note: "option du catalogue, non reprise dans la fiche — à confirmer" },
      { code: "weather_automation", label: "HELIO Vent / HELIO Soleil — capteurs de vent et d'ensoleillement", description: "Par vent fort, le capteur commande la position des lames (ouvertes si les côtés sont ouverts, fermées s'ils sont fermés) ; le capteur d'ensoleillement oriente les lames selon le soleil.", supplierRef: "Eolis io 230V ; Soliris io 230V ; Sunis Wirefree io", group: "control", status: "to_confirm", requiresControlKind: "electric", prerequisite: "documenté avec la commande radio io de la pergola ; non documenté avec la télécommande HELIO Pilot fournie", pricing: "quote", sources: [T("p. 11 — « possibility of using weather automation »"), at(SOURCES.dteSB400Pro, "p. 44, 47, 52")], note: "compatibilité avec la commande HELIO Pilot à confirmer" },
      { code: "rain_sensor", label: "Capteur de pluie", description: "Détecte la pluie pour la commande automatique de la toiture.", supplierRef: "Ondeis 24V", group: "control", status: "to_confirm", requiresControlKind: "electric", prerequisite: "documenté avec la commande radio io de la pergola ; non documenté avec la télécommande HELIO Pilot fournie", pricing: "quote", sources: [at(SOURCES.dteSB400Pro, "p. 47 — tableau « Commande et contrôle »")], note: "compatibilité avec la commande HELIO Pilot à confirmer" },
      { code: "connect_box", label: "HELIO Connect — box de pilotage par smartphone", description: "Box internet qui pilote depuis une application les équipements radio io compatibles. Elle ne rend pas connectée une commande non compatible.", supplierRef: "Somfy TaHoma Switch", group: "control", status: "to_confirm", requiresControlKind: "electric", prerequisite: "documenté avec la commande radio io de la pergola ; non documenté avec la télécommande HELIO Pilot fournie", pricing: "quote", sources: [at(SOURCES.dteSB400Pro, "p. 47 — « Commande via Internet »")], note: "compatibilité avec la commande HELIO Pilot à confirmer" },
    ],
    modules: { maxSingleWidthMm: 4000, multiModule: "documented", sources: [at(SOURCES.aluprofSB400, "« Modular system: Yes »")], note: "Système modulaire ; composition (modules, poteaux, gouttières) établie au devis." },
    closureWishes: [{ familySlug: "helio-ombra", label: "Screen HELIO Ombra", status: "to_confirm", note: "la documentation cite des screens en panneaux latéraux sans désigner de modèle — intégration d'un screen HELIO Ombra étudiée au devis selon les ouvertures réelles." }],
    structure3d: { postMm: [150, 85], beamMm: [212, 85], bladeMm: [216, 40] },
    notices: ["Fixations, fondations et raccordement électrique non inclus ; la tenue de l'ouvrage dépend du support et se vérifie au relevé."],
    wind: { action: "blades", text: "Par vent fort (plus de 45 km/h), le capteur de vent ouvre les lames si les côtés sont ouverts et les ferme si les côtés sont fermés ; la même documentation demande aussi des lames fermées par fortes rafales. Comportement à confirmer avec le fabricant ; documenté pour la version à commande radio io.", status: "to_confirm", sources: [at(SOURCES.dteSB400Pro, "p. 44, 45, 52")] },
  },
  specs: [
    { key: "width_max", label: "Largeur maximale d'un module", valueNum: 4000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 11 ; catalogue SB400 p. 2" },
    { key: "width_min", label: "Largeur minimale d'un module", valueNum: 1400, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 11" },
    { key: "width_min", label: "Largeur minimale d'un module", valueNum: 1400, unit: "mm", source: "CLIENT_SHEET", sourceRef: "Fiche SB400 — Spécifications" },
    { key: "projection_max", label: "Projection maximale d'un module", valueNum: 7000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 10–11" },
    { key: "projection_min", label: "Projection minimale", valueNum: 1400, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 11" },
    { key: "projection_min", label: "Projection minimale", valueNum: 1400, unit: "mm", source: "CLIENT_SHEET", sourceRef: "Fiche SB400 — Spécifications" },
    { key: "projection_step", label: "Pas de projection", valueNum: 200, unit: "mm", source: "CLIENT_SHEET", sourceRef: "Fiche SB400 — « disponible tous les 20 cm »" },
    { key: "height_max", label: "Hauteur maximale", valueNum: 2800, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue SB400 p. 1 (schéma) ; THYSENS p. 10" },
    { key: "post_section", label: "Section du poteau", valueText: "85 × 150 mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue SB400 p. 1 ; THYSENS p. 10" },
    { key: "beam_section", label: "Section de la poutre", valueText: "85 × 212 mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue SB400 p. 1 ; THYSENS p. 10" },
    { key: "blade_section", label: "Section de la lame", valueText: "216 × 40 mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue SB400 p. 1 ; THYSENS p. 10" },
    { key: "material", label: "Construction", valueText: "aluminium extrudé avec éléments en acier", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 11" },
    { key: "drainage", label: "Évacuation des eaux", valueText: "intégrée à la structure", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 11" },
    { key: "standards", label: "Normes de construction citées", valueText: "PN-EN 1090 et PN-EN 13659", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 11" },
    { key: "wind_class", label: "Résistance au vent (EN 13561)", valueText: "classe 3 ; classe 6 selon EN 13561:2015 (propriété complémentaire)", source: "SUPPLIER_DOCUMENT", sourceRef: "Déclaration des performances PD/SB400/25 (ALUPROF, 2025-12-05)" },
    { key: "structure_class", label: "Structure (EN 1090-1)", valueText: "classe d'exécution EXC2 (acier)", source: "SUPPLIER_DOCUMENT", sourceRef: "Déclaration des performances P/SB400/25" },
    { key: "height_max", label: "Hauteur maximale", valueNum: 2800, unit: "mm", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/sb-400 — Maximum height" },
    { key: "height_max", label: "Hauteur maximale", valueNum: 3020, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Déclaration des performances P/SB400/25 — « max. dimensions 7000x4000x3020 mm »", note: "Deux documents techniques diffèrent (2,8 m et 3,02 m) : au-delà de 2,8 m, la hauteur est confirmée au devis." },
    { key: "width_max", label: "Largeur maximale d'un module", valueNum: 4000, unit: "mm", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/sb-400 — Maximum width" },
    { key: "projection_max", label: "Projection maximale d'un module", valueNum: 7000, unit: "mm", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/sb-400 — Maximum projection" },
    { key: "projection_step", label: "Pas de projection", valueNum: 200, unit: "mm", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/sb-400 — « multiple of the blade interval (20 cm) »" },
    { key: "blade_rotation", label: "Rotation des lames", valueText: "120° ± 2°", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/sb-400" },
    { key: "modular", label: "Système modulaire", valueText: "oui", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/sb-400 — Modular system" },
    { key: "side_panels", label: "Fermetures latérales citées", valueText: "parois coulissantes, screens ou panneaux à lames", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/sb-400 — « Slide, Ziiip systems or Sunbreaker 210 »", note: "Modèles et fixations non précisés : étude au devis." },
    { key: "drive", label: "Motorisation", valueText: "moteur 24 V inclus", source: "CLIENT_SHEET", sourceRef: "Fiche SB400 — Structure incluse" },
    { key: "remote", label: "Commande", valueText: "télécommande radio HELIO Pilot 1 ou 6 canaux, incluse", source: "CLIENT_SHEET", sourceRef: "Fiche SB400 — Structure incluse (« commande radio BleBox 1 ou 6 canaux »)" },
    { key: "seals", label: "Joints", valueText: "noirs uniquement", source: "CLIENT_SHEET", sourceRef: "Fiche SB400 — Spécifications" },
    { key: "colours_standard", label: "Teintes standard", valueText: "RAL 9016 mat, FSM 71319, RAL 7016 mat", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 10 ; catalogue SB400 p. 1" },
  ],
  faq: [
    { q: "Le prix est-il affiché en ligne ?", a: "Oui : le configurateur affiche le prix hors taxes de la structure selon vos dimensions (grille tarifaire HELIOSTORES, pour les cotes de la grille ; une autre cote est chiffrée au devis). Les options, la pose et la livraison sont chiffrées sur votre devis." },
    { q: "Peut-on commander en ligne ?", a: "Oui pour la structure seule : aux dimensions couvertes par la grille, sans option ni choix à confirmer, la configuration s'ajoute au panier (TVA ajoutée au total). La livraison et la pose s'organisent ensuite avec un conseiller. Dans les autres cas, demandez un devis depuis le configurateur." },
    { q: "Quelles dimensions sont possibles ?", a: "Un module mesure de 1,4 m à 4 m de largeur et de 1,4 m à 7 m de projection, par pas de 20 cm en projection (l'entraxe des lames). La documentation indique un système modulaire : une installation de plusieurs modules est composée au devis." },
    { q: "Quelle hauteur de passage ?", a: "La documentation technique indique 2,8 m au maximum ; un autre document mentionne 3 020 mm. Au-delà de 2,8 m, la hauteur est confirmée au devis. La hauteur minimale n'est pas documentée." },
    { q: "Peut-on fermer les côtés ?", a: "La documentation cite des fermetures latérales (parois coulissantes, screens, panneaux à lames) sans préciser les modèles. Une fermeture latérale dépend des ouvertures réelles : nous l'étudions au devis." },
    { q: "Qu'est-ce qui est inclus ?", a: "Lames orientables, motorisation électrique 24 V, supports muraux, télécommande radio HELIO Pilot (1 ou 6 canaux), joints noirs et première révision du moteur. Les poteaux intermédiaires et l'éclairage HELIO Lumière sont en option." },
  ],
  openQuestions: [
    { field: "Tarifs", question: "Nature des colonnes « Prix fournisseur » et « Prix final HELIOSTORES » (achat, vente, prix public ?), devise (DH dans la fiche, absente du classeur), HT ou TTC, validité, transport et pose.", sources: ["fiche-sb400", "classeur tarifaire (privé)"], blocks: "affichage d'un prix" },
    { field: "Tarifs", question: "Écarts entre la fiche SB400 et le classeur sur plusieurs cellules (dont la ligne murale 520 cm) : quelle version fait foi ?", sources: ["fiche-sb400", "classeur tarifaire (privé)"], blocks: "affichage d'un prix" },
    { field: "Hauteur", question: "Hauteur minimale de passage et pas de largeur ; la déclaration P/SB400/25 indique des dimensions maximales 7000 × 4000 × 3020 mm alors que la page fabricant indique 2,8 m de hauteur maximale.", sources: ["catalogue-sb400", "aluprof-sb-400", "dop-p-sb400-25"], blocks: "hauteurs de 2,8 à 3,02 m (à confirmer au devis)" },
    { field: "Fermetures latérales", question: "Fermetures compatibles avec la SB400 (screen, parois) et leurs fixations.", sources: [], blocks: "fermeture latérale (devis)" },
  ],
};

/* ------------------------------------------------------------------ */
/* HELIO Panorama — réf. fournisseur SB500 (SunBreaker 500)            */
/* ------------------------------------------------------------------ */

const sb500Sheet = SOURCES.ficheSB500;
const sb500: HelioFamily = {
  slug: "helio-panorama",
  name: "HELIO Panorama",
  category: "PERGOLAS",
  kind: "PERGOLA_SYSTEM",
  status: "QUOTE_ONLY",
  sortOrder: 20,
  brand: "SELT",
  manufacturer: "SELT (fusionnée avec ALUPROF SA)",
  supplierRef: "SB500 (SunBreaker 500)",
  shortDescription: "Grande pergola à lames orientables, jusqu'à 5 × 7 m par module, extensible par modules.",
  description:
    "HELIO Panorama est une pergola en aluminium extrudé avec éléments en acier, à lames orientables motorisées. Ses sections renforcées autorisent un module jusqu'à 5 m de largeur et 7 m de projection. Elle existe en version murale ou autoportante et accepte l'assemblage de plusieurs modules. Deux gouttières sont fournies ; l'éclairage HELIO Lumière (bandeau ou spots), l'ensemble solaire et les poteaux supplémentaires sont en option.",
  seoTitle: "Pergola HELIO Panorama à lames orientables — grandes dimensions",
  seoDescription: "Pergola HELIO Panorama : lames orientables motorisées, jusqu'à 5 × 7 m par module, modulable. Configurez vos cotes et demandez un devis.",
  rules: {
    type: "pergola",
    dims: {
      width: { label: "Largeur", minMm: 1400, maxMm: 5000, sources: [at(sb500Sheet, "Spécifications"), T("p. 7")], note: "Pas de largeur non documenté : cote au centimètre, confirmée au relevé." },
      depth: { label: "Projection", minMm: 2000, maxMm: 7000, stepMm: 250, sources: [at(sb500Sheet, "Spécifications : « disponible tous les 25 cm »"), T("p. 7")] },
      height: { label: "Hauteur de passage", minMm: null, maxMm: 3200, sources: [T("p. 6, schéma « max 3.2 m »")], note: "Hauteur minimale non documentée." },
    },
    mountings: [
      { code: "wall", label: "Murale", status: "established", sources: [at(sb500Sheet, "titre"), T("p. 7")] },
      { code: "freestanding", label: "Autoportante", status: "established", sources: [at(sb500Sheet, "titre"), T("p. 7")] },
    ],
    finishes: SB_STANDARD_COLOURS([T("p. 6 — couleurs standard")]),
    customFinish: { code: "RAL_CUSTOM", label: "Autre teinte RAL (option)", status: "to_confirm", sources: [T("p. 7 — « painted in any RAL colour (optional) »")], note: "teinte hors standard : conditions et délai confirmés au devis" },
    controls: [
      { code: "radio_rts", label: "Motorisation radio — commande RTS", supplierRef: "Moteur Elero Picolo XL — commande RTS", kind: "electric", status: "established", sources: [at(sb500Sheet, "Motorisation")] },
      { code: "radio_io", label: "Motorisation radio — commande io", supplierRef: "Moteur Elero Picolo XL — commande IO", kind: "electric", status: "established", sources: [at(sb500Sheet, "Motorisation")] },
      { code: "motor_24v_io", label: "Motorisation 24 V — commande radio io uniquement", supplierRef: "Moteur Pergola 24 V — commande IO uniquement", kind: "electric", status: "established", sources: [at(sb500Sheet, "Motorisation")] },
    ],
    included: [
      { label: "Toiture à lames orientables", sources: [at(sb500Sheet, "Structure incluse"), T("p. 7")] },
      { label: "Motorisation (selon la commande choisie)", supplierRef: "Moteur", sources: [at(sb500Sheet, "Structure incluse")] },
      { label: "HELIO Pilot — télécommande radio 5 canaux", description: "Ouvre, ferme et oriente les lames à distance.", supplierRef: "Commande radio 5 canaux", sources: [at(sb500Sheet, "Structure incluse")] },
      { label: "Supports muraux", sources: [at(sb500Sheet, "Structure incluse")] },
      { label: "2 gouttières (sans évacuation)", sources: [at(sb500Sheet, "Spécifications")] },
      { label: "Joints noirs (seule teinte de joint proposée)", sources: [at(sb500Sheet, "Spécifications")] },
    ],
    options: [
      { code: "led_perimeter", label: "HELIO Lumière — bandeau LED périphérique (COB 3200 K)", description: "Éclairage blanc chaud intégré au pourtour de la structure.", supplierRef: "Éclairage LED périphérique COB 3200 K", group: "lighting", status: "established", sources: [at(sb500Sheet, "Options"), T("p. 7")], cumulToConfirmWith: ["led_spots"] },
      {
        code: "led_spots",
        label: "HELIO Lumière — spots LED dans les lames",
        description: "Points lumineux encastrés dans les lames ; leur nombre dépend des dimensions.",
        supplierRef: "Spots LED dans les lames",
        group: "lighting",
        status: "established",
        note: "spots non modifiables individuellement",
        sources: [at(sb500Sheet, "Tarification des spots — nombre de points"), T("p. 7")],
        spotTable: [
          { depthMinMm: 2000, depthMaxMm: 4240, widthMinMm: 2000, widthMaxMm: 3490, points: 4 },
          { depthMinMm: 2000, depthMaxMm: 4240, widthMinMm: 3500, widthMaxMm: 5000, points: 6 },
          { depthMinMm: 4250, depthMaxMm: 5240, widthMinMm: 2000, widthMaxMm: 3490, points: 6 },
          { depthMinMm: 4250, depthMaxMm: 5240, widthMinMm: 3500, widthMaxMm: 5000, points: 9 },
          { depthMinMm: 5250, depthMaxMm: 7000, widthMinMm: 2000, widthMaxMm: 3490, points: 8 },
          { depthMinMm: 5250, depthMaxMm: 7000, widthMinMm: 3500, widthMaxMm: 5000, points: 12 },
        ],
      },
      { code: "solar_kit", label: "Ensemble solaire", group: "energy", status: "to_confirm", sources: [at(sb500Sheet, "Options")], note: "composition de l'ensemble et compatibilité avec le moteur choisi à confirmer" },
      {
        code: "extra_post",
        label: "Poteau supplémentaire",
        group: "structure",
        status: "established",
        maxQty: 6,
        sources: [at(sb500Sheet, "Poteaux supplémentaires (option) — longueurs 200 à 320 cm")],
        note: "position établie au devis",
        values: [200, 220, 240, 260, 280, 300, 320].map((cm) => ({ code: `${cm * 10}`, label: `longueur ${cm} cm` })),
      },
      { code: "slide_wall", label: "Paroi coulissante (jusqu'à 2,8 m de haut)", supplierRef: "Paroi coulissante SLIDE", group: "closure", status: "to_confirm", sources: [T("p. 7 — « possibility of using sliding wall system SLIDE up to 2.8 m high »")], note: "système non référencé au catalogue HELIOSTORES — étude au devis" },
      { code: "weather_automation", label: "Automatisme météo (capteurs)", group: "control", status: "to_confirm", sources: [T("p. 7")], note: "capteurs et compatibilité avec la commande à confirmer" },
    ],
    modules: { maxSingleWidthMm: 5000, multiModule: "documented", sources: [T("p. 7 — « possibility of modular connection »"), at(sb500Sheet, "tableau « Module suivant (extension) »")] },
    closureWishes: [{ familySlug: "helio-ombra", label: "Screen HELIO Ombra", status: "to_confirm", note: "compatibilité avec HELIO Panorama non documentée par les sources — étude des ouvertures réelles au devis." }],
    structure3d: { postMm: [150, 150], beamMm: [290, 150], bladeMm: [267, 42], gutters: 2 },
    notices: ["Fixations, fondations et raccordement électrique non inclus ; la tenue de l'ouvrage dépend du support et se vérifie au relevé.", "Gouttières fournies sans évacuation : le raccordement des descentes d'eau est prévu au devis."],
    wind: { action: "not_documented", text: "Aucun comportement en cas de vent n'est documenté pour ce modèle (automatisme météo cité sans détail) : la position des lames et les capteurs sont définis au devis.", status: "to_confirm", sources: [T("p. 7")] },
  },
  specs: [
    { key: "width_max", label: "Largeur maximale d'un module", valueNum: 5000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 6–7" },
    { key: "width_min", label: "Largeur minimale d'un module", valueNum: 1400, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 7" },
    { key: "width_min", label: "Largeur minimale d'un module", valueNum: 1400, unit: "mm", source: "CLIENT_SHEET", sourceRef: "Fiche SB500 — Spécifications" },
    { key: "projection_max", label: "Projection maximale d'un module", valueNum: 7000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 6–7" },
    { key: "projection_min", label: "Projection minimale", valueNum: 2000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 7" },
    { key: "projection_min", label: "Projection minimale", valueNum: 2000, unit: "mm", source: "CLIENT_SHEET", sourceRef: "Fiche SB500 — Spécifications" },
    { key: "projection_step", label: "Pas de projection", valueNum: 250, unit: "mm", source: "CLIENT_SHEET", sourceRef: "Fiche SB500 — « disponible tous les 25 cm »" },
    { key: "height_max", label: "Hauteur maximale", valueNum: 3200, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 6 (schéma)" },
    { key: "post_section", label: "Section du poteau", valueText: "150 × 150 mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 6" },
    { key: "beam_section", label: "Section de la poutre", valueText: "150 × 290 mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 6" },
    { key: "modular", label: "Assemblage modulaire", valueText: "possible", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 7" },
    { key: "manufacturer_reference", label: "Référence chez le fabricant", valueText: "SB500 (SunBreaker 500)", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS (collection SELT) p. 6–7 ; kit LED SELT « SB400/SB400PRO/SB500 »" },
    { key: "manufacturer_reference", label: "Référence chez le fabricant", valueText: "aucune page « SB 500 » (gammes publiées : SB 350, SB 400, SB 450, SB 550)", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com — offre pergolas ; /en/product/sb-500 introuvable (404)", note: "Rien n'établit que la SB 550 remplace la SB500." },
    { key: "side_panels", label: "Fermetures latérales citées", valueText: "paroi coulissante jusqu'à 2,8 m de haut", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 7 (« sliding wall system SLIDE »)", note: "Compatibilité d'un screen HELIO Ombra non documentée." },
    { key: "gutters", label: "Gouttières", valueText: "2 incluses, sans évacuation", source: "CLIENT_SHEET", sourceRef: "Fiche SB500 — Spécifications" },
    { key: "drive", label: "Motorisation", valueText: "motorisation radio (commande RTS ou io) ou motorisation 24 V (commande io uniquement)", source: "CLIENT_SHEET", sourceRef: "Fiche SB500 — Motorisation (« Elero Picolo XL RTS / IO ; Pergola 24 V IO uniquement »)" },
    { key: "remote", label: "Commande", valueText: "radio 5 canaux, incluse", source: "CLIENT_SHEET", sourceRef: "Fiche SB500 — Structure incluse" },
    { key: "seals", label: "Joints", valueText: "noirs uniquement", source: "CLIENT_SHEET", sourceRef: "Fiche SB500 — Spécifications" },
    { key: "standards", label: "Normes de construction citées", valueText: "EN 1090 et EN 13659", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 7", note: "Mention du catalogue ; aucun certificat ni déclaration de performance n'a été transmis." },
    { key: "colours_standard", label: "Teintes standard", valueText: "RAL 9016 mat, FSM 71319, RAL 7016 mat", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 6" },
  ],
  faq: [
    { q: "Le prix est-il affiché en ligne ?", a: "Oui : le configurateur affiche le prix hors taxes de la structure selon vos dimensions (grille tarifaire HELIOSTORES, pour les cotes de la grille ; une autre cote est chiffrée au devis). Les options, la pose et la livraison sont chiffrées sur votre devis." },
    { q: "Peut-on commander en ligne ?", a: "Oui pour la structure seule : aux dimensions couvertes par la grille, sans option ni choix à confirmer, la configuration s'ajoute au panier (TVA ajoutée au total). La livraison et la pose s'organisent ensuite avec un conseiller. Dans les autres cas, demandez un devis depuis le configurateur." },
    { q: "Peut-on couvrir plus de 5 m de largeur ?", a: "Oui, HELIO Panorama accepte l'assemblage de plusieurs modules. La composition (modules, poteaux, gouttières) est établie au devis." },
    { q: "Quels moteurs sont proposés ?", a: "Une motorisation radio en commande RTS ou io, ou une motorisation 24 V en commande io uniquement. Le moteur retenu est précisé sur votre devis." },
    { q: "Les gouttières sont-elles fournies ?", a: "Deux gouttières sont incluses, sans évacuation : le raccordement des descentes est prévu au devis." },
    { q: "Peut-on fermer les côtés ?", a: "La documentation mentionne une paroi coulissante jusqu'à 2,8 m de haut. Ce système et la compatibilité d'un screen se vérifient au devis selon les ouvertures réelles." },
  ],
  openQuestions: [
    { field: "Marque / fabricant", question: "aluprof.com ne publie pas de page « SB 500 » (gammes actuelles SB 350, SB 400, SB 450, SB 550) ; la SB500 figure au catalogue THYSENS (collection SELT) et dans le kit LED SELT « SB400/SB400PRO/SB500 ». Rien n'établit que la SB 550 la remplace : référence ALUPROF actuelle à confirmer.", sources: ["catalogue-thysens p. 6–7", "aluprof.com — offre pergolas"], blocks: "rapprochement avec une page fabricant" },
    { field: "Tarifs", question: "La fiche nomme les deux grilles « Premier module » et « Module suivant (extension) » ; le classeur nomme les mêmes montants « AUTOPORTANTE » et « MURALE ». Quelle lecture est correcte ?", sources: ["fiche-sb500", "classeur tarifaire (privé)"], blocks: "affichage d'un prix" },
    { field: "Tarifs", question: "Nature, devise (DH / €), HT ou TTC et validité des montants ; options « non remisées » en €.", sources: ["fiche-sb500"], blocks: "affichage d'un prix" },
    { field: "Tarifs", question: "La fiche annonce une projection dès 2 m par pas de 25 cm et une largeur dès 1,4 m, mais la grille commence à 3 m de projection (pas de 50 cm) et 2,5 m de largeur.", sources: ["fiche-sb500"], blocks: "prix des petites dimensions" },
  ],
};

/* ------------------------------------------------------------------ */
/* HELIO Ombra — réf. fournisseur REFLEKSOL 120 ZiiiP                  */
/* ------------------------------------------------------------------ */

const refSheet = SOURCES.ficheRefleksol;
/**
 * Moteurs de la fiche : libellé public « Motorisation électrique » ou « Motorisation radio » (seulement quand la
 * référence nomme le protocole radio RTS ou IO) ; le modèle du fabricant reste dans `supplierRef`.
 * [code, libellé public, modèle fournisseur, largeur minimale du système, câble]
 */
const REF_MOTORS: Array<[string, string, string, number, string]> = [
  ["electric_1", "Motorisation électrique — modèle 1", "M45-10/26", 580, "3 m noir VVF"],
  ["electric_2", "Motorisation électrique — modèle 2", "VariEco M 10/14", 590, "2 m blanc RNF"],
  ["electric_3", "Motorisation électrique — modèle 3", "Jet 10/17", 640, "2,5 m blanc VVF"],
  ["electric_4", "Motorisation électrique — modèle 4", "SunTop M", 580, "2 m blanc RNF"],
  ["electric_5", "Motorisation électrique — modèle 5", "Altus WT", 730, "3 m noir RRF"],
  ["electric_6", "Motorisation électrique — modèle 6", "DM45EAF/S-10/26", 720, "3 m blanc VVF"],
  ["electric_7", "Motorisation électrique — modèle 7", "SunTop 868 M 10/14", 580, "2 m blanc RNF"],
  ["radio_rts", "Motorisation radio — commande RTS", "Altus 50 RTS 10/17", 680, "3 m blanc VVF"],
  ["radio_io", "Motorisation radio — commande io", "SUNILUS SCR IO 10/17", 680, "5 m blanc VVF"],
];
const refleksol: HelioFamily = {
  slug: "helio-ombra",
  name: "HELIO Ombra",
  category: "SCREENS",
  kind: "SCREEN_SYSTEM",
  status: "QUOTE_ONLY",
  sortOrder: 30,
  brand: "SELT by Aluprof",
  manufacturer: "ALUPROF SA (usine d'Opole, ex-SELT)",
  supplierRef: "REFLEKSOL 120 ZiiiP",
  shortDescription: "Screen à toile tendue guidée par fermeture zip, motorisé, pose en niche ou en façade.",
  description:
    "HELIO Ombra est un screen extérieur à coffre en aluminium extrudé de 126 mm, pour une pose en niche ou en façade. Son guidage zip tient la toile dans des coulisses en deux parties avec joints de compensation. La commande est uniquement électrique. La documentation indique une résistance au vent de classe 6 (classe 4 au-delà de 4 001 mm de largeur) et un renfort de la toile pour les largeurs supérieures à 5 m.",
  seoTitle: "Screen HELIO Ombra motorisé — prix selon vos dimensions",
  seoDescription: "Screen extérieur HELIO Ombra : toile tendue par coulisses zip, commande électrique, pose en niche ou façade. Configurez et demandez un devis.",
  rules: {
    type: "screen",
    dims: {
      width: {
        label: "Largeur",
        minMm: 580,
        maxMm: 7000,
        confirmAboveMm: 4000,
        confirmNote: "la fiche transmise indique 4 m au maximum (3,5 m avec guidage câble) quand le catalogue indique 7 m",
        sources: [T("p. 66 — largeur maximale 7 m"), at(SOURCES.aluprofRefleksol, "Maximum width 7.0 m"), at(refSheet, "Spécifications — 400 cm (barre anti-vent) / 350 cm (guidage câble) ; largeur minimale selon moteur")],
        note: "La largeur minimale dépend du moteur choisi (58 à 80 cm selon la fiche).",
      },
      height: { label: "Hauteur", minMm: null, maxMm: 4000, confirmAboveMm: 3000, confirmNote: "la page fabricant indique 4 m dans ses caractéristiques mais « up to 3 m » dans son texte", sources: [T("p. 66 — hauteur maximale 4 m"), at(SOURCES.aluprofRefleksol, "Maximum height 4.0 m ; texte « height of up to 3 m »"), at(refSheet, "Spécifications — 400 cm")] },
    },
    mountings: [
      { code: "facade", label: "En façade", status: "established", sources: [T("p. 67 — « cassette dedicated for niche and facade installation »")] },
      { code: "niche", label: "En niche", status: "established", sources: [T("p. 67")] },
    ],
    finishes: SELT_PALETTE.map((c) => finish(`${c}`, [T("p. 66 et 150 — couleurs de la palette SELT")], c.startsWith("VSR") ? "aperçu non disponible" : undefined)),
    customFinish: { code: "RAL_CUSTOM", label: "Autre teinte RAL (option)", status: "to_confirm", sources: [T("p. 67 — « any colour from RAL palette (optional) »")], note: "teinte hors palette : conditions et délai confirmés au devis" },
    fabrics: [
      { code: "soltis", label: "Soltis (92 / 99)", status: "established", sources: [at(refSheet, "Tissus disponibles"), T("p. 157")] },
      { code: "sunworker", label: "Sunworker", status: "established", sources: [at(refSheet, "Tissus disponibles"), T("p. 157")] },
      { code: "serge", label: "Serge", status: "established", sources: [at(refSheet, "Tissus disponibles"), T("p. 157")] },
      { code: "polyscreen", label: "Polyscreen", status: "established", sources: [at(refSheet, "Tissus disponibles"), T("p. 157")] },
      { code: "acrylique", label: "Acrylique", status: "to_confirm", sources: [at(refSheet, "Tissus disponibles")], note: "citée par la fiche, absente des toiles du catalogue pour ce screen — à confirmer" },
    ],
    controls: REF_MOTORS.map(([c, label, model, minW, cable]) => ({ code: c, label, supplierRef: `Moteur ${model}`, kind: "electric" as const, minWidthMm: minW, cable: `câble ${cable}`, status: "established" as const, sources: [at(refSheet, "Options moteurs — largeur minimale du système et câble")] })),
    included: [
      { label: "Coffre en aluminium extrudé (126 mm)", sources: [T("p. 66–67")] },
      { label: "Guidage zip : coulisses en deux parties avec joints de compensation", supplierRef: "Mécanisme ZiiiP", sources: [T("p. 67")] },
      { label: "Coulisses et barres anti-vent selon la configuration", sources: [at(refSheet, "Spécifications")], status: "to_confirm" },
    ],
    options: [
      { code: "group_installation", label: "Installation groupée (supports modulaires)", group: "structure", status: "to_confirm", sources: [T("p. 67 — « option to create modules using modular brackets »")], note: "nombre de modules et supports établis au devis" },
      { code: "weather_automation", label: "HELIO Vent / HELIO Soleil — automatisme vent et soleil", description: "Relève le screen dans son coffre par vent fort ; pilote la toile selon l'ensoleillement.", supplierRef: "Automatisme (capteurs vent / soleil), modèle selon le moteur", group: "control", status: "to_confirm", requiresControlKind: "electric", prerequisite: "capteur compatible avec le moteur choisi (à confirmer)", pricing: "quote", sources: [T("p. 160 — pilotage automatique selon la météo"), at(SOURCES.noticeScreens, "p. 10 — relevage complet par vent"), at(SOURCES.dteRefleksol, "p. 27 — automatisation du vent recommandée")], note: "capteurs compatibles avec le moteur choisi à confirmer" },
      { code: "connect_box", label: "HELIO Connect — box de pilotage par smartphone", description: "Box internet qui pilote depuis une application un moteur radio io compatible. Elle ne rend pas connectés les autres moteurs.", supplierRef: "Somfy TaHoma Switch (liste d'accessoires du fabricant)", group: "control", status: "to_confirm", requiresControls: ["radio_io"], prerequisite: "nécessite la motorisation radio — commande io", pricing: "quote", sources: [at(SOURCES.aluprofRefleksol, "onglet Automatisation (liste, sans compatibilité par moteur)")], note: "compatibilité à confirmer" },
    ],
    structure3d: { cassetteMm: [126, 126] },
    wind: { action: "raise", text: "Par vent fort, le screen doit être entièrement relevé dans son coffre ; l'automatisme de vent recommandé ne dispense pas de le relever au-delà de la vitesse admissible.", status: "established", sources: [at(SOURCES.dteRefleksol, "p. 27"), at(SOURCES.noticeScreens, "p. 10")] },
    notices: ["Commande uniquement électrique : alimentation et raccordement à prévoir.", "Résistance au vent déclarée (EN 13659) : classe 6 jusqu'à 4 × 4 m, classe 4 de 4 à 5 m de largeur (hauteur ≤ 3 m), classe 2 pour 7 × 4 m (déclarations des performances du fabricant)."],
  },
  specs: [
    { key: "width_max", label: "Largeur maximale", valueNum: 7000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 66" },
    { key: "width_max", label: "Largeur maximale", valueNum: 4000, unit: "mm", source: "CLIENT_SHEET", sourceRef: "Fiche REFLEKSOL — « 400 cm (barre anti-vent) / 350 cm (guidage câble) »", note: "Contradiction avec le catalogue (7 m) ; le guidage câble ne correspond pas au guidage zip." },
    { key: "height_max", label: "Hauteur maximale", valueNum: 4000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 66" },
    { key: "height_max", label: "Hauteur maximale", valueNum: 4000, unit: "mm", source: "CLIENT_SHEET", sourceRef: "Fiche REFLEKSOL — Spécifications" },
    { key: "cassette", label: "Coffre", valueText: "aluminium extrudé, 126 × 126 mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 66" },
    { key: "wind_class", label: "Résistance au vent", valueText: "classe 6 (classe 4 au-delà de 4 001 mm de largeur)", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 67" },
    { key: "wind_class_dop", label: "Résistance au vent déclarée (EN 13659)", valueText: "classe 6 (480 Pa) jusqu'à 400 × 400 cm ; classe 4 (204 Pa) de 400 à 500 cm × ≤ 300 cm ; classe 2 (84 Pa) pour 700 × 400 cm", source: "SUPPLIER_DOCUMENT", sourceRef: "Déclarations des performances 52/RZ/2024 et 30/RZ/2023 (SELT) — lecture visuelle de documents numérisés" },
    { key: "width_max", label: "Largeur maximale", valueNum: 7000, unit: "mm", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/refleksol-120-ziiip — Maximum width" },
    { key: "height_max", label: "Hauteur maximale", valueNum: 4000, unit: "mm", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/refleksol-120-ziiip — Maximum height", note: "Le texte de la même page indique « height of up to 3 m »." },
    { key: "height_max", label: "Hauteur maximale", valueNum: 3000, unit: "mm", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/refleksol-120-ziiip — texte « width of up to 7 m and height of up to 3 m »", note: "Même page que la valeur 4 m de son tableau de caractéristiques." },
    { key: "drive", label: "Commande", valueText: "électrique uniquement", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 66" },
    { key: "drive", label: "Commande", valueText: "électrique uniquement", source: "CLIENT_SHEET", sourceRef: "Fiche REFLEKSOL — Spécifications" },
    { key: "use", label: "Usage", valueText: "extérieur", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 66" },
    { key: "wide_width_reinforcement", label: "Grandes largeurs", valueText: "renfort de la toile au-delà de 5 m", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 67 (« ZOOMTECH® »)" },
    { key: "colours", label: "Teintes", valueText: "palette de 26 teintes standard, autre RAL en option", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 66–67, 150" },
  ],
  faq: [
    { q: "Le prix est-il affiché en ligne ?", a: "Oui : le configurateur affiche le prix hors taxes de la structure selon vos dimensions (grille tarifaire HELIOSTORES, pour les cotes de la grille ; une autre cote est chiffrée au devis). Les options, la pose et la livraison sont chiffrées sur votre devis." },
    { q: "Peut-on commander en ligne ?", a: "Oui pour la structure seule : aux dimensions couvertes par la grille, sans option ni choix à confirmer, la configuration s'ajoute au panier (TVA ajoutée au total). La livraison et la pose s'organisent ensuite avec un conseiller. Dans les autres cas, demandez un devis depuis le configurateur." },
    { q: "Quelle largeur maximale ?", a: "Le catalogue indique 7 m, la fiche transmise 4 m. Jusqu'à 4 m, les deux sources concordent ; au-delà, la faisabilité est confirmée au devis." },
    { q: "Peut-on le manœuvrer à la main ?", a: "Non : HELIO Ombra est uniquement à commande électrique. Le choix du moteur fixe la largeur minimale du screen." },
    { q: "Peut-il fermer le côté d'une pergola ?", a: "Un screen vendu seul n'est pas automatiquement compatible avec une pergola : l'intégration se vérifie au devis selon les ouvertures et les fixations." },
  ],
  openQuestions: [
    { field: "Largeur maximale", question: "Fiche : 4 m (barre anti-vent) / 3,5 m (guidage câble) ; catalogue : 7 m. La fiche décrit-elle un autre guidage que ZiiiP ?", sources: ["fiche-refleksol-120-ziiip", "catalogue-thysens p. 66"], blocks: "largeurs supérieures à 4 m (devis)" },
    { field: "Tarifs", question: "La grille de la fiche ne correspond à aucune cellule du classeur et couvre moins de dimensions : quelle grille fait foi ? Nature, devise et fiscalité.", sources: ["fiche-refleksol-120-ziiip", "classeur tarifaire (privé)"], blocks: "affichage d'un prix" },
    { field: "Toiles", question: "Toile acrylique citée par la fiche mais absente des toiles REFLEKSOL du catalogue.", sources: ["fiche-refleksol-120-ziiip", "catalogue-thysens p. 157"], blocks: "toile acrylique (devis)" },
    { field: "Hauteur maximale", question: "Page fabricant : 4 m (caractéristiques) et « up to 3 m » (texte) ; catalogue et fiche : 4 m.", sources: ["aluprof-r120-ziiip"], blocks: "hauteurs de 3 à 4 m (devis)" },
  ],
};

/* ------------------------------------------------------------------ */
/* HELIO Riviera — réf. fournisseur CASABLANCA                         */
/* ------------------------------------------------------------------ */

const casaSheet = SOURCES.ficheCasablanca;
const casaGrid = at(casaSheet, "tableau des dimensions (projection × largeur)");
const casablanca: HelioFamily = {
  slug: "helio-riviera",
  name: "HELIO Riviera",
  category: "STORES_BANNES",
  kind: "AWNING_SYSTEM",
  status: "QUOTE_ONLY",
  sortOrder: 40,
  brand: "SELT by Aluprof",
  manufacturer: "ALUPROF SA (usine d'Opole, ex-SELT)",
  supplierRef: "CASABLANCA",
  shortDescription: "Store de terrasse à coffre, jusqu'à 6 m de largeur et 3,6 m d'avancée.",
  description:
    "HELIO Riviera est un store de terrasse à coffre en aluminium extrudé. Le joint du coffre protège la toile, les bras sont à chaînes Flyer et un support de tube d'enroulement équipe les grandes largeurs. Il se pose au mur, au plafond ou sur chevrons, avec une inclinaison de 5° à 40°. La fiche transmise décrit la commande manuelle par manivelle.",
  seoTitle: "Store banne HELIO Riviera à coffre — prix selon vos dimensions",
  seoDescription: "Store banne coffre HELIO Riviera : jusqu'à 6 m de largeur et 3,6 m d'avancée, pose murale, plafond ou chevrons. Configurez et demandez un devis.",
  rules: {
    type: "awning",
    dims: {
      width: { label: "Largeur", minMm: 2000, maxMm: 6000, sources: [at(casaSheet, "Spécifications — 200 à 600 cm"), T("p. 114 — largeur maximale 6 m")] },
      depth: { label: "Avancée", minMm: 1600, maxMm: 3600, valuesMm: [1600, 2100, 2600, 3100, 3600], sources: [at(casaSheet, "Spécifications — 160 à 360 cm ; tableau des dimensions"), T("p. 114 — avancée maximale 3,6 m")], note: "Avancées proposées par le tableau de la fiche." },
    },
    depthWidthMin: [
      { depthMm: 2600, widthMinMm: 2910, sources: [casaGrid] },
      { depthMm: 3100, widthMinMm: 3510, sources: [casaGrid] },
      { depthMm: 3600, widthMinMm: 3510, sources: [casaGrid] },
    ],
    mountings: [
      { code: "wall", label: "Murale", status: "established", sources: [T("p. 114–115 — wall installation")] },
      { code: "ceiling", label: "Au plafond", status: "established", sources: [T("p. 114–115 — ceiling installation")] },
      { code: "rafter", label: "Sur chevrons", status: "established", sources: [T("p. 114–115 — roof rafter installation")] },
    ],
    finishes: ["RAL 9010", "RAL 1015", "RAL 8014", "RAL 9006", "FSM 71319"].map((c) => finish(c, [at(casaSheet, "Couleurs disponibles"), T("p. 114 — couleurs standard")])),
    fabrics: [{ code: "acrylic_collection", label: "Toile acrylique — coloris à choisir parmi la collection (150 références)", status: "established", sources: [T("p. 114 — « 150 patterns » ; p. 155 toiles acryliques")], note: "coloris choisi au devis sur nuancier" }],
    controls: [
      { code: "crank_1500", label: "Manuelle — manivelle 150 cm", kind: "manual", status: "established", sources: [at(casaSheet, "Commande manuelle")] },
      { code: "crank_1800", label: "Manuelle — manivelle 180 cm", kind: "manual", status: "established", sources: [at(casaSheet, "Commande manuelle")] },
      { code: "crank_2200", label: "Manuelle — manivelle 220 cm", kind: "manual", status: "established", sources: [at(casaSheet, "Commande manuelle")] },
      { code: "electric", label: "Motorisation électrique (moteur à définir)", kind: "electric", status: "to_confirm", sources: [T("p. 114 — « electric drive: yes »"), at(SOURCES.aluprofCasablanca, "commande manuelle ou électrique")], note: "motorisation citée par le catalogue mais absente de la fiche : moteur et conditions établis au devis" },
    ],
    included: [
      { label: "Coffre avec joint de protection de la toile", sources: [T("p. 115")] },
      { label: "Bras à chaînes Flyer", sources: [T("p. 115")] },
      { label: "Embouts en aluminium", sources: [T("p. 115")] },
      { label: "Support de tube d'enroulement pour les grandes largeurs", sources: [T("p. 115")] },
      { label: "2 supports jusqu'à 4,10 m de largeur, 3 au-delà", sources: [at(casaSheet, "Spécifications"), at(SOURCES.suppStores, "p. 46")] },
    ],
    options: [
      { code: "remote_control", label: "HELIO Pilot — télécommande radio", description: "Émetteur de commande à distance de la version motorisée.", supplierRef: "émetteur de commande à distance (modèle à définir avec le moteur)", group: "control", status: "to_confirm", requiresControlKind: "electric", prerequisite: "nécessite la motorisation", pricing: "quote", sources: [at(SOURCES.dteCasablanca, "p. 6 — « émetteur de commande à distance »")], note: "modèle défini avec le moteur au devis" },
      { code: "weather_automation", label: "HELIO Vent / HELIO Soleil — automatisme vent-soleil", description: "Replie le store par vent fort et le déploie selon l'ensoleillement ; seuils réglables.", supplierRef: "automatisation météorologique vent-soleil (capteurs selon le moteur)", group: "control", status: "to_confirm", requiresControlKind: "electric", prerequisite: "nécessite la motorisation", pricing: "quote", sources: [T("p. 115 — « simple handling using full weather automation »"), at(SOURCES.dteCasablanca, "p. 6, p. 19"), at(SOURCES.brochureAwnings, "p. 29")], note: "capteurs définis avec le moteur au devis" },
      { code: "shock_sensor", label: "Capteur de vibrations", description: "Capteur de choc fixé sur la barre de charge, pour la commande automatique du store motorisé.", supplierRef: "capteurs de choc / vibration listés par le fabricant (Eolis 3D io, capteurs RED / BLUE)", group: "control", status: "to_confirm", requiresControlKind: "electric", prerequisite: "nécessite la motorisation ; capteur compatible avec le moteur", pricing: "quote", sources: [at(SOURCES.aluprofCasaAutomation, "capteurs de choc ou de vibration")], note: "compatibilité avec le moteur à confirmer" },
      { code: "connect_box", label: "HELIO Connect — box de pilotage par smartphone", description: "Box internet qui pilote depuis une application un moteur radio compatible. Elle ne rend pas connectée une commande non compatible.", supplierRef: "Somfy TaHoma Switch (liste d'accessoires du fabricant)", group: "control", status: "to_confirm", requiresControlKind: "electric", prerequisite: "nécessite une motorisation radio io (moteur à définir)", pricing: "quote", sources: [at(SOURCES.aluprofCasaAutomation, "TaHoma Switch")], note: "compatibilité avec le moteur à confirmer" },
    ],
    packs: [
      { code: "essentiel", label: "Essentiel", tier: 1, summary: "Store à coffre manœuvré à la manivelle : la solution simple.", status: "established", controlKinds: ["manual"], includes: ["Coffre avec joint de protection de la toile", "Bras à chaînes Flyer", "Manivelle 150, 180 ou 220 cm"], sources: [casaSheet, T("p. 114–115")] },
      { code: "confort", label: "Confort", tier: 2, summary: "Même store, motorisé, avec télécommande radio ; automatisme vent-soleil en option.", status: "to_confirm", controlKinds: ["electric"], includes: ["Coffre avec joint de protection de la toile", "Bras à chaînes Flyer", "Motorisation (moteur à définir)", "HELIO Pilot — télécommande radio"], optionCodes: ["remote_control", "weather_automation", "shock_sensor", "connect_box"], sources: [at(SOURCES.dteCasablanca, "p. 6")], note: "moteur, télécommande et capteurs définis et chiffrés au devis" },
      { code: "premium", label: "Premium", tier: 3, summary: "Autre modèle à coffre, uniquement motorisé, avec éclairage LED et capteurs météo : en préparation.", status: "to_confirm", controlKinds: ["electric"], includes: ["Éclairage LED dans le profil bas", "Capteurs météo"], familySlug: "helio-azur", sources: [T("p. 118–119"), at(SOURCES.brochureAwnings, "p. 13")], note: "modèle à valider (fiche, tarifs, photos) avant toute présentation" },
    ],
    wind: { action: "retract", text: "Par vent fort, le store se replie : au-delà de sa classe de vent déclarée, il doit être enroulé immédiatement ; l'automatisme de vent recommandé ne protège pas contre les rafales qui dépassent ses réglages.", status: "established", sources: [at(SOURCES.dteCasablanca, "p. 18–19"), at(SOURCES.noticeAwnings, "p. 10")] },
    structure3d: { tiltDeg: [5, 40] },
    notices: ["Fixations adaptées au support (béton, maçonnerie, charpente) à déterminer au relevé ; pas de pose directe sur un support non porteur.", "Résistance au vent déclarée : classe 2 jusqu'à 4,10 × 3,10 m, classe 1 au-delà (déclaration des performances du fabricant) — un store banne se replie par vent fort.", "Manivelles et engrenages disponibles en RAL 9010, 1013, 8017, 9006, 7016.", "Éclairage LED : non proposé sur ce modèle."],
  },
  specs: [
    { key: "width_range", label: "Largeur", valueText: "200 à 600 cm", source: "CLIENT_SHEET", sourceRef: "Fiche CASABLANCA — Spécifications" },
    { key: "width_max", label: "Largeur maximale", valueNum: 6000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 114" },
    { key: "width_max", label: "Largeur maximale", valueNum: 6000, unit: "mm", source: "CLIENT_SHEET", sourceRef: "Fiche CASABLANCA — Spécifications" },
    { key: "projection_max", label: "Avancée maximale", valueNum: 3600, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 114" },
    { key: "projection_max", label: "Avancée maximale", valueNum: 3600, unit: "mm", source: "CLIENT_SHEET", sourceRef: "Fiche CASABLANCA — Spécifications" },
    { key: "tilt", label: "Inclinaison", valueText: "5° à 40°", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 114" },
    { key: "tilt", label: "Inclinaison", valueText: "5° à 40°", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/casablanca-awning" },
    { key: "width_max", label: "Largeur maximale", valueNum: 6000, unit: "mm", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/casablanca-awning" },
    { key: "projection_max", label: "Avancée maximale", valueNum: 3600, unit: "mm", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/casablanca-awning" },
    { key: "wind_class_dop", label: "Résistance au vent déclarée (EN 13561)", valueText: "classe 2 (84 Pa) jusqu'à 410 × 310 cm, classe 1 (48 Pa) au-delà", source: "SUPPLIER_DOCUMENT", sourceRef: "Déclaration des performances 08/M/2018 (SELT) — lecture visuelle de document numérisé" },
    { key: "cassette", label: "Coffre", valueText: "oui, avec joint", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 114–115" },
    { key: "valance", label: "Lambrequin", valueText: "non", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 114" },
    { key: "fabric", label: "Toiles", valueText: "150 références (toiles acryliques)", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 114, 155" },
    { key: "drive", label: "Commande", valueText: "électrique ou manuelle", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com/en/product/casablanca-awning", note: "Moteur de la version électrique non précisé ; la fiche transmise ne décrit que la manivelle." },
    { key: "drive", label: "Commande", valueText: "manuelle par manivelle (150, 180 ou 220 cm)", source: "CLIENT_SHEET", sourceRef: "Fiche CASABLANCA — Spécifications" },
    { key: "drive", label: "Commande", valueText: "électrique ou manuelle", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 114" },
    { key: "colours_standard", label: "Teintes standard", valueText: "RAL 9010, RAL 1015, RAL 8014, RAL 9006, FSM 71319", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 114" },
    { key: "colours_standard", label: "Teintes standard", valueText: "RAL 9010, RAL 1015, RAL 8014, RAL 9006, FSM 71319", source: "CLIENT_SHEET", sourceRef: "Fiche CASABLANCA — Couleurs disponibles" },
  ],
  faq: [
    { q: "Le prix est-il affiché en ligne ?", a: "Oui : le configurateur affiche le prix hors taxes de la structure selon vos dimensions (grille tarifaire HELIOSTORES, pour les cotes de la grille ; une autre cote est chiffrée au devis). Les options, la pose et la livraison sont chiffrées sur votre devis." },
    { q: "Peut-on commander en ligne ?", a: "Oui pour la structure seule : aux dimensions couvertes par la grille, sans option ni choix à confirmer, la configuration s'ajoute au panier (TVA ajoutée au total). La livraison et la pose s'organisent ensuite avec un conseiller. Dans les autres cas, demandez un devis depuis le configurateur." },
    { q: "Quelles avancées sont proposées ?", a: "1,6 m, 2,1 m, 2,6 m, 3,1 m et 3,6 m. Les grandes avancées demandent une largeur minimale : 2,91 m pour 2,6 m d'avancée, 3,51 m pour 3,1 m et 3,6 m." },
    { q: "Existe-t-il une version motorisée ?", a: "Le catalogue cite une commande électrique ; la fiche transmise décrit la version à manivelle. La motorisation est donc étudiée au devis." },
    { q: "Où peut-on le poser ?", a: "Au mur, au plafond ou sur chevrons. Les fixations dépendent du support et se déterminent au relevé." },
  ],
  openQuestions: [
    { field: "Motorisation", question: "Moteur, commande et conditions de la version électrique citée par le catalogue.", sources: ["catalogue-thysens p. 114"], blocks: "version électrique (devis)" },
    { field: "Largeur minimale", question: "Largeurs minimales selon l'avancée : la fiche (2,91 m pour 2,6 m ; 3,51 m pour 3,1 et 3,6 m) diffère de la documentation technique (portée + 0,4 m : 2,5 / 3 / 4 m).", sources: ["fiche-casablanca", "dte-casablanca p. 6", "supp-stores p. 46"], blocks: "aucun (la fiche s'applique, à confirmer)" },
    { field: "Niveau Confort", question: "Moteur (fins de course électroniques recommandées, certains moteurs déconseillés), télécommande et capteurs de la version motorisée.", sources: ["dte-casablanca p. 6", "DT-E CASABLANCA EN 2016 p. 17–18"], blocks: "niveau Confort (devis)" },
    { field: "Tarifs", question: "Nature, devise (DH), HT ou TTC, validité ; transport et pose.", sources: ["fiche-casablanca", "classeur tarifaire (privé)"], blocks: "affichage d'un prix" },
  ],
};

/* ------------------------------------------------------------------ */
/* HELIO Azur — réf. CORSICA — brouillon (niveau Premium des stores bannes) */
/* ------------------------------------------------------------------ */

const corsica: HelioFamily = {
  slug: "helio-azur",
  name: "HELIO Azur",
  category: "STORES_BANNES",
  kind: "AWNING_SYSTEM",
  status: "DRAFT",
  sortOrder: 45,
  brand: "SELT by Aluprof",
  manufacturer: "ALUPROF SA (usine d'Opole, ex-SELT)",
  supplierRef: "CORSICA",
  shortDescription: "Store de terrasse à coffre, uniquement motorisé, avec éclairage LED : niveau Premium en préparation.",
  description: "HELIO Azur est un store de terrasse à coffre et barre carrée, uniquement motorisé. Le profil bas peut recevoir un éclairage LED et des bras éclairés existent pour les avancées de 3,1 et 3,6 m. Il se pose au mur, au plafond ou sur chevrons, avec une inclinaison de 5° à 35°. Modèle en brouillon : fiche, tarif et photographies à obtenir.",
  seoTitle: "Store banne HELIO Azur — motorisé, éclairage LED",
  seoDescription: "Store banne à coffre motorisé HELIO Azur, éclairage LED et capteurs météo : sur devis.",
  rules: {
    type: "awning",
    dims: {
      width: { label: "Largeur", minMm: 2050, maxMm: 7000, sources: [T("p. 118 — largeur maximale 7 m"), at(SOURCES.brochureAwnings, "p. 13 — 2,05 à 7 m")] },
      depth: { label: "Avancée", minMm: 1600, maxMm: 3600, sources: [T("p. 118 — avancée 1,6 à 3,6 m"), at(SOURCES.brochureAwnings, "p. 13")], note: "Pas d'avancée et largeurs minimales par avancée non documentés : établis au devis." },
    },
    mountings: [
      { code: "wall", label: "Murale", status: "established", sources: [T("p. 118")] },
      { code: "ceiling", label: "Au plafond", status: "established", sources: [T("p. 118")] },
      { code: "rafter", label: "Sur chevrons", status: "established", sources: [T("p. 118")] },
    ],
    finishes: ["RAL 9010", "RAL 1015", "RAL 8014", "RAL 9006", "FSM 71319"].map((c) => finish(c, [T("p. 118 — couleurs standard")])),
    fabrics: [{ code: "acrylic_collection", label: "Toile acrylique — coloris à choisir parmi la collection", status: "established", sources: [T("p. 155"), at(SOURCES.brochureAwnings, "p. 26")], note: "coloris choisi au devis sur nuancier" }],
    controls: [
      { code: "electric", label: "Motorisation électrique (moteur à définir)", kind: "electric", status: "to_confirm", sources: [T("p. 118 — uniquement motorisé"), at(SOURCES.brochureAwnings, "p. 13")], note: "moteur, télécommande et conditions établis au devis" },
    ],
    included: [
      { label: "Coffre et barre de charge carrée", sources: [T("p. 118–119"), at(SOURCES.brochureAwnings, "p. 13")] },
    ],
    options: [
      { code: "led_bottom_profile", label: "HELIO Lumière — éclairage LED dans le profil bas", description: "Bandeau LED intégré au profil inférieur du store.", supplierRef: "LED dans le profil bas (équipement selon le catalogue, option selon le supplément technique)", group: "lighting", status: "to_confirm", requiresControlKind: "electric", prerequisite: "commande d'éclairage compatible à définir", pricing: "quote", sources: [T("p. 119"), at(SOURCES.brochureAwnings, "p. 13"), at(SOURCES.suppStores, "p. 51")], note: "équipement de série ou option : à confirmer" },
      { code: "led_arms", label: "HELIO Lumière — bras éclairés", description: "Bras articulés équipés de LED, pour les avancées de 3,1 m et 3,6 m.", supplierRef: "bras LED 3100 et 3600 mm", group: "lighting", status: "to_confirm", prerequisite: "avancée de 3,1 m ou 3,6 m", pricing: "quote", sources: [at(SOURCES.brochureAwnings, "p. 13"), at(SOURCES.suppStores, "p. 83")], note: "commande de l'éclairage à définir" },
      { code: "weather_automation", label: "HELIO Vent / HELIO Soleil — capteurs météo", description: "Replie le store par vent fort et le déploie selon l'ensoleillement ; seuils réglables.", supplierRef: "capteurs météo (selon le moteur)", group: "control", status: "to_confirm", requiresControlKind: "electric", pricing: "quote", sources: [at(SOURCES.brochureAwnings, "p. 13, p. 29")], note: "capteurs définis avec le moteur" },
    ],
    wind: { action: "retract", text: "Par vent fort, les capteurs replient le store ; seuils réglables.", status: "to_confirm", sources: [at(SOURCES.brochureAwnings, "p. 29 (stores bannes en général)")] },
    structure3d: { tiltDeg: [5, 35] },
    notices: ["Modèle en préparation : aucune page publique, aucun prix. Sans support télescopique ni lambrequin (supplément technique)."],
  },
  specs: [
    { key: "width_max", label: "Largeur maximale", valueNum: 7000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 118" },
    { key: "projection_max", label: "Avancée maximale", valueNum: 3600, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 118" },
    { key: "tilt", label: "Inclinaison", valueText: "5° à 35°", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 118" },
    { key: "drive", label: "Commande", valueText: "uniquement motorisée", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 118 ; brochure ALUPROF Stores bannes p. 13" },
    { key: "cassette", label: "Coffre", valueText: "coffre (« semi-cassette » selon la brochure)", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 118 ; brochure ALUPROF p. 13" },
  ],
  faq: [],
  openQuestions: [
    { field: "Validation", question: "Disponibilité chez le fournisseur, fiche technique, classe de vent, coffre (intégral ou semi-coffre).", sources: ["catalogue-thysens p. 118–119", "brochure-stores-bannes p. 13"], blocks: "publication" },
    { field: "Tarifs", question: "Grille de la structure et prix de l'éclairage LED.", sources: [], blocks: "affichage d'un prix" },
    { field: "Éclairage", question: "LED du profil bas de série ou en option ; commande de l'éclairage (récepteur, télécommande).", sources: ["catalogue-thysens p. 119", "supp-stores p. 51"], blocks: "option LED" },
  ],
};

/* ------------------------------------------------------------------ */
/* HELIO Verrière — réf. VERANDA FTS — brouillon, hors catalogue public */
/* ------------------------------------------------------------------ */

const ftsSheet = SOURCES.ficheFts;
const veranda: HelioFamily = {
  slug: "helio-verriere",
  name: "HELIO Verrière",
  category: null,
  kind: "ROOF_BLIND_SYSTEM",
  status: "DRAFT",
  sortOrder: 90,
  brand: null,
  manufacturer: null,
  supplierRef: "VERANDA FTS",
  shortDescription: "Store textile de toiture vitrée (pose sur toiture ou au plafond), deux moteurs — en attente de classement.",
  description:
    "HELIO Verrière est un store textile en aluminium extrudé qui ombrage une toiture vitrée (véranda, verrière). Il se pose sur la toiture ou, à la demande, au plafond. Deux moteurs à capteurs de charge intégrés le commandent, et il couvre de grandes surfaces sans division du système, jusqu'à 4,5 m de largeur et 6,5 m de longueur selon le catalogue. Ce n'est ni une pergola, ni un screen vertical, ni un store banne à bras : son rattachement à l'une des trois familles reste à décider.",
  seoTitle: "HELIO Verrière",
  seoDescription: "Store de toiture HELIO Verrière (brouillon).",
  rules: {
    type: "roof_blind",
    dims: {
      width: { label: "Largeur", minMm: 900, maxMm: 4500, sources: [at(ftsSheet, "Spécifications — min 90 cm, max 450 cm"), T("p. 108 — largeur maximale 4,5 m")] },
      height: { label: "Longueur (sens de déroulement)", minMm: null, maxMm: 6500, sources: [at(ftsSheet, "Spécifications — hauteur jusqu'à 650 cm"), T("p. 108 — 6,5 m")] },
    },
    mountings: [
      { code: "rafter", label: "Sur toiture", status: "established", sources: [T("p. 108–109 — roof mounting")] },
      { code: "ceiling", label: "Au plafond (à la demande)", status: "to_confirm", sources: [T("p. 108–109 — ceiling at the customer's request")], note: "pose au plafond sur demande" },
    ],
    finishes: SELT_PALETTE.map((c) => finish(c, [T("p. 108, 150 — palette SELT")])),
    fabrics: [
      { code: "soltis_92", label: "Soltis 92", status: "established", sources: [at(ftsSheet, "Tissus disponibles")] },
      { code: "acrylic", label: "Toile acrylique extérieure", status: "established", sources: [at(ftsSheet, "Tissus disponibles")] },
    ],
    controls: [{ code: "two_motors", label: "Motorisation électrique — deux moteurs et contrôleur", supplierRef: "Électrique — deux moteurs + contrôleur FTS", kind: "electric", status: "established", sources: [at(ftsSheet, "Commande exclusivement électrique"), T("p. 109")] }],
    included: [{ label: "Deux moteurs à capteurs de charge intégrés", sources: [T("p. 109")] }],
    options: [{ code: "weather_sensor", label: "Capteur météo", group: "control", status: "to_confirm", sources: [at(ftsSheet, "compatible capteur météo")], note: "modèle à confirmer" }],
  },
  specs: [
    { key: "width_range", label: "Largeur", valueText: "90 à 450 cm", source: "CLIENT_SHEET", sourceRef: "Fiche VERANDA FTS — Spécifications" },
    { key: "length_max", label: "Longueur maximale", valueNum: 6500, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "Catalogue THYSENS p. 108" },
    { key: "drive", label: "Commande", valueText: "électrique, deux moteurs et contrôleur", source: "CLIENT_SHEET", sourceRef: "Fiche VERANDA FTS (« deux moteurs + contrôleur FTS »)" },
  ],
  faq: [],
  openQuestions: [
    { field: "Correspondance", question: "aluprof.com présente le système « Veranda » (4,5 × 5 m) et un moteur « Somfy FTS » en accessoire ; la « Veranda FTS » (6,5 m) n'apparaît qu'au catalogue THYSENS.", sources: ["aluprof-veranda", "catalogue-thysens p. 108"], blocks: "référence fabricant" },
    { field: "Classement", question: "La VERANDA FTS est un store de toiture vitrée (véranda / verrière). Le rattacher aux Stores bannes, aux Screens, en faire un équipement de pergola, ou le laisser hors catalogue ? (Aucune quatrième famille n'est créée.)", sources: ["fiche-veranda-fts", "catalogue-thysens p. 104–109"], blocks: "publication du produit" },
    { field: "Tarifs", question: "La grille de la fiche ne correspond à aucune cellule du classeur ; nature, devise et fiscalité à établir.", sources: ["fiche-veranda-fts", "classeur tarifaire (privé)"], blocks: "affichage d'un prix" },
  ],
};

export const HELIOSTORES_FAMILIES: HelioFamily[] = [sb400, sb500, refleksol, casablanca, corsica, veranda];
export const HELIOSTORES_SLUGS = HELIOSTORES_FAMILIES.map((f) => f.slug);

/** Instantané de catalogue construit sans base (tests, aperçus) — mêmes règles que celles semées en base. */
export function buildHeliostoresCatalog(): import("@/domain/types").CatalogSnapshot {
  const kind = (k: HelioFamily["kind"]) => k.toLowerCase() as "pergola_system" | "screen_system" | "awning_system" | "roof_blind_system";
  const status = (s: HelioFamily["status"]) => s.toLowerCase() as "published" | "quote_only" | "draft";
  const source = (s: SpecSeed["source"]) => s.toLowerCase() as "client_sheet" | "supplier_document" | "manufacturer_website";
  return {
    version: "heliostores-fixture",
    generatedAt: "2026-10-21T00:00:00.000Z",
    taxRateBps: 2000,
    finishes: [],
    dimensions: [],
    families: HELIOSTORES_FAMILIES.map((f) => ({
      slug: f.slug,
      name: f.name,
      kind: kind(f.kind),
      status: status(f.status),
      shortDescription: f.shortDescription,
      dataStatus: "unknown",
      category: f.category,
      brand: f.brand,
      manufacturer: f.manufacturer,
      supplierRef: f.supplierRef,
      systemRules: f.rules,
      legacy: false,
      technicalSpecs: f.specs.map((s) => ({ key: s.key, label: s.label, valueNum: s.valueNum ?? null, unit: s.unit ?? null, valueText: s.valueText ?? null, source: source(s.source), sourceRef: s.sourceRef, note: s.note ?? null })),
    })),
    variants: [],
    closureCompat: [],
    optionCompat: [],
    installationRates: [],
    shippingRules: [],
    promotions: [],
    custom: { quoteOnly: true, widthMm: { min: 0, max: 0, step: 10 }, lengthMm: { min: 0, max: 0, step: 10 }, heightMm: { min: 0, max: 0, step: 10 }, dataStatus: "unknown", grids: [] },
  };
}
