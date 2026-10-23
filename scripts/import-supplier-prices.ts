/**
 * Import PRIVÉ des tarifs fournisseur (classeur XLSX, fiches DOCX) — voir docs/heliostores/import-tarifs.md.
 *
 *   pnpm supplier-prices:import --file "<classeur.xlsx>" --file "<fiche.docx>"            # aperçu (aucune écriture)
 *   pnpm supplier-prices:import --file … --apply                                            # nouvelle version en brouillon
 * --apply crée aussi les brouillons de grille (nature, devise et HT/TTC non établis) ; la publication se fait
 * uniquement dans l'administration (Tarifs). --activate et --rollback ont été retirés (ancien mode de publication).
 *
 * Aucun montant ni coefficient n'est imprimé (« montants masqués ») : seuls des comptes et des références.
 * Codes de sortie : 0 succès · 1 erreur inattendue · 2 usage · 3 fichier illisible / non pris en charge ·
 * 4 source sans aucune ligne reconnue · 5 activation / retour arrière refusé.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";

const EXIT = { OK: 0, ERROR: 1, USAGE: 2, SOURCE: 3, EMPTY: 4, REFUSED: 5 } as const;
const ACTOR = { actorUserId: null, actorEmail: "cli:supplier-prices:import" };

function usage(msg?: string): never {
  if (msg) console.error(`Erreur : ${msg}`);
  console.error('Usage : pnpm supplier-prices:import --file <chemin> [--file <chemin> …] [--apply] [--source-key <clé>]\n(publication : administration → Tarifs)');
  process.exit(EXIT.USAGE);
}

function parseArgs(argv: string[]) {
  const files: string[] = [];
  let apply = false;
  let sourceKey: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--file") {
      const v = argv[++i];
      if (!v) usage("--file attend un chemin");
      files.push(v);
    } else if (a === "--apply") apply = true;
    else if (a === "--activate" || a === "--rollback") usage(`${a} a été retiré : les grilles se publient dans l'administration (Tarifs)`);
    else if (a === "--source-key") {
      const v = argv[++i];
      if (!v) usage("--source-key attend une clé");
      sourceKey = v;
    } else if (a === "--help" || a === "-h") usage();
    else usage(`argument inconnu « ${a} »`);
  }
  if (!files.length) usage("au moins un --file est requis");
  if (sourceKey && files.length !== 1) usage("--source-key ne s'utilise qu'avec un seul --file");
  return { files, apply, sourceKey };
}

const mm = (v: number | null) => (v == null ? "—" : String(v));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const svc = await import("../src/server/supplier-prices/import");
  const { SourceError } = await import("../src/server/supplier-prices/analyse");
  const { prisma } = await import("../src/lib/prisma");
  try {
    const inputs = [];
    for (const f of args.files) {
      try {
        inputs.push({ fileName: path.basename(f), bytes: new Uint8Array(await readFile(f)), sourceKey: args.sourceKey ?? undefined });
      } catch (e) {
        console.error(`Lecture impossible : ${f} (${(e as NodeJS.ErrnoException).code ?? "erreur"})`);
        return EXIT.SOURCE;
      }
    }
    let preview;
    try {
      preview = await svc.previewSupplierPrices(inputs);
    } catch (e) {
      if (e instanceof SourceError) {
        console.error(e.message);
        return EXIT.SOURCE;
      }
      throw e;
    }
    console.log(`Tarifs fournisseur — ${args.apply ? "IMPORT" : "APERÇU (aucune écriture)"} · montants masqués\n`);
    for (const p of preview.previews) {
      console.log(`■ ${p.fileName}  [${p.type}]  source « ${p.sourceKey} »  sha256 ${p.sha256.slice(0, 12)}…`);
      console.log(`  Familles : ${p.families.join(", ") || "aucune"}`);
      console.log(`  Devise : ${p.currency ?? "non indiquée"} · base HT/TTC : inconnue · nature : non établie`);
      if (p.structure) console.log(`  Classeur : feuilles masquées ${p.structure.hiddenSheets.length} · liens externes ${p.structure.externalLinks} · commentaires ${p.structure.comments} · noms définis ${p.structure.definedNames} (+ ${p.structure.builtInNames} intégrés : zones d'impression…) · mentions devise ${p.structure.mentionsCurrency} · mentions HT/TTC ${p.structure.mentionsTax}`);
      for (const s of p.sheets) {
        console.log(`  Feuille « ${s.name} » (${s.state}) → ${s.familySlug ?? "non rattachée"} : ${s.dataRows} ligne(s) de grille, ${s.textNumbers} nombre(s) stocké(s) en texte`);
        for (const b of s.blocks) console.log(`    · bloc « ${b.title} » (variante « ${b.variantKey || "—"} ») : ${b.rows} ligne(s)`);
        for (const f of s.formulas) console.log(`    · formules colonne ${f.column} : ${f.count} · sans cache ${f.missingCache} · incohérentes ${f.mismatches}`);
        for (const n of s.notes) console.log(`    ! ${n}`);
      }
      for (const t of p.tables) console.log(`  Tableau ${t.index} « ${t.caption.slice(0, 50)} » : ${t.kind}${t.variantKey ? ` (variante « ${t.variantKey} »)` : ""}, ${t.rows} ligne(s), devise ${t.currency ?? "—"}`);
      console.log(`  Lignes : ${p.counts.total} · OK ${p.counts.byStatus.OK} · à vérifier ${p.counts.byStatus.TO_CHECK} · rejetées ${p.counts.byStatus.REJECTED} · montants vides ${p.counts.emptyAmounts}`);
      for (const [fam, vs] of Object.entries(p.counts.byFamily)) for (const [v, roles] of Object.entries(vs)) console.log(`    ${fam} / ${v} : ${Object.entries(roles).map(([r, n]) => `${r} ${n}`).join(" · ")}`);
      console.log(`  Doublons : ${p.duplicates} · combinaisons manquantes (grilles incomplètes) : ${p.gaps}`);
      const dc = Object.entries(p.discrepancies);
      console.log(`  Écarts DOCX↔XLSX : ${dc.length ? dc.map(([k, n]) => `${k} ${n}`).join(" · ") : "aucun"}`);
      for (const i of p.issues.slice(0, 12)) console.log(`    – ${i.issue.slice(0, 160)} (${i.count})`);
      for (const n of p.notes) console.log(`  ! ${n}`);
      console.log("  Échantillon (montants masqués) :");
      for (const s of p.sample) console.log(`    ${s.sourceRef} · ${s.familySlug}/${s.variantKey || "—"} · ${s.amountRole} · ${s.dimAKey ?? "dim"} ${mm(s.dimAmm)} mm × l ${mm(s.widthMinMm)}–${mm(s.widthMaxMm)} mm · ${s.status} · montant ${s.hasAmount ? "présent (masqué)" : "vide"}`);
      if (p.existing) console.log(`  = Empreinte déjà importée : v${p.existing.version} (${p.existing.status}) — un import serait sans effet.`);
      console.log("");
    }
    if (preview.analysis.comparison.notes.length) for (const n of preview.analysis.comparison.notes) console.log(`Rapprochement : ${n}`);
    if (preview.previews.some((p) => p.counts.total === 0)) {
      console.error("Au moins une source ne contient aucune ligne de tarif reconnue.");
      return EXIT.EMPTY;
    }
    if (!args.apply) {
      console.log("\nAperçu uniquement : rien n'a été écrit. Relancez avec --apply pour créer une version en brouillon.");
      return EXIT.OK;
    }
    const { results } = await svc.applySupplierPrices(inputs, ACTOR);
    for (const r of results) console.log(r.unchanged ? `= ${r.fileName} : identique à v${r.version} (${r.status}) — aucune écriture.` : `+ ${r.fileName} : v${r.version} créée en brouillon (${r.rows} lignes) — id ${r.listId}`);
    const { deriveGridsFromImport } = await import("../src/server/tariffs/grids");
    const unknown = { enabled: true, nature: "UNKNOWN" as const, currency: null, taxBasis: "UNKNOWN" as const };
    for (const r of results) {
      const g = await deriveGridsFromImport(r.listId, { columns: { PRIX_FINAL: unknown, PRIX_SOURCE: unknown } }, ACTOR);
      console.log(`  grilles : ${g.created.length} brouillon(s) créé(s), ${g.unchanged.length} inchangée(s)`);
    }
    console.log("\nRien n'est publié : complétez, vérifiez et publiez les grilles dans /admin/tarifs.");
    return EXIT.OK;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    // message seul : jamais de dump d'objet (qui pourrait contenir des montants)
    console.error(err instanceof Error ? `${err.name} : ${err.message.split("\n")[0]}` : "Erreur inattendue");
    process.exit(EXIT.ERROR);
  });
