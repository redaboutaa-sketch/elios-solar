/**
 * Synchronise les familles HELIOSTORES avec les données du code (src/server/catalog/families/*, heliostores-data.ts),
 * sans le reste du seed (catalogue de démonstration, variantes, réglages, contenus). Même règles que le seed :
 * statut jamais réécrit, textes commerciaux modifiés en administration conservés, ancien nom gardé en alias
 * (`nameHistory`) lors d'un renommage. Aucune donnée tarifaire n'est touchée.
 *
 *   node_modules/.bin/tsx scripts/catalogue-sync.ts            # aperçu des différences (champ par champ)
 *   node_modules/.bin/tsx scripts/catalogue-sync.ts --apply    # applique (idempotent, trace AuditLog)
 *   … --apply --open-study-requests                            # en plus : brouillons devenus « demande d'étude » dans
 *                                                                 le code (statut QUOTE_ONLY + studyOnly) → sur devis
 *
 * `--open-study-requests` (retour client du 2026-11-01, moustiquaires manquantes) ne change QUE les familles en
 * brouillon (DRAFT) en base que le code définit en demande d'étude sur devis ; tout autre statut choisi en
 * administration est conservé. Trace AuditLog par famille.
 */
import "dotenv/config";

const FIELDS = ["name", "supplierRef", "shortDescription", "description", "seoTitle", "seoDescription", "faq", "systemRules", "openQuestions", "included", "mountings", "sortOrder"] as const;

/** Sérialisation canonique (jsonb réordonne les clés et ignore les valeurs indéfinies). */
const canon = (v: unknown): string => JSON.stringify(v ?? null, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).filter(([, y]) => y !== undefined).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

async function main() {
  const apply = process.argv.includes("--apply");
  const { prisma } = await import("../src/lib/prisma");
  const { HELIOSTORES_FAMILIES } = await import("../src/server/catalog/heliostores-data");
  const { seedHeliostores } = await import("../src/server/catalog/heliostores-seed");
  const rows = new Map((await prisma.productFamily.findMany({ where: { slug: { in: HELIOSTORES_FAMILIES.map((f) => f.slug) } } })).map((r) => [r.slug, r as unknown as Record<string, unknown>]));
  const changes: Record<string, string[]> = {};
  for (const f of HELIOSTORES_FAMILIES) {
    const row = rows.get(f.slug);
    if (!row) { changes[f.slug] = ["(création)"]; continue; }
    const target: Record<string, unknown> = { name: f.name, supplierRef: f.supplierRef, shortDescription: f.shortDescription, description: f.description, seoTitle: f.seoTitle, seoDescription: f.seoDescription, faq: f.faq, systemRules: f.rules, openQuestions: f.openQuestions, included: f.rules.included.map((i) => i.label), sortOrder: f.sortOrder,
      mountings: [...new Set(f.rules.mountings.map((m) => m.code).filter((m) => m === "wall" || m === "freestanding"))].map((m) => (m === "wall" ? "WALL" : "FREESTANDING")) };
    const diff = FIELDS.filter((k) => canon(row[k]) !== canon(target[k])).map((k) => (k === "name" ? `name : « ${row.name} » → « ${f.name} »${row.commercialEditedAt ? " (modifié en administration : conservé)" : ""}` : k));
    if (diff.length) changes[f.slug] = diff;
  }
  for (const [slug, d] of Object.entries(changes)) console.log(`~ ${slug} : ${d.join(", ")}`);
  const study = HELIOSTORES_FAMILIES.filter((f) => f.status === "QUOTE_ONLY" && f.rules.studyOnly && (rows.get(f.slug) as { status?: string } | undefined)?.status === "DRAFT").map((f) => f.slug);
  if (study.length) console.log(`statut : ${study.join(", ")} — brouillon en base, demande d'étude dans le code${process.argv.includes("--open-study-requests") ? " → sur devis" : " (--open-study-requests pour ouvrir)"}`);
  if (!apply) { console.log(`Aperçu : ${Object.keys(changes).length} famille(s) à synchroniser sur ${HELIOSTORES_FAMILIES.length}`); await prisma.$disconnect(); return; }
  const r = await seedHeliostores(prisma);
  if (process.argv.includes("--open-study-requests")) {
    for (const slug of study) {
      await prisma.productFamily.update({ where: { slug }, data: { status: "QUOTE_ONLY" } });
      await prisma.auditLog.create({ data: { action: "family.status", entity: "ProductFamily", entityId: slug, before: { status: "DRAFT" } as never, after: { status: "QUOTE_ONLY", reason: "demande d'étude (retour client du 2026-11-01)" } as never } });
    }
    if (study.length) console.log(`Statut : ${study.length} demande(s) d'étude ouverte(s) sur devis`);
  }
  await prisma.auditLog.create({ data: { action: "catalogue.sync", entity: "ProductFamily", entityId: "heliostores", after: { families: Object.keys(changes), specs: r.specs } as never } });
  console.log(`Appliqué : ${Object.keys(changes).length} famille(s) synchronisée(s), ${r.specs} caractéristique(s) semée(s)`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
