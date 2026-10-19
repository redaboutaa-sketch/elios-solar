/**
 * Rendus originaux ELIOS SOLAR : les scènes SVG procédurales (TerraceScene, PergolaArt,
 * RoofDetailArt, AwningArt, ClosureArt) sont rendues en SVG (react-dom/server) puis en PNG
 * (sharp, 1600 px de large) et enregistrées dans la médiathèque (nature RENDER, statut PUBLISHED).
 *
 * - Idempotent : chaque rendu porte une clé dans `renderConfig.key` ; un rendu déjà présent
 *   (fichier compris) n'est pas régénéré. Un fichier manquant est régénéré et le chemin mis à jour.
 * - Aucun rendu n'est présenté comme une photographie : nature RENDER + texte alternatif explicite.
 * - Les équipements visibles non compris dans le prix sont listés dans `visibleOptions`.
 * - Sans `server-only` : appelé par `prisma/seed.ts` et `scripts/generate-renders.ts`.
 */
import { existsSync } from "node:fs";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import type { PrismaClient } from "../../generated/prisma/client";
import { TerraceScene } from "../../components/illustrations/scene";
import { AwningArt, ClosureArt, PergolaArt, RoofDetailArt, colorOf } from "../../components/illustrations/pergola";
import { artKind } from "../../components/illustrations/art-kind";
import { MEDIA_URL_PREFIX, resolveMediaFile, storeMediaBuffer } from "./storage";

export const RENDER_SOURCE = "Rendu original ELIOS SOLAR — scène procédurale";
const RENDER_WIDTH = 1600;
const FABRICS: Record<string, { color: string; label: string }> = { GREY: { color: "#9a9a94", label: "toile grise" }, BEIGE: { color: "#d8c8a8", label: "toile beige" } };

export interface RenderSpec {
  key: string;
  familySlug: string;
  element: ReactElement;
  alt: string;
  title: string;
  caption: string;
  role: "hero" | "gallery" | "detail" | "night" | "plan";
  sortOrder: number;
  finishCode: string | null;
  mounting: "wall" | "freestanding" | null;
  tags: string[];
  visibleOptions: string;
  config: Record<string, unknown>;
}

interface FamilyRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  lightingIncluded: string | null;
  finishes: Array<{ finishCode: string; finish: { label: string; structureColor: string; bladeColor: string } }>;
}

/** Liste déclarative des rendus à produire pour le catalogue courant. */
export function buildRenderSpecs(families: FamilyRow[]): RenderSpec[] {
  const specs: RenderSpec[] = [];
  for (const f of families) {
    if (f.kind === "PERGOLA_STANDARD") {
      const lighting = !!f.lightingIncluded && f.lightingIncluded !== "none";
      f.finishes.forEach((ff, fi) => {
        const structure = colorOf(ff.finish.structureColor), blades = colorOf(ff.finish.bladeColor);
        const fin = ff.finish.label.toLowerCase();
        const base = { familySlug: f.slug, finishCode: ff.finishCode, tags: [] as string[] };
        const cfg = (view: string, mounting: string, equipment: string[] = []) => ({ key: `${f.slug}|${ff.finishCode}|${mounting}|${view}|${equipment.join("+") || "nu"}`, range: f.slug, finish: ff.finishCode, mounting, view, equipment, lighting: lighting && view === "soiree" });
        const o = fi * 10;
        specs.push({
          ...base, key: cfg("situation", "freestanding").key, config: cfg("situation", "freestanding"), role: fi === 0 ? "hero" : "gallery", sortOrder: o + 0, mounting: "freestanding",
          element: createElement(TerraceScene, { structure, blades, mounting: "freestanding", lighting: false, title: `${f.name} ${fin}, autoportée, en situation` }),
          alt: `Visualisation 3D (rendu) : ${f.name} finition ${fin}, autoportée sur une terrasse en bois, en journée`, title: `${f.name} — ${ff.finish.label}, autoportée`, caption: `En situation — autoportée, ${fin}`,
          visibleOptions: "Mobilier, jardinières et végétation (décor)",
        });
        specs.push({
          ...base, key: cfg("situation", "wall").key, config: cfg("situation", "wall"), role: "gallery", sortOrder: o + 1, mounting: "wall",
          element: createElement(TerraceScene, { structure, blades, mounting: "wall", lighting: false, title: `${f.name} ${fin}, adossée, en situation` }),
          alt: `Visualisation 3D (rendu) : ${f.name} finition ${fin}, adossée au mur de la maison, en journée`, title: `${f.name} — ${ff.finish.label}, adossée`, caption: `En situation — adossée, ${fin}`,
          visibleOptions: "Mobilier, jardinières et végétation (décor)",
        });
        for (const mounting of ["freestanding", "wall"] as const) {
          specs.push({
            ...base, key: cfg("trois-quarts", mounting).key, config: cfg("trois-quarts", mounting), role: "gallery", sortOrder: o + 2, mounting,
            element: createElement(PergolaArt, { structure, blades, mounting, lighting: false, title: `${f.name} ${fin}, vue trois quarts` }),
            alt: `Visualisation 3D (rendu) : ${f.name} finition ${fin}, ${mounting === "wall" ? "adossée" : "autoportée"}, vue trois quarts`, title: `${f.name} — vue trois quarts`, caption: `Vue trois quarts — ${mounting === "wall" ? "adossée" : "autoportée"}`,
            visibleOptions: "",
          });
        }
        if (lighting) {
          specs.push({
            ...base, key: cfg("soiree", "freestanding").key, config: cfg("soiree", "freestanding"), role: "night", sortOrder: o + 3, mounting: "freestanding",
            element: createElement(TerraceScene, { structure, blades, mounting: "freestanding", lighting: true, evening: true, title: `${f.name} ${fin} le soir, éclairage inclus` }),
            alt: `Visualisation 3D (rendu) : ${f.name} finition ${fin} le soir, éclairage LED inclus allumé`, title: `${f.name} — le soir`, caption: "Le soir — éclairage inclus",
            visibleOptions: "Mobilier, jardinières, lampadaire et végétation (décor)",
          });
        }
        specs.push({
          ...base, key: cfg("detail", "any").key, config: cfg("detail", "any"), role: "detail", sortOrder: o + 4, mounting: null,
          element: createElement(RoofDetailArt, { structure, blades, title: `${f.name} ${fin}, détail des lames` }),
          alt: `Schéma (rendu) : coupe des lames orientables et de la gouttière, ${f.name} finition ${fin}`, title: `${f.name} — détail du toit`, caption: "Détail — lames orientables et gouttière (schéma)",
          visibleOptions: "",
        });
        if (fi === 0) {
          const eq = ["paroi-vitree:gauche", "store-vertical-zip:droite"];
          specs.push({
            ...base, key: cfg("equipee", "freestanding", eq).key, config: cfg("equipee", "freestanding", eq), role: "gallery", sortOrder: o + 5, mounting: "freestanding", tags: ["equipee"],
            element: createElement(TerraceScene, { structure, blades, mounting: "freestanding", lighting: false, closures: { left: "glass", right: "screen" }, title: `${f.name} ${fin} équipée d'une paroi vitrée et d'un store vertical` }),
            alt: `Visualisation 3D (rendu) : ${f.name} finition ${fin} équipée d'une paroi vitrée à gauche et d'un store vertical ZIP à droite`, title: `${f.name} — exemple équipé`, caption: "Exemple équipé — fermetures en option",
            visibleOptions: "Paroi vitrée (côté gauche), store vertical ZIP (côté droit), mobilier et végétation (décor)",
          });
        }
      });
    } else if (f.kind === "AWNING") {
      let i = 0;
      for (const [code, fab] of Object.entries(FABRICS)) {
        const key = `${f.slug}|ANTHRACITE|${code}|deploye`;
        specs.push({
          key, familySlug: f.slug, finishCode: "ANTHRACITE", mounting: "wall", tags: [`toile:${code}`], role: i === 0 ? "hero" : "gallery", sortOrder: i,
          config: { key, range: f.slug, cabinet: "ANTHRACITE", fabric: code, view: "deploye", lighting: true },
          element: createElement(AwningArt, { cabinet: "ANTHRACITE", fabric: fab.color, lighting: true, extended: true, title: `${f.name} déployé, ${fab.label}` }),
          alt: `Visualisation 3D (rendu) : ${f.name} coffre anthracite déployé, ${fab.label}, en façade`, title: `${f.name} — ${fab.label}`, caption: `Déployé — coffre anthracite, ${fab.label}`,
          visibleOptions: "Mobilier (décor)",
        });
        i++;
      }
      const key = `${f.slug}|ANTHRACITE|GREY|soiree`;
      specs.push({
        key, familySlug: f.slug, finishCode: "ANTHRACITE", mounting: "wall", tags: ["toile:GREY"], role: "night", sortOrder: i,
        config: { key, range: f.slug, cabinet: "ANTHRACITE", fabric: "GREY", view: "soiree", lighting: true },
        element: createElement(AwningArt, { cabinet: "ANTHRACITE", fabric: FABRICS.GREY!.color, lighting: true, extended: true, evening: true, title: `${f.name} le soir, LED allumées` }),
        alt: `Visualisation 3D (rendu) : ${f.name} déployé le soir, éclairage LED allumé`, title: `${f.name} — le soir`, caption: "Le soir — LED du store",
        visibleOptions: "Mobilier (décor)",
      });
      const keyR = `${f.slug}|ANTHRACITE|GREY|replie`;
      specs.push({
        key: keyR, familySlug: f.slug, finishCode: "ANTHRACITE", mounting: "wall", tags: [], role: "gallery", sortOrder: i + 1,
        config: { key: keyR, range: f.slug, cabinet: "ANTHRACITE", view: "replie" },
        element: createElement(AwningArt, { cabinet: "ANTHRACITE", lighting: false, extended: false, title: `${f.name} replié dans son coffre` }),
        alt: `Visualisation 3D (rendu) : ${f.name} replié dans son coffre intégral anthracite`, title: `${f.name} — replié`, caption: "Replié — toile protégée dans le coffre",
        visibleOptions: "Mobilier (décor)",
      });
    } else if (f.kind === "SIDE_CLOSURE" || f.kind === "OPTION") {
      const kind = artKind(f.slug);
      const key = `${f.slug}|ANTHRACITE|produit`;
      specs.push({
        key, familySlug: f.slug, finishCode: null, mounting: null, tags: [], role: "hero", sortOrder: 0,
        config: { key, range: f.slug, view: "produit", art: kind, color: "ANTHRACITE" },
        element: createElement(ClosureArt, { kind, color: "ANTHRACITE", title: `${f.name}, rendu de principe` }),
        alt: `Visualisation 3D (rendu de principe) : ${f.name} entre deux poteaux de pergola anthracite`, title: `${f.name} — rendu de principe`, caption: "Rendu de principe",
        visibleOptions: "Poteaux et poutre de pergola (non compris)",
      });
      if (kind === "glass" || kind === "slats" || kind === "screen") {
        const keyS = `${f.slug}|ANTHRACITE|situation`;
        specs.push({
          key: keyS, familySlug: f.slug, finishCode: null, mounting: "freestanding", tags: [], role: "gallery", sortOrder: 1,
          config: { key: keyS, range: f.slug, view: "situation", closure: kind, sides: ["left", "right"] },
          element: createElement(TerraceScene, { mounting: "freestanding", closures: { left: kind, right: kind }, title: `${f.name} posée sur deux côtés d'une pergola` }),
          alt: `Visualisation 3D (rendu) : ${f.name} installée sur les côtés gauche et droit d'une pergola bioclimatique anthracite`, title: `${f.name} — en situation`, caption: "En situation, sur deux côtés",
          visibleOptions: "Pergola, mobilier et végétation (non compris)",
        });
      }
    }
  }
  return specs;
}

export async function renderToPng(element: ReactElement, width = RENDER_WIDTH): Promise<{ png: Buffer; width: number; height: number }> {
  let svg = renderToStaticMarkup(element);
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const png = await sharp(Buffer.from(svg), { density: 300 }).resize({ width }).png({ compressionLevel: 9, palette: false }).toBuffer();
  const meta = await sharp(png).metadata();
  return { png, width: meta.width ?? width, height: meta.height ?? 0 };
}

function fileExists(url: string): boolean {
  if (!url.startsWith(MEDIA_URL_PREFIX)) return false;
  const full = resolveMediaFile(url.slice(MEDIA_URL_PREFIX.length));
  return !!full && existsSync(full);
}

export interface SeedRendersResult { created: number; skipped: number; regenerated: number; linked: number; documents: number }

/** Génère (si besoin) les rendus et les associe aux familles ; crée le document de démonstration en brouillon. */
export async function seedDemoRenders(prisma: PrismaClient, opts: { log?: (m: string) => void; only?: string[] } = {}): Promise<SeedRendersResult> {
  const log = opts.log ?? (() => undefined);
  const families = await prisma.productFamily.findMany({
    where: { status: { not: "ARCHIVED" }, kind: { in: ["PERGOLA_STANDARD", "AWNING", "SIDE_CLOSURE", "OPTION"] }, ...(opts.only?.length ? { slug: { in: opts.only } } : {}) },
    select: { id: true, slug: true, name: true, kind: true, lightingIncluded: true, finishes: { select: { finishCode: true, finish: { select: { label: true, structureColor: true, bladeColor: true, sortOrder: true } } }, orderBy: { finish: { sortOrder: "asc" } } } },
  });
  const famId = new Map(families.map((f) => [f.slug, f.id]));
  const res: SeedRendersResult = { created: 0, skipped: 0, regenerated: 0, linked: 0, documents: 0 };
  for (const spec of buildRenderSpecs(families)) {
    const familyId = famId.get(spec.familySlug)!;
    const existing = await prisma.media.findFirst({ where: { nature: "RENDER", renderConfig: { path: ["key"], equals: spec.key } } });
    let mediaId: string;
    if (existing && fileExists(existing.path)) {
      mediaId = existing.id;
      res.skipped++;
    } else {
      const { png, width, height } = await renderToPng(spec.element);
      const { url } = await storeMediaBuffer(png, "image/png");
      const data = {
        kind: "image", nature: "RENDER" as const, status: "PUBLISHED" as const, path: url, mimeType: "image/png", sizeBytes: png.length, width, height,
        alt: spec.alt, title: spec.title, source: RENDER_SOURCE, license: "interne", credit: "ELIOS SOLAR",
        rightsNote: "Création originale générée par le site (aucune photographie, aucun visuel de tiers).", visibleOptions: spec.visibleOptions,
        renderConfig: spec.config as never, sortOrder: spec.sortOrder, validatedBy: "seed (rendu procédural)", validatedAt: new Date(),
      };
      if (existing) {
        await prisma.media.update({ where: { id: existing.id }, data });
        mediaId = existing.id;
        res.regenerated++;
      } else {
        mediaId = (await prisma.media.create({ data })).id;
        res.created++;
      }
      log(`rendu ${spec.key} → ${url}`);
    }
    const link = await prisma.productMedia.findFirst({ where: { familyId, mediaId } });
    if (!link) {
      await prisma.productMedia.create({ data: { familyId, mediaId, role: spec.role, caption: spec.caption, sortOrder: spec.sortOrder, finishCode: spec.finishCode, mounting: spec.mounting, tags: spec.tags, context: { generated: true, key: spec.key } } });
      res.linked++;
    }
  }
  // Document de démonstration : brouillon évident, sans contenu technique inventé.
  const pro = await prisma.productFamily.findUnique({ where: { slug: "pergola-solis-pro" }, select: { id: true } });
  if (pro) {
    const groupKey = "demo-notice-montage-pergola-solis-pro";
    const exists = await prisma.document.findFirst({ where: { groupKey } });
    if (!exists) {
      await prisma.document.create({
        data: {
          groupKey, version: 1, familyId: pro.id, title: "Notice de montage — à fournir par le fournisseur", kind: "notice", status: "DRAFT", audience: "CUSTOMER", dataStatus: "DEMO",
          summary: "Emplacement réservé : la notice officielle du fournisseur sera téléversée puis validée avant publication. Aucun contenu technique n'est rédigé par le site.",
          source: "Démonstration (aucun document fournisseur reçu)", notes: "Document de démonstration du workflow : ne pas publier en l'état.", createdBy: "seed",
        },
      });
      res.documents++;
    }
  }
  return res;
}
