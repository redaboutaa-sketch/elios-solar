"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { gridFromDb, invalidateCatalogCache } from "@/server/catalog/load";
import { actorOf, back, fields } from "@/server/admin/form";
import { createDraftGrid, parseGridFile } from "@/server/pricing/grid-import";
import { priceFromGrid, validateGrid, type GridPriceResult, type GridValidation } from "@/domain/pricing-grid";

export type GridPreviewState =
  | { error: string }
  | { filename: string; text: string; summary: { familySlug: string; name: string; cells: number; surcharges: number; priceRange: [number, number] }; validation: Pick<GridValidation, "errors" | "warnings" | "gaps" | "overlaps" | "coverage"> };
export type GridTestState = { error: string } | { result: GridPriceResult };

const PATH = "/admin/catalogue/grilles";

export async function previewGridAction(_prev: unknown, formData: FormData): Promise<GridPreviewState> {
  await assertRole(["ADMIN", "MANAGER"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Aucun fichier reçu." };
  if (file.size > 4 * 1024 * 1024) return { error: "Fichier trop volumineux (4 Mo max.)." };
  const text = await file.text();
  const r = parseGridFile(file.name, text);
  if ("error" in r) return { error: r.error };
  return { filename: file.name, text, summary: { familySlug: r.file.familySlug, name: r.file.name, cells: r.snapshot.cells.length, surcharges: r.snapshot.surcharges.length, priceRange: [Math.min(...r.snapshot.cells.map((c) => c.priceCents)), Math.max(...r.snapshot.cells.map((c) => c.priceCents))] as [number, number] }, validation: { errors: r.validation.errors, warnings: r.validation.warnings, gaps: r.validation.gaps.slice(0, 30), overlaps: r.validation.overlaps.slice(0, 30), coverage: r.validation.coverage } };
}

export async function importGridAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const text = String(formData.get("text") ?? "");
  const filename = String(formData.get("filename") ?? "grille.json");
  const r = parseGridFile(filename, text);
  if ("error" in r) back(PATH, r.error, "err");
  if (r.validation.errors.length) back(PATH, `Grille refusée : ${r.validation.errors[0]!.message}`, "err");
  const family = await prisma.productFamily.findUnique({ where: { slug: r.file.familySlug }, select: { kind: true } });
  if (family?.kind !== "PERGOLA_CUSTOM") back(PATH, `Famille « ${r.file.familySlug} » inconnue ou non sur mesure.`, "err");
  const grid = await createDraftGrid(r.file, filename, session.user.email);
  await audit({ ...actorOf(session), action: "grid.import", entity: "PriceGrid", entityId: grid.id, after: { familySlug: grid.familySlug, version: grid.version, cells: r.snapshot.cells.length, source: grid.source } });
  back(`${PATH}?grille=${grid.id}`, `Grille importée en brouillon (v${grid.version}). Testez-la avant publication.`);
}

const statusSchema = z.object({ id: z.string().min(1).max(64), status: z.enum(["DRAFT", "TESTING", "PUBLISHED", "ARCHIVED"]) });

export async function setGridStatusAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN"]);
  const p = statusSchema.safeParse(fields(formData));
  if (!p.success) back(PATH, "Requête invalide", "err");
  const g = await prisma.priceGrid.findUnique({ where: { id: p.data.id }, include: { cells: true, surcharges: true } });
  if (!g) back(PATH, "Grille introuvable", "err");
  if (p.data.status === "PUBLISHED") {
    const v = validateGrid(gridFromDb(g));
    if (v.errors.length) back(`${PATH}?grille=${g.id}`, `Publication refusée : ${v.errors[0]!.message}`, "err");
    if (g.status !== "TESTING") back(`${PATH}?grille=${g.id}`, "Passez d'abord la grille en test et vérifiez des combinaisons.", "err");
  }
  await prisma.$transaction(async (tx) => {
    if (p.data.status === "PUBLISHED") await tx.priceGrid.updateMany({ where: { familySlug: g.familySlug, status: "PUBLISHED", id: { not: g.id } }, data: { status: "ARCHIVED" } });
    await tx.priceGrid.update({ where: { id: g.id }, data: { status: p.data.status } });
  });
  invalidateCatalogCache();
  await audit({ ...actorOf(session), action: "grid.status", entity: "PriceGrid", entityId: g.id, before: { status: g.status }, after: { status: p.data.status } });
  back(`${PATH}?grille=${g.id}`, p.data.status === "PUBLISHED" ? `v${g.version} publiée ; l'ancienne version publiée est archivée.` : `Statut : ${p.data.status}.`);
}

/** Test d'une grille (brouillon compris) sur une combinaison, sans publication. */
export async function testGridAction(_prev: unknown, formData: FormData): Promise<GridTestState> {
  await assertRole(["ADMIN", "MANAGER"]);
  const f = fields(formData);
  const g = await prisma.priceGrid.findUnique({ where: { id: f.id ?? "" }, include: { cells: true, surcharges: true } });
  if (!g) return { error: "Grille introuvable" };
  const n = (k: string) => Number(f[k]);
  const snap = { ...gridFromDb(g), status: "published" as const };
  const res = priceFromGrid(snap, { widthMm: n("widthMm"), lengthMm: n("lengthMm"), heightMm: n("heightMm"), mounting: f.mounting === "wall" ? "wall" : "freestanding", finishCode: f.finishCode ?? "ANTHRACITE", closureSlugs: (f.closures ?? "").split(",").map((s) => s.trim()).filter(Boolean) });
  return { result: res };
}
