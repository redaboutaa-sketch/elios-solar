import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createDocument, createNextVersion, transitionDocument, DocumentError } from "@/server/documents/service";
import { customerDocuments, publicDocumentsForFamily } from "@/server/documents/queries";
import { publishedMediaFor } from "@/server/media/queries";

const tag = `itest-${randomBytes(4).toString("hex")}`;
let familyId = "";
let otherFamilyId = "";
let pdfId = "";
const userId = `${tag}-user`;

beforeAll(async () => {
  const fam = await prisma.productFamily.findUniqueOrThrow({ where: { slug: "pergola-solis-pro" }, select: { id: true } });
  const other = await prisma.productFamily.findUniqueOrThrow({ where: { slug: "pergola-solis-max" }, select: { id: true } });
  familyId = fam.id;
  otherFamilyId = other.id;
  pdfId = (await prisma.media.create({ data: { kind: "document", nature: "DOCUMENT", status: "VALIDATED", path: `/api/media/${"0".repeat(32)}.pdf`, mimeType: "application/pdf", alt: tag, title: tag, source: "test", license: "test", credit: "test" } })).id;
});

afterAll(async () => {
  await prisma.document.deleteMany({ where: { title: { startsWith: tag } } });
  await prisma.orderLine.deleteMany({ where: { order: { userId } } });
  await prisma.order.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.productMedia.deleteMany({ where: { caption: { startsWith: tag } } });
  await prisma.media.deleteMany({ where: { title: { startsWith: tag } } });
  await prisma.$disconnect();
});

describe("versionnage des documents", () => {
  it("seule la dernière version publiée est visible ; un brouillon ne l'est pas", async () => {
    const v1 = await createDocument({ title: `${tag} guide`, kind: "guide", audience: "PUBLIC", dataStatus: "DEMO", familyId, mediaId: pdfId }, "test");
    expect(v1.version).toBe(1);
    expect((await publicDocumentsForFamily(familyId)).some((d) => d.groupKey === v1.groupKey)).toBe(false); // brouillon

    await expect(transitionDocument(v1.id, "PUBLISHED", "test")).rejects.toBeInstanceOf(DocumentError); // DRAFT → PUBLISHED interdit
    await transitionDocument(v1.id, "REVIEW", "test");
    expect((await publicDocumentsForFamily(familyId)).some((d) => d.groupKey === v1.groupKey)).toBe(false); // en relecture
    await transitionDocument(v1.id, "PUBLISHED", "tester@test.invalid");
    let visible = (await publicDocumentsForFamily(familyId)).filter((d) => d.groupKey === v1.groupKey);
    expect(visible.map((d) => d.version)).toEqual([1]);

    // nouvelle version en brouillon : la v1 publiée reste affichée
    const v2 = await createNextVersion(v1.groupKey, { summary: "révision" }, "test");
    expect(v2.version).toBe(2);
    expect(v2.title).toBe(v1.title);
    expect(v2.status).toBe("DRAFT");
    visible = (await publicDocumentsForFamily(familyId)).filter((d) => d.groupKey === v1.groupKey);
    expect(visible.map((d) => d.version)).toEqual([1]);

    // publication de la v2 : la v1 est archivée, seule la v2 est visible
    await transitionDocument(v2.id, "REVIEW", "test");
    const { archived, after } = await transitionDocument(v2.id, "PUBLISHED", "tester@test.invalid");
    expect(archived.map((a) => a.version)).toEqual([1]);
    expect(after.validatedBy).toBe("tester@test.invalid");
    expect(after.publishedAt).not.toBeNull();
    expect((await prisma.document.findUniqueOrThrow({ where: { id: v1.id } })).status).toBe("ARCHIVED");
    visible = (await publicDocumentsForFamily(familyId)).filter((d) => d.groupKey === v1.groupKey);
    expect(visible.map((d) => d.version)).toEqual([2]);
    expect(visible[0]!.summary).toBe("révision");
  });

  it("refuse de publier un document sans PDF ou une notice non vérifiée fournisseur", async () => {
    const noPdf = await createDocument({ title: `${tag} sans pdf`, kind: "guide", familyId }, "test");
    await transitionDocument(noPdf.id, "REVIEW", "test");
    await expect(transitionDocument(noPdf.id, "PUBLISHED", "test")).rejects.toThrow(/PDF/);
    const notice = await createDocument({ title: `${tag} notice`, kind: "notice", dataStatus: "DEMO", familyId, mediaId: pdfId }, "test");
    await transitionDocument(notice.id, "REVIEW", "test");
    await expect(transitionDocument(notice.id, "PUBLISHED", "test")).rejects.toThrow(/vérifié fournisseur/);
  });

  it("audience CUSTOMER : invisible publiquement, visible des clients ayant commandé la famille", async () => {
    const doc = await createDocument({ title: `${tag} client`, kind: "guide", audience: "CUSTOMER", familyId, mediaId: pdfId }, "test");
    await transitionDocument(doc.id, "REVIEW", "test");
    await transitionDocument(doc.id, "PUBLISHED", "test");
    const internal = await createDocument({ title: `${tag} interne`, kind: "autre", audience: "INTERNAL", familyId, mediaId: pdfId }, "test");
    await transitionDocument(internal.id, "REVIEW", "test");
    await transitionDocument(internal.id, "PUBLISHED", "test");
    const otherFam = await createDocument({ title: `${tag} autre famille`, kind: "guide", audience: "CUSTOMER", familyId: otherFamilyId, mediaId: pdfId }, "test");
    await transitionDocument(otherFam.id, "REVIEW", "test");
    await transitionDocument(otherFam.id, "PUBLISHED", "test");

    const pub = await publicDocumentsForFamily(familyId);
    expect(pub.some((d) => d.id === doc.id)).toBe(false);
    expect(pub.some((d) => d.id === internal.id)).toBe(false);

    await prisma.user.create({ data: { id: userId, name: "Client test", email: `${tag}@test.invalid` } });
    expect((await customerDocuments(userId)).some((d) => d.id === doc.id)).toBe(false); // pas encore de commande
    const sku = (await prisma.variant.findFirstOrThrow({ where: { familyId }, select: { sku: true } })).sku;
    const addr = { firstName: "T", lastName: "T", line1: "1 rue", postalCode: "69000", city: "Lyon", countryCode: "FR" };
    await prisma.order.create({ data: { number: `T-${tag}`, userId, email: `${tag}@test.invalid`, goodsCents: 100, taxCents: 0, totalCents: 100, shippingAddress: addr, billingAddress: addr, delivery: {}, lines: { create: [{ kind: "base", sku, label: "Pergola", qty: 1, unitGrossCents: 100, totalGrossCents: 100, taxRateBps: 2000 }] } } });
    const mine = await customerDocuments(userId);
    expect(mine.some((d) => d.id === doc.id)).toBe(true);
    expect(mine.some((d) => d.id === internal.id)).toBe(false);
    expect(mine.some((d) => d.id === otherFam.id)).toBe(false);
  });
});

describe("médias publiés en boutique", () => {
  it("n'expose que les médias PUBLISHED, classés selon la finition", async () => {
    const mk = (status: "DRAFT" | "PUBLISHED", finishCode: string | null, sortOrder: number) =>
      prisma.media.create({ data: { kind: "image", nature: "RENDER", status, path: `/api/media/${randomBytes(16).toString("hex")}.png`, alt: tag, title: `${tag} ${status} ${finishCode}`, source: "test", license: "test", credit: "test", products: { create: { familyId: otherFamilyId, caption: `${tag} pm`, sortOrder, finishCode } } } });
    const draft = await mk("DRAFT", "WHITE", 0);
    const white = await mk("PUBLISHED", "WHITE", 900);
    const anth = await mk("PUBLISHED", "ANTHRACITE", 0);
    const list = await publishedMediaFor("pergola-solis-max", { finishCode: "WHITE" });
    const ids = list.map((m) => m.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).toContain(white.id);
    expect(ids).not.toContain(anth.id); // autre finition écartée car une correspondance existe
    expect(list.every((m) => m.finishCode !== "ANTHRACITE")).toBe(true);
    // les médias ciblés sur la finition passent avant les médias non ciblés
    const firstNeutral = list.findIndex((m) => m.finishCode == null);
    if (firstNeutral >= 0) expect(ids.indexOf(white.id)).toBeLessThan(firstNeutral);
  });
});
