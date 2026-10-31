import { describe, expect, it } from "vitest";
import { isNormalizedHeader, parseCsv, parseNormalizedRows, productMatcher } from "@/server/supplier-prices/normalized";
import { deriveCells } from "@/domain/tariffs";

const HEAD = "ref_fournisseur;produit;variante;type_ligne;code;libelle;dimension_a;unite;dim_a;largeur_min;largeur_max;montant;devise;base;nature;remise_fournisseur_pct;inclus;regle;source_document;source_localisation;valide_du;valide_au";
const opts = { fileName: "selt-test.csv", productOf: productMatcher([{ slug: "marbella", supplierRef: "SB450" }, { slug: "malaga", supplierRef: "SB350" }]), knownProducts: new Set(["marbella", "malaga"]) };
const parse = (...lines: string[]) => parseNormalizedRows(parseCsv([HEAD, ...lines].join("\n")), opts);
// montants fictifs atypiques (jamais des tarifs réels)
const ROW = "SB 450;;Autoportante;grille;;Grille test;projection;cm;300;250;300;\"12 345,67\";EUR;HT;catalogue_fournisseur;;moteur, télécommande;cote exacte;Catalogue test 2027;p. 12, ligne 3;01/01/2027;31/12/2027";

describe("format tarifaire normalisé (catalogues fournisseur)", () => {
  it("lit le CSV (guillemets, « ; »), convertit les unités, rapproche le produit par sa référence fournisseur", () => {
    expect(parseCsv('a;b\n"x;y";"dit ""z"""\n')).toEqual([["a", "b"], ["x;y", 'dit "z"']]);
    expect(isNormalizedHeader(HEAD.split(";"))).toBe(true);
    const s = parse(ROW);
    expect(s.type).toBe("normalized");
    expect(s.currency).toBe("EUR");
    expect(s.taxBasis).toBe("HT");
    expect(s.validity).toEqual({ from: "2027-01-01", to: "2027-12-31" });
    const [r] = s.rows;
    expect(r).toMatchObject({ familySlug: "marbella", variantKey: "autoportante", kind: "GRID", dimAKey: "projection", dimAmm: 3000, widthMinMm: 2500, widthMaxMm: 3000, amountMinor: 1_234_567, amountRole: "CATALOGUE_FOURNISSEUR", status: "OK" });
    expect(r!.conditions).toMatchObject({ supplierRef: "SB 450", included: "moteur, télécommande", rule: "cote exacte", source: { document: "Catalogue test 2027", location: "p. 12, ligne 3" }, matchedBy: expect.any(String) });
    expect(r!.sourceRef).toContain("ligne 2");
  });

  it("erreurs explicites, sans montant dans les messages ; aucun prix nul ; unité contrôlée", () => {
    const s = parse(
      ROW.replace('"12 345,67"', "0"),
      ROW.replace(";cm;300;250;300;", ";mm;30;25;30;"), // 30 mm de projection : cotes en cm déclarées en mm
      ROW.replace("SB 450", "SB 999"),
      ROW.replace("catalogue_fournisseur", "prix_magique"),
      ROW.replace('"12 345,67"', "12,345,67"),
      ROW.replace(";catalogue_fournisseur;;", ";vente;10;"),
    );
    const [zero, unit, unmatched, nature, unreadable, discount] = s.rows;
    expect(zero!.status).toBe("REJECTED");
    expect(zero!.issues.join()).toMatch(/montant nul refusé/);
    expect(unit!.issues.join()).toMatch(/hors plage plausible.*unité à vérifier/);
    expect(unmatched!.familySlug).toMatch(/^non-rapproche-/);
    expect(unmatched!.issues.join()).toMatch(/produit non rapproché/);
    expect(nature!.status).toBe("REJECTED");
    expect(unreadable!.issues.join()).toMatch(/montant illisible/);
    expect(discount!.issues.join()).toMatch(/remise fournisseur ne s'applique qu'à un prix catalogue/);
    for (const r of s.rows) expect(r.issues.join(" ")).not.toMatch(/12 ?345|1234567/);
  });

  it("devises ou bases mélangées signalées, sans conversion", () => {
    const s = parse(ROW, ROW.replace(";EUR;", ";MAD;").replace("p. 12", "p. 13"));
    expect(s.currency).toBeNull();
    expect(s.rows.every((r) => r.issues.includes("fichier à devises multiples"))).toBe(true);
  });

  it("remise fournisseur puis règle de vente : arrondi au centime demi supérieur, majoration ≠ marge", () => {
    const cells = [{ dimAmm: 3000, widthMinMm: 2500, widthMaxMm: 3000, amountMinor: 1_000_001 }];
    const net = deriveCells(cells, "supplier_discount", "33,3");
    expect(net.ok && net.cells[0]!.amountMinor).toBe(667_001); // 1 000 001 × 0,667 = 667 000,667 → 667 001
    const markup = deriveCells([{ ...cells[0]!, amountMinor: 100_000 }], "markup_on_cost", "25");
    const margin = deriveCells([{ ...cells[0]!, amountMinor: 100_000 }], "margin_on_price", "25");
    expect(markup.ok && markup.cells[0]!.amountMinor).toBe(125_000);
    expect(margin.ok && margin.cells[0]!.amountMinor).toBe(133_333);
    expect(deriveCells(cells, "supplier_discount", "100").ok).toBe(false);
  });
});
