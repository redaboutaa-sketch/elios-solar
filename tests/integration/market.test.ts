/**
 * Comparatif marché — base de test, montants SYNTHÉTIQUES : politique de coût versionnée, relevés (création,
 * correction, archivage, historique, import idempotent), étude d'une configuration (coût net, marges, plancher,
 * comparables), proposition et brouillon de grille d'UNE cellule. Contrôle central : aucune de ces opérations ne
 * modifie un prix public (grilles de vente publiées chargées par la boutique, identiques avant et après).
 * Isolation : famille de test en brouillon (hors catalogue), grilles jamais publiées, politique datée de 2099.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { applySupplierPrices } from "@/server/supplier-prices/import";
import { deriveGridsFromImport, deriveSaleGrid, gridCells } from "@/server/tariffs/grids";
import { loadPublicSystemPrices } from "@/server/pricing/system-prices";
import { invalidateCatalogCache } from "@/server/catalog/load";
import { createPolicyVersion, DEFAULT_DIRECT_COSTS, policyAt } from "@/server/market/policy";
import { createObservation, importObservations, observationDetail, setObservationStatus, updateObservation } from "@/server/market/observations";
import { study } from "@/server/market/study";
import { createProposal, draftGridFromProposal } from "@/server/market/proposals";

const TAG = randomBytes(4).toString("hex");
const FAM = `mkt-${TAG}`;
const ACTOR = { actorUserId: null, actorEmail: "test:market" };
const AT = new Date("2099-06-01T12:00:00Z");
const HEAD = "ref_fournisseur;produit;variante;type_ligne;code;libelle;dimension_a;unite;dim_a;largeur_min;largeur_max;montant;devise;base;nature;mode;pourcentage;applique_a;exigence;obligatoire;regle;source_document;source_localisation;valide_du";
const DOC = `Catalogue marché ${TAG}`;
const row = (dim: number, w: number, amount: string) => `X;${FAM};murale;grille;;Grille;projection;mm;${dim};${w};${w};${amount};EUR;HT;catalogue_fournisseur;;;;;;;${DOC};p. 1, ligne ${dim}, colonne ${w};15/09/2026`;
const supp = (code: string, mode: string, amount: string, pct: string, applies: string) => `X;${FAM};murale;option;${code};Supplément ${code};;;;;;${amount};EUR;HT;catalogue_fournisseur;${mode};${pct};${applies};;;;${DOC};p. 2`;
let saleId = "", policyId = "";
const policyIds: string[] = [];

async function publicFingerprint() {
  invalidateCatalogCache();
  const p = await loadPublicSystemPrices();
  return createHash("sha256").update(JSON.stringify([p.version, [...p.tables.entries()]])).digest("hex");
}

const obsInput = (o: Record<string, unknown> = {}) => ({
  retailer: `Revendeur ${TAG}`, manufacturer: "", model: "Bioclimatique test", url: `https://example.invalid/${TAG}`, observedAt: "2099-05-20", country: "FR", currency: "EUR", familySlug: FAM,
  widthMm: 4000, depthMm: 4000, heightMm: null, mounting: "wall", roofType: "lames", control: "moteur", options: "", priceMinor: 600_000, taxBasis: "TTC", priceKind: "fixed_size",
  regularPriceMinor: null, promoPriceMinor: null, promoEnd: null,
  scope: { delivery: { status: "extra" }, installation: { status: "extra" }, motor: { status: "included" }, remote: { status: "absent" }, led: { status: "absent" }, screen: { status: "absent" }, glazing: { status: "absent" } },
  warranty: "", material: "", blades: "", resistance: "", sav: "", comparability: "STRONG", comparabilityReason: "test", evidence: "", access: "ok", notes: "", ...o,
});

beforeAll(async () => {
  const rules = (await prisma.productFamily.findUniqueOrThrow({ where: { slug: "marbella" }, select: { systemRules: true } })).systemRules as Record<string, unknown>;
  await prisma.productFamily.create({ data: { slug: FAM, name: `Test marché ${TAG}`, kind: "PERGOLA_SYSTEM", status: "DRAFT", systemRules: { ...rules, options: [], controls: undefined } as never } });
  const { results } = await applySupplierPrices([{ fileName: `m-${TAG}.csv`, bytes: new TextEncoder().encode([HEAD, row(4000, 4000, "4000"), row(4000, 3000, "3500"), supp("decor", "pourcentage", "", "20", "finition:WOOD_DECOR"), supp("centrale", "montant", "300", "", "toujours")].join("\n")), sourceKey: `market-test-${TAG}` }], ACTOR);
  const g = await deriveGridsFromImport(results[0]!.listId, { columns: { CATALOGUE_FOURNISSEUR: { enabled: true, nature: "SUPPLIER_LIST", currency: "EUR", taxBasis: "HT" } } }, ACTOR);
  saleId = (await deriveSaleGrid(g.created[0]!.id, { mode: "coefficient", value: "1" }, { vatRateBps: 2000 }, ACTOR)).id;
});

const FAM2 = `mkt2-${TAG}`;

afterAll(async () => {
  await prisma.supplierPriceList.deleteMany({ where: { familySlug: FAM2 } });
  await prisma.productFamily.deleteMany({ where: { slug: FAM2 } });
  await prisma.marketPriceProposal.deleteMany({ where: { familySlug: FAM } });
  await prisma.marketObservation.deleteMany({ where: { familySlug: FAM } });
  await prisma.costPolicyVersion.deleteMany({ where: { id: { in: policyIds } } });
  await prisma.supplierPriceList.deleteMany({ where: { OR: [{ familySlug: FAM }, { sourceKey: { contains: TAG } }] } });
  await prisma.productFamily.deleteMany({ where: { slug: FAM } });
  await prisma.$disconnect();
});

describe("comparatif marché", () => {
  let before = "";
  it("politique de coût : versions successives, jamais modifiées ; version en vigueur selon la date d'effet", async () => {
    before = await publicFingerprint();
    const base = { eligibility: { structure: "ELIGIBLE" as const }, directCosts: DEFAULT_DIRECT_COSTS, marginTargetBps: null, contributionTargetBps: null, staleDays: 120, dimToleranceBps: 1000, rounding: { stepMinor: 1000, basis: "TTC" as const }, note: "test" };
    const v1 = await createPolicyVersion({ ...base, validFrom: new Date("2099-01-01T00:00:00Z"), discountBps: 3700 }, ACTOR);
    const v2 = await createPolicyVersion({ ...base, validFrom: new Date("2099-12-01T00:00:00Z"), discountBps: 4000 }, ACTOR);
    policyIds.push(v1.id, v2.id);
    policyId = v1.id;
    expect(v2.version).toBe(v1.version + 1);
    expect((await policyAt(AT))!.id).toBe(v1.id);
    expect((await policyAt(new Date("2099-12-15T00:00:00Z")))!.discountBps).toBe(4000);
    await expect(createPolicyVersion({ ...base, validFrom: new Date("2099-01-01T00:00:00Z"), discountBps: 12_000 }, ACTOR)).rejects.toThrow(/Remise invalide/);
    // le journal ne contient ni taux ni montant
    const log = await prisma.auditLog.findFirst({ where: { entity: "CostPolicyVersion", entityId: v1.id } });
    expect(JSON.stringify(log?.after)).not.toMatch(/3700|discount/);
  });

  it("étude : coût net poste par poste (structure −37 %, centrale « toujours » d'éligibilité inconnue), marge et contribution partielles", async () => {
    const r = await study({ familySlug: FAM, mounting: "wall", widthMm: 4000, dimMm: 4000, country: "FR", saleVersionId: saleId, at: AT });
    if ("error" in r) throw new Error(r.error);
    expect(r.policy!.id).toBe(policyId);
    expect(r.saleHt).toBe(430_000); // 4 000 + centrale 300
    expect(r.cost!.lines.find((l) => l.code === "structure")!.netMinor).toBe(252_000);
    expect(r.cost!.lines.find((l) => l.code === "centrale")).toMatchObject({ netMinor: null, basis: "unknown", prudentMinor: 30_000 });
    expect(r.cost!.knownNetMinor).toBe(252_000);
    expect(r.cost!.prudentNetMinor).toBe(282_000);
    expect(r.current!.known.grossMinor).toBe(430_000 - 252_000);
    expect(r.current!.contribution.partial).toBe(true);
    // aucun objectif défini : pas de plancher, pas de prix conseillé
    expect(r.floor!.floorHtMinor).toBeNull();
    expect(r.reco!.recommended).toBeNull();
  });

  it("relevés : création, correction (historique), archivage ; import idempotent ; comparable non équivalent écarté", async () => {
    const a = await createObservation(obsInput(), ACTOR);
    await createObservation(obsInput({ retailer: `Autre ${TAG}`, manufacturer: "B", priceMinor: 540_000, url: `https://example.invalid/${TAG}/b` }), ACTOR);
    await createObservation(obsInput({ retailer: `Livré ${TAG}`, manufacturer: "C", priceMinor: 480_000, url: `https://example.invalid/${TAG}/c`, scope: { ...obsInput().scope, delivery: { status: "included" } } }), ACTOR);
    const fixed = await updateObservation(a.id, a.revision, obsInput({ priceMinor: 660_000 }), "prix relu", ACTOR);
    expect(fixed.revision).toBe(2);
    await expect(updateObservation(a.id, 1, obsInput(), "conflit", ACTOR)).rejects.toThrow(/modifié entre-temps/);
    const d = await observationDetail(a.id);
    expect(d.revisions.map((x) => [x.revision, x.action, (x.data as { priceMinor: number }).priceMinor])).toEqual([[2, "update", 660_000], [1, "create", 600_000]]);
    const imp = await importObservations([{ line: 1, input: obsInput({ retailer: `Import ${TAG}`, manufacturer: "D", priceMinor: 720_000, url: `https://example.invalid/${TAG}/d` }) }, { line: 2, input: { retailer: "" } }], `test-${TAG}`, ACTOR);
    expect(imp).toMatchObject({ created: 1, unchanged: 0 });
    expect(imp.rejected).toHaveLength(1);
    expect((await importObservations([{ line: 1, input: obsInput({ retailer: `Import ${TAG}`, manufacturer: "D", priceMinor: 720_000, url: `https://example.invalid/${TAG}/d` }) }], `test-${TAG}`, ACTOR)).created).toBe(0);

    const r = await study({ familySlug: FAM, mounting: "wall", widthMm: 4000, dimMm: 4000, country: "FR", saleVersionId: saleId, at: AT });
    if ("error" in r) throw new Error(r.error);
    // retenues : 660, 540, 720 TTC → 550, 450, 600 HT ; « livraison comprise » présentée séparément
    expect(r.stats).toMatchObject({ n: 3, independent: 3, minMinor: 450_000, medianMinor: 550_000, maxMinor: 600_000 });
    const livre = r.evals.find((e) => e.obs.retailer === `Livré ${TAG}`)!;
    expect(livre.retained).toBe(false);
    expect(livre.gaps[0]!.key).toBe("delivery");
    await setObservationStatus(a.id, 2, "ARCHIVED", "test", ACTOR);
    const r2 = await study({ familySlug: FAM, mounting: "wall", widthMm: 4000, dimMm: 4000, country: "FR", saleVersionId: saleId, at: AT });
    if ("error" in r2) throw new Error(r2.error);
    expect(r2.stats.n).toBe(2);
    expect(r2.reco!.confidence).toBe("indicative");
  });

  it("plancher : objectif de marge 30 % sur le coût prudent ; proposition sous le plancher refusée", async () => {
    const v = await createPolicyVersion({ eligibility: { structure: "ELIGIBLE" }, directCosts: DEFAULT_DIRECT_COSTS, marginTargetBps: 3000, contributionTargetBps: null, staleDays: 120, dimToleranceBps: 1000, rounding: { stepMinor: 1000, basis: "TTC" }, note: "test", validFrom: new Date("2099-02-01T00:00:00Z"), discountBps: 3700 }, ACTOR);
    policyIds.push(v.id);
    const input = { familySlug: FAM, mounting: "wall" as const, widthMm: 4000, dimMm: 4000, country: "FR", saleVersionId: saleId, at: AT };
    const r = await study(input);
    if ("error" in r) throw new Error(r.error);
    expect(r.floor!.floorHtMinor).toBe(Math.ceil(282_000 / 0.7));
    expect(r.reco!.recommended!.htMinor).toBeGreaterThanOrEqual(r.floor!.floorHtMinor!);
    await expect(createProposal({ ...input, scenario: "manuel", proposedHtMinor: 300_000, justification: "" }, ACTOR)).rejects.toThrow(/sous le plancher/);
    await expect(createProposal({ ...input, scenario: "premium", proposedHtMinor: 500_000, justification: "" }, ACTOR)).rejects.toThrow(/premium/);
  });

  it("proposition → brouillon d'une seule cellule ; aucun prix public modifié", async () => {
    const input = { familySlug: FAM, mounting: "wall" as const, widthMm: 4000, dimMm: 4000, country: "FR", saleVersionId: saleId, at: AT };
    const p = await createProposal({ ...input, scenario: "aligned", proposedHtMinor: 480_000, justification: "" }, ACTOR);
    expect(p).toMatchObject({ priceListId: saleId, currentHtMinor: 430_000, proposedTtcMinor: 576_000 });
    const d = await draftGridFromProposal(p.id, ACTOR);
    expect(d.cellMinor).toBe(450_000); // 4 800 − centrale 300
    const [baseCells, draftCells] = await Promise.all([gridCells(saleId), gridCells(d.draftId)]);
    const changed = draftCells.filter((c) => baseCells.find((b) => b.dimAmm === c.dimAmm && b.widthMaxMm === c.widthMaxMm)!.amountMinor !== c.amountMinor);
    expect(changed).toEqual([{ dimAmm: 4000, widthMinMm: 4000, widthMaxMm: 4000, amountMinor: 450_000 }]);
    expect((await prisma.supplierPriceList.findUniqueOrThrow({ where: { id: d.draftId } })).status).toBe("DRAFT");
    await expect(draftGridFromProposal(p.id, ACTOR)).rejects.toThrow(/existe déjà/);
    expect(await publicFingerprint()).toBe(before);
  });

  it("catalogue à plusieurs variantes (lame 217,4 mm non vendue) : coût lu dans la variante de la vente, à la même cellule", async () => {
    const rules = (await prisma.productFamily.findUniqueOrThrow({ where: { slug: "malaga" }, select: { systemRules: true } })).systemRules as Record<string, unknown>;
    await prisma.productFamily.create({ data: { slug: FAM2, name: `Test lames ${TAG}`, kind: "PERGOLA_SYSTEM", status: "DRAFT", systemRules: rules as never } });
    const r2 = (variant: string, dim: number, amount: string) => `X;${FAM2};${variant};grille;;Grille;projection;mm;${dim};3500;3500;${amount};EUR;HT;catalogue_fournisseur;;;;;;;${DOC} 2;p. 3, ligne ${dim};15/09/2026`;
    const { results } = await applySupplierPrices([{ fileName: `m2-${TAG}.csv`, bytes: new TextEncoder().encode([HEAD, r2("", 3400, "7000"), r2("", 4300, "8000"), r2("lame-217", 3400, "7500")].join("\n")), sourceKey: `market-test2-${TAG}` }], ACTOR);
    const g = await deriveGridsFromImport(results[0]!.listId, { columns: { CATALOGUE_FOURNISSEUR: { enabled: true, nature: "SUPPLIER_LIST", currency: "EUR", taxBasis: "HT" } } }, ACTOR);
    const base = await prisma.supplierPriceList.findFirstOrThrow({ where: { id: { in: g.created.map((x) => x.id) }, variantKey: "" } });
    const sale = await deriveSaleGrid(base.id, { mode: "coefficient", value: "1" }, { vatRateBps: 2000, dimRule: "ROUND_UP", dimRuleNote: "test" }, ACTOR);
    // cote intermédiaire 4 000 → cellule 4 300 en vente (dimension supérieure) et au catalogue
    const r = await study({ familySlug: FAM2, mounting: "freestanding", widthMm: 3500, dimMm: 4000, country: "FR", saleVersionId: sale.id, at: AT });
    if ("error" in r) throw new Error(r.error);
    expect(r.saleHt).toBe(800_000);
    expect(r.sim.supplierBreakdown!.totalMinor).toBe(800_000);
    expect(r.cost!.knownNetMinor).toBe(504_000);
  });
});
