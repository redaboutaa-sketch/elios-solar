import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { invalidateCatalogCache, loadCatalog } from "@/server/catalog/load";
import { includedCablePublicText } from "@/domain/technical-spec";
import { createValidation, getDossier, transitionValidation, updateDraft, type Actor } from "@/server/validation/service";
import { specTargetId } from "@/server/validation/targets";
import { guest, standardInput } from "./helpers";

const SKU = "ES-PA-5M-WHI-ADO";
const CABLE = specTargetId("store-banne-ombra", "included_cable_length");
const admin: Actor = { userId: null, email: "admin-test@test.invalid", role: "ADMIN" };
const customer: Actor = { userId: null, email: "client@test.invalid", role: "CUSTOMER" };
const created: string[] = [];
let original: { priceCents: number; dataStatus: never; purchasable: boolean; attributes: never; leadSource: never; validationSource: string | null; validationDocumentId: string | null; validatedBy: string | null; validatedAt: Date | null } | null = null;
let ruleBackup: { id: string; status: never; dataStatus: never; reason: string | null } | null = null;

const noSource = { sourceKind: null, sourceUrl: null, documentId: null, sourceNote: "" };
const written = { sourceKind: "SUPPLIER_WRITTEN" as const, sourceUrl: null, documentId: null, sourceNote: "E-mail fournisseur de test du 19/10 (intégration)" };

beforeAll(async () => {
  original = (await prisma.variant.findUniqueOrThrow({ where: { sku: SKU }, select: { priceCents: true, dataStatus: true, purchasable: true, attributes: true, leadSource: true, validationSource: true, validationDocumentId: true, validatedBy: true, validatedAt: true } })) as never;
  const r = await prisma.optionCompatRule.findFirstOrThrow({ where: { status: "UNKNOWN" } });
  ruleBackup = { id: r.id, status: r.status as never, dataStatus: r.dataStatus as never, reason: r.reason };
});

afterAll(async () => {
  if (original) await prisma.variant.update({ where: { sku: SKU }, data: original as never });
  if (ruleBackup) await prisma.optionCompatRule.update({ where: { id: ruleBackup.id }, data: { status: ruleBackup.status, dataStatus: ruleBackup.dataStatus, reason: ruleBackup.reason } });
  await prisma.technicalSpec.deleteMany({ where: { source: "SUPPLIER_CONFIRMED", createdBy: admin.email } });
  await prisma.referenceValidation.deleteMany({ where: { id: { in: created } } });
  await prisma.cartLine.deleteMany({});
  await prisma.cart.deleteMany({});
  invalidateCatalogCache();
  await prisma.$disconnect();
});

describe("validation des références", () => {
  it("jeu initial : dossier câble « à vérifier », conflit démo / observation visible, rien de confirmé", async () => {
    const seeded = await prisma.referenceValidation.findFirstOrThrow({ where: { targetType: "FAMILY_SPEC", targetId: CABLE } });
    expect(seeded.status).toBe("TO_REVIEW");
    expect(seeded.proposed).toEqual({});
    const d = (await getDossier(seeded.id))!;
    expect(d.divergences.join(" ")).toMatch(/divergentes/);
    expect(d.missing).toContain("Valeur confirmée par le fournisseur");
    expect(d.specCandidates.map((s) => s.source).sort()).toEqual(["demo_seed", "observed_reference"]);
    expect(d.blockers.length).toBeGreaterThan(0);
    await expect(transitionValidation(seeded.id, "VALIDATED", null, admin)).rejects.toThrow(/Source manquante/);
  });

  it("rôle client refusé", async () => {
    await expect(createValidation({ targetType: "VARIANT", targetId: SKU, proposed: {}, ...noSource }, customer)).rejects.toThrow(/Accès refusé/);
  });

  it("validation sur version précise : refusée si les données changent, appliquée après actualisation ; achetable inchangé", async () => {
    const v = await createValidation({ targetType: "VARIANT", targetId: SKU, proposed: { priceCents: "215000", attributes: '{"usableWidthMm": 4640}', purchasable: "true" }, ...written }, admin);
    created.push(v.id);
    expect(v.proposed).toEqual({ priceCents: 215000, attributes: { usableWidthMm: 4640 } });
    // configuration enregistrée + ligne de panier active utilisant la référence : visibles dans les conséquences
    const input = standardInput({ dimensionCode: "3x5", mounting: "wall", segments: { "front-1": { closureFamilySlug: "persienne-aluminium" } } });
    const cfg = await prisma.configuration.create({ data: { shareToken: `t-${guest()}`, kind: "pergola_standard", engineVersion: "test", catalogVersion: "test", input: input as never, result: { lines: [{ sku: SKU, qty: 1 }] } as never } });
    const cart = await prisma.cart.create({ data: { guestKey: guest(), lines: { create: [{ input: input as never, configurationId: cfg.id }] } } });
    const impact = (await getDossier(v.id))!.impact;
    expect(impact).toMatchObject({ configurations: 1, activeCartLines: 1, openQuotes: 0, orders: 0, scope: "sku" });
    await prisma.cart.delete({ where: { id: cart.id } });
    await prisma.configuration.delete({ where: { id: cfg.id } });
    await transitionValidation(v.id, "TO_REVIEW", null, admin);
    await prisma.variant.update({ where: { sku: SKU }, data: { priceCents: original!.priceCents + 100 } });
    await expect(transitionValidation(v.id, "VALIDATED", null, admin)).rejects.toThrow(/données ont changé/);
    expect((await getDossier(v.id))!.stale).toBe(true);
    await transitionValidation(v.id, "DRAFT", "base à actualiser", admin);
    await updateDraft(v.id, { proposed: { priceCents: "215000", attributes: '{"usableWidthMm": 4640}' }, ...written }, admin);
    await transitionValidation(v.id, "TO_REVIEW", null, admin);
    const r = await transitionValidation(v.id, "VALIDATED", "conforme à l'écrit", admin);
    const after = await prisma.variant.findUniqueOrThrow({ where: { sku: SKU } });
    expect(after.priceCents).toBe(215000);
    expect(after.dataStatus).toBe("SUPPLIER_VERIFIED");
    expect(after.purchasable).toBe(original!.purchasable);
    expect((after.attributes as Record<string, unknown>).usableWidthMm).toBe(4640);
    expect((after.attributes as Record<string, unknown>).validation).toBe("confirmed");
    expect(after.validationSource).toMatch(/Écrit fournisseur/);
    const d = (await getDossier(v.id))!;
    expect(d.validation.appliedHash).toBe(r.appliedHash);
    expect(d.validation.events.map((e) => e.toStatus)).toEqual(["DRAFT", "TO_REVIEW", "DRAFT", "DRAFT", "TO_REVIEW", "VALIDATED"]);
    expect(d.checklist!.ready).toBe(false);
    expect(d.impact.scope).toBe("sku");
    await expect(transitionValidation(v.id, "REJECTED", "trop tard", admin)).rejects.toThrow(/Transition impossible/);
  });

  it("donnée technique : la validation fournisseur crée une valeur confirmée, publiée ; démo et observation conservées", async () => {
    const v = await createValidation({ targetType: "FAMILY_SPEC", targetId: CABLE, proposed: { valueNum: "7500" }, ...written }, admin);
    created.push(v.id);
    await transitionValidation(v.id, "TO_REVIEW", null, admin);
    await transitionValidation(v.id, "VALIDATED", null, admin);
    const fam = await prisma.productFamily.findUniqueOrThrow({ where: { slug: "store-banne-ombra" }, include: { technicalSpecs: true } });
    expect(fam.technicalSpecs.map((s) => s.source).sort()).toEqual(["DEMO_SEED", "OBSERVED_REFERENCE", "SUPPLIER_CONFIRMED"]);
    invalidateCatalogCache();
    const catalog = await loadCatalog({ fresh: true });
    expect(includedCablePublicText(catalog.families.find((f) => f.slug === "store-banne-ombra")!.technicalSpecs)).toBe("7,5 m");
    await prisma.technicalSpec.deleteMany({ where: { source: "SUPPLIER_CONFIRMED", createdBy: admin.email } });
  });

  it("une observation ne produit qu'un statut « Observé » ; un rejet doit être motivé", async () => {
    const v = await createValidation({ targetType: "OPTION_RULE", targetId: ruleBackup!.id, proposed: { status: "ALLOWED" }, sourceKind: "OBSERVED_REFERENCE", sourceUrl: "https://exemple.invalid/fiche", documentId: null, sourceNote: "" }, admin);
    created.push(v.id);
    await transitionValidation(v.id, "TO_REVIEW", null, admin);
    await transitionValidation(v.id, "VALIDATED", null, admin);
    const r = await prisma.optionCompatRule.findUniqueOrThrow({ where: { id: ruleBackup!.id } });
    expect(r.dataStatus).toBe("OBSERVED");
    expect(r.status).toBe("ALLOWED");
    const w = await createValidation({ targetType: "VARIANT", targetId: SKU, proposed: {}, ...noSource }, admin);
    created.push(w.id);
    await expect(transitionValidation(w.id, "REJECTED", "  ", admin)).rejects.toThrow(/motivé/);
    await transitionValidation(w.id, "REJECTED", "doublon", admin);
    expect((await prisma.referenceValidation.findUniqueOrThrow({ where: { id: w.id } })).decisionNote).toBe("doublon");
  });
});
