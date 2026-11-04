"use server";
/**
 * Actions du comparatif marché (Administration → Tarifs). Réservées aux administrateurs (contrôle serveur à chaque
 * action). Aucune ne modifie un prix public : relevés, politique de coût et propositions sont internes ; un brouillon
 * de grille n'est jamais publié ici.
 */
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { actorOf, back, fields } from "@/server/admin/form";
import { DIRECT_COST_KEYS, SCOPE_KEYS, type DirectCostInput, type Eligibility } from "@/domain/market";
import { createPolicyVersion, MarketError } from "@/server/market/policy";
import { createObservation, csvRecord, importObservations, parseCsv, setObservationStatus, updateObservation, CSV_HEADER } from "@/server/market/observations";
import { archiveProposal, createProposal, draftGridFromProposal } from "@/server/market/proposals";
import { TariffError } from "@/server/tariffs/grids";
import { studyInputFrom } from "@/server/market/form";

const BASE = "/admin/tarifs/comparatif-marche";
const id = z.string().min(1).max(64).regex(/^[\w-]+$/);

async function admin() {
  const { session } = await assertRole(["ADMIN"]);
  return actorOf(session);
}

async function run<T>(path: string, fn: () => Promise<T>, ok: (r: T) => string, okPath?: (r: T) => string): Promise<never> {
  let r: T;
  try {
    r = await fn();
  } catch (e) {
    if (e instanceof MarketError || e instanceof TariffError) back(path, e.message, "err");
    throw e;
  }
  back(okPath ? okPath(r) : path, ok(r));
}

const euros = (s: string | undefined): number | null => {
  const t = (s ?? "").replace(/[\s  €]/g, "").replace(",", ".");
  if (!t) return null;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) throw new MarketError(`Montant invalide : « ${(s ?? "").slice(0, 20)} »`);
  return Math.round(Number(t) * 100);
};
const pct = (s: string | undefined): number | null => {
  const t = (s ?? "").replace(/[\s %]/g, "").replace(",", ".");
  if (!t) return null;
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) throw new MarketError(`Pourcentage invalide : « ${(s ?? "").slice(0, 10)} »`);
  return Math.round(Number(t) * 100);
};
const mm = (s: string | undefined) => (s && s.trim() ? Number(s.trim()) : null);

/** Formulaire de relevé → saisie (montants en euros, cotes en mm). */
function observationFromForm(f: Record<string, string>) {
  const scope: Record<string, { status: string; extraAmountMinor: number | null; note?: string }> = {};
  for (const k of SCOPE_KEYS) scope[k] = { status: f[`scope_${k}`] || "unknown", extraAmountMinor: euros(f[`scope_${k}_montant`]), ...(f[`scope_${k}_note`] ? { note: f[`scope_${k}_note`] } : {}) };
  return {
    retailer: f.retailer, manufacturer: f.manufacturer ?? "", model: f.model, url: f.url, observedAt: f.observedAt, country: (f.country ?? "").toUpperCase(), currency: (f.currency ?? "").toUpperCase(),
    familySlug: f.familySlug, widthMm: mm(f.widthMm), depthMm: mm(f.depthMm), heightMm: mm(f.heightMm), mounting: f.mounting, roofType: f.roofType ?? "", control: f.control ?? "", options: f.options ?? "",
    priceMinor: euros(f.price), taxBasis: f.taxBasis, priceKind: f.priceKind, regularPriceMinor: euros(f.regularPrice), promoPriceMinor: euros(f.promoPrice), promoEnd: f.promoEnd || null,
    scope, warranty: f.warranty ?? "", material: f.material ?? "", blades: f.blades ?? "", resistance: f.resistance ?? "", sav: f.sav ?? "",
    comparability: f.comparability, comparabilityReason: f.comparabilityReason ?? "", evidence: f.evidence ?? "", access: f.access ?? "", notes: f.notes ?? "",
  };
}

export async function createObservationAction(formData: FormData) {
  const actor = await admin();
  const f = fields(formData);
  await run(`${BASE}/releves`, async () => createObservation(observationFromForm(f), actor), () => "Relevé ajouté.", (o) => `${BASE}/releves/${o.id}`);
}

export async function updateObservationAction(formData: FormData) {
  const actor = await admin();
  const f = fields(formData);
  const p = z.object({ id, revision: z.coerce.number().int().min(1) }).safeParse(f);
  if (!p.success) back(`${BASE}/releves`, "Requête invalide", "err");
  await run(`${BASE}/releves/${p.data.id}`, async () => updateObservation(p.data.id, p.data.revision, observationFromForm(f), f.reason ?? "", actor), () => "Relevé corrigé ; la version précédente reste dans l'historique.");
}

export async function setObservationStatusAction(formData: FormData) {
  const actor = await admin();
  const f = fields(formData);
  const p = z.object({ id, revision: z.coerce.number().int().min(1), status: z.enum(["ACTIVE", "ARCHIVED"]) }).safeParse(f);
  if (!p.success) back(`${BASE}/releves`, "Requête invalide", "err");
  await run(`${BASE}/releves/${p.data.id}`, () => setObservationStatus(p.data.id, p.data.revision, p.data.status, f.reason ?? "", actor), () => (p.data.status === "ARCHIVED" ? "Relevé archivé (écarté des calculs, historique conservé)." : "Relevé rétabli."));
}

/** Import d'un CSV de relevés (format de l'export). Idempotent ; aucun prix public touché. */
export async function importObservationsAction(formData: FormData) {
  const actor = await admin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) back(`${BASE}/releves`, "Choisissez un fichier CSV.", "err");
  if (file.size > 2_000_000) back(`${BASE}/releves`, "Fichier trop volumineux (2 Mo au plus).", "err");
  const rows = parseCsv(await file.text());
  const header = rows[0] ?? [];
  const missing = CSV_HEADER.filter((h) => !["id", "statut", "revision"].includes(h) && !h.startsWith("scope_") && !header.includes(h));
  if (missing.length) back(`${BASE}/releves`, `Colonnes manquantes : ${missing.slice(0, 6).join(", ")}`, "err");
  const dry = fields(formData).dryRun === "1";
  await run(`${BASE}/releves`, async () => {
    const records = rows.slice(1).map((cells, i) => {
      try { return { line: i + 2, input: csvRecord(header, cells).input }; } catch (e) { return { line: i + 2, input: { error: (e as Error).message } }; }
    });
    return importObservations(records, `import:${file.name.replace(/[^\w.-]/g, "_").slice(0, 60)}`, actor, { dryRun: dry });
  }, (r) => `${dry ? "Aperçu : " : ""}${r.created} relevé(s) ${dry ? "à créer" : "créé(s)"}, ${r.unchanged} déjà présent(s), ${r.rejected.length} rejeté(s)${r.rejected.length ? ` (${r.rejected.slice(0, 3).map((x) => `ligne ${x.line} : ${x.error}`).join(" ; ")})` : ""}.`);
}

/* ------------------------------------------------------------------ */

export async function createPolicyAction(formData: FormData) {
  const actor = await admin();
  const f = fields(formData);
  const path = `${BASE}/politique`;
  await run(path, async () => {
    const eligibility: Record<string, Eligibility> = {};
    for (const [k, v] of Object.entries(f)) if (k.startsWith("elig:") && (v === "ELIGIBLE" || v === "NOT_ELIGIBLE")) eligibility[k.slice(5)] = v;
    const directCosts: DirectCostInput[] = DIRECT_COST_KEYS.map((key) => {
      const status = (["known", "unknown", "na"].includes(f[`cost_${key}_status`] ?? "") ? f[`cost_${key}_status`] : "unknown") as DirectCostInput["status"];
      const mode = f[`cost_${key}_mode`] === "percent" ? "percent" : "fixed";
      const base = (["sale_ht", "sale_ttc", "gross_margin"].includes(f[`cost_${key}_base`] ?? "") ? f[`cost_${key}_base`] : "sale_ht") as DirectCostInput["base"];
      return { key, status, mode, ...(mode === "fixed" ? { amountMinor: euros(f[`cost_${key}_value`]) } : { percentBps: pct(f[`cost_${key}_value`]), base }), billedToClient: f[`cost_${key}_billed`] === "1", note: (f[`cost_${key}_note`] ?? "").slice(0, 300) };
    });
    const step = euros(f.roundingStep);
    return createPolicyVersion({
      validFrom: new Date(`${f.validFrom}T00:00:00`), discountBps: pct(f.discount) ?? -1, eligibility, directCosts,
      marginTargetBps: pct(f.marginTarget), contributionTargetBps: pct(f.contributionTarget), staleDays: Number(f.staleDays), dimToleranceBps: pct(f.dimTolerance) ?? 1000,
      rounding: { stepMinor: step ?? 1000, basis: f.roundingBasis === "HT" ? "HT" : "TTC" }, note: f.note ?? "",
    }, actor);
  }, (p) => `Version ${p.version} de la politique de coût enregistrée (effet le ${p.validFrom.toLocaleDateString("fr-FR")}).`);
}

/* ------------------------------------------------------------------ */

/** Paramètres de l'étude renvoyés par le formulaire, sans message précédent. */
const studyQuery = (q: string | undefined) => { const u = new URLSearchParams(q ?? ""); u.delete("ok"); u.delete("err"); return u.toString(); };

export async function createProposalAction(formData: FormData) {
  const actor = await admin();
  const f = fields(formData);
  const query = studyQuery(f.query);
  const path = `${BASE}?${query}`;
  await run(path, async () => {
    const input = studyInputFrom(new URLSearchParams(query));
    if (!input) throw new MarketError("Configuration incomplète.");
    const ht = euros(f.proposedHt);
    if (ht == null) throw new MarketError("Indiquez le prix HT proposé.");
    return createProposal({ ...input, scenario: f.scenario || "manuel", proposedHtMinor: ht, justification: f.justification ?? "" }, actor);
  }, () => "Proposition enregistrée en brouillon (aucun prix modifié).");
}

export async function archiveProposalAction(formData: FormData) {
  const actor = await admin();
  const f = fields(formData);
  const p = id.safeParse(f.id);
  if (!p.success) back(BASE, "Requête invalide", "err");
  await run(`${BASE}?${studyQuery(f.query)}`, () => archiveProposal(p.data, actor), () => "Proposition archivée.");
}

export async function draftGridAction(formData: FormData) {
  const actor = await admin();
  const f = fields(formData);
  const p = id.safeParse(f.id);
  if (!p.success) back(BASE, "Requête invalide", "err");
  await run(`${BASE}?${studyQuery(f.query)}`, () => draftGridFromProposal(p.data, actor), (r) => `Brouillon v${r.version} créé (une cellule modifiée). Vérifiez-le puis publiez-le manuellement si vous le décidez.`, (r) => `/admin/tarifs/grilles/${r.draftId}`);
}
