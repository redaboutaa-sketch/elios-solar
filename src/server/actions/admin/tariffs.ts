"use server";
/**
 * Actions de l'écran Tarifs. Réservées aux administrateurs (contrôle serveur à chaque action) : les montants, dont
 * les coûts d'achat, ne sont accessibles qu'à ce rôle.
 */
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { actorOf, back, fields, firstError } from "@/server/admin/form";
import { createManualGrid, deactivateGrid, deriveDraft, publishGrid, rejectGrid, restoreAsDraft, saveCells, saveFixedTariffs, TariffError, updateParams, verifyGrid, type CellEdit } from "@/server/tariffs/grids";
import { cancelUpload, createUpload, importUpload, saveUploadMapping, type UploadMapping } from "@/server/tariffs/upload";

const BASE = "/admin/tarifs";
const gridPath = (id: string) => `${BASE}/grilles/${id}`;
const id = z.string().min(1).max(64).regex(/^[\w-]+$/);
const rev = z.coerce.number().int().min(0);

async function admin() {
  const { session } = await assertRole(["ADMIN"]);
  return actorOf(session);
}

/** Exécute une opération ; une erreur métier revient en message sur la page. */
async function run<T>(path: string, fn: () => Promise<T>, ok: (r: T) => string, okPath?: (r: T) => string): Promise<never> {
  let r: T;
  try {
    r = await fn();
  } catch (e) {
    // erreurs métier et de lecture des fichiers (archive illisible, format non reconnu…)
    if (e instanceof TariffError || (e instanceof Error && (e.name === "SupplierPriceError" || e.name === "SourceError"))) back(path, e.message, "err");
    throw e;
  }
  back(okPath ? okPath(r) : path, ok(r));
}

const editSchema = z.array(z.object({ dimAmm: z.number().int(), widthMinMm: z.number().int(), widthMaxMm: z.number().int(), action: z.enum(["set", "clear", "remove"]), value: z.string().max(40).optional() })).max(5000);

export async function saveCellsAction(formData: FormData) {
  const actor = await admin();
  const f = fields(formData);
  const p = z.object({ id, revision: rev, edits: z.string().max(500_000) }).safeParse(f);
  if (!p.success) back(BASE, "Requête invalide", "err");
  let edits: CellEdit[];
  try {
    const e = editSchema.parse(JSON.parse(p.data.edits));
    edits = e.map((x) => (x.action === "set" ? { dimAmm: x.dimAmm, widthMinMm: x.widthMinMm, widthMaxMm: x.widthMaxMm, action: "set", value: x.value ?? "" } : { dimAmm: x.dimAmm, widthMinMm: x.widthMinMm, widthMaxMm: x.widthMaxMm, action: x.action })) as CellEdit[];
  } catch {
    back(gridPath(p.data.id), "Modifications illisibles.", "err");
  }
  await run(gridPath(p.data.id), () => saveCells(p.data.id, p.data.revision, edits, actor), (r) => `Enregistré : ${r.changed} modifiée(s), ${r.added} ajoutée(s), ${r.cleared} vidée(s), ${r.removed} retirée(s) (non tarifées). Vérifiez de nouveau la grille avant publication.`);
}

export async function saveFixedAction(formData: FormData) {
  const actor = await admin();
  const p = z.object({ id, revision: rev }).safeParse(fields(formData));
  if (!p.success) back(BASE, "Requête invalide", "err");
  const all = (k: string) => formData.getAll(k).map((v) => (typeof v === "string" ? v : ""));
  const [codes, labels, units, values] = [all("code"), all("label"), all("unit"), all("value")];
  const items = codes.map((code, i) => ({ code, label: labels[i] ?? "", unit: units[i] ?? "", value: values[i] ?? "" })).filter((x) => x.code.trim() || x.label.trim() || x.value.trim());
  await run(gridPath(p.data.id), () => saveFixedTariffs(p.data.id, p.data.revision, items, actor), () => `${items.length} tarif(s) fixe(s) enregistré(s).`);
}

const opt = (max = 2000) => z.preprocess((v) => (v == null ? "" : v), z.string().trim().max(max));
const dateTime = z.preprocess((v) => (v == null ? "" : v), z.string().trim()).transform((v, ctx) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) { ctx.addIssue({ code: "custom", message: "Date invalide" }); return z.NEVER; }
  return d;
});
const paramsSchema = z.object({
  id, revision: rev,
  nature: z.enum(["UNKNOWN", "PURCHASE", "SALE", "RECOMMENDED", "EXAMPLE", "SUPPLIER_LIST"]),
  natureNote: opt(),
  currency: opt(3).transform((v) => (v ? v.toUpperCase() : null)).refine((v) => v == null || /^[A-Z]{3}$/.test(v), "Devise : code ISO à trois lettres"),
  taxBasis: z.enum(["UNKNOWN", "HT", "TTC"]),
  vatRate: opt(8).transform((v, ctx) => {
    if (!v) return null;
    const m = /^(\d{1,2})(?:[.,](\d{1,2}))?$/.exec(v);
    if (!m) { ctx.addIssue({ code: "custom", message: "TVA : pourcentage (ex. 20 ou 5,5)" }); return z.NEVER; }
    return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  }),
  clientele: z.enum(["ALL", "PARTICULIER", "PROFESSIONNEL"]),
  dimRule: z.enum(["EXACT", "ROUND_UP"]),
  dimRuleNote: opt(500),
  validFrom: dateTime, validTo: dateTime,
  scopeNote: opt(), included: opt(), excluded: opt(), notes: opt(5000),
  zeroConfirmed: z.preprocess((v) => v === "on", z.boolean()),
});

export async function saveParamsAction(formData: FormData) {
  const actor = await admin();
  const p = paramsSchema.safeParse(fields(formData));
  const gid = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  if (!p.success) back(gid && /^[\w-]+$/.test(gid) ? gridPath(gid) : BASE, firstError(p.error), "err");
  const { id: gridId, revision, vatRate, ...rest } = p.data;
  await run(gridPath(gridId), () => updateParams(gridId, revision, { ...rest, vatRateBps: vatRate }, actor), (r) => (r.changed.length ? `Paramètres enregistrés (${r.changed.length} modifié(s)). Vérifiez de nouveau la grille.` : "Aucun changement."));
}

export async function verifyAction(formData: FormData) {
  const actor = await admin();
  const p = z.object({ id, revision: rev }).safeParse(fields(formData));
  if (!p.success) back(BASE, "Requête invalide", "err");
  await run(gridPath(p.data.id), () => verifyGrid(p.data.id, p.data.revision, actor), (c) => `Grille vérifiée${c.length ? ` (${c.length} avertissement(s))` : ""} : elle peut être publiée.`);
}

export async function publishAction(formData: FormData) {
  const actor = await admin();
  const p = z.object({ id, revision: rev, when: z.enum(["now", "later"]), at: dateTime }).safeParse(fields(formData));
  if (!p.success) back(BASE, "Requête invalide", "err");
  if (p.data.when === "later" && (!p.data.at || p.data.at <= new Date())) back(gridPath(p.data.id), "Indiquez une date et une heure futures.", "err");
  await run(gridPath(p.data.id), () => publishGrid(p.data.id, p.data.revision, { at: p.data.when === "later" ? p.data.at : null }, actor), (r) => (r.scheduled ? `Publication programmée le ${r.from.toLocaleString("fr-FR")}.` : "Grille publiée : elle alimente les nouvelles évaluations.") + (r.replaced.length ? ` Remplace v${r.replaced.map((x) => x.version).join(", v")}.` : ""));
}

export async function deactivateAction(formData: FormData) {
  const actor = await admin();
  const p = z.object({ id }).safeParse(fields(formData));
  if (!p.success) back(BASE, "Requête invalide", "err");
  await run(gridPath(p.data.id), () => deactivateGrid(p.data.id, actor), () => "Version désactivée : sans autre version en vigueur, ces configurations passent au devis.");
}

export async function restoreAction(formData: FormData) {
  const actor = await admin();
  const p = z.object({ id }).safeParse(fields(formData));
  if (!p.success) back(BASE, "Requête invalide", "err");
  await run(gridPath(p.data.id), () => restoreAsDraft(p.data.id, actor), (c) => `Brouillon v${c.version} créé à partir de cette version.`, (c) => gridPath(c.id));
}

export async function rejectAction(formData: FormData) {
  const actor = await admin();
  const p = z.object({ id }).safeParse(fields(formData));
  if (!p.success) back(BASE, "Requête invalide", "err");
  await run(gridPath(p.data.id), () => rejectGrid(p.data.id, actor), () => "Brouillon rejeté (conservé pour traçabilité).");
}

export async function deriveAction(formData: FormData) {
  const actor = await admin();
  const p = z.object({ id, baseId: id, mode: z.enum(["coefficient", "markup_on_cost", "margin_on_price", "supplier_discount"]), value: z.string().trim().min(1).max(20) }).safeParse(fields(formData));
  if (!p.success) back(BASE, "Requête invalide : choisissez une grille de base, une règle et une valeur.", "err");
  await run(gridPath(p.data.id), () => deriveDraft(p.data.baseId, p.data.id, p.data.mode, p.data.value, actor), (c) => `Brouillon v${c.version} recalculé : vérifiez chaque montant avant publication.`, (c) => gridPath(c.id));
}

export async function createGridAction(formData: FormData) {
  const actor = await admin();
  const p = z.object({ familySlug: z.string().min(1).max(80), variantKey: z.string().trim().max(40).regex(/^[a-z0-9-]*$/, "Variante : minuscules, chiffres, tirets"), label: z.string().trim().min(2).max(120), nature: z.enum(["UNKNOWN", "PURCHASE", "SALE"]), dimAKey: z.enum(["projection", "hauteur"]) }).safeParse(fields(formData));
  if (!p.success) back(BASE, firstError(p.error), "err");
  await run(BASE, () => createManualGrid(p.data, actor), (c) => `Grille créée (brouillon v${c.version}) : ajoutez des lignes et des colonnes.`, (c) => gridPath(c.id));
}

/* ------------------------------------------------------------------ */
/* Import                                                               */
/* ------------------------------------------------------------------ */

const IMPORT = `${BASE}/import`;

export async function uploadAction(formData: FormData) {
  const actor = await admin();
  const files = formData.getAll("files").filter((f): f is File => typeof f === "object" && f != null && "arrayBuffer" in f && (f as File).size > 0);
  if (!files.length) back(IMPORT, "Choisissez au moins un fichier .xlsx ou .docx.", "err");
  const loaded = await Promise.all(files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
  await run(IMPORT, () => createUpload(loaded, actor), () => "Fichier(s) reçu(s) : vérifiez l'analyse et les correspondances, puis importez.", (u) => `${IMPORT}/${u.id}`);
}

const mappingSchema = z.object({
  groups: z.record(z.string().max(200), z.object({ familySlug: z.string().max(80).nullable(), variantKey: z.string().max(40), dimAKey: z.enum(["projection", "hauteur"]) })),
  columns: z.record(z.string().max(40), z.object({ enabled: z.boolean(), nature: z.enum(["UNKNOWN", "PURCHASE", "SALE", "RECOMMENDED", "EXAMPLE", "SUPPLIER_LIST"]), currency: z.string().max(3).nullable(), taxBasis: z.enum(["UNKNOWN", "HT", "TTC"]) })),
});

function mappingFrom(formData: FormData): UploadMapping {
  const groups: UploadMapping["groups"] = {};
  const columns: UploadMapping["columns"] = {};
  for (const g of formData.getAll("group").map(String)) {
    const fam = String(formData.get(`g:${g}:family`) ?? "");
    groups[g] = { familySlug: fam === "_skip" ? null : fam, variantKey: String(formData.get(`g:${g}:variant`) ?? "").trim().toLowerCase(), dimAKey: formData.get(`g:${g}:dim`) === "hauteur" ? "hauteur" : "projection" };
  }
  for (const c of formData.getAll("column").map(String)) {
    const cur = String(formData.get(`c:${c}:currency`) ?? "").trim().toUpperCase();
    columns[c] = { enabled: formData.get(`c:${c}:enabled`) === "on", nature: String(formData.get(`c:${c}:nature`) ?? "UNKNOWN") as never, currency: cur || null, taxBasis: String(formData.get(`c:${c}:tax`) ?? "UNKNOWN") as never };
  }
  return mappingSchema.parse({ groups, columns }) as UploadMapping;
}

export async function saveMappingAction(formData: FormData) {
  const actor = await admin();
  const p = z.object({ uploadId: id, intent: z.enum(["save", "import"]) }).safeParse(fields(formData));
  if (!p.success) back(IMPORT, "Requête invalide", "err");
  const path = `${IMPORT}/${p.data.uploadId}`;
  let mapping: UploadMapping;
  try {
    mapping = mappingFrom(formData);
  } catch {
    back(path, "Correspondances invalides.", "err");
  }
  if (p.data.intent === "save") await run(path, () => saveUploadMapping(p.data.uploadId, mapping, actor), () => "Correspondances enregistrées : la prévisualisation est à jour.");
  await run(path, async () => { await saveUploadMapping(p.data.uploadId, mapping, actor); return importUpload(p.data.uploadId, actor); }, (r) => {
    const created = r.grids.reduce((n, g) => n + g.created.length, 0), same = r.grids.reduce((n, g) => n + g.unchanged.length, 0);
    return `Import terminé : ${created} brouillon(s) de grille créé(s), ${same} grille(s) inchangée(s)${r.imports.some((i) => i.reused) ? " ; fichier déjà importé, version réutilisée" : ""}. Rien n'a été publié.`;
  });
}

export async function cancelUploadAction(formData: FormData) {
  const actor = await admin();
  const p = z.object({ uploadId: id }).safeParse(fields(formData));
  if (!p.success) back(IMPORT, "Requête invalide", "err");
  await run(IMPORT, () => cancelUpload(p.data.uploadId, actor), () => "Téléversement abandonné ; fichiers effacés.");
}
