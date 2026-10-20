/**
 * Seed idempotent : données de référence (finitions, dimensions), catalogue de
 * DÉMONSTRATION, paramètres du site, pages de contenu avec champs manquants.
 * Relançable sans doublon (upsert par clés naturelles).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  CLOSURE_COMPAT, DEMO_PRICE_GRID, DIMENSIONS, FAMILIES, FAMILY_CONTENT, FINISHES, INSTALLATION_RATES, OPTION_COMPAT, PROMOTIONS, SHIPPING_RULES, buildVariants,
} from "../src/server/catalog/demo-data";
import { CONTENT_PAGES } from "../src/server/content/default-pages";
import { seedDemoRenders } from "../src/server/media/demo-renders";
import { seedReferenceValidations } from "../src/server/validation/seed";
import { seedHeliostores, setLegacyCatalogue } from "../src/server/catalog/heliostores-seed";

const up = (s: string) => s.toUpperCase();

export async function runSeed(prisma: PrismaClient) {
  await prisma.siteSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, brandName: process.env.NEXT_PUBLIC_BRAND_NAME ?? "HELIOSTORES" } });
  await prisma.customPergolaSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  for (const [i, f] of FINISHES.entries()) {
    await prisma.finish.upsert({ where: { code: f.code }, update: { label: f.label, structureColor: f.structureColor, bladeColor: f.bladeColor, swatch: f.swatch, sortOrder: i }, create: { ...f, sortOrder: i } });
  }
  for (const [i, d] of DIMENSIONS.entries()) {
    await prisma.dimensionPreset.upsert({ where: { code: d.code }, update: { label: d.label, widthMm: d.widthMm, lengthMm: d.lengthMm, sortOrder: i }, create: { ...d, sortOrder: i } });
  }
  const familyIds = new Map<string, string>();
  for (const [i, f] of FAMILIES.entries()) {
    const content = FAMILY_CONTENT[f.slug] ?? { description: "", included: [], faq: [] };
    const data = {
      name: f.name,
      kind: up(f.kind) as never,
      status: up(f.status) as never,
      generation: f.generation ?? null,
      shortDescription: f.shortDescription,
      description: content.description,
      roof: f.roof ?? null,
      lightingIncluded: f.lightingIncluded ?? null,
      accessoryRails: f.accessoryRails ?? null,
      dividerThresholdMm: f.dividerThresholdMm ?? null,
      mountings: (f.mountings ?? []).map((m) => (m === "wall" ? "WALL" : "FREESTANDING")) as never,
      specs: f.specs ?? [],
      faq: content.faq,
      included: content.included,
      dataStatus: up(f.dataStatus) as never,
      sortOrder: i,
    };
    const row = await prisma.productFamily.upsert({ where: { slug: f.slug }, update: data, create: { slug: f.slug, ...data } });
    familyIds.set(f.slug, row.id);
    // Données techniques du jeu de démo : seules les lignes non confirmées sont réécrites ;
    // une confirmation fournisseur saisie en administration n'est jamais écrasée.
    await prisma.technicalSpec.deleteMany({ where: { familyId: row.id, source: { in: ["DEMO_SEED", "OBSERVED_REFERENCE"] } } });
    for (const s of f.technicalSpecs ?? []) {
      await prisma.technicalSpec.create({ data: { familyId: row.id, key: s.key, label: s.label, valueNum: s.valueNum ?? null, unit: s.unit ?? null, valueText: s.valueText ?? null, source: s.source.toUpperCase() as never, sourceRef: s.sourceRef ?? "", observedAt: s.observedAt ? new Date(s.observedAt) : null, note: s.source === "demo_seed" ? "Ne pas publier : non issue d'une source." : "" } });
    }
    await prisma.familyFinish.deleteMany({ where: { familyId: row.id } });
    await prisma.familyDimension.deleteMany({ where: { familyId: row.id } });
    if (f.finishCodes?.length) await prisma.familyFinish.createMany({ data: f.finishCodes.map((c) => ({ familyId: row.id, finishCode: c })) });
    if (f.dimensionCodes?.length) await prisma.familyDimension.createMany({ data: f.dimensionCodes.map((c) => ({ familyId: row.id, dimensionCode: c })) });
  }

  const variants = buildVariants();
  let created = 0;
  for (const v of variants) {
    const familyId = familyIds.get(v.familySlug)!;
    const existing = await prisma.variant.findUnique({ where: { sku: v.sku } });
    const data = {
      familyId, label: v.label, priceCents: v.priceCents, compareAtCents: v.compareAtCents ?? null, taxRateBps: v.taxRateBps, purchasable: v.purchasable,
      dataStatus: up(v.dataStatus) as never, stockMode: (v.stockMode === "stock" ? "STOCK" : "MADE_TO_ORDER") as never, stockQty: v.stockQty ?? null,
      leadTimeDays: v.leadTimeDays ?? null, weightGrams: v.weightGrams ?? null, attributes: v.attributes as never,
      availability: up(v.availability ?? "to_confirm") as never, leadMinDays: v.leadMinDays ?? null, leadMaxDays: v.leadMaxDays ?? null,
      leadUnit: up(v.leadUnit ?? "business_days") as never, leadSource: up(v.leadSource ?? "unknown") as never, leadUpdatedAt: new Date("2026-10-19T00:00:00Z"),
      supplierDays: v.leadComponents?.supplier ?? null, preparationDays: v.leadComponents?.preparation ?? null, productionDays: v.leadComponents?.production ?? null, transportDays: v.leadComponents?.transport ?? null,
      preorderAllowed: v.preorderAllowed ?? false, partialShipAllowed: v.partialShipAllowed ?? true,
      stockSource: v.stockMode === "stock" ? "démonstration (aucune source connectée)" : "", stockUpdatedAt: v.stockMode === "stock" ? new Date("2026-10-19T00:00:00Z") : null,
    };
    if (existing) {
      // Un prix modifié par l'administration (SUPPLIER_VERIFIED) n'est jamais écrasé par le seed.
      if (existing.dataStatus === "DEMO" || existing.dataStatus === "UNKNOWN") await prisma.variant.update({ where: { sku: v.sku }, data });
    } else {
      await prisma.variant.create({ data: { sku: v.sku, ...data } });
      created += 1;
    }
  }

  // Règles : remplacées intégralement si aucune règle n'a été éditée en administration (dataStatus != DEMO/UNKNOWN du seed)
  const edited = await prisma.closureCompatRule.count({ where: { dataStatus: "SUPPLIER_VERIFIED" } });
  if (edited === 0) {
    await prisma.closureCompatRule.deleteMany({});
    await prisma.closureCompatRule.createMany({ data: CLOSURE_COMPAT.map((r) => ({ closureFamilySlug: r.closureFamilySlug, pergolaFamilySlug: r.pergolaFamilySlug, segmentLengthMm: r.segmentLengthMm === "*" ? null : r.segmentLengthMm, pergolaFinishCode: r.pergolaFinishCode, mounting: r.mounting, status: up(r.status) as never, reason: r.reason ?? null, dataStatus: up(r.dataStatus) as never })) });
  }
  for (const r of OPTION_COMPAT) {
    await prisma.optionCompatRule.upsert({
      where: { optionFamilySlug_pergolaFamilySlug: { optionFamilySlug: r.optionFamilySlug, pergolaFamilySlug: r.pergolaFamilySlug } },
      update: {},
      create: { optionFamilySlug: r.optionFamilySlug, pergolaFamilySlug: r.pergolaFamilySlug, status: up(r.status) as never, includedInBase: r.includedInBase ?? false, maxQty: r.maxQty ?? null, reason: r.reason ?? null, dataStatus: up(r.dataStatus) as never },
    });
  }
  if ((await prisma.installationRate.count()) === 0) {
    await prisma.installationRate.createMany({ data: INSTALLATION_RATES.map((r) => ({ familySlug: r.familySlug, dimensionCode: r.dimensionCode ?? null, priceCents: r.priceCents, dataStatus: up(r.dataStatus) as never })) });
  }
  if ((await prisma.shippingRule.count()) === 0) {
    await prisma.shippingRule.createMany({ data: SHIPPING_RULES.map((r, i) => ({ countryCode: r.countryCode, postalPrefixes: r.postalPrefixes, priceCents: r.priceCents, label: r.label, quoteRequired: r.quoteRequired ?? false, sortOrder: i })) });
  }
  for (const p of PROMOTIONS) {
    await prisma.promotion.upsert({ where: { code: p.code }, update: {}, create: { code: p.code, label: p.label, familySlugs: p.familySlugs === "*" ? [] : p.familySlugs, allFamilies: p.familySlugs === "*", percentBps: p.percentBps, active: p.active } });
  }
  for (const page of CONTENT_PAGES) {
    await prisma.contentPage.upsert({ where: { slug: page.slug }, update: {}, create: page });
  }
  // Réalisations / showroom : structure de démonstration, non publiée
  if ((await prisma.realisation.count()) === 0) {
    await prisma.realisation.createMany({ data: [
      { title: "Terrasse ombragée (exemple de structure)", description: "Fiche de démonstration : à remplacer par une réalisation réelle et autorisée.", location: "Ville, département", familySlug: "pergola-solis-pro", published: false, isDemo: true, sortOrder: 1 },
    ] });
  }
  if ((await prisma.showroom.count()) === 0) {
    await prisma.showroom.create({ data: { name: "Showroom (à renseigner)", line1: "Adresse à renseigner", postalCode: "00000", city: "Ville", hours: "Horaires à renseigner", published: false, isDemo: true } });
  }
  // Grille sur mesure FICTIVE : créée une seule fois, jamais écrasée (une grille importée prend une autre version)
  const g = DEMO_PRICE_GRID;
  const existingGrid = await prisma.priceGrid.findUnique({ where: { familySlug_version: { familySlug: g.familySlug, version: g.version } } });
  if (!existingGrid) {
    await prisma.priceGrid.create({
      data: {
        familySlug: g.familySlug, name: g.name, version: g.version, status: "PUBLISHED", mode: "TABLE", validFrom: g.validFrom ? new Date(g.validFrom) : null, validTo: null,
        dataStatus: "DEMO", isDemo: true, source: "Grille fictive ELIOS SOLAR pour tester le moteur — aucune donnée commerciale",
        widthMinMm: g.widthMm.min, widthMaxMm: g.widthMm.max, widthStepMm: g.widthMm.step, lengthMinMm: g.lengthMm.min, lengthMaxMm: g.lengthMm.max, lengthStepMm: g.lengthMm.step,
        heightMinMm: g.heightMm.min, heightMaxMm: g.heightMm.max, heightStepMm: g.heightMm.step, mountings: g.mountings, finishCodes: g.finishCodes,
        notes: "Zone 3,51–4 × 5,01–6 m adossée volontairement sans tarif (démonstration du parcours devis).",
        cells: { create: g.cells.map((c) => ({ ...c })) },
        surcharges: { create: g.surcharges.map((x, i) => ({ code: x.code, label: x.label, kind: x.kind, match: x.match, thresholdMm: x.thresholdMm ?? null, perStepMm: x.perStepMm ?? null, perStepCents: x.perStepCents ?? null, priceCents: x.priceCents, percentBps: x.percentBps, sortOrder: i })) },
      },
    });
  }

  // Catalogue HELIOSTORES (sources publiables) ; l'ancien catalogue de démonstration est archivé pour l'historique,
  // sauf SEED_LEGACY_DEMO=active (jeu d'essai des tests d'intégration du panier, des commandes et du paiement simulé).
  const legacyMode = process.env.SEED_LEGACY_DEMO === "active" ? "active" : "archived";
  const helio = await seedHeliostores(prisma);
  const legacy = await setLegacyCatalogue(prisma, FAMILIES.map((f) => f.slug), legacyMode);
  console.log(`HELIOSTORES : ${helio.families} familles, ${helio.specs} données sourcées, ${helio.documents} document(s) fabricant ajouté(s) ; ancien catalogue (${legacy} familles) : ${legacyMode === "active" ? "jeu d'essai actif" : "archivé"}`);

  // Rendus originaux (scènes procédurales) de l'ancien catalogue : seulement comme jeu d'essai (SEED_SKIP_RENDERS=1 pour les ignorer)
  if (process.env.SEED_SKIP_RENDERS !== "1" && legacyMode === "active") {
    const r = await seedDemoRenders(prisma);
    console.log(`Rendus : ${r.created} créés, ${r.skipped} existants, ${r.linked} associations, ${r.documents} document(s) démo`);
  }

  const dossiers = await seedReferenceValidations(prisma);
  if (dossiers) console.log(`Dossiers de validation : ${dossiers} créé(s) (à vérifier)`);

  const counts = { families: await prisma.productFamily.count(), variants: await prisma.variant.count(), closureRules: await prisma.closureCompatRule.count(), optionRules: await prisma.optionCompatRule.count() };
  console.log(`Seed terminé : ${JSON.stringify(counts)} (variantes créées : ${created})`);
}

if (process.argv[1] && /seed\.ts$/.test(process.argv[1])) {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  runSeed(prisma).catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
}
