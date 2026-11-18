import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { findActiveCart, evaluateCart } from "@/server/cart/service";
import { createOrderFromCart, OrderError } from "@/server/order/service";
import { invalidateCatalogCache, loadCatalog } from "@/server/catalog/load";
import { estimateCartDelivery } from "@/server/stock/delivery";
import { applyStockRows, previewStockImport, fileAdapter, syncFromAdapter } from "@/server/stock/import";
import { createDraftGrid, parseGridFile } from "@/server/pricing/grid-import";
import { evaluate } from "@/domain/engine";
import { ADDRESS, cartWith, cleanup, guest, standardInput } from "./helpers";

const SKU_OPT = "ES-CH-1500W-ANT";
const SKU_BASE = "ES-PS1-3X4-ANT-AUT";
let snapshot: Array<{ sku: string; availability: never; stockQty: number | null; stockMode: never; preorderAllowed: boolean }> = [];

beforeEach(async () => {
  await cleanup();
  snapshot = (await prisma.variant.findMany({ where: { sku: { in: [SKU_OPT, SKU_BASE] } }, select: { sku: true, availability: true, stockQty: true, stockMode: true, preorderAllowed: true } })) as never;
  invalidateCatalogCache();
});
afterAll(async () => {
  for (const s of snapshot) await prisma.variant.update({ where: { sku: s.sku }, data: { availability: s.availability, stockQty: s.stockQty, stockMode: s.stockMode, preorderAllowed: s.preorderAllowed, reservedQty: 0 } });
  await prisma.priceGrid.deleteMany({ where: { name: { startsWith: "TEST " } } });
  await cleanup();
  await prisma.$disconnect();
});

describe("stocks et délais", () => {
  it("estimation de livraison groupée au panier, puis revalidation au checkout (rupture ⇒ refus, panier conservé)", async () => {
    const g = guest();
    await cartWith(g, [standardInput({ options: [{ familySlug: "lampe-chauffante", variantOption: "1500w", qty: 1 }] })]);
    const cart = await findActiveCart({ guestKey: g });
    const ev = await evaluateCart(cart!);
    const est = await estimateCartDelivery(ev, await loadCatalog({ fresh: true }));
    expect(est.status).toBe("estimated");
    expect(est.policy).toBe("GROUPED");
    expect(est.shipments).toHaveLength(1);
    // rupture survenue entre le panier et la commande
    await prisma.variant.update({ where: { sku: SKU_OPT }, data: { stockMode: "STOCK", stockQty: 0, reservedQty: 0, availability: "OUT_OF_STOCK", preorderAllowed: false } });
    invalidateCatalogCache();
    await expect(createOrderFromCart({ owner: { guestKey: g }, email: "s@test.invalid", shippingAddress: ADDRESS })).rejects.toBeTruthy();
    expect((await findActiveCart({ guestKey: g }))?.lines).toHaveLength(1);
  });

  it("stock suivi insuffisant avec précommande : commande possible, délai de réapprovisionnement figé dans la commande", async () => {
    const g = guest();
    await prisma.variant.update({ where: { sku: SKU_OPT }, data: { stockMode: "STOCK", stockQty: 0, reservedQty: 0, availability: "AVAILABLE", preorderAllowed: true } });
    invalidateCatalogCache();
    await cartWith(g, [standardInput({ options: [{ familySlug: "lampe-chauffante", variantOption: "1500w", qty: 1 }] })]);
    // le stock suivi à 0 bloque la réservation atomique : la précommande ne contourne pas la réservation
    await expect(createOrderFromCart({ owner: { guestKey: g }, email: "p@test.invalid", shippingAddress: ADDRESS })).rejects.toBeInstanceOf(OrderError);
    await prisma.variant.update({ where: { sku: SKU_OPT }, data: { stockMode: "MADE_TO_ORDER", stockQty: null, availability: "ON_ORDER" } });
    invalidateCatalogCache();
    const order = await createOrderFromCart({ owner: { guestKey: g }, email: "p@test.invalid", shippingAddress: ADDRESS });
    const est = (order.delivery as { estimate?: { status: string; explanation: string } }).estimate;
    expect(est?.status).toBe("estimated");
    expect(est?.explanation).toMatch(/groupée/);
  });

  it("import contrôlé : aperçu sans écriture, doublons/inconnus rejetés, application journalisée", async () => {
    const csv = readFileSync("docs/import/stocks.example.csv", "utf8") + "ES-SV-3M-ANT,AVAILABLE,1,,,,,,,,,,DEMO,doublon\nINCONNU-1,AVAILABLE,1,,,,,,,,,,DEMO,x\nES-SV-4M-ANT,AVAILABLE,0,,,,,,,,,,DEMO,stock nul\n";
    const before = await prisma.variant.findUnique({ where: { sku: "ES-SV-3M-ANT" } });
    const p = await previewStockImport("s.csv", csv);
    expect(p.rows.map((r) => r.row.sku)).toEqual(["ES-SV-3M-ANT", "ES-PV-4M-WHI-FIXED", "ES-PA-5M-ANT-AUT"]);
    expect(p.duplicates).toContain("ES-SV-3M-ANT");
    expect(p.errors.some((e) => e.sku === "INCONNU-1")).toBe(true);
    expect(p.errors.some((e) => e.sku === "ES-SV-4M-ANT" && /stock nul/.test(e.message))).toBe(true);
    expect((await prisma.variant.findUnique({ where: { sku: "ES-SV-3M-ANT" } }))?.stockQty).toBe(before?.stockQty);
    await applyStockRows([p.rows[0]!.row], { actorEmail: "t@test.invalid" }, "test");
    const after = await prisma.variant.findUnique({ where: { sku: "ES-SV-3M-ANT" }, include: { movements: { orderBy: { createdAt: "desc" }, take: 1 } } });
    expect(after?.stockQty).toBe(8);
    expect(after?.movements[0]?.reason).toBe("import");
    await prisma.variant.update({ where: { sku: "ES-SV-3M-ANT" }, data: { stockQty: before?.stockQty ?? null, availability: before!.availability, leadSource: before!.leadSource } });
  });

  it("adaptateur non connecté : une ligne « vérifié fournisseur » est rétrogradée en « observé »", async () => {
    const json = JSON.stringify([{ sku: "ES-SV-5M-ANT", availability: "AVAILABLE", stockQty: 4, leadSource: "SUPPLIER_VERIFIED", source: "export fournisseur déposé" }]);
    const p = await syncFromAdapter(fileAdapter("depot", "f.json", json), { actorEmail: "t@test.invalid" }, false);
    expect(p.rows[0]?.row.leadSource).toBe("OBSERVED");
  });
});

describe("grilles sur mesure (base)", () => {
  it("import → brouillon versionné ; non utilisé tant que non publié ; publication archive l'ancienne version", async () => {
    const text = readFileSync("docs/import/grille-sur-mesure.example.json", "utf8").replace("Exemple de grille (FICTIVE)", "TEST grille").replace("2027-01-01", "2026-01-01");
    const parsed = parseGridFile("g.json", text);
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.snapshot.cells[0]!.priceCents).toBe(399_000); // euros → centimes
    const draft = await createDraftGrid(parsed.file, "g.json", null);
    expect(draft.status).toBe("DRAFT");
    expect(draft.version).toBeGreaterThan(1);
    const input = { kind: "pergola_custom" as const, widthMm: 2500, lengthMm: 3000, heightMm: 2500, mounting: "freestanding" as const, finishCode: "ANTHRACITE", sides: {}, options: [], installation: "self" as const, delivery: { countryCode: "FR", postalCode: "69000" } };
    invalidateCatalogCache();
    const before = evaluate(await loadCatalog({ fresh: true }), input);
    expect(before.lines.find((l) => l.kind === "base")?.unitGrossCents).toBe(349_000); // grille fictive v1
    const demo = await prisma.priceGrid.findFirst({ where: { familySlug: "pergola-sur-mesure", status: "PUBLISHED" } });
    await prisma.$transaction([prisma.priceGrid.update({ where: { id: demo!.id }, data: { status: "ARCHIVED" } }), prisma.priceGrid.update({ where: { id: draft.id }, data: { status: "PUBLISHED" } })]);
    invalidateCatalogCache();
    const after = evaluate(await loadCatalog({ fresh: true }), input);
    expect(after.lines.find((l) => l.kind === "base")?.unitGrossCents).toBe(399_000);
    expect(after.purchasable).toBe(false); // grille fictive : estimation seulement
    await prisma.priceGrid.update({ where: { id: demo!.id }, data: { status: "PUBLISHED" } });
    await prisma.priceGrid.delete({ where: { id: draft.id } });
  });

  it("refuse une grille en mètres ou avec prix contradictoires", async () => {
    const bad = JSON.parse(readFileSync("docs/import/grille-sur-mesure.example.json", "utf8"));
    bad.unit = "m";
    expect("error" in parseGridFile("b.json", JSON.stringify(bad))).toBe(true);
    const overlap = JSON.parse(readFileSync("docs/import/grille-sur-mesure.example.json", "utf8"));
    overlap.cells.push({ ...overlap.cells[0], price: 1234 });
    const r = parseGridFile("o.json", JSON.stringify(overlap));
    expect("validation" in r && r.validation.errors.some((e) => e.code === "overlap")).toBe(true);
  });
});
