/**
 * Classement des médias d'une fiche produit selon le contexte affiché (finition, implantation,
 * variante). Fonction pure, sans dépendance serveur : testable unitairement.
 *
 * Règles :
 *  - un média ciblé sur la finition / l'implantation / la variante affichée passe devant ;
 *  - un média non ciblé (champ vide) reste neutre ;
 *  - dès qu'au moins un média correspond exactement à un critère, les médias ciblés sur une
 *    AUTRE valeur de ce critère sont écartés (on n'affiche pas une pergola blanche quand le
 *    client regarde l'anthracite) ; sans correspondance, ils restent, classés après ;
 *  - à score égal : rôle « hero » d'abord, puis `sortOrder` de l'association, puis `sortOrder` du média.
 */
export interface RankableMedia {
  role?: string | null;
  sortOrder: number;
  variantSku?: string | null;
  finishCode?: string | null;
  mounting?: string | null;
  /** ordre d'affichage propre au média (table Media) */
  mediaSortOrder?: number | null;
}

export interface RankContext {
  finishCode?: string | null;
  mounting?: string | null;
  variantSku?: string | null;
}

const WEIGHTS = { variantSku: 8, finishCode: 4, mounting: 2 } as const;
type Criterion = keyof typeof WEIGHTS;

function matchOf(item: RankableMedia, ctx: RankContext, c: Criterion): "match" | "neutral" | "mismatch" {
  const wanted = ctx[c];
  const value = item[c];
  if (!value || !wanted) return "neutral";
  return value === wanted ? "match" : "mismatch";
}

export function scoreProductMedia(item: RankableMedia, ctx: RankContext): number {
  let score = 0;
  for (const c of Object.keys(WEIGHTS) as Criterion[]) {
    const m = matchOf(item, ctx, c);
    if (m === "match") score += WEIGHTS[c];
    else if (m === "mismatch") score -= WEIGHTS[c];
  }
  return score;
}

export function rankProductMedia<T extends RankableMedia>(items: readonly T[], ctx: RankContext = {}): T[] {
  const criteria = Object.keys(WEIGHTS) as Criterion[];
  // critères pour lesquels au moins un média correspond exactement → les mauvaises valeurs sont écartées
  const exclusive = new Set(criteria.filter((c) => items.some((i) => matchOf(i, ctx, c) === "match")));
  const kept = items.filter((i) => !criteria.some((c) => exclusive.has(c) && matchOf(i, ctx, c) === "mismatch"));
  return kept
    .map((item, index) => ({ item, index, score: scoreProductMedia(item, ctx) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ha = a.item.role === "hero" ? 0 : 1, hb = b.item.role === "hero" ? 0 : 1;
      if (ha !== hb) return ha - hb;
      if (a.item.sortOrder !== b.item.sortOrder) return a.item.sortOrder - b.item.sortOrder;
      const ma = a.item.mediaSortOrder ?? 0, mb = b.item.mediaSortOrder ?? 0;
      if (ma !== mb) return ma - mb;
      return a.index - b.index;
    })
    .map((x) => x.item);
}
