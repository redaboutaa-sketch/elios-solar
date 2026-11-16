/**
 * Conseils de relevé par famille et par type de pose, partagés par l'outil interactif de prise de mesures et par la
 * version rendue côté serveur du guide (lisible sans JavaScript par les moteurs et assistants). Bonnes pratiques
 * génériques : aucune valeur technique ; les cotes définitives sont confirmées lors de l'étude du devis.
 */
import type { CategoryKey } from "@/domain/categories";
import { MOUNTING_FR, type SystemMounting, type SystemRules } from "@/domain/system";

export const MEASURE_FAMILY_LABEL: Record<CategoryKey, string> = { PERGOLAS: "Pergola", SCREENS: "Screen", STORES_BANNES: "Store banne", MOUSTIQUAIRES: "Moustiquaire" };

export const MEASURE_COMMON = "Mesurez en millimètres, à plusieurs endroits, et notez la plus petite valeur pour une pose entre deux appuis ; le conseiller vérifie toujours les cotes avec vous lors de l'étude du devis.";

/** Ce qu'il faut mesurer, par famille et par pose (conseils génériques de relevé, sans valeur technique inventée). */
export function measureAdvice(cat: CategoryKey, mounting: SystemMounting, type: SystemRules["type"]): string[] {
  const common = MEASURE_COMMON;
  if (cat === "PERGOLAS") return [
    "Largeur : la dimension hors tout souhaitée, le long du mur pour une pergola adossée.",
    "Avancée (projection) : depuis le mur (ou l'arrière de la structure) jusqu'à l'avant des poteaux.",
    "Hauteur : du sol fini au-dessous de la poutre ; repérez une pente éventuelle du sol.",
    mounting === "wall" ? "Pose adossée : vérifiez la nature du mur (béton, maçonnerie) et les obstacles (fenêtres, gouttières, descentes d'eau)." : "Pose autoportante : repérez l'emplacement des poteaux et la nature du sol pour les ancrages.",
    common,
  ];
  if (cat === "SCREENS" && type === "roof_blind") return [
    "Largeur : la largeur de la toiture vitrée à couvrir, entre les appuis prévus pour les coulisses.",
    "Projection : la longueur de toiture à couvrir, du coffre (côté haut) jusqu'à l'avant.",
    "Notez la pente de la toiture et la structure porteuse (véranda, pergola).",
    common,
  ];
  if (cat === "SCREENS") return [
    mounting === "niche" ? "Pose en niche (dans le tableau) : largeur entre les deux tableaux, en haut, au milieu et en bas ; hauteur du linteau à l'appui." : "Pose en façade : largeur de la baie et débord souhaité de chaque côté ; hauteur du point de fixation du coffre jusqu'au sol ou à l'appui.",
    "Repérez une alimentation électrique : le screen est motorisé.",
    common,
  ];
  if (cat === "STORES_BANNES") return [
    "Largeur : la largeur de toile souhaitée ; vérifiez la place disponible pour le coffre et les supports.",
    "Avancée : choisissez parmi les avancées fabriquées ; une grande avancée demande une largeur minimale.",
    `Pose ${MOUNTING_FR[mounting]} : vérifiez la nature et l'état du support, et la hauteur disponible au-dessus de la baie.`,
    common,
  ];
  return [
    mounting === "reveal" ? "Pose dans l'embrasure : largeur entre les tableaux et hauteur entre linteau et appui, à trois endroits ; retenez la plus petite valeur." : "Pose en applique : mesurez le dormant ou l'encadrement sur lequel la moustiquaire sera fixée.",
    "Signalez un seuil, une poignée ou un volet qui pourrait gêner.",
    common,
  ];
}
