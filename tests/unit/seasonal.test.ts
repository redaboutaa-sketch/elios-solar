import { describe, expect, it } from "vitest";
import { activeSeasonalTheme } from "@/domain/seasonal";

const d = (s: string) => new Date(s);

describe("habillage saisonnier", () => {
  const halloween = { seasonalTheme: "halloween", seasonalStartsAt: d("2026-10-20T00:00:00"), seasonalEndsAt: d("2026-10-31T23:59:59.999") };

  it("désactivé par défaut (aucun thème, période absente ou incomplète)", () => {
    expect(activeSeasonalTheme(null)).toBeNull();
    expect(activeSeasonalTheme({ seasonalTheme: "", seasonalStartsAt: null, seasonalEndsAt: null })).toBeNull();
    expect(activeSeasonalTheme({ seasonalTheme: "halloween", seasonalStartsAt: null, seasonalEndsAt: null }, d("2026-10-31T12:00:00"))).toBeNull();
    expect(activeSeasonalTheme({ seasonalTheme: "halloween", seasonalStartsAt: d("2026-10-20T00:00:00"), seasonalEndsAt: null }, d("2026-10-31T12:00:00"))).toBeNull();
  });

  it("actif seulement dans la période, bornes incluses", () => {
    expect(activeSeasonalTheme(halloween, d("2026-10-19T23:59:00"))).toBeNull();
    expect(activeSeasonalTheme(halloween, d("2026-10-20T00:00:00"))).toBe("halloween");
    expect(activeSeasonalTheme(halloween, d("2026-10-31T23:59:00"))).toBe("halloween");
    expect(activeSeasonalTheme(halloween, d("2026-11-01T00:00:01"))).toBeNull();
  });

  it("thème inconnu ou période inversée : inactif", () => {
    expect(activeSeasonalTheme({ ...halloween, seasonalTheme: "noel" }, d("2026-10-25T12:00:00"))).toBeNull();
    expect(activeSeasonalTheme({ ...halloween, seasonalStartsAt: halloween.seasonalEndsAt, seasonalEndsAt: halloween.seasonalStartsAt }, d("2026-10-25T12:00:00"))).toBeNull();
  });
});
