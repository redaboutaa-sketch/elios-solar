/**
 * Catalogues fournisseur au format normalisé (préparation SELT) — base de test, montants SYNTHÉTIQUES :
 * import → contrôle → rapprochement → brouillons (idempotent) → remise fournisseur → règle de vente → validation →
 * publication → retour à la version précédente ; prix catalogue et achat jamais publics ; calcul serveur seul.
 */
import { afterAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createManualGrid, deactivateGrid, deriveDraft, getGrid, gridCells, publishGrid, restoreAsDraft, TariffError, updateParams, verifyGrid, type GridParamsInput } from "@/server/tariffs/grids";
import { createUpload, importUpload, previewUpload } from "@/server/tariffs/upload";
import { loadPublicSystemPrices } from "@/server/pricing/system-prices";
import { invalidateCatalogCache, loadCatalog } from "@/server/catalog/load";
import { evaluateInput } from "@/server/configuration/service";
import { configurationInputSchema } from "@/domain/schemas";
import { defaultSystemInput, type SystemInput, type SystemRules } from "@/domain/system";

const TAG = randomBytes(4).toString("hex");
const VARIANT = `selt-${TAG}`;
const ACTOR = { actorUserId: null, actorEmail: "test:selt" };
const HEAD = "ref_fournisseur;variante;type_ligne;libelle;dimension_a;unite;dim_a;largeur_min;largeur_max;montant;devise;base;nature;source_document;source_localisation";
const csv = (amount: string) => new TextEncoder().encode([HEAD, `SB450;${VARIANT};grille;Grille test;projection;cm;450;400;400;${amount};EUR;HT;catalogue_fournisseur;Catalogue test ${TAG};p. 3, l. 1`].join("\n"));
const params = (nature: GridParamsInput["nature"]): GridParamsInput => ({ nature, natureNote: "test", currency: "EUR", taxBasis: "HT", vatRateBps: 2000, clientele: "ALL", dimRule: "EXACT", dimRuleNote: "", validFrom: null, validTo: null, scopeNote: "", included: "", excluded: "", notes: "", zeroConfirmed: false });
const rev = async (id: string) => (await getGrid(id)).revision;
const publicAmount = async () => (await loadPublicSystemPrices()).tables.get("marbella")?.cells.find((c) => c.variantKey === VARIANT)?.amountMinor;

afterAll(async () => {
  await prisma.supplierPriceList.deleteMany({ where: { OR: [{ variantKey: VARIANT }, { label: { contains: TAG } }, { sourceFile: { contains: TAG } }] } });
  await prisma.priceImportUpload.deleteMany({ where: { files: { some: { fileName: { contains: TAG } } } } });
  await prisma.$disconnect();
});

describe("import d'un catalogue au format normalisé", () => {
  let catalogueId = "";
  it("aperçu sans écriture, nature et base déclarées proposées, brouillon de nature « prix catalogue fournisseur », import idempotent", async () => {
    const before = await prisma.supplierPriceList.count();
    const up = await createUpload([{ name: `catalogue-${TAG}.csv`, bytes: csv("1000,01") }], ACTOR);
    const p = await previewUpload(up.id);
    expect(await prisma.supplierPriceList.count()).toBe(before);
    expect(p.groups[0]).toMatchObject({ detectedFamily: "marbella", detectedVariant: VARIANT });
    expect(p.defaults.columns.CATALOGUE_FOURNISSEUR).toMatchObject({ nature: "SUPPLIER_LIST", currency: "EUR", taxBasis: "HT" });
    const r = await importUpload(up.id, ACTOR);
    const created = r.grids.flatMap((g) => g.created);
    expect(created).toHaveLength(1);
    catalogueId = created[0]!.id;
    const g = await getGrid(catalogueId);
    expect(g).toMatchObject({ nature: "SUPPLIER_LIST", status: "DRAFT", familySlug: "marbella", variantKey: VARIANT });
    expect((await gridCells(catalogueId))[0]).toMatchObject({ dimAmm: 4500, widthMaxMm: 4000, amountMinor: 100_001 });
    const row = await prisma.supplierPriceRow.findFirstOrThrow({ where: { listId: catalogueId } });
    expect(row.conditions).toMatchObject({ supplierRef: "SB450", source: { document: `Catalogue test ${TAG}`, location: "p. 3, l. 1" } });
    // même fichier : aucune nouvelle version
    const again = await importUpload((await createUpload([{ name: `catalogue-${TAG}.csv`, bytes: csv("1000,01") }], ACTOR)).id, ACTOR);
    expect(again.imports[0]!.reused).toBe(true);
    expect(again.grids.flatMap((x) => x.created)).toHaveLength(0);
  });

  it("refus explicites : fichier texte non CSV, en-têtes absents", async () => {
    await expect(createUpload([{ name: `faux-${TAG}.csv`, bytes: new Uint8Array([0x61, 0x00, 0x62]) }], ACTOR)).rejects.toThrow(/texte attendu/);
    const up = await createUpload([{ name: `entetes-${TAG}.csv`, bytes: new TextEncoder().encode("a;b\n1;2") }], ACTOR);
    await expect(previewUpload(up.id)).rejects.toThrow(/en-têtes du format normalisé absents/);
  });

  it("remise fournisseur → achat net → règle de vente validée → publication ; catalogue et achat jamais publics ; retour arrière", async () => {
    // le prix catalogue ne se publie pas comme prix de vente et n'est jamais lu par le site
    await updateParams(catalogueId, await rev(catalogueId), params("SUPPLIER_LIST"), ACTOR);
    await verifyGrid(catalogueId, await rev(catalogueId), ACTOR);
    await publishGrid(catalogueId, await rev(catalogueId), {}, ACTOR);
    expect(await publicAmount()).toBeUndefined();

    const purchase = await createManualGrid({ familySlug: "marbella", variantKey: VARIANT, label: `Achat net ${TAG}`, nature: "PURCHASE", dimAKey: "projection" }, ACTOR);
    await updateParams(purchase.id, await rev(purchase.id), params("PURCHASE"), ACTOR);
    // une majoration ne s'applique pas à un prix catalogue (ce n'est pas un coût)
    await expect(deriveDraft(catalogueId, purchase.id, "markup_on_cost", "25", ACTOR)).rejects.toBeInstanceOf(TariffError);
    const net = await deriveDraft(catalogueId, purchase.id, "supplier_discount", "30", ACTOR);
    expect((await gridCells(net.id))[0]!.amountMinor).toBe(70_001); // 100 001 × 0,70 = 70 000,7 → 70 001
    await verifyGrid(net.id, await rev(net.id), ACTOR);
    await publishGrid(net.id, await rev(net.id), {}, ACTOR);
    expect(await publicAmount()).toBeUndefined();

    const sale = await createManualGrid({ familySlug: "marbella", variantKey: VARIANT, label: `Vente ${TAG}`, nature: "SALE", dimAKey: "projection" }, ACTOR);
    await updateParams(sale.id, await rev(sale.id), params("SALE"), ACTOR);
    const v1 = await deriveDraft(net.id, sale.id, "margin_on_price", "30", ACTOR);
    expect((await gridCells(v1.id))[0]!.amountMinor).toBe(100_001); // 70 001 ÷ 0,70 = 100 001,43 → 100 001
    await verifyGrid(v1.id, await rev(v1.id), ACTOR);
    await publishGrid(v1.id, await rev(v1.id), {}, ACTOR);
    expect(await publicAmount()).toBe(100_001);

    // calcul serveur : un montant envoyé par le navigateur est ignoré
    invalidateCatalogCache();
    const fam = (await loadCatalog({ fresh: true })).families.find((f) => f.slug === "marbella")!;
    const base: SystemInput = { ...defaultSystemInput("marbella", fam.systemRules as SystemRules), widthMm: 4000, depthMm: 4500, mounting: "freestanding" };
    const forged = configurationInputSchema.parse({ ...base, price: 1, systemPrice: { amountMinor: 1 }, totalGrossCents: 1 }) as SystemInput;
    expect("systemPrice" in forged || "price" in forged).toBe(false);

    // nouvelle version, puis retour à la précédente (reprise en brouillon, contrôle, publication)
    const v2 = await deriveDraft(net.id, sale.id, "margin_on_price", "35", ACTOR);
    await verifyGrid(v2.id, await rev(v2.id), ACTOR);
    await publishGrid(v2.id, await rev(v2.id), {}, ACTOR);
    expect(await publicAmount()).toBe(107_694); // 70 001 ÷ 0,65 = 107 693,85 → 107 694
    await deactivateGrid(v2.id, ACTOR);
    expect(await publicAmount()).toBeUndefined(); // aucune reprise implicite : sur devis
    const back = await restoreAsDraft(v1.id, ACTOR);
    await verifyGrid(back.id, await rev(back.id), ACTOR);
    await publishGrid(back.id, await rev(back.id), {}, ACTOR);
    expect(await publicAmount()).toBe(100_001);
    expect((await evaluateInput(forged)).systemPrice?.amountMinor).not.toBe(1); // prix lu dans la grille du serveur, jamais celui du navigateur
  });
});
