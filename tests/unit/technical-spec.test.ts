import { describe, expect, it } from "vitest";
import { confirmedSpec, formatSpecValue, includedCablePublicText, reviewSpec, type TechnicalSpecValue } from "@/domain/technical-spec";
import { buildDemoCatalog } from "@/server/catalog/demo-data";

const base = { key: "included_cable_length", label: "Longueur du câble", unit: "mm" };
const demo: TechnicalSpecValue = { ...base, valueNum: 3000, source: "demo_seed" };
const observed: TechnicalSpecValue = { ...base, valueNum: 7500, source: "observed_reference", observedAt: "2026-10-19" };
const supplier = (mm: number): TechnicalSpecValue => ({ ...base, valueNum: mm, source: "supplier_confirmed", sourceRef: "doc" });

describe("données techniques sourcées", () => {
  it("démo et observation divergentes : conflit signalé, rien de public", () => {
    const r = reviewSpec([demo, observed], base.key, "longueur à confirmer")!;
    expect(r.conflict).toBe(true);
    expect(r.confirmed).toBeNull();
    expect(r.publicText).toBe("longueur à confirmer");
  });
  it("une observation seule ne devient pas une spécification", () => {
    expect(confirmedSpec([observed], base.key)).toBeNull();
    expect(includedCablePublicText([observed])).toBe("longueur à confirmer");
  });
  it("deux confirmations fournisseur contradictoires restent à confirmer", () => {
    expect(confirmedSpec([supplier(7500), supplier(5000)], base.key)).toBeNull();
    expect(includedCablePublicText([supplier(7500), supplier(5000)])).toBe("longueur à confirmer");
  });
  it("confirmation fournisseur : valeur publiée, formatée", () => {
    expect(includedCablePublicText([demo, observed, supplier(7500)])).toBe("7,5 m");
    expect(formatSpecValue({ valueNum: 1500, unit: "W" })).toMatch(/^1\s500 W$/);
  });
  it("caractéristique absente : pas de ligne", () => {
    expect(includedCablePublicText([])).toBeNull();
  });
  it("jeu de démo : aucune caractéristique publique ne porte une longueur de câble chiffrée", () => {
    const c = buildDemoCatalog();
    for (const f of c.families) for (const s of f.specs ?? []) if (/câble/i.test(s.value)) expect(s.value).not.toMatch(/\d+([,.]\d+)?\s?m\b/);
    const awning = c.families.find((f) => f.slug === "store-banne-ombra")!;
    expect(new Set(awning.technicalSpecs!.map((s) => s.source))).toEqual(new Set(["demo_seed", "observed_reference"]));
  });
});
