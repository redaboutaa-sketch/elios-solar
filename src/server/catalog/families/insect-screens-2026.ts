/**
 * Moustiquaires (quatrième famille, nomenclature du 2026-10-25) : MoskiFold, MoskiFold 2, MoskiUp, MoskiSlide, MoskiFix.
 *
 * Aucune source ne relie un nom Moski* à un code fabricant : la correspondance proposée (systèmes ALUPROF MPH HARMONY,
 * MPH DUAL, MZN, MRP, MRS) repose sur le principe d'ouverture documenté et l'unicité du système dans la gamme — confiance
 * moyenne, À CONFIRMER PAR LE CLIENT (private/heliostores/research/moustiquaires.md). Les caractéristiques ne sont jamais
 * déduites du nom commercial. Les cinq modèles sont présentés en demande d'étude sur devis (cotes transmises comme souhait,
 * aucune limite inventée, aucune photo du système candidat). ALUPROF fournit un système à des fabricants : le contenu du kit
 * livré au client final n'est documenté pour aucun modèle.
 */
import type { SourceRef } from "@/domain/system";
import type { HelioFamily } from "../heliostores-data";
import { src } from "./shared";

export const INSECT_SOURCES = {
  brochure: src("brochure-moustiquaires-fr", "Brochure « Systèmes de moustiquaires » (FR, 2021, 16 p.)"),
  brochurePl: src("brochure-moskitiery-pl", "Brochure « Moskitiery » (PL, 2022, 16 p.)"),
  pageHarmony: src("aluprof-mph-harmony", "Page fabricant « MPH HARMONY »", "https://aluprof.com/fr/produit/mph-harmony-systeme-de-moustiquaire-plissee"),
  pageDual: src("aluprof-mph-dual", "Page fabricant « MPH DUAL »", "https://aluprof.com/fr/produit/mph-dual-systeme-de-moustiquaire-plissee"),
  pageMzn: src("aluprof-mzn", "Page fabricant « MZN »", "https://aluprof.com/fr/produit/mzn-systeme-de-moustiquaire-enroulable"),
  pageMrp: src("aluprof-mrp", "Page fabricant « MRP »", "https://aluprof.com/fr/produit/mrp-systeme-de-moustiquaire-coulissante"),
  pageMrs: src("aluprof-mrs", "Page fabricant « MRS »", "https://aluprof.com/fr/produit/mrs-systeme-de-moustiquaires-a-cadre-fixe"),
  offre: src("aluprof-offre-moustiquaires", "Offre « Moustiquaires » (filtres type, installation, apparence)", "https://aluprof.com/fr/produits/pare-soleil/moustiquaires"),
} as const satisfies Record<string, SourceRef>;

const S = INSECT_SOURCES;
const at = (s: SourceRef, loc: string): SourceRef => ({ ...s, loc });

/** Teintes de profilés publiées pour les plissés (codes du fabricant) ; aperçus indicatifs. */
const PROFILE_COLOURS: Array<[string, string, string]> = [["00", "Non peint", "#c9cbcc"], ["01", "Argent", "#b9bcbd"], ["02", "Blanc", "#f2f2ee"], ["08", "Brun foncé", "#3f2c22"], ["09", "Brun", "#6a4a35"], ["15", "Blanc cassé", "#ebe6d8"], ["20", "Noir", "#151515"], ["23", "Gris anthracite", "#3a3e41"]];
const profileFinishes = (sources: SourceRef[], status: "established" | "to_confirm" = "established") => PROFILE_COLOURS.map(([c, label, swatch]) => ({ code: `P${c}`, label: `${label} (teinte ${c})`, status, swatch, sources }));
const STUDY_ONLY = "la correspondance de ce modèle avec le système du fabricant est en cours de confirmation ; dimensions, poses et teintes sont précisées à l'étude.";
const WOOD = (sources: SourceRef[]) => ({ code: "WOOD_DECOR", label: "Décor bois (option)", status: "to_confirm" as const, sources, note: "décors R26, R28, R30, R52 avec supplément : conditions au devis" });
const CORRESPONDENCE = (system: string): HelioFamily["openQuestions"][number] => ({ field: "Correspondance", question: `Correspondance avec le système fabricant ${system} : proposée d'après le principe d'ouverture (confiance moyenne), à confirmer par le client.`, sources: ["private/heliostores/research/moustiquaires.md"], blocks: "publication des caractéristiques" });
const KIT = { field: "Kit", question: "Contenu du kit livré au client final (le fabricant fournit un système à des fabricants), notice de pose et guide de mesure.", sources: [], blocks: "guide d'installation" };

const moskifold: HelioFamily = {
  slug: "moskifold",
  name: "MoskiFold",
  category: "MOUSTIQUAIRES",
  kind: "INSECT_SCREEN_SYSTEM",
  status: "QUOTE_ONLY",
  sortOrder: 60,
  brand: "Aluprof",
  manufacturer: "ALUPROF SA",
  supplierRef: "MPH HARMONY (correspondance proposée, à confirmer)",
  shortDescription: "Moustiquaire plissée à un vantail pour porte-fenêtre ou baie de balcon : présentation et demande d'étude sur mesure.",
  description: "MoskiFold est une moustiquaire plissée à ouverture latérale et à un vantail, destinée aux portes-fenêtres et aux baies de balcon. Sa fiche technique est en cours de confirmation : les dimensions possibles, la pose et les teintes sont établies lors de l'étude de votre projet, à partir de vos mesures.",
  seoTitle: "Moustiquaire plissée MoskiFold pour porte-fenêtre",
  seoDescription: "Moustiquaire plissée MoskiFold à un vantail pour porte-fenêtre : transmettez vos mesures pour une étude sur mesure et un devis.",
  rules: {
    type: "insect_screen",
    insect: { opening: "pleated", leaves: 1, sources: [at(S.pageHarmony, "description"), at(S.brochure, "p. 4")] },
    dims: {
      // bornes du système candidat (4 m ; 3,2 m selon la seule brochure PL) non publiées tant que la correspondance n'est pas confirmée
      width: { label: "Largeur", minMm: null, maxMm: 0, sources: [at(S.pageHarmony, "« jusqu'à 4 m » (système candidat)"), at(S.brochure, "p. 4")], note: "Dimension souhaitée, étudiée au devis." },
      height: { label: "Hauteur", minMm: null, maxMm: 0, sources: [at(S.brochurePl, "p. 4 — hauteur maximale 3 200 mm (système candidat)")], note: "Dimension souhaitée, étudiée au devis." },
    },
    studyOnly: STUDY_ONLY,
    mountings: [
      { code: "reveal", label: "Dans l'embrasure (niche de balcon)", status: "to_confirm", sources: [at(S.pageHarmony, "« dans les niches de balcon »")], note: "pose du système candidat, confirmée à l'étude" },
      { code: "frame", label: "En applique (façade)", status: "to_confirm", sources: [at(S.offre, "filtre « Monté sur façade »")], note: "pose en applique citée par un filtre du catalogue, à confirmer" },
    ],
    finishes: profileFinishes([at(S.pageHarmony, "onglet Couleurs")], "to_confirm"),
    customFinish: WOOD([at(S.pageHarmony, "onglet Couleurs — avec supplément")]),
    included: [
      { label: "Toile plissée repliée dans le profil latéral, arrêt dans toutes les positions", status: "to_confirm", sources: [at(S.pageHarmony, "description"), at(S.brochure, "p. 4")] },
      { label: "Seuil bas", status: "to_confirm", sources: [at(S.pageHarmony, "seuil fin")] },
      { label: "Réglage indépendant de la tension des fils guides", status: "to_confirm", sources: [at(S.brochure, "p. 4")] },
    ],
    options: [],
    notices: ["Couleur de toile et dimensions minimales non documentées : précisées au devis."],
  },
  specs: [
    { key: "opening", label: "Ouverture", valueText: "plissée latérale, un vantail", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com — MPH HARMONY" },
  ],
  faq: [{ q: "Pour quelles ouvertures ?", a: "Portes-fenêtres et baies de balcon. Les dimensions réalisables sont confirmées à l'étude de votre projet." }],
  openQuestions: [CORRESPONDENCE("MPH HARMONY (alternative : MPH VERTI)"), { field: "Dimensions", question: "Hauteur maximale (3 200 mm dans la seule brochure polonaise) et dimensions minimales.", sources: ["brochure-moskitiery-pl p. 4"], blocks: "bornes du configurateur" }, KIT],
};

const moskifold2: HelioFamily = {
  slug: "moskifold-2",
  name: "MoskiFold 2",
  category: "MOUSTIQUAIRES",
  kind: "INSECT_SCREEN_SYSTEM",
  status: "QUOTE_ONLY",
  sortOrder: 61,
  brand: "Aluprof",
  manufacturer: "ALUPROF SA",
  supplierRef: "MPH DUAL (correspondance proposée, à confirmer)",
  shortDescription: "Moustiquaire plissée à deux vantaux pour grandes baies et portes coulissantes : présentation et demande d'étude sur mesure.",
  description: "MoskiFold 2 est une moustiquaire plissée à deux vantaux qui se rejoignent au centre, destinée aux portes de terrasse et aux grandes portes coulissantes. Sa fiche technique est en cours de confirmation : dimensions, pose, toile et teintes sont établies lors de l'étude de votre projet.",
  seoTitle: "Moustiquaire plissée deux vantaux MoskiFold 2",
  seoDescription: "Moustiquaire plissée MoskiFold 2 à deux vantaux pour grandes baies : transmettez vos mesures pour une étude sur mesure et un devis.",
  rules: {
    type: "insect_screen",
    insect: { opening: "pleated", leaves: 2, sources: [at(S.pageDual, "« variante à deux vantaux »"), at(S.brochure, "p. 5")] },
    dims: {
      // bornes du système candidat (6 m ; 2,7 m FR / 3,2 m PL) non publiées tant que la correspondance n'est pas confirmée
      width: { label: "Largeur", minMm: null, maxMm: 0, sources: [at(S.pageDual, "« jusqu'à 6 m de large » (système candidat)"), at(S.brochure, "p. 5")], note: "Dimension souhaitée, étudiée au devis." },
      height: { label: "Hauteur", minMm: null, maxMm: 0, sources: [at(S.pageDual, "« 2,7 m de haut » (système candidat)"), at(S.brochurePl, "p. 5")], note: "Dimension souhaitée, étudiée au devis." },
    },
    studyOnly: STUDY_ONLY,
    mountings: [
      { code: "reveal", label: "Dans l'embrasure", status: "to_confirm", sources: [at(S.offre, "filtres « Pour portes », « Seuil bas »")], note: "type de pose précisé à l'étude" },
      { code: "frame", label: "En applique (façade)", status: "to_confirm", sources: [at(S.offre, "filtre « Monté sur façade »")], note: "pose du système candidat, confirmée à l'étude" },
    ],
    finishes: profileFinishes([at(S.pageDual, "onglet Couleurs")], "to_confirm"),
    customFinish: WOOD([at(S.pageDual, "onglet Couleurs — avec supplément")]),
    fabrics: [
      { code: "mesh_grey", label: "Toile grise", status: "to_confirm", swatch: "#7c8082", sources: [at(S.pageDual, "toile"), at(S.brochure, "p. 5")] },
      { code: "mesh_black", label: "Toile noire", status: "to_confirm", swatch: "#26282a", sources: [at(S.pageDual, "toile"), at(S.brochure, "p. 5")] },
    ],
    included: [
      { label: "Deux vantaux plissés, arrêt dans toutes les positions", status: "to_confirm", sources: [at(S.pageDual, "description")] },
      { label: "Seuil bas", status: "to_confirm", sources: [at(S.offre, "filtre « Seuil bas »")] },
    ],
    options: [
      { code: "corner", label: "Version d'angle sans poteau", group: "structure", status: "to_confirm", pricing: "quote", sources: [at(S.pageDual, "« moustiquaire en angle sans poteau »")], note: "configuration d'angle étudiée au devis" },
    ],
  },
  specs: [
    { key: "opening", label: "Ouverture", valueText: "plissée latérale, deux vantaux", source: "MANUFACTURER_WEBSITE", sourceRef: "aluprof.com — MPH DUAL" },
  ],
  faq: [{ q: "Quelle différence avec MoskiFold ?", a: "MoskiFold 2 a deux vantaux qui se rejoignent au centre : il est destiné aux baies plus larges. Les dimensions réalisables sont confirmées à l'étude." }],
  openQuestions: [CORRESPONDENCE("MPH DUAL"), { field: "Dimensions", question: "Hauteur maximale 2,7 m ou 3,2 m ; dimensions minimales ; largeur par vantail.", sources: ["aluprof-mph-dual", "brochure-moskitiery-pl p. 5"], blocks: "au-delà de 2,7 m (devis)" }, KIT],
};

/**
 * Demandes d'étude (retour client : moustiquaires manquantes, 2026-11-01) : MoskiUp, MoskiSlide, MoskiFix présentés
 * sur devis comme MoskiFold, avec leurs seules caractéristiques de principe (type d'ouverture) ; aucune dimension, pose,
 * teinte ni photo du système candidat n'est publiée tant que la correspondance et les dimensions ne sont pas confirmées.
 * Aucun configurateur validé : les cotes sont transmises comme souhait (studyOnly).
 */
function studyRequest(slug: string, name: string, sortOrder: number, supplierRef: string, opening: NonNullable<HelioFamily["rules"]["insect"]>["opening"], short: string, description: string, sources: SourceRef[], system: string, mountings: Array<{ code: "reveal" | "frame" | "facade" | "niche"; label: string }>, faq: HelioFamily["faq"], seoTitle: string): HelioFamily {
  return {
    slug, name, category: "MOUSTIQUAIRES", kind: "INSECT_SCREEN_SYSTEM", status: "QUOTE_ONLY", sortOrder,
    brand: "Aluprof", manufacturer: "ALUPROF SA", supplierRef,
    shortDescription: short, description, seoTitle, seoDescription: `${short} Transmettez vos mesures pour une étude sur mesure et un devis.`,
    rules: {
      type: "insect_screen",
      insect: { opening, leaves: 1, sources },
      dims: {
        width: { label: "Largeur", minMm: null, maxMm: 0, sources: sources.map((x) => ({ ...x, loc: "dimensions non documentées" })), note: "Dimension souhaitée, étudiée au devis." },
        height: { label: "Hauteur", minMm: null, maxMm: 0, sources: sources.map((x) => ({ ...x, loc: "dimensions non documentées" })), note: "Dimension souhaitée, étudiée au devis." },
      },
      studyOnly: STUDY_ONLY,
      mountings: mountings.map((m) => ({ code: m.code, label: m.label, status: "to_confirm" as const, sources, note: "type de pose confirmé à l'étude" })),
      finishes: [{ code: "TO_CONFIRM", label: "Teinte précisée à l'étude", status: "to_confirm", swatch: "#b9bcbd", sources, note: "teintes de profilés confirmées au devis" }],
      included: [],
      options: [],
      notices: ["Dimensions minimales et maximales, poses et teintes non confirmées pour ce modèle : elles sont établies à l'étude de votre projet, à partir de vos mesures."],
    },
    specs: [{ key: "opening", label: "Ouverture", valueText: opening === "roller_vertical" ? "enroulable verticale" : opening === "sliding" ? "coulissante à cadre" : "cadre fixe", source: "MANUFACTURER_WEBSITE", sourceRef: sources.map((s) => s.label).join(" ; ") }],
    faq,
    openQuestions: [CORRESPONDENCE(system), { field: "Dimensions", question: "Dimensions minimales et maximales (non documentées) : bloquant pour un configurateur validé ; la page reste une demande d'étude.", sources: [], blocks: "configurateur validé, photos" }, { field: "Teintes et toiles", question: "Teintes de profilés et toiles proposées pour ce modèle.", sources: ["private/heliostores/research/moustiquaires.md"], blocks: "choix de teinte en ligne" }, KIT],
  };
}

const moskiup = studyRequest("moskiup", "MoskiUp", 62, "MZN (correspondance proposée, à confirmer ; alternative MZH)", "roller_vertical",
  "Moustiquaire enroulable verticale pour fenêtres et portes : présentation et demande d'étude sur mesure.",
  "MoskiUp est une moustiquaire enroulable : la toile remonte dans un coffre en partie haute et se guide dans des coulisses latérales. Sa fiche technique est en cours de confirmation : les dimensions possibles, la pose et les teintes sont établies lors de l'étude de votre projet, à partir de vos mesures.",
  [at(S.pageMzn, "description"), at(S.brochure, "p. 8")], "MZN (alternative : MZH)",
  [{ code: "reveal", label: "Dans l'embrasure" }, { code: "frame", label: "En applique" }],
  [{ q: "Pour quelles ouvertures ?", a: "Fenêtres et portes. La pose (dans l'embrasure ou en applique) et les dimensions réalisables sont confirmées à l'étude de votre projet." }],
  "Moustiquaire enroulable MoskiUp pour fenêtre et porte");
const moskislide = studyRequest("moskislide", "MoskiSlide", 63, "MRP (correspondance proposée, à confirmer ; alternative MZP)", "sliding",
  "Moustiquaire à cadres coulissants pour grandes baies et portes de terrasse : présentation et demande d'étude sur mesure.",
  "MoskiSlide est une moustiquaire à vantaux coulissants entre un rail haut et un rail bas, pensée pour les grandes baies vitrées et les portes de terrasse. Sa fiche technique est en cours de confirmation : les dimensions possibles, le nombre de vantaux, la pose et les teintes sont établis lors de l'étude de votre projet.",
  [at(S.pageMrp, "description"), at(S.brochure, "p. 10")], "MRP (alternative : MZP)",
  [{ code: "frame", label: "En applique (rails haut et bas)" }],
  [{ q: "Pour quelles ouvertures ?", a: "Grandes baies vitrées et portes de terrasse. Les dimensions réalisables et le nombre de vantaux sont confirmés à l'étude de votre projet." }],
  "Moustiquaire coulissante MoskiSlide pour baie vitrée");
const moskifix = studyRequest("moskifix", "MoskiFix", 64, "MRS (correspondance proposée, à confirmer ; alternative MRSZ)", "fixed",
  "Moustiquaire à cadre fixe pour fenêtres, amovible : présentation et demande d'étude sur mesure.",
  "MoskiFix est une moustiquaire à cadre fixe qui se pose sur la fenêtre et se retire pour l'hiver ou l'entretien. Sa fiche technique est en cours de confirmation : les dimensions possibles, le mode de fixation et les teintes sont établis lors de l'étude de votre projet.",
  [at(S.pageMrs, "description"), at(S.brochure, "p. 12")], "MRS (alternative : MRSZ)",
  [{ code: "frame", label: "En applique sur le dormant" }],
  [{ q: "Pour quelles ouvertures ?", a: "Fenêtres qui ne servent pas de passage. Le mode de fixation et les dimensions réalisables sont confirmés à l'étude de votre projet." }],
  "Moustiquaire fixe MoskiFix pour fenêtre");

export const INSECT_SCREENS_2026: HelioFamily[] = [moskifold, moskifold2, moskiup, moskislide, moskifix];
