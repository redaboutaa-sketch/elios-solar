/**
 * Import du catalogue de prix fournisseur (format normalisé, fichier PRIVÉ) et préparation des prix de vente — voir
 * docs/pricing/catalogue-2026-09.md. Aucun montant n'est imprimé.
 *
 *   tsx scripts/pricing-catalogue.ts --file <catalogue.csv>                     # aperçu (aucune écriture)
 *   tsx scripts/pricing-catalogue.ts --file <catalogue.csv> --apply             # import + grilles catalogue + brouillons de vente
 *   tsx scripts/pricing-catalogue.ts --file <catalogue.csv> --apply --publish   # + vérification et publication des produits activables
 *
 * Étapes (idempotentes : même empreinte de fichier = aucune nouvelle version ; mêmes cellules et suppléments = aucun
 * nouveau brouillon) :
 *  1. import tracé (version brute, lignes avec page / tableau / ligne / colonne) ;
 *  2. grilles « prix catalogue fournisseur » (EUR HT, internes, jamais publiées) avec leurs suppléments ;
 *  3. grilles de VENTE = prix catalogue × 1 (décision écrite du client du 2026-11-02), TVA 20 %, lecture à la dimension
 *     supérieure (même décision), validité au 15/09/2026 ;
 *  4. --publish : vérification puis publication des seules grilles de vente des produits ACTIVABLES (correspondance
 *     confirmée et caractéristiques du site cohérentes avec le système tarifé). Les autres restent en brouillon.
 * Une modification faite dans l'administration n'est jamais écrasée : un brouillon modifié reste intact (nouvelle
 * version seulement si la source change).
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ACTOR = { actorUserId: null, actorEmail: "cli:pricing-catalogue" };
const DECISION = "Décision écrite du client du 2026-11-02 (inputs/heliostores/selt-pricing/decisions/2026-11-02-politique-prix.md)";
const VALID_FROM = new Date("2026-09-15T00:00:00+02:00");

/** Produits dont la grille de vente est publiée (correspondance confirmée, données du site cohérentes). */
const ACTIVATE: Array<{ familySlug: string; variants: string[]; included: string; excluded: string }> = [
  { familySlug: "marbella", variants: ["autoportante", "murale"], included: "Structure, lames orientables (lame standard F), mécanisme d'entraînement et moteur 24 V.", excluded: "Centrale radio, capteurs, éclairage, poteaux supplémentaires, fermetures, livraison et pose (au devis)." },
  { familySlug: "malaga", variants: [""], included: "Structure, lames, mécanisme d'entraînement, moteur 24 V, récepteur et télécommande ; tailles fabriquées.", excluded: "Capteurs, fermetures, livraison et pose (au devis)." },
  { familySlug: "helioscreen", variants: [""], included: "Screen à guidage zip (barre de charge élargie quand la taille l'exige), toile de la gamme, supports de coulisses.", excluded: "Moteur : plus-value selon le modèle choisi (ajoutée quand elle est établie, sinon à chiffrer) ; automatismes, télécommandes, livraison et pose (au devis)." },
  { familySlug: "casablanca", variants: [""], included: "Store coffre, toile de la collection, commande manuelle par manivelle, supports muraux.", excluded: "Moteur et commandes si motorisation choisie, livraison et pose (au devis)." },
  { familySlug: "jamaica", variants: [""], included: "Store, toile de la collection, commande manuelle par manivelle, supports muraux.", excluded: "Moteur et commandes si motorisation choisie, auvent, livraison et pose (au devis)." },
  { familySlug: "corsica", variants: [""], included: "Store coffre, toile de la collection, éclairage LED, supports muraux.", excluded: "Moteur (obligatoire, à ajouter au prix de la grille), commandes, livraison et pose (au devis)." },
  { familySlug: "madera", variants: [""], included: "Store caisson, toile de la collection, éclairage LED, supports muraux.", excluded: "Moteur (obligatoire, à ajouter au prix de la grille), commandes, livraison et pose (au devis)." },
];

/** Produits dont la grille de vente est préparée sans publication, avec la raison. */
const PREPARE_ONLY: Array<{ familySlug: string; variants: string[]; reason: string }> = [
  { familySlug: "sevilla", variants: ["autoportante", "murale"], reason: "HelioLux = SOLID : les caractéristiques publiées (dimensions jusqu'à 5 × 6 m, toiles, poses) viennent encore de l'ancienne correspondance ; la grille SOLID couvre 1,5–4 m × 3–7 m. Fiche à aligner sur SOLID avant publication." },
  { familySlug: "helioroof-screen", variants: [""], reason: "HelioRoof = VÉRANDA V ZiiiP : les caractéristiques publiées (largeur 1,25–4,5 m, projection ≤ 5 m, toiles) viennent de « Veranda » standard ; la grille couvre 2–5 m × 2–6 m. Fiche à aligner avant publication." },
];

function parseArgs(argv: string[]) {
  const a = { file: "", apply: false, publish: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file") a.file = argv[++i] ?? "";
    else if (argv[i] === "--apply") a.apply = true;
    else if (argv[i] === "--publish") a.publish = true;
  }
  if (!a.file) { console.error("Usage : tsx scripts/pricing-catalogue.ts --file <catalogue.csv> [--apply [--publish]]"); process.exit(2); }
  if (a.publish && !a.apply) { console.error("--publish suppose --apply"); process.exit(2); }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { prisma } = await import("../src/lib/prisma");
  try {
    const svc = await import("../src/server/supplier-prices/import");
    const grids = await import("../src/server/tariffs/grids");
    const inputs = [{ fileName: path.basename(args.file), bytes: new Uint8Array(await readFile(args.file)), sourceKey: "catalogue-produits-finis-2026-09" }];
    const { previews } = await svc.previewSupplierPrices(inputs);
    for (const p of previews) {
      console.log(`■ ${p.fileName} · sha256 ${p.sha256.slice(0, 12)}… · ${p.counts.total} ligne(s) : OK ${p.counts.byStatus.OK} · à vérifier ${p.counts.byStatus.TO_CHECK} · rejetées ${p.counts.byStatus.REJECTED} · montants vides ${p.counts.emptyAmounts} · doublons ${p.duplicates}`);
      for (const [fam, vs] of Object.entries(p.counts.byFamily)) for (const [v, roles] of Object.entries(vs)) console.log(`    ${fam} / ${v || "—"} : ${Object.entries(roles).map(([r, n]) => `${r} ${n}`).join(" · ")}`);
      for (const i of p.issues.slice(0, 20)) console.log(`    – ${i.issue.slice(0, 160)} (${i.count})`);
      if (p.existing) console.log(`  = empreinte déjà importée : v${p.existing.version}`);
    }
    if (!args.apply) { console.log("\nAperçu : rien n'a été écrit (--apply pour importer)."); return 0; }

    // 1. import tracé
    const { results } = await svc.applySupplierPrices(inputs, ACTOR, { notes: "Liste des prix des produits finis 09.2026 (EUR HT, prix catalogue avant remise revendeur), report normalisé contrôlé." });
    const listId = results[0]!.listId;
    console.log(results[0]!.unchanged ? `= import identique (v${results[0]!.version})` : `+ import v${results[0]!.version} (${results[0]!.rows} lignes)`);

    // 2. grilles catalogue fournisseur (internes)
    // groupes sans produit au catalogue (parois HelioSlide : souhaits de fermeture) : conservés dans l'import tracé, sans grille
    const known = new Set((await prisma.productFamily.findMany({ select: { slug: true } })).map((f) => f.slug));
    const groupsRows = await prisma.supplierPriceRow.findMany({ where: { listId }, distinct: ["familySlug", "variantKey"], select: { familySlug: true, variantKey: true } });
    const mapping = Object.fromEntries(groupsRows.filter((r) => !known.has(r.familySlug)).map((r) => [grids.groupId(r.familySlug, r.variantKey), { familySlug: null, variantKey: r.variantKey, dimAKey: "projection" as const }]));
    const g = await grids.deriveGridsFromImport(listId, { columns: { CATALOGUE_FOURNISSEUR: { enabled: true, nature: "SUPPLIER_LIST", currency: "EUR", taxBasis: "HT" } }, mapping }, ACTOR);
    console.log(`  grilles catalogue : ${g.created.length} créée(s), ${g.unchanged.length} inchangée(s), ${g.skipped.length} groupe(s) ignoré(s)`);

    // 3. grilles de vente (coefficient 1)
    const done: Array<{ familySlug: string; variant: string; id: string; created: boolean; publish: boolean; reason?: string }> = [];
    const targets = [...ACTIVATE.map((a) => ({ ...a, publish: true, reason: undefined as string | undefined })), ...PREPARE_ONLY.map((p) => ({ ...p, included: "", excluded: "", publish: false }))];
    for (const t of targets) {
      for (const variant of t.variants) {
        const base = await prisma.supplierPriceList.findFirst({ where: { sourceKey: grids.gridKey(t.familySlug, variant, "CATALOGUE_FOURNISSEUR"), status: { not: "REJECTED" } }, orderBy: { version: "desc" }, select: { id: true } });
        if (!base) { console.log(`  ! ${t.familySlug}/${variant || "—"} : aucune grille catalogue`); continue; }
        const r = await grids.deriveSaleGrid(base.id, { mode: "coefficient", value: "1" }, {
          vatRateBps: 2000, dimRule: "ROUND_UP", dimRuleNote: `${DECISION} : cote lue à la dimension immédiatement supérieure de la grille.`, validFrom: VALID_FROM,
          natureNote: `Prix de vente HELIOSTORES HT = prix catalogue fournisseur HT (coefficient 1). ${DECISION}.`, ...(t.included ? { included: t.included, excluded: t.excluded } : {}),
          notes: t.publish ? "" : `Préparée, non publiée : ${t.reason}`,
        }, ACTOR);
        done.push({ familySlug: t.familySlug, variant, id: r.id, created: r.created, publish: t.publish, reason: t.reason });
        console.log(`  vente ${t.familySlug}/${variant || "—"} : ${r.created ? `v${r.version} créée en brouillon` : `inchangée (v${r.version})`}${t.publish ? "" : " — préparée, non publiée"}`);
      }
    }

    // 4. publication des produits activables
    if (args.publish) {
      for (const d of done.filter((x) => x.publish)) {
        let v = await grids.getGrid(d.id);
        if (v.status === "ACTIVE") { console.log(`  = ${d.familySlug}/${d.variant || "—"} déjà publiée (v${v.version})`); continue; }
        const blocking = (await grids.checksFor(v)).filter((c) => c.severity === "blocking");
        if (blocking.length) { console.log(`  ! ${d.familySlug}/${d.variant || "—"} non publiée : ${blocking.map((c) => c.message).join(" ; ")}`); continue; }
        await grids.verifyGrid(v.id, v.revision, ACTOR);
        v = await grids.getGrid(d.id);
        await grids.publishGrid(v.id, v.revision, { at: null }, ACTOR);
        console.log(`  ✓ ${d.familySlug}/${d.variant || "—"} publiée (v${v.version})`);
      }
    }
    console.log(args.publish ? "\nPublication terminée (caches du catalogue invalidés à la publication)." : "\nRien n'est publié (--publish pour publier les produits activables).");
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((c) => process.exit(c))
  .catch((err) => {
    console.error(err instanceof Error ? `${err.name} : ${err.message.split("\n")[0]}` : "Erreur inattendue");
    process.exit(1);
  });
