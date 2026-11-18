import { afterAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { MEDIA_URL_PREFIX, mediaDir, resolveMediaFile } from "@/server/media/storage";
import { GET } from "@/app/api/media/[...path]/route";

const created: string[] = [];
async function file(status: "DRAFT" | "PUBLISHED", doc?: { status: "DRAFT" | "PUBLISHED"; audience: "PUBLIC" | "CUSTOMER" | "INTERNAL" }) {
  const name = `${randomBytes(16).toString("hex")}.pdf`;
  await mkdir(mediaDir(), { recursive: true });
  await writeFile(resolveMediaFile(name)!, "%PDF-1.4\n%test\n");
  const m = await prisma.media.create({ data: { kind: "document", nature: "DOCUMENT", status, path: `${MEDIA_URL_PREFIX}${name}`, mimeType: "application/pdf", alt: "test", source: "test", license: "test", credit: "test" } });
  created.push(m.id);
  if (doc) await prisma.document.create({ data: { title: "TEST accès", mediaId: m.id, status: doc.status, audience: doc.audience } });
  return name;
}
const get = (name: string) => GET(new Request(`http://localhost/api/media/${name}`), { params: Promise.resolve({ path: [name] }) } as never);

afterAll(async () => {
  const medias = await prisma.media.findMany({ where: { id: { in: created } } });
  await prisma.document.deleteMany({ where: { mediaId: { in: created } } });
  await prisma.media.deleteMany({ where: { id: { in: created } } });
  for (const m of medias) await unlink(resolveMediaFile(m.path.slice(MEDIA_URL_PREFIX.length))!).catch(() => undefined);
  await prisma.$disconnect();
});

describe("accès aux fichiers de la médiathèque (anonyme)", () => {
  it("média publié et document public publié : servis et mis en cache", async () => {
    const r = await get(await file("PUBLISHED"));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toMatch(/public/);
    expect((await get(await file("PUBLISHED", { status: "PUBLISHED", audience: "PUBLIC" }))).status).toBe(200);
  });
  it("brouillon, document non publié, document client ou interne : 404 sans session", async () => {
    expect((await get(await file("DRAFT"))).status).toBe(404);
    expect((await get(await file("PUBLISHED", { status: "DRAFT", audience: "PUBLIC" }))).status).toBe(404);
    expect((await get(await file("PUBLISHED", { status: "PUBLISHED", audience: "CUSTOMER" }))).status).toBe(404);
    expect((await get(await file("PUBLISHED", { status: "PUBLISHED", audience: "INTERNAL" }))).status).toBe(404);
  });
  it("variante listée (AVIF à nom descriptif) : suit le statut de son média", async () => {
    const names: Record<string, string> = {};
    for (const status of ["PUBLISHED", "DRAFT"] as const) {
      const main = `${randomBytes(16).toString("hex")}.webp`;
      const avif = `test-visualisation-640-${randomBytes(4).toString("hex")}.avif`;
      await writeFile(resolveMediaFile(main)!, "RIFF0000WEBP");
      await writeFile(resolveMediaFile(avif)!, Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from("ftypavif")]));
      const m = await prisma.media.create({ data: { kind: "image", nature: "RENDER", status, path: `${MEDIA_URL_PREFIX}${main}`, mimeType: "image/webp", alt: "test", source: "test", license: "test", credit: "", provenance: { files: [`${MEDIA_URL_PREFIX}${main}`, `${MEDIA_URL_PREFIX}${avif}`] } } });
      created.push(m.id);
      names[status] = avif;
    }
    const ok = await get(names.PUBLISHED!);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/avif");
    expect((await get(names.DRAFT!)).status).toBe(404);
    for (const n of Object.values(names)) await unlink(resolveMediaFile(n)!).catch(() => undefined);
  });
});
