"use server";
/**
 * Actions de « Mes prix conseillés » (administrateurs, contrôle serveur à chaque action).
 * - Préparer ce prix : proposition + brouillon d'une seule cellule (jamais publié ici) ; le prix est recalculé côté
 *   serveur, jamais lu dans le formulaire.
 * - Politique par défaut : brouillons recalculés selon la marge cible, puis publication explicite.
 */
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { actorOf, back, fields } from "@/server/admin/form";
import { adviceFor } from "@/server/market/advice";
import { prepareDefaultPricing, publishDefaultPricing } from "@/server/market/default-pricing";
import { MarketError, policyAt } from "@/server/market/policy";
import { createProposal, draftGridFromProposal } from "@/server/market/proposals";
import { prisma } from "@/lib/prisma";
import { TariffError } from "@/server/tariffs/grids";

const BASE = "/admin/tarifs/prix-conseilles";
const slug = z.string().regex(/^[a-z0-9-]{2,64}$/);

async function admin() {
  const { session } = await assertRole(["ADMIN"]);
  return actorOf(session);
}

async function run<T>(fn: () => Promise<T>, ok: (r: T) => string, okPath?: (r: T) => string): Promise<never> {
  let r: T;
  try {
    r = await fn();
  } catch (e) {
    if (e instanceof MarketError || e instanceof TariffError) back(BASE, e.message, "err");
    throw e;
  }
  back(okPath ? okPath(r) : BASE, ok(r));
}

export async function prepareAdvicePriceAction(formData: FormData) {
  const actor = await admin();
  const f = fields(formData);
  const p = slug.safeParse(f.familySlug);
  const k = z.string().regex(/^[a-z0-9_-]{1,40}$/).safeParse(f.config);
  if (!p.success || !k.success) back(BASE, "Requête invalide", "err");
  await run(async () => {
    // prix recalculé côté serveur pour CETTE configuration ; le brouillon ne touche que sa cellule
    const row = await adviceFor(p.data, k.data);
    if (!row?.advice || row.advice.htMinor == null || !row.canPrepare) throw new MarketError("Aucun prix à préparer pour cette configuration : le prix conseillé est déjà en vigueur ou n'est pas établi.");
    const proposal = await createProposal({ ...row.input, scenario: row.advice.kind === "market" ? "aligned" : "target", proposedHtMinor: row.advice.htMinor, justification: [`Configuration : ${row.text}`, row.advice.title, ...row.advice.steps, ...row.limits].join("\n") }, actor);
    return draftGridFromProposal(proposal.id, actor);
  }, (r) => `Brouillon v${r.version} préparé : une seule cellule modifiée (celle de la configuration). Vérifiez-le puis publiez-le manuellement si vous le décidez.`, (r) => `/admin/tarifs/grilles/${r.draftId}`);
}

export async function prepareDefaultPricingAction() {
  const actor = await admin();
  await run(() => prepareDefaultPricing(actor), (r) => {
    const created = r.rows.filter((x) => x.draft?.created).length;
    const refused = r.rows.filter((x) => x.refused).length;
    return `Politique v${r.policy.version} : ${created} brouillon(s) créé(s), ${r.rows.length - created - refused} grille(s) déjà à jour${refused ? `, ${refused} refus` : ""}. Rien n'est publié.`;
  });
}

export async function publishDefaultPricingAction() {
  const actor = await admin();
  await run(async () => {
    const policy = await policyAt();
    if (!policy) throw new MarketError("Aucune politique de coût en vigueur.");
    const drafts = await prisma.supplierPriceList.findMany({ where: { scope: "GRID", nature: "SALE", status: "DRAFT", notes: { startsWith: `Politique de coût v${policy.version} :` } }, select: { id: true } });
    if (!drafts.length) throw new MarketError("Aucun brouillon de la politique en vigueur à publier : préparez-les d'abord.");
    return publishDefaultPricing(drafts.map((d) => d.id), actor);
  }, (r) => `${r.filter((x) => x.ok).length} grille(s) publiée(s)${r.some((x) => !x.ok) ? ` ; échecs : ${r.filter((x) => !x.ok).map((x) => `${x.sourceKey} (${x.error})`).join(", ")}` : ""}. Les versions précédentes restent consultables et peuvent être reprises en brouillon.`);
}
