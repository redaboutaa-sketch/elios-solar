import { describe, expect, it } from "vitest";
import { canTransition, canonicalJson, commercialChecklist, dataHash, diffProposal, nextStatuses, resultingDataStatus, sanitizeProposal, validationBlockers, type DecisionInput } from "@/server/validation/core";

describe("empreinte canonique des données", () => {
  it("indépendante de l'ordre des clés, sensible aux valeurs", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { y: 1, x: 0 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"x":0,"y":1}]},"b":1}');
    expect(dataHash({ a: 1, b: 2 })).toBe(dataHash({ b: 2, a: 1 }));
    expect(dataHash({ a: 1, b: 2 })).not.toBe(dataHash({ a: 1, b: 3 }));
    expect(dataHash({ a: 1, u: undefined })).toBe(dataHash({ a: 1 }));
    expect(dataHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("diff champ par champ", () => {
  it("compare les seules valeurs proposées, objets aplatis", () => {
    const rows = diffProposal({ priceCents: 100, label: "A", attributes: { assembly: "modular", modules: 2 } }, { priceCents: 120, attributes: { modules: 2, usableWidthMm: 4640 } });
    expect(rows).toEqual([
      { field: "attributes.modules", current: 2, proposed: 2, changed: false },
      { field: "attributes.usableWidthMm", current: null, proposed: 4640, changed: true },
      { field: "priceCents", current: 100, proposed: 120, changed: true },
    ]);
  });
});

describe("transitions", () => {
  it("brouillon → à vérifier → validé / rejeté ; états finaux figés", () => {
    expect(canTransition("DRAFT", "TO_REVIEW")).toBe(true);
    expect(canTransition("DRAFT", "VALIDATED")).toBe(false);
    expect(canTransition("TO_REVIEW", "VALIDATED")).toBe(true);
    expect(canTransition("TO_REVIEW", "DRAFT")).toBe(true);
    expect(canTransition("TO_REVIEW", "REJECTED")).toBe(true);
    expect(nextStatuses("VALIDATED")).toEqual([]);
    expect(nextStatuses("REJECTED")).toEqual([]);
  });
});

describe("garde-fous", () => {
  const ok: DecisionInput = { status: "TO_REVIEW", sourceKind: "SUPPLIER_DOCUMENT", documentId: "doc1", documentPublished: true, sourceUrl: null, sourceNote: "", baseHash: "h", currentHash: "h", targetType: "VARIANT", proposed: { priceCents: 1 } };
  it("une observation ne donne jamais « vérifié fournisseur »", () => {
    expect(resultingDataStatus("OBSERVED_REFERENCE")).toBe("OBSERVED");
    expect(resultingDataStatus("SUPPLIER_WRITTEN")).toBe("SUPPLIER_VERIFIED");
    expect(resultingDataStatus("OTHER")).toBeNull();
    expect(resultingDataStatus(null)).toBeNull();
  });
  it("dossier complet validable ; données changées depuis la proposition = refus", () => {
    expect(validationBlockers(ok)).toEqual([]);
    expect(validationBlockers({ ...ok, currentHash: "autre" }).join(" ")).toMatch(/données ont changé/);
  });
  it("source absente, document manquant ou non publié, état incorrect : refus", () => {
    expect(validationBlockers({ ...ok, sourceKind: null })).not.toEqual([]);
    expect(validationBlockers({ ...ok, documentId: null }).join(" ")).toMatch(/sans document/);
    expect(validationBlockers({ ...ok, documentPublished: false }).join(" ")).toMatch(/pas publié/);
    expect(validationBlockers({ ...ok, status: "DRAFT" })).not.toEqual([]);
    expect(validationBlockers({ ...ok, sourceKind: "SUPPLIER_WRITTEN", documentId: null, sourceNote: "" }).join(" ")).toMatch(/Écrit fournisseur/);
  });
  it("donnée technique sans valeur proposée : refus", () => {
    expect(validationBlockers({ ...ok, targetType: "FAMILY_SPEC", proposed: {} }).join(" ")).toMatch(/aucune valeur/);
  });
  it("« achetable » n'est jamais proposable", () => {
    const r = sanitizeProposal("VARIANT", { purchasable: "true", priceCents: "129000", availability: "NOPE", attributes: '{"modules":2}' });
    expect(r.proposed).toEqual({ priceCents: 129000, attributes: { modules: 2 } });
    expect(r.errors.join(" ")).toMatch(/Disponibilité/);
    expect(validationBlockers({ ...ok, proposed: { purchasable: true } }).join(" ")).toMatch(/achetable/);
  });
  it("checklist commercialisable : une référence démo validée reste non vendable", () => {
    const c = commercialChecklist({ dataStatus: "DEMO", availability: "TO_CONFIRM", leadSource: "UNKNOWN", leadMinDays: null, leadMaxDays: null, purchasable: false }, 2);
    expect(c.ready).toBe(false);
    expect(c.items.filter((i) => !i.ok).map((i) => i.key)).toEqual(["price", "availability", "compat", "notDemo", "purchasable"]);
    const v = commercialChecklist({ dataStatus: "SUPPLIER_VERIFIED", availability: "AVAILABLE", leadSource: "SUPPLIER_VERIFIED", leadMinDays: 5, leadMaxDays: 10, purchasable: false }, 0);
    expect(v.items.filter((i) => !i.ok).map((i) => i.key)).toEqual(["purchasable"]);
  });
});
