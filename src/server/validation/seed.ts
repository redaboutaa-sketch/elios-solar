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
