/**
 * Documents officiels du fabricant rattachés aux fiches HELIOSTORES : liens vers les fichiers publiés sur
 * aluprof.com (consultés le 2026-10-20). Ils ne sont ni ré-hébergés, ni modifiés, ni présentés comme émis par
 * HELIOSTORES. Les documents d'un autre modèle (ex. SB 400 PRO) ne sont pas rattachés.
 * Les huit fichiers transmis par le client (fiches avec tarifs, catalogues) ne sont pas publiés.
 */
export interface HelioDocument {
  key: string;
  familySlugs: string[];
  title: string;
  kind: "declaration_performance" | "fiche_technique" | "brochure" | "notice";
  url: string;
  language: "fr" | "en";
  summary: string;
}

const F = "https://aluprof.com/files/product_documents/";
const D = "https://aluprof.com/files/downloads/";
const NOTE = "Document officiel du fabricant, publié sur aluprof.com (consulté le 2026-10-20) — non émis par HELIOSTORES.";

export const HELIOSTORES_DOCUMENTS: HelioDocument[] = [
  { key: "dop-pd-sb400", familySlugs: ["helio-horizon"], title: "Déclaration des performances PD/SB400/25 — Pergola SB 400 (anglais)", kind: "declaration_performance", url: `${F}DWU_PD_SB400_EN.pdf`, language: "en", summary: `Performances déclarées selon EN 13561 (résistance au vent). ${NOTE}` },
  { key: "dop-p-sb400", familySlugs: ["helio-horizon"], title: "Déclaration des performances P/SB400/25 — structure (anglais)", kind: "declaration_performance", url: `${F}DWU_P_SB400_EN.pdf`, language: "en", summary: `Structure selon EN 1090-1. ${NOTE}` },
  { key: "suppl-pergolas-fr", familySlugs: ["helio-horizon"], title: "Supplément technique — Pergolas (fabricant)", kind: "fiche_technique", url: `${F}Suppl%C3%A9ment%20technique%20-%20PERGOLAS_fr.pdf`, language: "fr", summary: NOTE },
  { key: "led-pergola-fr", familySlugs: ["helio-horizon", "helio-panorama"], title: "Kit d'éclairage LED de pergola (document technique fabricant)", kind: "fiche_technique", url: `${F}8714050510_DTE_LED_de_la_pergola_FR.pdf`, language: "fr", summary: `Kit LED cité pour les pergolas SB400 / SB400PRO / SB500. ${NOTE}` },
  { key: "brochure-pergolas-fr", familySlugs: ["helio-horizon"], title: "Brochure Pergolas (fabricant)", kind: "brochure", url: `${D}Pergolas_FR.pdf`, language: "fr", summary: NOTE },
  { key: "dop-52-rz", familySlugs: ["helio-ombra"], title: "Déclaration des performances 52/RZ/2024 — R 120 ZiiiP (anglais)", kind: "declaration_performance", url: `${F}8634124DWU_52_RZ_2024_RZiiiP120_ENG.pdf`, language: "en", summary: `Résistance au vent selon EN 13659. ${NOTE}` },
  { key: "dop-30-rz", familySlugs: ["helio-ombra"], title: "Déclaration des performances 30/RZ/2023 — R 120 ZiiiP 700 × 400 (anglais)", kind: "declaration_performance", url: `${F}5478576DWU_30_RZ_2023_RZiiiP120700x400_en.pdf`, language: "en", summary: `Résistance au vent pour 7 × 4 m. ${NOTE}` },
  { key: "dt-refleksol-fr", familySlugs: ["helio-ombra"], title: "Document technique Refleksol ZiiiP 120 / 95 / BOX Large (fabricant)", kind: "fiche_technique", url: `${F}517864926_DT_E_Refleksol_ZiiiP120_95_BOX_Large_poprawki_10_2021_1_FR_2.pdf`, language: "fr", summary: NOTE },
  { key: "suppl-screens-fr", familySlugs: ["helio-ombra"], title: "Supplément technique — Screens (fabricant)", kind: "fiche_technique", url: `${F}Suppl%C3%A9ment%20technique%20%E2%80%93%20SCREENS_fr.pdf`, language: "fr", summary: NOTE },
  { key: "dop-08-m-fr", familySlugs: ["helio-riviera"], title: "Déclaration des performances 08/M/2018 — CASABLANCA", kind: "declaration_performance", url: `${F}7938140DWU_08_M_2018_CASABLANCA_FR.pdf`, language: "fr", summary: `Résistance au vent selon EN 13561. ${NOTE}` },
  { key: "suppl-stores-fr", familySlugs: ["helio-riviera"], title: "Supplément technique — Stores (fabricant)", kind: "fiche_technique", url: `${F}Suppl%C3%A9ment%20technique%20%E2%80%93%20STORES_fr.pdf`, language: "fr", summary: NOTE },
  { key: "notice-stores-fr", familySlugs: ["helio-riviera"], title: "Notice d'utilisation et d'entretien — stores bannes (fabricant)", kind: "notice", url: `${F}IUiK_Awings_fr.pdf`, language: "fr", summary: NOTE },
  { key: "brochure-stores-fr", familySlugs: ["helio-riviera"], title: "Brochure Stores bannes (fabricant)", kind: "brochure", url: `${D}Stores_Banes_FR.pdf`, language: "fr", summary: NOTE },
];
