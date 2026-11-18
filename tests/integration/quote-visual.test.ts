import { afterAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import type { AwningInput, PergolaCustomInput } from "@/domain/types";
import { VISUAL_DISCLAIMER } from "@/domain/scene-model";
import { evaluateInput, saveConfiguration, updateConfiguration } from "@/server/configuration/service";
import { createQuote } from "@/server/quote/service";
import { attachQuoteVisual, decodeVisual, MAX_VISUAL_DIM, quoteForViewer, resolveQuoteVisual } from "@/server/quote/visual";
import { loadCatalog } from "@/server/catalog/load";
import { buildQuotePdf } from "@/server/pdf/quote-pdf";
import { GET as getPdf } from "@/app/api/devis/[id]/pdf/route";
import { GET as getVisual } from "@/app/api/devis/[id]/visuel/route";
import { guest, standardInput } from "./helpers";

const files: string[] = [];
afterAll(async () => {
  for (const f of files) await unlink(f).catch(() => undefined);
  await prisma.$disconnect();
});

async function pngDataUrl(width = 800, height = 500, withExif = false) {
  let img = sharp({ create: { width, height, channels: 3, background: { r: 120, g: 140, b: 160 } } }).png();
  if (withExif) img = img.withExif({ IFD0: { Copyright: "secret-meta" } });
  return `data:image/png;base64,${(await img.toBuffer()).toString("base64")}`;
}
async function jpegBuffer(width = 400, height = 300) {
  return sharp({ create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } } }).jpeg().toBuffer();
}
const form = { firstName: "Vi", lastName: "Suel", email: "visuel@test.invalid" };

async function quoteWith(input: Parameters<typeof evaluateInput>[0], visual: unknown, owner: { userId?: string | null; guestKey?: string | null } = { guestKey: guest() }, configurationId: string | null = null) {
  const result = await evaluateInput(input);
  const q = await createQuote({ kind: input.kind === "pergola_custom" ? "custom" : "configuration", ...form, input, result, configurationId, visual }, owner);
  const visuals = await prisma.quoteVisual.findMany({ where: { quoteId: q.id } });
  for (const v of visuals) files.push(resolveQuoteVisual(v.storageKey)!);
  return { q, visuals };
}

describe("contrôle des images reçues", () => {
  it("accepte PNG et JPEG réels, ré-encodés sans métadonnées", async () => {
    const d = await decodeVisual(await pngDataUrl(640, 400, true));
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect([d.mime, d.width, d.height]).toEqual(["image/png", 640, 400]);
    expect((await sharp(d.buf).metadata()).exif).toBeUndefined();
    expect((await decodeVisual(`data:image/jpeg;base64,${(await jpegBuffer()).toString("base64")}`)).ok).toBe(true);
  });
  it("refuse signature falsifiée, type non accepté, image trop grande ou trop lourde", async () => {
    expect(await decodeVisual(`data:image/png;base64,${(await jpegBuffer()).toString("base64")}`)).toMatchObject({ ok: false, reason: "signature binaire invalide" });
    expect(await decodeVisual(`data:image/png;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`)).toMatchObject({ ok: false });
    expect(await decodeVisual(`data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`)).toMatchObject({ ok: false });
    expect(await decodeVisual(await pngDataUrl(MAX_VISUAL_DIM + 1, 80))).toMatchObject({ ok: false, reason: "dimensions trop grandes" });
    expect(await decodeVisual(await pngDataUrl(32, 32))).toMatchObject({ ok: false, reason: "dimensions trop petites" });
    const heavy = `data:image/png;base64,${randomBytes(3 * 1024 * 1024).toString("base64")}`;
    expect(await decodeVisual(heavy)).toMatchObject({ ok: false, reason: "trop lourde" });
    expect(await decodeVisual(42)).toMatchObject({ ok: false });
  });
});

describe("visualisation jointe au devis", () => {
  it("image 3D valide : stockée en privé, liste détaillée des éléments représentés, mention non contractuelle", async () => {
    const input = standardInput({ segments: { "left-1": { closureFamilySlug: "paroi-vitree", option: "fixe" } } });
    const { q, visuals } = await quoteWith(input, await pngDataUrl());
    expect(q.visualKind).toBe("SCENE_3D");
    expect(visuals).toHaveLength(1);
    const v = visuals[0]!;
    expect(v.storageKey).toMatch(/^quotes\/[a-f0-9]{32}\.png$/);
    expect(v.disclaimer).toBe(VISUAL_DISCLAIMER);
    const items = v.represented as string[];
    expect(items[0]).toMatch(/^Gamme : /);
    expect(items.some((i) => /Côté gauche.*Paroi vitrée/.test(i))).toBe(true);
    expect(items.some((i) => /Finition/.test(i))).toBe(true);
    // le fichier n'est pas servi par la médiathèque publique (pas de ligne Media)
    expect(await prisma.media.count({ where: { path: { contains: v.storageKey.split("/")[1]! } } })).toBe(0);
  });

  it("capture absente ou refusée : le devis est créé avec un plan 2D", async () => {
    const custom: PergolaCustomInput = { kind: "pergola_custom", widthMm: 3500, lengthMm: 4500, heightMm: 2600, mounting: "freestanding", finishCode: "ANTHRACITE", sides: { front: { closureFamilySlug: "store-vertical-zip" } }, options: [], installation: "self", delivery: { countryCode: "FR" } };
    const none = await quoteWith(custom, null);
    expect(none.q.visualKind).toBe("PLAN_2D");
    expect(none.visuals[0]).toMatchObject({ kind: "PLAN_2D", mime: "image/png", width: 1200, height: 800 });
    const forged = await quoteWith(custom, `data:image/png;base64,${(await jpegBuffer()).toString("base64")}`);
    expect(forged.q.visualKind).toBe("PLAN_2D");
    expect((forged.visuals[0]!.represented as string[]).some((i) => /Hauteur saisie : 2,6 m/.test(i))).toBe(true);
  });

  it("store sans capture : aucune visualisation, PDF avec mention explicite", async () => {
    const awning: AwningInput = { kind: "awning", familySlug: "store-banne-ombra", widthMm: 4000, projectionMm: 3000, cabinetColor: "ANTHRACITE", fabricCode: "GREY", bracketMount: "wall", options: [], installation: "self", delivery: { countryCode: "FR" } };
    const { q, visuals } = await quoteWith(awning, "pas-une-image");
    expect(q.visualKind).toBe("NONE");
    expect(visuals).toHaveLength(0);
    const pdf = await buildQuotePdf((await prisma.quote.findUniqueOrThrow({ where: { id: q.id }, include: { visuals: true } })));
    expect(pdf).not.toBeNull();
    expect(Buffer.from(pdf!).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("PDF du devis : l'image jointe est insérée", async () => {
    const { q } = await quoteWith(standardInput(), await pngDataUrl());
    const pdf = await buildQuotePdf((await prisma.quote.findUniqueOrThrow({ where: { id: q.id }, include: { visuals: true } })));
    expect(Buffer.from(pdf!).toString("latin1")).toMatch(/\/Subtype \/Image/);
  });

  it("figée à l'émission : une modification ultérieure du projet ne remplace pas l'image du devis", async () => {
    const userId = `u_${randomBytes(6).toString("hex")}`;
    await prisma.user.create({ data: { id: userId, name: "Visuel", email: `${userId}@test.invalid` } });
    const input = standardInput({ finishCode: "ANTHRACITE" });
    const cfg = await saveConfiguration({ input, ownerUserId: userId });
    const { q, visuals } = await quoteWith(input, await pngDataUrl(), { userId }, cfg.id);
    const v = visuals[0]!;
    expect(v.configurationId).toBe(cfg.id);
    expect(v.configurationVersion).toBe(cfg.version);
    const before = await readFile(resolveQuoteVisual(v.storageKey)!);

    const changed = await updateConfiguration(cfg.id, standardInput({ finishCode: "WHITE" }), { userId });
    expect(changed.version).toBe(cfg.version + 1);
    // nouvelle tentative de rattachement (ex. double soumission) : refusée, rien n'est remplacé
    expect((await attachQuoteVisual({ quoteId: q.id, dataUrl: await pngDataUrl(900, 600), input: standardInput({ finishCode: "WHITE" }), result: null, catalog: await loadCatalog(), configurationId: cfg.id })).kind).toBe("NONE");
    const after = await prisma.quoteVisual.findMany({ where: { quoteId: q.id } });
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: v.id, storageKey: v.storageKey, configurationVersion: cfg.version, inputHash: v.inputHash });
    expect((await readFile(resolveQuoteVisual(v.storageKey)!)).equals(before)).toBe(true);
  });

  it("configuration enregistrée différente de l'entrée du devis : version non rattachée", async () => {
    const userId = `u_${randomBytes(6).toString("hex")}`;
    await prisma.user.create({ data: { id: userId, name: "Visuel 2", email: `${userId}@test.invalid` } });
    const cfg = await saveConfiguration({ input: standardInput({ finishCode: "WHITE" }), ownerUserId: userId });
    const { visuals } = await quoteWith(standardInput({ finishCode: "ANTHRACITE" }), await pngDataUrl(), { userId }, cfg.id);
    expect(visuals[0]).toMatchObject({ configurationId: cfg.id, configurationVersion: null });
  });
});

describe("accès au visuel et au PDF du devis", () => {
  it("titulaire et administration uniquement ; invité, autre client et anonyme refusés", async () => {
    const owner = `u_${randomBytes(6).toString("hex")}`;
    const other = `u_${randomBytes(6).toString("hex")}`;
    await prisma.user.createMany({ data: [{ id: owner, name: "Titulaire", email: `${owner}@test.invalid` }, { id: other, name: "Autre", email: `${other}@test.invalid` }] });
    const { q } = await quoteWith(standardInput(), await pngDataUrl(), { userId: owner });
    const guestQuote = await quoteWith(standardInput(), await pngDataUrl());

    expect(await quoteForViewer(q.id, { userId: owner, role: "CUSTOMER" })).not.toBeNull();
    expect(await quoteForViewer(q.id, { userId: other, role: "CUSTOMER" })).toBeNull();
    expect(await quoteForViewer(q.id, null)).toBeNull();
    expect(await quoteForViewer(q.id, { userId: other, role: "MANAGER" })).not.toBeNull();
    expect(await quoteForViewer(q.id, { userId: other, role: "ADMIN" })).not.toBeNull();
    // devis demandé en invité : pas d'accès par URL, même en connaissant l'identifiant
    expect(await quoteForViewer(guestQuote.q.id, { userId: other, role: "CUSTOMER" })).toBeNull();

    const params = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
    for (const id of [q.id, guestQuote.q.id, "inexistant"]) {
      expect((await getPdf(new Request(`http://localhost/api/devis/${id}/pdf`), params(id))).status).toBe(404);
      expect((await getVisual(new Request(`http://localhost/api/devis/${id}/visuel`), params(id))).status).toBe(404);
    }
  });
});
