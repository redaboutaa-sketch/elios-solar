/** Helpers purs sur le versionnage des documents (un `groupKey` = une lignée de versions). */
export interface VersionedDoc {
  groupKey: string;
  version: number;
}

/** Dernière version de chaque groupe (la plus élevée), dans l'ordre d'apparition des groupes. */
export function latestPerGroup<T extends VersionedDoc>(docs: readonly T[]): T[] {
  const best = new Map<string, T>();
  for (const d of docs) {
    const cur = best.get(d.groupKey);
    if (!cur || d.version > cur.version) best.set(d.groupKey, d);
  }
  return [...best.values()];
}

export const DOCUMENT_KINDS = ["notice", "notice_montage", "fiche_technique", "guide_mesure", "video", "certificat", "garantie", "guide", "autre"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_KIND_FR: Record<string, string> = { notice: "Notice", notice_montage: "Notice de montage (PDF)", guide_mesure: "Guide de mesure", video: "Vidéo", fiche_technique: "Fiche technique", certificat: "Certificat", garantie: "Garantie", guide: "Guide", declaration_performance: "Déclaration des performances (fabricant)", brochure: "Brochure (fabricant)", autre: "Autre" };
export const DOCUMENT_STATUS_FR: Record<string, string> = { DRAFT: "Brouillon", REVIEW: "En relecture", PUBLISHED: "Publié", ARCHIVED: "Archivé" };
export const DOCUMENT_AUDIENCE_FR: Record<string, string> = { PUBLIC: "Public", CUSTOMER: "Clients", INTERNAL: "Interne" };

/** Transitions autorisées du cycle de vie : DRAFT → REVIEW → PUBLISHED → ARCHIVED (retour en brouillon possible depuis la relecture). */
export const DOCUMENT_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["PUBLISHED", "DRAFT"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function canTransition(from: string, to: string): boolean {
  return (DOCUMENT_TRANSITIONS[from] ?? []).includes(to);
}

export const DOCUMENT_STATUSES = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] as const;
export const DOCUMENT_AUDIENCES = ["PUBLIC", "CUSTOMER", "INTERNAL"] as const;
export const DATA_STATUSES = ["DEMO", "SUPPLIER_VERIFIED", "OBSERVED", "UNKNOWN"] as const;
