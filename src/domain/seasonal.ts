/**
 * Habillage saisonnier léger (retour client : décoration Halloween). Désactivé par défaut : il ne s'affiche que si un
 * thème est choisi dans les réglages ET que la date courante est dans la période [début, fin] (bornes incluses).
 * Une période absente ou incomplète = inactif (aucun affichage « permanent » oublié après la saison).
 */
export const SEASONAL_THEMES = { halloween: "Halloween" } as const;
export type SeasonalTheme = keyof typeof SEASONAL_THEMES;

export interface SeasonalSettings {
  seasonalTheme?: string | null;
  seasonalStartsAt?: Date | null;
  seasonalEndsAt?: Date | null;
}

export function isSeasonalTheme(v: unknown): v is SeasonalTheme {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(SEASONAL_THEMES, v);
}

export function activeSeasonalTheme(s: SeasonalSettings | null | undefined, now: Date = new Date()): SeasonalTheme | null {
  if (!s || !isSeasonalTheme(s.seasonalTheme)) return null;
  const from = s.seasonalStartsAt, to = s.seasonalEndsAt;
  if (!from || !to || from.getTime() > to.getTime()) return null;
  const t = now.getTime();
  return t >= from.getTime() && t <= to.getTime() ? s.seasonalTheme : null;
}
