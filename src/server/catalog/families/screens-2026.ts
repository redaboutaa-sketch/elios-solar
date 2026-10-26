/**
 * HelioRoof Screen — screen de toiture (nomenclature du 2026-10-25), référence fournisseur ALUPROF « Veranda »
 * (store de véranda standard, UN moteur). Ce n'est PAS le modèle « Veranda FTS » (deux moteurs, 6,5 m) de l'ancienne
 * fiche `helio-verriere`, retirée : aucune caractéristique FTS n'est reprise (private/heliostores/research/screens.md § B).
 * La fiche et la grille transmises par le client portent sur FTS : le choix Veranda / FTS reste à confirmer.
 */
import type { SourceRef } from "@/domain/system";
import type { HelioFamily } from "../heliostores-data";
import { src } from "./shared";
import { SELT_FINISHES } from "./palette";

export const ROOF_SOURCES = {
  page: src("aluprof-veranda", "Page fabricant « Veranda »", "https://aluprof.com/en/product/veranda"),
  dte: src("dte-veranda-fr", "Documentation technique DT-E 4.1 Véranda (FR, éd. 6, janvier 2020)"),
  dop2017: src("dop-67-mw-2017", "Déclaration des performances 67/MW/2017 « Store de véranda »"),
  dop2025: src("dop-67m-mw-2025", "Déclaration des performances 67m/MW/2025 « Conservatory awning (VERANDA) »"),
  supp: src("supp-screens", "Supplément technique SCREENS (FR, état 2026-08-03)"),
} as const satisfies Record<string, SourceRef>;

const S = ROOF_SOURCES;
const at = (s: SourceRef, loc: string): SourceRef => ({ ...s, loc });

const helioroof: HelioFamily = {
  slug: "helioroof-screen",
  name: "HelioRoof Screen",
  category: "SCREENS",
  kind: "ROOF_BLIND_SYSTEM",
  status: "QUOTE_ONLY",
  sortOrder: 32,
  brand: "Aluprof",
  manufacturer: "ALUPROF SA (usine d'Opole, ex-SELT)",
  supplierRef: "Veranda (store de véranda standard, DT-E 4.1) — pas Veranda FTS",
  shortDescription: "Screen de toiture motorisé pour verrière, véranda ou toiture vitrée, jusqu'à 4,5 × 5 m (16 m²).",
  description:
    "HelioRoof Screen est un store de toiture à toile tendue pour les surfaces vitrées horizontales ou inclinées : vérandas, verrières, jardins d'hiver. La toile, guidée dans des coulisses en aluminium, est tendue par un système intégré à la barre avant et entraînée par un moteur. Un module mesure jusqu'à 4,5 m de largeur et 5 m de projection, dans la limite de 16 m².",
  seoTitle: "Screen de toiture HelioRoof Screen pour véranda",
  seoDescription: "Store de toiture HelioRoof Screen : toile tendue motorisée pour véranda et verrière, jusqu'à 4,5 × 5 m. Configurez et demandez votre devis.",
  rules: {
    type: "roof_blind",
    dims: {
      width: { label: "Largeur", minMm: 1250, maxMm: 4500, sources: [at(S.dte, "p. 7 — 1 250 à 4 500 mm"), at(S.page, "largeur maximale 4,5 m"), at(S.supp, "p. 222 — S min. 800 / max. 4 500")], note: "Le supplément technique 2026 indique 800 mm minimum : en dessous de 1,25 m, faisabilité confirmée au devis." },
      depth: { label: "Projection", minMm: null, maxMm: 5000, confirmAboveMm: 4000, confirmNote: "au-delà de 4 m, la projection de 5 m n'est documentée que pour une largeur de 2,25 à 3 m", sources: [at(S.dte, "p. 7"), at(S.page, "longueur maximale 5 m"), at(S.dop2017, "Hmax = 5 000 mm")] },
    },
    mountings: [
      { code: "roof", label: "Sur la toiture (au-dessus du vitrage)", status: "established", sources: [at(S.page, "Mounting options — Roof installation"), at(S.supp, "p. 220")] },
      { code: "ceiling", label: "Sous la toiture (suspendu)", status: "to_confirm", sources: [at(S.page, "Ceiling installation"), at(S.supp, "p. 220 — sur demande expresse du client")], note: "pose suspendue sur demande, étudiée au devis" },
      { code: "facade", label: "Verticale", status: "established", sources: [at(S.page, "Vertical installation"), at(S.dte, "p. 7")] },
    ],
    finishes: SELT_FINISHES([at(S.page, "palette de 33 teintes")]),
    customFinish: { code: "RAL_CUSTOM", label: "Autre teinte RAL (option)", status: "to_confirm", sources: [at(S.page, "toute teinte RAL en option"), at(S.supp, "p. 220")], note: "teinte hors palette : conditions et délai confirmés au devis" },
    fabrics: [
      { code: "soltis_92", label: "Soltis 92 (laisse passer la lumière)", status: "established", swatch: "#b5b0a3", sources: [at(S.page, "onglet Tissus — Soltis 92")] },
      { code: "acrylic", label: "Toile acrylique (environ 70 coloris)", status: "established", swatch: "#c9bfa9", sources: [at(S.page, "onglet Tissus — acryliques")] },
      { code: "waterproof", label: "Toile imperméable (10 coloris)", status: "established", swatch: "#7f8180", sources: [at(S.page, "onglet Tissus — Waterproof")] },
    ],
    controls: [{ code: "electric", label: "Motorisation électrique (un moteur)", kind: "electric", status: "to_confirm", sources: [at(S.dte, "p. 7 — moteur 40 Nm"), at(S.supp, "p. 220 — commandé exclusivement par électricité")], note: "modèle de moteur établi au devis" }],
    included: [
      { label: "Coffre en aluminium et coulisses de guidage", sources: [at(S.dte, "p. 7")] },
      { label: "Tension de la toile intégrée à la barre avant", sources: [at(S.supp, "p. 220")] },
      { label: "Motorisation électrique (commande par interrupteur ou télécommande)", sources: [at(S.dte, "p. 7–8")] },
    ],
    options: [
      { code: "weather_automation", label: "Automatisme météo (capteurs)", description: "Protège la toile contre les conditions climatiques ; modèle compatible établi au devis.", group: "control", status: "to_confirm", wish: true, requiresControlKind: "electric", pricing: "quote", visual: "wind_sensor", sources: [at(S.dte, "p. 7 — automatisation météo optionnelle")] },
      { code: "remote_control", label: "Télécommande radio", group: "control", status: "to_confirm", wish: true, requiresControlKind: "electric", pricing: "quote", visual: "remote", sources: [at(S.page, "onglet Automatisation (liste sans compatibilité)")] },
      { code: "connect_box", label: "Box domotique — commande par smartphone", group: "control", status: "to_confirm", wish: true, requiresControlKind: "electric", prerequisite: "nécessite un moteur radio compatible", pricing: "quote", visual: "box", sources: [at(S.page, "onglet Automatisation (liste sans compatibilité)")] },
      { code: "modules", label: "Installation en plusieurs modules", group: "structure", status: "to_confirm", pricing: "quote", sources: [at(S.page, "modulaire"), at(S.supp, "p. 224–225")], note: "nombre de modules et supports établis au devis" },
    ],
    structure3d: { cassetteMm: [206, 146], tiltDeg: [5, 15] },
    notices: [
      "Surface maximale d'un module : 16 m² ; une largeur de 4,5 m est documentée jusqu'à 4 m de projection.",
      "Inclinaison de la toiture : le fabricant indique que le store fonctionne quel que soit l'angle, sans plage chiffrée — la représentation est indicative.",
      "Chevilles et vis de fixation non fournies : elles dépendent du support et sont prévues à l'étude du projet.",
    ],
    wind: { action: "retract", text: "Ne pas utiliser le store par fortes rafales, neige ou pluie verglaçante. Classe de vent déclarée : 2 (déclaration de 2017) ou 1 (déclaration de 2025) — la valeur applicable est confirmée au devis.", status: "to_confirm", sources: [at(S.dte, "p. 9"), at(S.dop2017, "classe 2"), at(S.dop2025, "classe 1")] },
  },
  specs: [
    { key: "width_max", label: "Largeur maximale", valueNum: 4500, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 4.1 p. 7 ; DoP 67/MW/2017" },
    { key: "projection_max", label: "Projection maximale", valueNum: 5000, unit: "mm", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 4.1 p. 7", note: "5 m seulement pour 2,25 à 3 m de largeur ; surface ≤ 16 m²" },
    { key: "area_max", label: "Surface maximale", valueText: "16 m²", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 4.1 p. 7" },
    { key: "drive", label: "Commande", valueText: "électrique uniquement (moteur 40 Nm)", source: "SUPPLIER_DOCUMENT", sourceRef: "DT-E 4.1 p. 7" },
    { key: "wind_class_dop", label: "Résistance au vent (EN 13561)", valueText: "classe 2 (2017) ; classe 1 (2025)", source: "SUPPLIER_DOCUMENT", sourceRef: "DoP 67/MW/2017 ; DoP 67m/MW/2025" },
  ],
  faq: [
    { q: "Pour quelles toitures ?", a: "Vérandas, verrières et toitures vitrées, horizontales ou inclinées. Le store se pose au-dessus du vitrage ; une pose suspendue ou verticale s'étudie au devis." },
    { q: "Quelle taille maximale ?", a: "4,5 m de largeur et jusqu'à 5 m de projection pour un module, dans la limite de 16 m² ; plusieurs modules peuvent se juxtaposer." },
  ],
  openQuestions: [
    { field: "Modèle", question: "Le client vend-il Veranda (un moteur, ≤ 4,5 × 5 m, 16 m²) ou Veranda FTS (deux moteurs, 6,5 m) ? Sa fiche et sa grille portent sur FTS.", sources: ["private/heliostores/research/screens.md § B"], blocks: "prix, publication définitive" },
    { field: "Dimensions", question: "Largeur minimale 800 mm (supplément 2026) ou 1 250 mm (documentation technique) ; plage d'inclinaison.", sources: ["supp-screens p. 222", "dte-veranda-fr p. 7"], blocks: "bornes (devis)" },
    { field: "Vent", question: "Classe 2 (2017) ou classe 1 (2025) ?", sources: ["dop-67-mw-2017", "dop-67m-mw-2025"], blocks: "communication sur le vent" },
  ],
};

export const SCREENS_2026: HelioFamily[] = [helioroof];
