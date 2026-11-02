/**
 * Catalogue de prix fournisseur → prix de vente publiés (circuit du 2026-11-02) — base de test, montants SYNTHÉTIQUES :
 * import tracé → grilles catalogue avec suppléments → grille de vente (coefficient 1) → vérification → publication →
 * moteur de la boutique ; import répété sans doublon ; modification administrateur conservée ; devis émis figé ;
 * aucune donnée privée dans les tables publiques.
 */
import { afterAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { applySupplierPrices } from "@/server/supplier-prices/import";
import { deriveGridsFromImport, deriveSaleGrid, getGrid, gridKey, publishGrid, restoreAsDraft, saveCells, saveFixedTariffs, verifyGrid } from "@/server/tariffs/grids";
import { loadPublicSystemPrices } from "@/server/pricing/system-prices";
import { invalidateCatalogCache } from "@/server/catalog/load";
import { evaluateInput } from "@/server/configuration/service";
import { createQuote } from "@/server/quote/service";
import { defaultSystemInput, type SystemInput, type SystemRules } from "@/domain/system";

const TAG = randomBytes(4).toString("hex");
const VARIANT = `cat-${TAG}`;
const ACTOR = { actorUserId: null, actorEmail: "test:catalogue" };
const HEAD = "ref_fournisseur;produit;variante;type_ligne;code;libelle;dimension_a;unite;dim_a;largeur_min;largeur_max;montant;devise;base;nature;mode;pourcentage;applique_a;exigence;obligatoire;regle;source_document;source_localisation;valide_du";
const DOC = `Catalogue test ${TAG}`;
const row = (dim: number, w: number, amount: string, exig = "") => `SB450;marbella;${VARIANT};grille;;Grille;projection;mm;${dim};${w};${w};${amount};EUR;HT;catalogue_fournisseur;;;;${exig};;;${DOC};p. 12, ligne ${dim}, colonne ${w};15/09/2026`;
const supp = (code: string, mode: string, amount: string, pct: string, applies: string, mandatory = "") => `SB450;marbella;${VARIANT};option;${code};Supplément ${code} Altus;;;;;;${amount};EUR;HT;catalogue_fournisseur;${mode};${pct};${applies};;${mandatory};modèle SunTop interne;${DOC};p. 8`;
const file = (cells: string[]) => [{ fileName: `catalogue-${TAG}.csv`, bytes: new TextEncoder().encode([HEAD, ...cells].join("\n")), sourceKey: `catalogue-test-${TAG}` }];
const BASE_ROWS = [row(2000, 1500, "1000"), row(2000, 2000, "1100"), row(2200, 1500, "1050"), row(2200, 2000, "1150", "moteur_20nm"),
  supp("decor-bois", "pourcentage", "", "20", "finition:WOOD_DECOR"), supp("moteur-x", "montant", "200", "", "commande:electric_3", "oui"), supp("moteur-20nm", "a_chiffrer", "", "", "exigence:moteur_20nm", "oui")];

afterAll(async () => {
  await prisma.supplierPriceList.deleteMany({ where: { OR: [{ variantKey: VARIANT }, { sourceKey: { contains: TAG } }] } });
  await prisma.quote.deleteMany({ where: { email: `${TAG}@example.invalid` } });
  await prisma.$disconnect();
});

describe("catalogue fournisseur → prix de vente publiés", () => {
  let importId = "", catalogueId = "", saleId = "";

  it("import tracé : lignes avec page, ligne, colonne et référence privée ; suppléments en pourcentage, montant et à chiffrer", async () => {
    const { results } = await applySupplierPrices(file(BASE_ROWS), ACTOR);
    importId = results[0]!.listId;
    const rows = await prisma.supplierPriceRow.findMany({ where: { listId: importId } });
    expect(rows).toHaveLength(7);
    expect(rows.find((r) => r.kind === "GRID" && r.dimAmm === 2000 && r.widthMaxMm === 2000)).toMatchObject({ amountMinor: 1_100_00, sourceRef: expect.stringContaining("p. 12, ligne 2000, colonne 2000"), conditions: expect.objectContaining({ supplierRef: "SB450" }) });
    expect(rows.find((r) => r.code === "decor-bois")).toMatchObject({ kind: "OPTION", amountMinor: null, conditions: expect.objectContaining({ mode: "percent", percentBps: 2000, applies: ["finition:WOOD_DECOR"] }) });
    expect(rows.find((r) => r.code === "moteur-20nm")!.conditions).toMatchObject({ mode: "pending", mandatory: true });
    expect(rows.find((r) => r.dimAmm === 2200 && r.widthMaxMm === 2000)!.conditions).toMatchObject({ requirement: "moteur_20nm" });
  });

  it("grille catalogue (interne) avec ses suppléments, puis grille de vente = catalogue × 1, sans doublon à la répétition", async () => {
    const g = await deriveGridsFromImport(importId, { columns: { CATALOGUE_FOURNISSEUR: { enabled: true, nature: "SUPPLIER_LIST", currency: "EUR", taxBasis: "HT" } } }, ACTOR);
    expect(g.created).toHaveLength(1);
    catalogueId = g.created[0]!.id;
    expect(await prisma.supplierPriceRow.count({ where: { listId: catalogueId, kind: "FIXED" } })).toBe(3);
    const sale = await deriveSaleGrid(catalogueId, { mode: "coefficient", value: "1" }, { vatRateBps: 2000, dimRule: "ROUND_UP", dimRuleNote: "décision écrite (test)", natureNote: "vente = catalogue (test)" }, ACTOR);
    expect(sale.created).toBe(true);
    saleId = sale.id;
    const sg = await getGrid(saleId);
    expect(sg).toMatchObject({ nature: "SALE", currency: "EUR", taxBasis: "HT", vatRateBps: 2000, dimRule: "ROUND_UP", status: "DRAFT", sourceKey: gridKey("marbella", VARIANT, "VENTE") });
    // répétition : même fichier → même import ; mêmes cellules → aucune nouvelle grille
    const again = await applySupplierPrices(file(BASE_ROWS), ACTOR);
    expect(again.results[0]).toMatchObject({ unchanged: true, listId: importId });
    expect((await deriveGridsFromImport(importId, { columns: { CATALOGUE_FOURNISSEUR: { enabled: true, nature: "SUPPLIER_LIST", currency: "EUR", taxBasis: "HT" } } }, ACTOR)).created).toHaveLength(0);
    expect((await deriveSaleGrid(catalogueId, { mode: "coefficient", value: "1" }, {}, ACTOR)).created).toBe(false);
  });

  it("publication : grille de vente et suppléments chargés par la boutique, sans référence ni désignation du fabricant", async () => {
    await verifyGrid(saleId, (await getGrid(saleId)).revision, ACTOR);
    await publishGrid(saleId, (await getGrid(saleId)).revision, { at: null }, ACTOR);
    const t = (await loadPublicSystemPrices()).tables.get("marbella")!;
    const v = t.variants![VARIANT]!;
    expect(v).toMatchObject({ currency: "EUR", taxBasis: "HT", dimRule: "round_up", vatRateBps: 2000 });
    expect(v.supplements!.map((s) => [s.code, s.mode]).sort()).toEqual([["decor-bois", "percent"], ["moteur-20nm", "pending"], ["moteur-x", "fixed"]]);
    const json = JSON.stringify(t);
    expect(json).not.toMatch(/SB450|Altus|SunTop|supplierRef|Catalogue test/);
    expect(t.cells.find((c) => c.variantKey === VARIANT && c.dimAmm === 2200 && c.widthMaxMm === 2000)).toMatchObject({ requirement: "moteur_20nm" });
  });

  it("modification administrateur : nouvelle révision ; un import répété ne l'écrase pas", async () => {
    const draft = await restoreAsDraft(saleId, ACTOR);
    await saveCells(draft.id, (await getGrid(draft.id)).revision, [{ dimAmm: 2000, widthMinMm: 1500, widthMaxMm: 1500, action: "set", value: "999,99" }], ACTOR);
    await saveFixedTariffs(draft.id, (await getGrid(draft.id)).revision, [{ code: "decor-bois", label: "Décor bois", unit: "%", value: "", mode: "percent", percent: "25", applies: "finition:WOOD_DECOR" }], ACTOR);
    // la version publiée reste intacte
    expect((await prisma.supplierPriceRow.findFirstOrThrow({ where: { listId: saleId, dimAmm: 2000, widthMaxMm: 1500 } })).amountMinor).toBe(1_000_00);
    // ré-import identique : rien de nouveau, le brouillon modifié est conservé
    await applySupplierPrices(file(BASE_ROWS), ACTOR);
    expect((await prisma.supplierPriceRow.findFirstOrThrow({ where: { listId: draft.id, dimAmm: 2000, widthMaxMm: 1500 } })).amountMinor).toBe(999_99);
    const fixed = await prisma.supplierPriceRow.findFirstOrThrow({ where: { listId: draft.id, kind: "FIXED", code: "decor-bois" } });
    expect(fixed).toMatchObject({ origin: "MANUAL", editedBy: "test:catalogue", conditions: expect.objectContaining({ percentBps: 2500 }) });
    await prisma.supplierPriceList.update({ where: { id: draft.id }, data: { status: "REJECTED" } });
  });

  it("devis émis : prix figé ; une nouvelle version publiée ne le modifie pas", async () => {
    // variante de test : la pose de la boutique ne la sélectionne pas ; on lit le devis tel qu'enregistré (instantané)
    const family = await prisma.productFamily.findUniqueOrThrow({ where: { slug: "marbella" }, select: { systemRules: true } });
    const input: SystemInput = { ...defaultSystemInput("marbella", family.systemRules as unknown as SystemRules), mounting: "freestanding", widthMm: 1500, depthMm: 2000 };
    invalidateCatalogCache();
    const result = await evaluateInput(input);
    const quote = await createQuote({ kind: "SYSTEM", firstName: "Test", lastName: TAG, email: `${TAG}@example.invalid`, consent: true, input, result } as never, { userId: null, guestKey: `g-${TAG}` });
    const before = JSON.stringify((await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).snapshot);
    const d2 = await restoreAsDraft(saleId, ACTOR);
    await saveCells(d2.id, (await getGrid(d2.id)).revision, [{ dimAmm: 2000, widthMinMm: 1500, widthMaxMm: 1500, action: "set", value: "2000" }], ACTOR);
    await verifyGrid(d2.id, (await getGrid(d2.id)).revision, ACTOR);
    await publishGrid(d2.id, (await getGrid(d2.id)).revision, { at: null }, ACTOR);
    expect(JSON.stringify((await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).snapshot)).toBe(before);
    expect((await loadPublicSystemPrices()).tables.get("marbella")!.cells.find((c) => c.variantKey === VARIANT && c.dimAmm === 2000 && c.widthMaxMm === 1500)!.amountMinor).toBe(2_000_00);
  });
});

describe("suppléments en tableau (une ligne par cellule) : import, agrégation, répétition sans nouvelle version", () => {
  const V = `${VARIANT}-tab`;
  const H = `${HEAD};axe;cote_min;cote_max;quantite_selon;fourchette_min;fourchette_max`;
  const cell = (code: string, axis: string, min: number, max: number, amount: string, qty = "") => `SB450;marbella;${V};option;${code};Tableau ${code};;mm;;;;${amount};EUR;HT;catalogue_fournisseur;tableau;;option:${code};;;;${DOC};p. 20;15/09/2026;${axis};${min};${max};${qty};;`;
  const rows = [
    `SB450;marbella;${V};grille;;Grille;projection;mm;2000;1500;1500;1000;EUR;HT;catalogue_fournisseur;;;;;;;${DOC};p. 12;15/09/2026;;;;;;`,
    // cellules volontairement dans le désordre
    cell("led_blades", "avancee", 2134, 2134, "825"), cell("led_blades", "avancee", 1930, 1930, "550"),
    cell("intermediate_post", "hauteur", 2501, 3000, "310", "intermediate_post"), cell("intermediate_post", "hauteur", 2000, 2500, "255", "intermediate_post"),
    `SB450;marbella;${V};option;telecommande;Télécommande;;;;;;;EUR;HT;catalogue_fournisseur;a_chiffrer;;!option:remote_io;;;;${DOC};p. 115;15/09/2026;;;;;60;171`,
    // valeur d'une option (modèle de télécommande)
    `SB450;marbella;${V};option;telecommande-1;Télécommande 1 canal;;;;;;60;EUR;HT;catalogue_fournisseur;montant;;option:remote_io=io_1ch;;;;${DOC};p. 115;15/09/2026;;;;;;`,
  ];
  const f = (r: string[]) => [{ fileName: `tableau-${TAG}.csv`, bytes: new TextEncoder().encode([H, ...r].join("\n")), sourceKey: `tableau-test-${TAG}` }];
  const cols = { columns: { CATALOGUE_FOURNISSEUR: { enabled: true, nature: "SUPPLIER_LIST" as const, currency: "EUR", taxBasis: "HT" as const } } };

  it("cellules d'un même tableau : jamais signalées en doublon ; agrégées en un supplément ; répétition sans nouvelle grille", async () => {
    const { results } = await applySupplierPrices(f(rows), ACTOR);
    const imported = await prisma.supplierPriceRow.findMany({ where: { listId: results[0]!.listId } });
    expect(imported).toHaveLength(7);
    expect(imported.filter((r) => r.status !== "OK").map((r) => r.issues)).toEqual([]);
    const g = await deriveGridsFromImport(results[0]!.listId, cols, ACTOR);
    expect(g.created).toHaveLength(1);
    const fixed = await prisma.supplierPriceRow.findMany({ where: { listId: g.created[0]!.id, kind: "FIXED" }, orderBy: { code: "asc" } });
    expect(fixed.map((r) => r.code)).toEqual(["intermediate_post", "led_blades", "telecommande", "telecommande-1"]);
    expect(fixed[3]!.conditions).toMatchObject({ mode: "fixed", applies: ["option:remote_io=io_1ch"] });
    expect(fixed[0]!.conditions).toMatchObject({ mode: "table", perOptionQty: "intermediate_post", table: { axis: "hauteur", cells: [{ dimMin: 2000, amountMinor: 255_00 }, { dimMin: 2501, amountMinor: 310_00 }] } });
    expect(fixed[2]!.conditions).toMatchObject({ mode: "pending", rangeMinor: [60_00, 171_00] });
    // la base réordonne les clés des objets (jsonb) : la comparaison n'en dépend pas
    expect((await deriveGridsFromImport(results[0]!.listId, cols, ACTOR)).created).toHaveLength(0);
  });
});
