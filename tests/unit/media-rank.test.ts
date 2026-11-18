import { describe, expect, it } from "vitest";
import { rankProductMedia, scoreProductMedia } from "@/server/media/rank";
import { latestPerGroup, canTransition } from "@/server/documents/versions";

const items = [
  { id: "generic", role: "gallery", sortOrder: 0 },
  { id: "white-wall", role: "gallery", sortOrder: 1, finishCode: "WHITE", mounting: "wall" },
  { id: "anth-free", role: "gallery", sortOrder: 2, finishCode: "ANTHRACITE", mounting: "freestanding" },
  { id: "anth-hero", role: "hero", sortOrder: 5, finishCode: "ANTHRACITE" },
  { id: "black", role: "gallery", sortOrder: 0, finishCode: "BLACK" },
];

describe("rankProductMedia", () => {
  it("met en premier les médias correspondant à la finition et à l'implantation, puis l'ordre", () => {
    const r = rankProductMedia(items, { finishCode: "ANTHRACITE", mounting: "freestanding" }).map((i) => i.id);
    expect(r[0]).toBe("anth-free"); // finition + implantation
    expect(r[1]).toBe("anth-hero"); // finition seule
    expect(r[2]).toBe("generic"); // neutre
    // les finitions différentes sont écartées puisqu'une correspondance existe
    expect(r).not.toContain("white-wall");
    expect(r).not.toContain("black");
  });

  it("sans correspondance de finition, garde les autres finitions après les médias neutres ; l'implantation reste discriminante", () => {
    const r = rankProductMedia(items, { finishCode: "ANTHRACITE_WHITE_BLADES", mounting: "wall" }).map((i) => i.id);
    // « white-wall » correspond à l'implantation → les médias ciblés « freestanding » sont écartés
    expect(r).not.toContain("anth-free");
    expect(r).toEqual(["generic", "white-wall", "anth-hero", "black"]);
  });

  it("calcule le score : variante > finition > implantation, mauvaise valeur pénalisée", () => {
    expect(scoreProductMedia({ sortOrder: 0, variantSku: "A", finishCode: "W", mounting: "wall" }, { variantSku: "A", finishCode: "W", mounting: "wall" })).toBe(14);
    expect(scoreProductMedia({ sortOrder: 0, finishCode: "W" }, { finishCode: "B" })).toBe(-4);
    expect(scoreProductMedia({ sortOrder: 0 }, { finishCode: "B" })).toBe(0);
    expect(scoreProductMedia({ sortOrder: 0, mounting: "wall" }, {})).toBe(0);
  });

  it("sans contexte : rôle hero d'abord, puis sortOrder, puis ordre du média, sans écarter personne", () => {
    const r = rankProductMedia([
      { id: "b", sortOrder: 1, mediaSortOrder: 0 },
      { id: "a", sortOrder: 1, mediaSortOrder: -1 },
      { id: "h", role: "hero", sortOrder: 9 },
      { id: "c", sortOrder: 0 },
    ]).map((i) => i.id);
    expect(r).toEqual(["h", "c", "a", "b"]);
  });

  it("ne modifie pas le tableau d'entrée", () => {
    const copy = [...items];
    rankProductMedia(items, { finishCode: "WHITE" });
    expect(items).toEqual(copy);
  });
});

describe("latestPerGroup", () => {
  it("retient la version la plus élevée de chaque groupe", () => {
    const r = latestPerGroup([
      { groupKey: "g1", version: 1 },
      { groupKey: "g2", version: 3 },
      { groupKey: "g1", version: 2 },
      { groupKey: "g2", version: 2 },
    ]);
    expect(r).toEqual([{ groupKey: "g1", version: 2 }, { groupKey: "g2", version: 3 }]);
  });
  it("transitions du cycle de vie", () => {
    expect(canTransition("DRAFT", "REVIEW")).toBe(true);
    expect(canTransition("DRAFT", "PUBLISHED")).toBe(false);
    expect(canTransition("REVIEW", "PUBLISHED")).toBe(true);
    expect(canTransition("PUBLISHED", "ARCHIVED")).toBe(true);
    expect(canTransition("PUBLISHED", "DRAFT")).toBe(false);
  });
});
