/**
 * Dossiers de validation initiaux (idempotent, appelé par prisma/seed.ts) : uniquement des dossiers « à vérifier »,
 * sans aucune valeur proposée comme confirmée. Imports relatifs (exécuté par tsx hors Next).
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { loadTarget, specTargetId } from "./targets";
import type { TargetType } from "./core";

const SEED_NOTE = "Dossier initial du jeu de démonstration";

const DOSSIERS: Array<{ type: TargetType; id: string; note: string }> = [
  {
    type: "FAMILY_SPEC",
    id: specTargetId("helio-ombra", "width_max"),
    note: "Contradiction de sources HELIOSTORES : fiche transmise par le client = 4 m (barre anti-vent) / 3,5 m (guidage câble) ; catalogue THYSENS p. 66 et page fabricant R 120 ZiiiP = 7 m. Le configurateur accepte jusqu'à 7 m mais signale toute largeur > 4 m « à valider au devis ». Joindre un écrit fournisseur pour trancher.",
  },
  {
    type: "FAMILY_SPEC",
    id: specTargetId("helio-ombra", "height_max"),
    note: "Contradiction : page fabricant R 120 ZiiiP = 4 m (caractéristiques) et « height of up to 3 m » (texte) ; catalogue et fiche = 4 m. Le configurateur accepte jusqu'à 4 m et signale toute hauteur > 3 m « à confirmer ». Écrit fournisseur attendu.",
  },
  {
    type: "FAMILY_SPEC",
    id: specTargetId("helio-horizon", "height_max"),
    note: "Contradiction : page fabricant et catalogue = 2,8 m ; déclaration des performances P/SB400/25 = dimensions maximales 7000 × 4000 × 3020 mm. Le configurateur accepte jusqu'à 3 020 mm et signale toute hauteur > 2,8 m « à confirmer ». Écrit fournisseur attendu.",
  },
  {
    type: "FAMILY_SPEC",
    id: specTargetId("helio-panorama", "manufacturer_reference"),
    note: "Référence à confirmer : la SB500 figure au catalogue THYSENS (SELT) et dans le kit LED SELT, mais aluprof.com ne publie que SB 350 / 400 / 450 / 550. Ne pas assimiler la SB 550 à la SB500 sans écrit du fournisseur.",
  },
  {
    type: "FAMILY_SPEC",
    id: specTargetId("helio-riviera", "drive"),
    note: "Motorisation à confirmer : la fiche transmise décrit la manivelle (150 / 180 / 220 cm) ; le catalogue et la page fabricant citent une commande électrique sans préciser le moteur. Version électrique maintenue « à confirmer » au devis.",
  },
  {
    type: "FAMILY_SPEC",
    id: specTargetId("helio-horizon", "side_panels"),
    note: "Compatibilité pergola / screen : le fabricant cite des panneaux latéraux « Slide, systèmes Ziiip ou Sunbreaker 210 » pour la SB 400 sans désigner de modèle. Confirmer si le REFLEKSOL 120 ZiiiP (et quelles fixations, cotes utiles, kits) s'adapte aux ouvertures de la SB400.",
  },
  {
    type: "FAMILY_SPEC",
    id: specTargetId("helio-panorama", "side_panels"),
    note: "Compatibilité pergola / screen : le catalogue cite la paroi coulissante SLIDE (jusqu'à 2,8 m) pour la SB500 ; aucune source ne documente un screen REFLEKSOL 120 ZiiiP sur la SB500. Confirmer modèles, fixations et cotes utiles.",
  },
  {
    type: "FAMILY_SPEC",
    id: specTargetId("store-banne-ombra", "included_cable_length"),
    note: `${SEED_NOTE}. Conflit : 3 m (valeur fictive du seed) / 7,5 m (observé sur la fiche de référence, sortie gauche). Aucune spécification fournisseur : la longueur reste « à confirmer » sur le site. Joindre la fiche technique fournisseur pour valider.`,
  },
  {
    type: "VARIANT",
    id: "ES-PA-5M-ANT-AUT",
    note: `${SEED_NOTE}. Persienne 5 m : assemblage de 2 modules avec poteau intermédiaire, cotes utiles et kit de fixation à confirmer par le fournisseur (composition, poteau, fixations, couleurs).`,
  },
  {
    type: "VARIANT",
    id: "ES-PA-6M-ANT-AUT",
    note: `${SEED_NOTE}. Persienne 6 m : assemblage de 2 modules de 3 m avec poteau intermédiaire, à confirmer par le fournisseur.`,
  },
];

export async function seedReferenceValidations(prisma: PrismaClient): Promise<number> {
  let created = 0;
  for (const d of DOSSIERS) {
    const exists = await prisma.referenceValidation.count({ where: { targetType: d.type, targetId: d.id } });
    if (exists) continue;
    const target = await loadTarget(prisma, d.type, d.id);
    if (!target) continue;
    await prisma.referenceValidation.create({
      data: {
        targetType: d.type, targetId: d.id, targetLabel: target.label, familySlug: target.familySlug, baseData: target.data as never, baseHash: target.hash, proposed: {},
        sourceKind: null, sourceNote: d.note, status: "TO_REVIEW",
        events: { create: [{ fromStatus: null, toStatus: "DRAFT", actorEmail: "seed", note: "Dossier créé", dataHash: target.hash }, { fromStatus: "DRAFT", toStatus: "TO_REVIEW", actorEmail: "seed", note: "À vérifier : en attente d'une source fournisseur", dataHash: target.hash }] },
      },
    });
    created++;
  }
  return created;
}
