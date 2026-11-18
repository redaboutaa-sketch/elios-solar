import { describe, expect, it } from "vitest";
import { colourInfo, colourLabel } from "@/domain/colours";
import { HELIOSTORES_FAMILIES } from "@/server/catalog/heliostores-data";

describe("teintes du configurateur", () => {
  it("code, nom RAL Classic et aspect ; aucun nom inventé pour un code hors RAL", () => {
    expect(colourInfo("RAL 7016 mat")).toEqual({ code: "RAL 7016", name: "Gris anthracite", finish: "mat" });
    expect(colourInfo("RAL 9016")).toEqual({ code: "RAL 9016", name: "Blanc signalisation", finish: null });
    expect(colourInfo("FSM 71319")).toEqual({ code: "FSM 71319", name: null, finish: null });
    expect(colourInfo("Décor bois (option)")).toEqual({ code: null, name: "Décor bois (option)", finish: null });
    expect(colourLabel("RAL 8014 mat")).toBe("Brun sépia · RAL 8014 · mat");
  });

  it("chaque teinte RAL proposée par un modèle actuel a son nom normalisé", () => {
    const labels = HELIOSTORES_FAMILIES.filter((f) => !f.retired).flatMap((f) => f.rules.finishes.map((x) => x.label));
    for (const l of labels.filter((x) => /^RAL \d{4}/.test(x))) expect(colourInfo(l).name, l).not.toBeNull();
  });
});
