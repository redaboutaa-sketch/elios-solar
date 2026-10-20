import { afterAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { defaultSystemInput, type SystemInput, type SystemRules } from "@/domain/system";
import { evaluateInput } from "@/server/configuration/service";
import { createQuote } from "@/server/quote/service";
import { loadCatalog, invalidateCatalogCache } from "@/server/catalog/load";
import { publicNavigation } from "@/server/catalog/navigation";
import { seedHeliostores, HELIOSTORES_SEED_TAG } from "@/server/catalog/heliostores-seed";
import { buildQuotePdf } from "@/server/pdf/quote-pdf";
import { sanitizeAttribution } from "@/domain/attribution";
import { MEDIA_URL_PREFIX, mediaDir, resolveMediaFile } from "@/server/media/storage";
import { GET as getMedia } from "@/app/api/media/[...path]/route";

const quotes: string[] = [];
const medias: string[] = [];
const files: string[] = [];
afterAll(async () => {
  await prisma.quoteVisual.deleteMany({ where: { quoteId: { in: quotes } } });
  await prisma.quote.deleteMany({ where: { id: { in: quotes } } });
  await prisma.media.deleteMany({ where: { id: { in: medias } } });
  for (const f of files) await unlink(f).catch(() => undefined);
  await prisma.$disconnect();
});

async function systemInput(slug: string, over: Partial<SystemInput> = {}): Promise<SystemInput> {
  const f = await prisma.productFamily.findUniqueOrThrow({ where: { slug } });
  return { ...defaultSystemInput(slug, f.systemRules as unknown as SystemRules), ...over };
}

describe("catalogue HELIOSTORES en base", () => {
  it("navigation : exactement Pergolas, Screens, Stores bannes, sans ancien produit ni brouillon", async () => {
    const nav = await publicNavigation();
    expect(nav.map((c) => c.label)).toEqual(["Pergolas", "Screens", "Stores bannes"]);
    expect(nav.flatMap((c) => c.items.map((i) => i.slug))).toEqual(["pergola-sb400", "pergola-sb500", "screen-refleksol-120-ziiip", "store-banne-casablanca"]);
  });

  it("l'ancien catalogue est conservé (historique) mais marqué legacy, hors famille publique", async () => {
    const legacy = await prisma.productFamily.findMany({ where: { legacy: true } });
    expect(legacy.length).toBeGreaterThan(0);
    expect(legacy.every((f) => f.category === null)).toBe(true);
    expect(await prisma.variant.count({ where: { family: { legacy: true } } })).toBeGreaterThan(0);
  });

  it("seed idempotent : statut décidé en administration et confirmation fournisseur jamais écrasés", async () => {
    const fam = await prisma.productFamily.findUniqueOrThrow({ where: { slug: "store-banne-casablanca" } });
    const before = await prisma.technicalSpec.count({ where: { familyId: fam.id, createdBy: HELIOSTORES_SEED_TAG } });
    await prisma.productFamily.update({ where: { id: fam.id }, data: { status: "PUBLISHED" } });
    const confirmed = await prisma.technicalSpec.create({ data: { familyId: fam.id, key: "test_confirmed", label: "Test", valueText: "x", source: "SUPPLIER_CONFIRMED", sourceRef: "écrit fournisseur (test)" } });
    try {
      await seedHeliostores(prisma);
      await seedHeliostores(prisma);
      expect(await prisma.technicalSpec.count({ where: { familyId: fam.id, createdBy: HELIOSTORES_SEED_TAG } })).toBe(before);
      expect((await prisma.productFamily.findUniqueOrThrow({ where: { id: fam.id } })).status).toBe("PUBLISHED");
      expect(await prisma.technicalSpec.count({ where: { id: confirmed.id } })).toBe(1);
    } finally {
      await prisma.technicalSpec.delete({ where: { id: confirmed.id } });
      await prisma.productFamily.update({ where: { id: fam.id }, data: { status: "QUOTE_ONLY" } });
      invalidateCatalogCache();
    }
  });

  it("l'instantané public transporte les règles et les sources, jamais de tarif fournisseur", async () => {
    const c = await loadCatalog({ fresh: true });
    const sb400 = c.families.find((f) => f.slug === "pergola-sb400")!;
    expect(sb400.systemRules?.dims.depth?.stepMm).toBe(200);
    expect(sb400.category).toBe("PERGOLAS");
    expect(JSON.stringify(c)).not.toMatch(/SupplierPrice|amountMinor|Prix final/);
  });
});

describe("devis d'un système : sans prix, récapitulatif, visualisation et attribution", () => {
  it("pergola : priceMode quote, récapitulatif, plan 2D joint sans image 3D, attribution nettoyée", async () => {
    const input = await systemInput("pergola-sb400", { widthMm: 3500, depthMm: 5000, mounting: "wall", options: [{ code: "led_spots" }] });
    const result = await evaluateInput(input);
    expect(result.priceMode).toBe("quote");
    expect(result.lines).toEqual([]);
    const q = await createQuote({ kind: "system", firstName: "Test", lastName: "Helio", email: `helio-${randomBytes(4).toString("hex")}@test.invalid`, input, result, attribution: sanitizeAttribution({ params: { utm_source: "salon", utm_campaign: "automne" }, landingPath: "/pergolas/pergola-sb400", evil: "x" }) }, { userId: null, guestKey: randomBytes(8).toString("hex") });
    quotes.push(q.id);
    expect(q.visualKind).toBe("PLAN_2D");
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(row.attribution).toEqual({ params: { utm_source: "salon", utm_campaign: "automne" }, landingPath: "/pergolas/pergola-sb400" });
    expect(row.qualification).toBe("TO_QUALIFY");
    const snap = row.snapshot as { result: { recap: Array<{ label: string; value: string }> } };
    expect(snap.result.recap.find((r) => r.label === "Projection")?.value).toBe("5 m");
    expect(snap.result.recap.some((r) => /9 points/.test(r.value))).toBe(true);
    const visual = await prisma.quoteVisual.findFirstOrThrow({ where: { quoteId: q.id } });
    expect(visual.represented as string[]).toEqual(expect.arrayContaining([expect.stringMatching(/Sections représentées \(catalogue\)/)]));
    // PDF : aucun total ni TVA, récapitulatif et mention du devis
    const pdf = await buildQuotePdf(await prisma.quote.findUniqueOrThrow({ where: { id: q.id }, include: { visuals: true } }));
    expect(pdf).toBeTruthy();
    const { PDFDocument } = await import("pdf-lib");
    expect((await PDFDocument.load(pdf!)).getPageCount()).toBeGreaterThan(0);
  });

  it("screen : pas de plan 2D possible → absence de visualisation indiquée, devis enregistré", async () => {
    const input = await systemInput("screen-refleksol-120-ziiip", { widthMm: 2500, heightMm: 2200 });
    const q = await createQuote({ kind: "system", firstName: "Test", lastName: "Screen", email: `screen-${randomBytes(4).toString("hex")}@test.invalid`, input, result: await evaluateInput(input) }, { userId: null, guestKey: randomBytes(8).toString("hex") });
    quotes.push(q.id);
    expect(q.visualKind).toBe("NONE");
    expect(await prisma.quote.count({ where: { id: q.id } })).toBe(1);
  });

  it("une configuration hors règles est enregistrée avec ses blocages (jamais de prix inventé)", async () => {
    const input = await systemInput("store-banne-casablanca", { widthMm: 2500, depthMm: 3600 });
    const result = await evaluateInput(input);
    expect(result.issues.some((i) => i.code === "depth_width_combination" && i.severity === "blocking")).toBe(true);
    expect(result.totals.totalGrossCents).toBe(0);
  });
});

describe("médiathèque : variantes réduites", () => {
  it("une vignette suit les règles d'accès de son média (publié : servie ; brouillon : 404)", async () => {
    await mkdir(mediaDir(), { recursive: true });
    const make = async (status: "PUBLISHED" | "DRAFT") => {
      const main = `${randomBytes(16).toString("hex")}.webp`;
      const small = `${randomBytes(16).toString("hex")}.webp`;
      const buf = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 68, g: 102, b: 77 } } }).webp().toBuffer();
      for (const n of [main, small]) { await writeFile(resolveMediaFile(n)!, buf); files.push(resolveMediaFile(n)!); }
      const m = await prisma.media.create({ data: { kind: "image", nature: "RENDER", status, path: `${MEDIA_URL_PREFIX}${main}`, mimeType: "image/webp", alt: "test", source: "test", license: "test", credit: "test", provenance: { key: `test-${main}`, variants: { small: { path: `${MEDIA_URL_PREFIX}${small}` } } } } });
      medias.push(m.id);
      return small;
    };
    const get = (name: string) => getMedia(new Request(`http://localhost/api/media/${name}`), { params: Promise.resolve({ path: [name] }) } as never);
    expect((await get(await make("PUBLISHED"))).status).toBe(200);
    expect((await get(await make("DRAFT"))).status).toBe(404);
  });
});
