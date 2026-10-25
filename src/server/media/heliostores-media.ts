/**
 * Manifeste des médias HELIOSTORES — métadonnées publiables (aucun fichier binaire dans le dépôt).
 *
 * Les fichiers préparés (extraits des PDF fournis ou récupérés sur aluprof.com) restent dans un dossier privé
 * (`private/heliostores/media-staging/`, exclu de Git et de Docker) et sont importés dans la médiathèque par
 * `scripts/import-heliostores-media.ts`. Usage autorisé par le client pour le site HELIOSTORES (instruction du
 * 2026-10-20). Ces visuels présentent le produit du fabricant : ils ne sont jamais présentés comme des
 * réalisations installées par HELIOSTORES.
 *
 * Seules les images rattachées au modèle exact sont retenues (légende, mise en page du catalogue ou nom de
 * fichier du fabricant). Écartées : visuels « SB 400 PRO » (autre produit), image nommée « SB500 » publiée
 * sur la page SB 400 (à vérifier), illustrations génériques (étiquette énergie, façades sans produit identifiable).
 */

import { HELIOSTORES_MEDIA_2026 } from "./heliostores-media-2026";

export type MediaRole = "hero" | "gallery" | "detail" | "technical";
export type MediaNatureCode = "PHOTO" | "RENDER" | "ILLUSTRATION";

export type MediaSource =
  | { type: "pdf"; file: string; page: number; ref: string }
  | { type: "url"; url: string; pageUrl: string; retrievedAt: string };

export interface HelioMedia {
  key: string;
  /** fichier préparé dans le dossier privé */
  file: string;
  familySlug: string;
  role: MediaRole;
  nature: MediaNatureCode;
  productRepresented: string;
  alt: string;
  caption: string;
  credit: string;
  source: MediaSource;
  /** confiance du rattachement au modèle */
  match: "confirmed" | "partial";
  matchNote?: string;
  finishCode?: string;
  mounting?: "wall" | "freestanding";
  /** options visibles sur l'image (jamais comprises d'office) */
  visibleOptions?: string;
  sortOrder: number;
}

const THY = "Catalogue THYSENS (7).pdf";
const ALU_SB400 = "https://aluprof.com/en/product/sb-400";
const ALU_R120 = "https://aluprof.com/en/product/refleksol-120-ziiip";
const ALU_CASA = "https://aluprof.com/en/product/casablanca-awning";
const RETRIEVED = "2026-10-20";
const CREDIT_ALU = "Visuel fabricant ALUPROF (aluprof.com)";
const CREDIT_THY = "Catalogue THYSENS — collection SELT";
const ASSET = "https://aluprof.com/app/default/assets/images/";
const FILES = "https://aluprof.com/files/products_images/";

const pdf = (page: number, ref: string, file = THY): MediaSource => ({ type: "pdf", file, page, ref });
const url = (u: string, pageUrl: string): MediaSource => ({ type: "url", url: u, pageUrl, retrievedAt: RETRIEVED });

const HELIOSTORES_MEDIA_2025: HelioMedia[] = [
  /* Pergola SB400 */
  { key: "thy-p011-x152", file: "thy-p011-x152.jpg", familySlug: "helio-horizon", role: "hero", nature: "PHOTO", productRepresented: "SunBreaker 400", alt: "Pergola HELIO Horizon gris anthracite adossée à une maison contemporaine, lames ouvertes projetant des ombres rayées sur la terrasse", caption: "Pergola HELIO Horizon adossée.", credit: CREDIT_THY, source: pdf(11, "photo de la page SunBreaker 400 ; même photo au catalogue SB400 p. 2"), match: "confirmed", mounting: "wall", sortOrder: 0 },
  { key: "alu-sb400-01", file: "alu-sb400-01.webp", familySlug: "helio-horizon", role: "gallery", nature: "RENDER", productRepresented: "SB 400", alt: "Pergola HELIO Horizon autoportante à quatre poteaux, structure gris anthracite, vue de face", caption: "HELIO Horizon autoportante.", credit: CREDIT_ALU, source: url(`${ASSET}11335Zdj%C4%99cie_g%C5%82%C3%B3wne_CA%C5%81A_RAMKA.jpg.webp`, ALU_SB400), match: "confirmed", mounting: "freestanding", sortOrder: 10 },
  { key: "alu-sb400-26", file: "alu-sb400-26.webp", familySlug: "helio-horizon", role: "gallery", nature: "RENDER", productRepresented: "SB 400", alt: "Pergola HELIO Horizon adossée à un mur, lames fermées, vue en perspective", caption: "Version murale.", credit: CREDIT_ALU, source: url(`${FILES}78436Opcje_montazu_przyscienna.jpg.webp`, ALU_SB400), match: "confirmed", mounting: "wall", sortOrder: 20 },
  { key: "alu-sb400-25", file: "alu-sb400-25.webp", familySlug: "helio-horizon", role: "gallery", nature: "RENDER", productRepresented: "SB 400", alt: "Pergola HELIO Horizon autoportante, lames fermées, vue en perspective", caption: "Version autoportante.", credit: CREDIT_ALU, source: url(`${FILES}11693Opcje_montazu_wolnostojaca.jpg.webp`, ALU_SB400), match: "confirmed", mounting: "freestanding", sortOrder: 30 },
  { key: "alu-sb400-04", file: "alu-sb400-04.webp", familySlug: "helio-horizon", role: "gallery", nature: "RENDER", productRepresented: "SB 400", alt: "Pergola HELIO Horizon à six poteaux composée de deux modules, lames entrouvertes", caption: "Assemblage de deux modules — composition établie au devis.", credit: CREDIT_ALU, source: url(`${ASSET}Pergola-SB-400-LED-folder-2020.webp`, ALU_SB400), match: "confirmed", visibleOptions: "assemblage de plusieurs modules", sortOrder: 40 },
  { key: "alu-sb400-05", file: "alu-sb400-05.webp", familySlug: "helio-horizon", role: "detail", nature: "RENDER", productRepresented: "SB 400", alt: "Vue de dessous de la toiture à lames d'une HELIO Horizon avec éclairage LED périphérique allumé", caption: "Éclairage LED périphérique (option).", credit: CREDIT_ALU, source: url(`${ASSET}SB-400-Ledy-z-dolu.webp`, ALU_SB400), match: "confirmed", visibleOptions: "éclairage LED périphérique (option)", sortOrder: 50 },
  { key: "alu-sb400-03", file: "alu-sb400-03.webp", familySlug: "helio-horizon", role: "gallery", nature: "RENDER", productRepresented: "SB 400", alt: "Pergola HELIO Horizon à structure brune et lames blanches, vue en perspective", caption: "Exemple bicolore RAL 8014 / RAL 9016 (teinte hors standard, sur devis).", credit: CREDIT_ALU, source: url(`${ASSET}Pergola-400-LED-8014-plus-9016_1.webp`, ALU_SB400), match: "confirmed", visibleOptions: "teinte hors standard (option)", sortOrder: 60 },
  { key: "alu-sb400-02", file: "alu-sb400-02.webp", familySlug: "helio-horizon", role: "gallery", nature: "RENDER", productRepresented: "SB 400", alt: "Pergola HELIO Horizon vue de dessus en perspective, lames de toiture fermées, teinte FSM 71319", caption: "Toiture fermée, teinte FSM 71319.", credit: CREDIT_ALU, source: url(`${ASSET}Pergola400-orto-FSM-small_2.webp`, ALU_SB400), match: "confirmed", finishCode: "FSM_71319", sortOrder: 70 },
  { key: "thy-p010-x148", file: "thy-p010-x148.jpg", familySlug: "helio-horizon", role: "detail", nature: "RENDER", productRepresented: "SunBreaker 400", alt: "Détail d'angle de la HELIO Horizon : poutre, chéneau intégré et départ de poteau", caption: "Angle de structure et chéneau intégré.", credit: CREDIT_THY, source: pdf(10, "détail de la page SunBreaker 400 ; même image au catalogue SB400 p. 1"), match: "confirmed", sortOrder: 80 },
  { key: "alu-sb400-14", file: "alu-sb400-14.webp", familySlug: "helio-horizon", role: "detail", nature: "RENDER", productRepresented: "SB 400", alt: "Poutre de la HELIO Horizon ouverte montrant le moteur et le mécanisme d'entraînement des lames", caption: "Mécanisme d'entraînement des lames dans la poutre.", credit: CREDIT_ALU, source: url(`${FILES}47066nowy_dach_sb_400_plaski_copy.jpg.webp`, ALU_SB400), match: "confirmed", sortOrder: 90 },
  { key: "alu-sb400-07", file: "alu-sb400-07.webp", familySlug: "helio-horizon", role: "detail", nature: "RENDER", productRepresented: "SB 400", alt: "Détail du vérin d'orientation des lames logé le long de la poutre de la HELIO Horizon", caption: "Vérin d'orientation des lames.", credit: CREDIT_ALU, source: url(`${ASSET}widok-silnika.webp`, ALU_SB400), match: "confirmed", sortOrder: 100 },
  { key: "alu-sb400-06", file: "alu-sb400-06.webp", familySlug: "helio-horizon", role: "technical", nature: "ILLUSTRATION", productRepresented: "SB 400", alt: "Vue éclatée de l'angle d'une HELIO Horizon montrant le chéneau et l'évacuation des eaux par le poteau", caption: "Évacuation des eaux intégrée.", credit: CREDIT_ALU, source: url(`${ASSET}Pergola-SB-400-nowe-odprowadzanie-wody-odprowadzanie-wody.webp`, ALU_SB400), match: "confirmed", sortOrder: 110 },
  { key: "alu-sb400-10", file: "alu-sb400-10.webp", familySlug: "helio-horizon", role: "technical", nature: "RENDER", productRepresented: "SB 400", alt: "Profilé de poutre en aluminium de la HELIO Horizon, vue isolée", caption: "Profilé de poutre.", credit: CREDIT_ALU, source: url(`${ASSET}Pergola-400-profil-belki_1.webp`, ALU_SB400), match: "confirmed", sortOrder: 120 },
  { key: "alu-sb400-11", file: "alu-sb400-11.webp", familySlug: "helio-horizon", role: "technical", nature: "RENDER", productRepresented: "SB 400", alt: "Profilé de lame orientable en aluminium de la HELIO Horizon, vue isolée", caption: "Profilé de lame (216 mm).", credit: CREDIT_ALU, source: url(`${ASSET}Pergola-400-profil-piora_1.webp`, ALU_SB400), match: "confirmed", sortOrder: 130 },
  { key: "alu-sb400-24", file: "alu-sb400-24.webp", familySlug: "helio-horizon", role: "technical", nature: "ILLUSTRATION", productRepresented: "SB 400", alt: "HELIO Horizon avec cotes maximales : projection 7000 mm, largeur 4000 mm, hauteur 2800 mm", caption: "Dimensions maximales d'un module.", credit: CREDIT_ALU, source: url(`${FILES}50890Wymiary_Pergoli_400_kopia.jpg.webp`, ALU_SB400), match: "confirmed", sortOrder: 140 },
  { key: "thy-p010-x146", file: "thy-p010-x146.png", familySlug: "helio-horizon", role: "gallery", nature: "RENDER", productRepresented: "SunBreaker 400", alt: "Pergola HELIO Horizon autoportante détourée, lames fermées, éclairage périphérique", caption: "Vue produit.", credit: CREDIT_THY, source: pdf(10, "vue produit de la page SunBreaker 400"), match: "confirmed", visibleOptions: "éclairage LED périphérique (option)", sortOrder: 150 },

  /* Pergola SB500 — photos de la page SunBreaker 500 du catalogue (non légendées individuellement) */
  { key: "thy-p007-x130", file: "thy-p007-x130.jpg", familySlug: "helio-panorama", role: "hero", nature: "PHOTO", productRepresented: "SunBreaker 500 (selon la mise en page du catalogue)", alt: "Grande pergola à lames gris anthracite adossée à une maison en briques, store vertical baissé sur la façade, terrasse en bois", caption: "Pergola HELIO Panorama.", credit: CREDIT_THY, source: pdf(7, "photo de la page SunBreaker 500"), match: "partial", matchNote: "photo non légendée, rattachée par sa page ; le store vertical visible n'est pas inclus", visibleOptions: "store vertical en façade (non inclus)", mounting: "wall", sortOrder: 0 },
  { key: "thy-p006-x110", file: "thy-p006-x110.png", familySlug: "helio-panorama", role: "gallery", nature: "RENDER", productRepresented: "SunBreaker 500", alt: "Pergola HELIO Panorama autoportante détourée, lames fermées, éclairage périphérique", caption: "Vue produit.", credit: CREDIT_THY, source: pdf(6, "vue produit de la page SunBreaker 500"), match: "confirmed", visibleOptions: "éclairage LED périphérique (option)", mounting: "freestanding", sortOrder: 10 },
  { key: "thy-p006-x118", file: "thy-p006-x118.jpg", familySlug: "helio-panorama", role: "detail", nature: "RENDER", productRepresented: "SunBreaker 500", alt: "Détail d'angle de la HELIO Panorama : lames, poutre et éclairage intégré", caption: "Détail d'angle et lames.", credit: CREDIT_THY, source: pdf(6, "détail de la page SunBreaker 500"), match: "confirmed", visibleOptions: "éclairage LED (option)", sortOrder: 20 },

  /* Screen REFLEKSOL 120 ZiiiP */
  { key: "thy-p067-x483", file: "thy-p067-x483.jpg", familySlug: "helioscreen", role: "hero", nature: "PHOTO", productRepresented: "REFLEKSOL 120 ZiiiP (selon la mise en page du catalogue)", alt: "Séjour lumineux avec grandes baies vitrées équipées de screens gris partiellement descendus", caption: "Screen HelioScreen.", credit: CREDIT_THY, source: pdf(67, "photo de la page REFLEKSOL 120 ZiiiP ; même photo sur la page fabricant R 120 ZiiiP"), match: "partial", matchNote: "photo non légendée, rattachée par sa page", sortOrder: 0 },
  { key: "alu-r120-01", file: "alu-r120-01.webp", familySlug: "helioscreen", role: "gallery", nature: "RENDER", productRepresented: "R 120 ZiiiP", alt: "Screen HelioScreen avec coffre carré et coulisses, toile claire déroulée, teinte FSM 71319", caption: "Coffre, coulisses et toile.", credit: CREDIT_ALU, source: url(`${FILES}69695Refleksol_ZiiiP120_FSM_orto.jpg.webp`, ALU_R120), match: "confirmed", finishCode: "FSM_71319", sortOrder: 10 },
  { key: "thy-p066-x477", file: "thy-p066-x477.png", familySlug: "helioscreen", role: "gallery", nature: "RENDER", productRepresented: "REFLEKSOL 120 ZiiiP", alt: "Screen HelioScreen détouré, coffre gris anthracite et toile claire", caption: "Vue produit.", credit: CREDIT_THY, source: pdf(66, "vue produit de la page REFLEKSOL 120 ZiiiP"), match: "confirmed", sortOrder: 20 },
  { key: "alu-r120-02", file: "alu-r120-02.webp", familySlug: "helioscreen", role: "gallery", nature: "RENDER", productRepresented: "R 120 ZiiiP", alt: "Screen HelioScreen de grande dimension, toile grise déroulée", caption: "Grande dimension.", credit: CREDIT_ALU, source: url(`${ASSET}Refleksol-ZiiiP-120-Niestandardowy-.webp`, ALU_R120), match: "confirmed", sortOrder: 30 },
  { key: "alu-r120-06", file: "alu-r120-06.webp", familySlug: "helioscreen", role: "detail", nature: "RENDER", productRepresented: "R 120 ZiiiP", alt: "Vue éclatée de la coulisse en deux parties du HelioScreen avec joints et fermeture à glissière", caption: "Coulisse zip en deux parties.", credit: CREDIT_ALU, source: url(`${FILES}10520Plastex__detal__Cord.jpg.webp`, ALU_R120), match: "confirmed", sortOrder: 40 },
  { key: "alu-r120-05", file: "alu-r120-05.webp", familySlug: "helioscreen", role: "detail", nature: "RENDER", productRepresented: "R 120 ZiiiP", alt: "Détail de la coulisse avec flèches symbolisant le vent retenu par la toile", caption: "Tenue de la toile au vent.", credit: CREDIT_ALU, source: url(`${FILES}93523Refleksol_ZiiiP_Wiatr.jpg.webp`, ALU_R120), match: "confirmed", sortOrder: 50 },
  { key: "thy-p066-x479", file: "thy-p066-x479.jpg", familySlug: "helioscreen", role: "detail", nature: "RENDER", productRepresented: "REFLEKSOL 120 ZiiiP", alt: "Coupe du coffre du HelioScreen montrant le tube d'enroulement et le moteur", caption: "Coffre et tube d'enroulement.", credit: CREDIT_THY, source: pdf(66, "détail de la page REFLEKSOL 120 ZiiiP"), match: "confirmed", sortOrder: 60 },
  { key: "alu-r120-08", file: "alu-r120-08.webp", familySlug: "helioscreen", role: "detail", nature: "RENDER", productRepresented: "R 120 ZiiiP", alt: "Coffre du HelioScreen avec trappe de visite frontale ouverte", caption: "Trappe de visite frontale.", credit: CREDIT_ALU, source: url(`${FILES}77496R120_ZiiiP__rewizja.jpg.webp`, ALU_R120), match: "confirmed", sortOrder: 70 },
  { key: "alu-r120-04", file: "alu-r120-04.webp", familySlug: "helioscreen", role: "technical", nature: "ILLUSTRATION", productRepresented: "R 120 ZiiiP", alt: "Coupe cotée du coffre du HelioScreen : 126 mm", caption: "Coffre 126 mm.", credit: CREDIT_ALU, source: url(`${ASSET}69841120ziiip.jpg.webp`, ALU_R120), match: "confirmed", sortOrder: 80 },

  /* Store banne CASABLANCA */
  { key: "alu-casa-09", file: "alu-casa-09.webp", familySlug: "casablanca", role: "hero", nature: "RENDER", productRepresented: "CASABLANCA AWNING", alt: "Store banne Casablanca gris déployé au-dessus d'une terrasse en bois avec salon de jardin", caption: "Store Casablanca déployé.", credit: CREDIT_ALU, source: url("https://aluprof.com/app/default/assets/products_images/2017-08-08-wizualizacja_casablanca.webp", ALU_CASA), match: "confirmed", matchNote: "fichier nommé « wizualizacja » (visualisation) ; même image au catalogue THYSENS p. 115", mounting: "wall", sortOrder: 0 },
  { key: "alu-casa-02", file: "alu-casa-02.webp", familySlug: "casablanca", role: "gallery", nature: "RENDER", productRepresented: "CASABLANCA AWNING", alt: "Store Casablanca déployé, coffre et bras FSM 71319, toile grise", caption: "Teinte FSM 71319.", credit: CREDIT_ALU, source: url(`${ASSET}casablanca_FSM_71319.webp`, ALU_CASA), match: "confirmed", finishCode: "FSM_71319", sortOrder: 10 },
  { key: "alu-casa-06", file: "alu-casa-06.webp", familySlug: "casablanca", role: "gallery", nature: "RENDER", productRepresented: "CASABLANCA AWNING", alt: "Store Casablanca déployé, coffre et bras blancs RAL 9010, toile grise", caption: "Teinte RAL 9010.", credit: CREDIT_ALU, source: url(`${ASSET}casablanca_RAL_9010.webp`, ALU_CASA), match: "confirmed", finishCode: "RAL_9010", sortOrder: 20 },
  { key: "alu-casa-03", file: "alu-casa-03.webp", familySlug: "casablanca", role: "gallery", nature: "RENDER", productRepresented: "CASABLANCA AWNING", alt: "Store Casablanca déployé, coffre et bras beige RAL 1015, toile grise", caption: "Teinte RAL 1015.", credit: CREDIT_ALU, source: url(`${ASSET}casablanca_RAL_1015.webp`, ALU_CASA), match: "confirmed", finishCode: "RAL_1015", sortOrder: 30 },
  { key: "alu-casa-04", file: "alu-casa-04.webp", familySlug: "casablanca", role: "gallery", nature: "RENDER", productRepresented: "CASABLANCA AWNING", alt: "Store Casablanca déployé, coffre et bras marron RAL 8014, toile grise", caption: "Teinte RAL 8014.", credit: CREDIT_ALU, source: url(`${ASSET}casablanca_RAL_8014.webp`, ALU_CASA), match: "confirmed", finishCode: "RAL_8014", sortOrder: 40 },
  { key: "alu-casa-05", file: "alu-casa-05.webp", familySlug: "casablanca", role: "gallery", nature: "RENDER", productRepresented: "CASABLANCA AWNING", alt: "Store Casablanca déployé, coffre et bras gris aluminium RAL 9006, toile grise", caption: "Teinte RAL 9006.", credit: CREDIT_ALU, source: url(`${ASSET}casablanca_RAL_9006.webp`, ALU_CASA), match: "confirmed", finishCode: "RAL_9006", sortOrder: 50 },
  { key: "thy-p114-x731", file: "thy-p114-x731.png", familySlug: "casablanca", role: "gallery", nature: "RENDER", productRepresented: "CASABLANCA", alt: "Store banne Casablanca détouré, coffre ouvert et bras dépliés", caption: "Vue produit.", credit: CREDIT_THY, source: pdf(114, "vue produit de la page CASABLANCA"), match: "confirmed", sortOrder: 60 },
  { key: "alu-casa-07", file: "alu-casa-07.webp", familySlug: "casablanca", role: "detail", nature: "RENDER", productRepresented: "CASABLANCA AWNING", alt: "Coffre fermé du store Casablanca en vue transparente montrant la toile enroulée", caption: "Coffre fermé (vue transparente).", credit: CREDIT_ALU, source: url(`${ASSET}Casablanca-transparent.webp`, ALU_CASA), match: "confirmed", sortOrder: 70 },
  { key: "alu-casa-10", file: "alu-casa-10.webp", familySlug: "casablanca", role: "detail", nature: "RENDER", productRepresented: "CASABLANCA AWNING", alt: "Joue latérale et coffre fermé du store Casablanca, vue rapprochée", caption: "Coffre fermé et embout.", credit: CREDIT_ALU, source: url(`${FILES}61754Casablanca__zamykana_kaseta.jpg.webp`, ALU_CASA), match: "confirmed", sortOrder: 80 },
  { key: "alu-casa-11", file: "alu-casa-11.webp", familySlug: "casablanca", role: "detail", nature: "RENDER", productRepresented: "CASABLANCA AWNING", alt: "Articulation d'un bras du store Casablanca avec chaîne Flyer", caption: "Bras à chaînes Flyer.", credit: CREDIT_ALU, source: url(`${FILES}25617Casablanca__lancuch_flyera.jpg.webp`, ALU_CASA), match: "confirmed", sortOrder: 90 },
  { key: "alu-casa-13", file: "alu-casa-13.webp", familySlug: "casablanca", role: "technical", nature: "ILLUSTRATION", productRepresented: "CASABLANCA AWNING", alt: "Schéma coté de la pose murale du store Casablanca", caption: "Pose murale.", credit: CREDIT_ALU, source: url(`${FILES}29270dosicany.jpg.webp`, ALU_CASA), match: "confirmed", mounting: "wall", sortOrder: 100 },
  { key: "alu-casa-14", file: "alu-casa-14.webp", familySlug: "casablanca", role: "technical", nature: "ILLUSTRATION", productRepresented: "CASABLANCA AWNING", alt: "Schéma coté de la pose au plafond du store Casablanca", caption: "Pose au plafond.", credit: CREDIT_ALU, source: url(`${FILES}82666dosufitu.jpg.webp`, ALU_CASA), match: "confirmed", sortOrder: 110 },
  { key: "alu-casa-12", file: "alu-casa-12.webp", familySlug: "casablanca", role: "technical", nature: "ILLUSTRATION", productRepresented: "CASABLANCA AWNING", alt: "Schéma coté de la pose sur chevrons du store Casablanca", caption: "Pose sur chevrons.", credit: CREDIT_ALU, source: url(`${FILES}39545dokrokwi.jpg.webp`, ALU_CASA), match: "confirmed", sortOrder: 120 },
];

export const HELIOSTORES_MEDIA_AUTHORIZATION = "Utilisation autorisée par le client pour le site HELIOSTORES (instruction du 2026-10-20) — visuel fabricant / fournisseur, pas une réalisation HELIOSTORES.";

/** Manifeste complet : médias historiques et médias des modèles du 2026-10-25. */
export const HELIOSTORES_MEDIA: HelioMedia[] = [...HELIOSTORES_MEDIA_2025, ...HELIOSTORES_MEDIA_2026];
