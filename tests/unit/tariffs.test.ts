import { describe, expect, it } from "vitest";
import { checkGrid, deriveCells, deriveRatio, diffCells, effectiveState, formatAmountInput, isPublishable, parseAmountInput, periodsOverlap, roundHalfUp, type GridCheckInput, type TariffCell } from "@/domain/tariffs";

// montants FICTIFS
const cells: TariffCell[] = [
  { dimAmm: 3400, widthMinMm: 1500, widthMaxMm: 1500, amountMinor: 100_000 },
  { dimAmm: 3400, widthMinMm: 2000, widthMaxMm: 2000, amountMinor: 110_050 },
];
const params: GridCheckInput = { nature: "SALE", currency: "EUR", taxBasis: "HT", vatRateBps: 2000, catalogVatRateBps: 2000, clientele: "ALL", dimRule: "EXACT", dimRuleNote: "", validFrom: null, validTo: null, zeroConfirmed: false, family: { known: true, status: "QUOTE_ONLY" } };
const codes = (c: ReturnType<typeof checkGrid>) => c.filter((x) => x.severity === "blocking").map((x) => x.code);

describe("saisie des montants (centimes entiers, sans flottant)", () => {
  it("formats acceptés et refusés", () => {
    expect(parseAmountInput("1 234,56")).toEqual({ ok: true, minor: 123_456 });
    expect(parseAmountInput("1234.5")).toEqual({ ok: true, minor: 123_450 });
    expect(parseAmountInput("0")).toEqual({ ok: true, minor: 0 });
    expect(parseAmountInput("  ")).toEqual({ ok: true, minor: null });
    for (const bad of ["-5", "1,234", "1.234,5", "12,345", "1e3", "abc", "1 234 567 890,00"]) expect(parseAmountInput(bad).ok, bad).toBe(false);
    expect(formatAmountInput(123_405)).toBe("1234,05");
    expect(formatAmountInput(null)).toBe("");
  });
});

describe("contrôles avant publication", () => {
  it("grille complète de vente : publiable", () => {
    const c = checkGrid(params, cells);
    expect(isPublishable(c)).toBe(true);
  });

  it("cellule vide, prix nul non confirmé, doublon, chevauchement : bloquants", () => {
    expect(codes(checkGrid(params, [...cells, { dimAmm: 3600, widthMinMm: 1500, widthMaxMm: 1500, amountMinor: null }]))).toContain("empty_cells");
    const zero = [...cells, { dimAmm: 3600, widthMinMm: 1500, widthMaxMm: 1500, amountMinor: 0 }];
    expect(codes(checkGrid(params, zero))).toContain("zero_cells");
    expect(codes(checkGrid({ ...params, zeroConfirmed: true }, zero))).not.toContain("zero_cells");
    expect(codes(checkGrid(params, [...cells, cells[0]!]))).toContain("duplicate_cells");
    expect(codes(checkGrid(params, [{ dimAmm: 1600, widthMinMm: 2000, widthMaxMm: 2900, amountMinor: 1 }, { dimAmm: 1600, widthMinMm: 2900, widthMaxMm: 3500, amountMinor: 2 }]))).toContain("overlapping_widths");
    expect(codes(checkGrid(params, []))).toContain("no_cells");
  });

  it("nature, devise ou base fiscale non établies : bloquants ; prix conseillé non publiable", () => {
    expect(codes(checkGrid({ ...params, nature: "UNKNOWN", currency: null, taxBasis: "UNKNOWN" }, cells))).toEqual(expect.arrayContaining(["nature_unknown", "currency_missing", "tax_unknown"]));
    expect(codes(checkGrid({ ...params, nature: "RECOMMENDED" }, cells))).toContain("nature_not_publishable");
    expect(codes(checkGrid({ ...params, currency: "euro" }, cells))).toContain("currency_invalid");
  });

  it("lecture à la dimension supérieure : justification obligatoire ; période cohérente ; brouillon obsolète", () => {
    expect(codes(checkGrid({ ...params, dimRule: "ROUND_UP" }, cells))).toContain("dim_rule_unconfirmed");
    expect(codes(checkGrid({ ...params, dimRule: "ROUND_UP", dimRuleNote: "Confirmé par écrit le …" }, cells))).not.toContain("dim_rule_unconfirmed");
    const now = new Date("2026-10-23T10:00:00Z");
    expect(codes(checkGrid({ ...params, now, validFrom: new Date("2026-11-01"), validTo: new Date("2026-10-30") }, cells))).toContain("validity_inverted");
    expect(codes(checkGrid({ ...params, now, validTo: new Date("2026-10-01") }, cells))).toContain("validity_past");
    expect(codes(checkGrid({ ...params, stale: { activeVersion: 4 } }, cells))).toContain("stale_draft");
  });

  it("avertissements : TVA du catalogue, coût d'achat interne, produit non publié", () => {
    const w = (p: Partial<GridCheckInput>) => checkGrid({ ...params, ...p }, cells).filter((c) => c.severity === "warning").map((c) => c.code);
    expect(w({ vatRateBps: null })).toContain("vat_default");
    expect(w({ nature: "PURCHASE" })).toContain("purchase_internal");
    expect(w({ family: { known: true, status: "DRAFT" } })).toContain("family_not_public");
  });
});

describe("comparaison et recalcul", () => {
  it("différences : modifiées, ajoutées, retirées (non tarifées), identiques", () => {
    const next: TariffCell[] = [{ ...cells[0]!, amountMinor: 100_500 }, { dimAmm: 3600, widthMinMm: 1500, widthMaxMm: 1500, amountMinor: 120_000 }];
    const d = diffCells(cells, next);
    expect(d.changed).toEqual([{ dimAmm: 3400, widthMinMm: 1500, widthMaxMm: 1500, before: 100_000, after: 100_500 }]);
    expect(d.added.map((c) => c.dimAmm)).toEqual([3600]);
    expect(d.removed.map((c) => c.widthMaxMm)).toEqual([2000]);
    expect(diffCells(cells, cells)).toMatchObject({ unchanged: 2, changed: [], added: [], removed: [] });
  });

  it("trois règles distinctes, arrondi au centime demi supérieur, calcul exact", () => {
    expect(roundHalfUp(1, 1n, 2n)).toBe(1); // 0,5 centime → 1
    expect(roundHalfUp(3, 1n, 2n)).toBe(2); // 1,5 → 2
    const coef = deriveCells(cells, "coefficient", "1,1");
    expect(coef.ok && coef.cells.map((c) => c.amountMinor)).toEqual([110_000, 121_055]);
    // majoration de 25 % sur coût : coût × 1,25 ; marge de 25 % sur prix de vente : coût ÷ 0,75
    const markup = deriveCells([{ ...cells[0]!, amountMinor: 100_000 }], "markup_on_cost", "25");
    const margin = deriveCells([{ ...cells[0]!, amountMinor: 100_000 }], "margin_on_price", "25");
    expect(markup.ok && markup.cells[0]!.amountMinor).toBe(125_000);
    expect(margin.ok && margin.cells[0]!.amountMinor).toBe(133_333);
    expect(deriveRatio("margin_on_price", "100").ok).toBe(false);
    expect(deriveRatio("coefficient", "0").ok).toBe(false);
    expect(deriveRatio("coefficient", "abc").ok).toBe(false);
    const empty = deriveCells([{ ...cells[0]!, amountMinor: null }], "coefficient", "2");
    expect(empty.ok && empty.cells[0]!.amountMinor).toBeNull(); // une cellule vide reste vide
  });
});

describe("statut et périodes", () => {
  const now = new Date("2026-10-23T10:00:00Z");
  it("statut affiché d'une version", () => {
    const v = (status: string, from: string | null, to: string | null, deact = false) => effectiveState({ status, validFrom: from ? new Date(from) : null, validTo: to ? new Date(to) : null, deactivatedAt: deact ? now : null }, now);
    expect(v("ACTIVE", "2026-10-01", null)).toBe("in_force");
    expect(v("ACTIVE", "2026-11-01", null)).toBe("scheduled");
    expect(v("ACTIVE", "2026-01-01", "2026-10-01")).toBe("expired");
    expect(v("ARCHIVED", null, null, true)).toBe("deactivated");
    expect(v("VERIFIED", null, null)).toBe("verified");
  });
  it("chevauchement de périodes [début, fin[", () => {
    const d = (s: string) => new Date(s);
    expect(periodsOverlap({ from: d("2026-01-01"), to: null }, { from: d("2026-06-01"), to: null })).toBe(true);
    expect(periodsOverlap({ from: d("2026-01-01"), to: d("2026-06-01") }, { from: d("2026-06-01"), to: null })).toBe(false);
  });
});
