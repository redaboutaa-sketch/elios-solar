/**
 * Import de variantes depuis un fichier CSV ou JSON (même logique que l'administration).
 *
 *   pnpm catalogue:import docs/import/variants.example.csv          # aperçu seulement
 *   pnpm catalogue:import docs/import/variants.example.csv --apply  # applique les lignes valides
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Usage : pnpm catalogue:import <fichier.csv|fichier.json> [--apply]");
    process.exit(2);
  }
  const { buildPreview, createImportPreview, applyImport, MAX_IMPORT_BYTES } = await import("../src/server/catalog/import");
  const { prisma } = await import("../src/lib/prisma");
  const text = await readFile(file, "utf8");
  if (Buffer.byteLength(text) > MAX_IMPORT_BYTES) throw new Error("Fichier trop volumineux (2 Mo maximum)");
  const name = path.basename(file);
  try {
    const { summary, errors } = await buildPreview(name, text);
    console.log(`Fichier : ${name}`);
    console.log(`Lignes : ${summary.total} · valides : ${summary.valid} · en erreur : ${summary.invalid}`);
    console.log(`Créations : ${summary.create} · mises à jour : ${summary.update} · inchangées : ${summary.unchanged} · prix modifiés : ${summary.priceChanged}`);
    for (const e of errors) console.log(`  ✗ ligne ${e.line}${e.sku ? ` (${e.sku})` : ""} : ${e.message}`);
    for (const r of summary.rows.filter((x) => x.action !== "unchanged")) {
      const price = r.priceChanged ? ` prix ${r.oldPriceCents} → ${r.priceCents}` : "";
      console.log(`  ${r.action === "create" ? "+" : "~"} ${r.sku} (${r.familySlug})${price}`);
    }
    if (!apply) {
      console.log("\nAperçu uniquement. Relancez avec --apply pour appliquer les lignes valides.");
      return;
    }
    if (summary.create + summary.update === 0) {
      console.log("\nRien à appliquer.");
      return;
    }
    const record = await createImportPreview(name, text, null);
    const res = await applyImport(record.id, { actorEmail: "cli:catalogue:import" });
    console.log(`\nAppliqué (import ${record.id}) : ${res.created} création(s), ${res.updated} mise(s) à jour, ${res.priceChanges.length} prix modifié(s).`);
    console.log("Le cache catalogue du serveur web expire de lui-même sous 10 s.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
