import "server-only";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { invalidateCatalogCache } from "@/server/catalog/load";
import { reviewSpec, type SpecSource, type TechnicalSpecValue } from "@/domain/technical-spec";
import {
  SOURCE_KIND_FR, canTransition, commercialChecklist, diffProposal, resultingDataStatus, sanitizeProposal, validationBlockers,
  type CommercialChecklist, type DbDataStatus, type DiffRow, type SourceKind, type TargetType, type ValidationStatus,
} from "./core";
import { loadTarget, type Db, type TargetSnapshot } from "./targets";

export interface Actor {
  userId: string | null;
  email: string | null;
  role: string | null;
}

export class ValidationError extends Error {}

/** Contrôle d'accès répété côté service (en plus de l'action) : seuls ADMIN et MANAGER décident. */
function assertStaff(actor: Actor) {
  if (actor.role !== "ADMIN" && actor.role !== "MANAGER") throw new ValidationError("Accès refusé : rôle administrateur ou gestionnaire requis.");
}

export interface SourceInput {
  sourceKind: SourceKind | null;
  sourceUrl: string | null;
  documentId: string | null;
  sourceNote: string;
}

function cleanUrl(u: string | null): string | null {
  if (!u) return null;
  const s = u.trim().slice(0, 500);
  if (!s) return null;
  if (!/^https?:\/\//i.test(s) && !s.startsWith("/")) throw new ValidationError("Lien de source : URL http(s) ou chemin interne attendu.");
  return s;
}

async function checkDocument(db: Db, documentId: string | null) {
  if (!documentId) return null;
  const d = await db.document.findUnique({ where: { id: documentId }, select: { id: true, status: true } });
  if (!d) throw new ValidationError("Document justificatif introuvable.");
  return d;
}

export async function createValidation(input: { targetType: TargetType; targetId: string; proposed: Record<string, unknown> } & SourceInput, actor: Actor) {
  assertStaff(actor);
  const target = await loadTarget(prisma, input.targetType, input.targetId);
  if (!target) throw new ValidationError("Cible introuvable.");
  const { proposed, errors } = sanitizeProposal(input.targetType, input.proposed);
  if (errors.length) throw new ValidationError(errors.join(" "));
  await checkDocument(prisma, input.documentId);
  const sourceUrl = cleanUrl(input.sourceUrl);
  return prisma.$transaction(async (tx) => {
    const v = await tx.referenceValidation.create({
      data: {
        targetType: input.targetType, targetId: target.id, targetLabel: target.label.slice(0, 300), familySlug: target.familySlug,
        baseData: target.data as never, baseHash: target.hash, proposed: proposed as never,
        sourceKind: input.sourceKind, sourceUrl, documentId: input.documentId, sourceNote: input.sourceNote.slice(0, 4000),
        status: "DRAFT", createdById: actor.userId,
      },
    });
    await tx.referenceValidationEvent.create({ data: { validationId: v.id, fromStatus: null, toStatus: "DRAFT", actorId: actor.userId, actorEmail: actor.email, note: "Dossier créé", dataHash: target.hash } });
    return v;
  });
}

/** Modifie un brouillon : la base est réactualisée sur les données actuelles (nouvelle version de référence). */
export async function updateDraft(id: string, input: { proposed: Record<string, unknown> } & SourceInput, actor: Actor) {
  assertStaff(actor);
  const v = await prisma.referenceValidation.findUnique({ where: { id } });
  if (!v) throw new ValidationError("Dossier introuvable.");
  if (v.status !== "DRAFT") throw new ValidationError("Seul un brouillon peut être modifié.");
  const target = await loadTarget(prisma, v.targetType, v.targetId);
  if (!target) throw new ValidationError("Cible introuvable (supprimée ou recréée).");
  const { proposed, errors } = sanitizeProposal(v.targetType, input.proposed);
  if (errors.length) throw new ValidationError(errors.join(" "));
  await checkDocument(prisma, input.documentId);
  const sourceUrl = cleanUrl(input.sourceUrl);
  await prisma.$transaction(async (tx) => {
    await tx.referenceValidation.update({ where: { id }, data: { proposed: proposed as never, sourceKind: input.sourceKind, sourceUrl, documentId: input.documentId, sourceNote: input.sourceNote.slice(0, 4000), baseData: target.data as never, baseHash: target.hash, targetLabel: target.label.slice(0, 300) } });
    await tx.referenceValidationEvent.create({ data: { validationId: id, fromStatus: "DRAFT", toStatus: "DRAFT", actorId: actor.userId, actorEmail: actor.email, note: target.hash === v.baseHash ? "Proposition modifiée" : "Proposition modifiée, base actualisée sur les données actuelles", dataHash: target.hash } });
  });
}

function sourceLabel(v: { id: string; sourceKind: SourceKind | null; sourceUrl: string | null; sourceNote: string }) {
  return `${v.sourceKind ? SOURCE_KIND_FR[v.sourceKind] : "source ?"} : ${v.sourceUrl ?? v.sourceNote.slice(0, 160)} (dossier ${v.id})`.slice(0, 500);
}

async function applyValidation(tx: Db, v: { id: string; targetType: TargetType; targetId: string; proposed: Record<string, unknown>; sourceKind: SourceKind | null; sourceUrl: string | null; documentId: string | null; sourceNote: string }, status: DbDataStatus, actor: Actor) {
  const now = new Date();
  const p = v.proposed;
  if (v.targetType === "VARIANT") {
    const cur = await tx.variant.findUniqueOrThrow({ where: { sku: v.targetId } });
    const attrs = { ...(cur.attributes as Record<string, unknown>), ...((p.attributes as Record<string, unknown>) ?? {}) };
    // l'assemblage n'est « confirmé » que par une source fournisseur ; une observation le laisse à confirmer
    if ("validation" in attrs && status === "SUPPLIER_VERIFIED" && !(p.attributes && "validation" in (p.attributes as object))) attrs.validation = "confirmed";
    if (status !== "SUPPLIER_VERIFIED" && attrs.validation === "confirmed" && cur.dataStatus !== "SUPPLIER_VERIFIED") attrs.validation = "to_confirm";
    const leadMin = (p.leadMinDays as number | undefined) ?? cur.leadMinDays;
    const leadMax = (p.leadMaxDays as number | undefined) ?? cur.leadMaxDays;
    await tx.variant.update({
      where: { sku: v.targetId },
      data: {
        // purchasable n'est JAMAIS modifié ici
        ...(p.label !== undefined ? { label: p.label as string } : {}),
        ...(p.priceCents !== undefined ? { priceCents: p.priceCents as number } : {}),
        ...(p.availability !== undefined ? { availability: p.availability as never } : {}),
        ...(p.leadUnit !== undefined ? { leadUnit: p.leadUnit as never } : {}),
        leadMinDays: leadMin, leadMaxDays: leadMax,
        ...(leadMin != null && leadMax != null ? { leadSource: status, leadUpdatedAt: now } : {}),
        attributes: attrs as never,
        dataStatus: status,
        validationSource: sourceLabel(v), validationDocumentId: v.documentId, validatedBy: actor.email, validatedAt: now,
      },
    });
  } else if (v.targetType === "FAMILY_SPEC") {
    const [slug, key] = v.targetId.split("#");
    const fam = await tx.productFamily.findUniqueOrThrow({ where: { slug: slug! }, select: { id: true } });
    const ref = await tx.technicalSpec.findFirstOrThrow({ where: { familyId: fam.id, key: key! }, orderBy: { createdAt: "asc" } });
    // nouvelle ligne sourcée ; les lignes démo / observées sont conservées pour l'historique
    await tx.technicalSpec.create({
      data: {
        familyId: fam.id, key: key!, label: ref.label, valueNum: (p.valueNum as number | undefined) ?? null, unit: (p.unit as string | undefined) ?? ref.unit, valueText: (p.valueText as string | undefined) ?? null,
        source: status === "SUPPLIER_VERIFIED" ? "SUPPLIER_CONFIRMED" : "OBSERVED_REFERENCE", sourceRef: sourceLabel(v), documentId: v.documentId, observedAt: now, note: `Validé via le dossier ${v.id}`, createdBy: actor.email,
      },
    });
  } else if (v.targetType === "CLOSURE_RULE") {
    await tx.closureCompatRule.update({ where: { id: v.targetId }, data: { ...(p.status !== undefined ? { status: p.status as never } : {}), ...(p.reason !== undefined ? { reason: p.reason as string } : {}), dataStatus: status } });
  } else {
    await tx.optionCompatRule.update({ where: { id: v.targetId }, data: { ...(p.status !== undefined ? { status: p.status as never } : {}), ...(p.reason !== undefined ? { reason: p.reason as string } : {}), ...(p.includedInBase !== undefined ? { includedInBase: p.includedInBase as boolean } : {}), ...(p.maxQty !== undefined ? { maxQty: p.maxQty as number } : {}), dataStatus: status } });
  }
}

export async function transitionValidation(id: string, to: ValidationStatus, note: string | null, actor: Actor) {
  assertStaff(actor);
  const result = await prisma.$transaction(async (tx) => {
    const v = await tx.referenceValidation.findUnique({ where: { id }, include: { document: { select: { status: true } } } });
    if (!v) throw new ValidationError("Dossier introuvable.");
    if (!canTransition(v.status, to)) throw new ValidationError(`Transition impossible : ${v.status} → ${to}.`);
    if (to === "REJECTED" && !note?.trim()) throw new ValidationError("Un rejet doit être motivé.");
    const target = await loadTarget(tx, v.targetType, v.targetId);
    let appliedHash: string | null = null;
    if (to === "VALIDATED") {
      const blockers = validationBlockers({
        status: v.status, sourceKind: v.sourceKind, documentId: v.documentId, documentPublished: v.document ? v.document.status === "PUBLISHED" : undefined, sourceUrl: v.sourceUrl, sourceNote: v.sourceNote,
        baseHash: v.baseHash, currentHash: target?.hash ?? "cible-absente", targetType: v.targetType, proposed: v.proposed as Record<string, unknown>,
      });
      if (!target) blockers.unshift("Cible introuvable (supprimée ou recréée).");
      if (blockers.length) throw new ValidationError(blockers.join(" "));
      const status = resultingDataStatus(v.sourceKind)!;
      await applyValidation(tx, { ...v, proposed: v.proposed as Record<string, unknown> }, status, actor);
      appliedHash = (await loadTarget(tx, v.targetType, v.targetId))!.hash;
    }
    const decided = to === "VALIDATED" || to === "REJECTED";
    await tx.referenceValidation.update({ where: { id }, data: { status: to, ...(decided ? { decidedById: actor.userId, decidedAt: new Date(), decisionNote: note?.slice(0, 2000) || null } : {}), ...(appliedHash ? { appliedHash } : {}) } });
    await tx.referenceValidationEvent.create({ data: { validationId: id, fromStatus: v.status, toStatus: to, actorId: actor.userId, actorEmail: actor.email, note: note?.slice(0, 2000) || null, dataHash: appliedHash ?? target?.hash ?? null } });
    return { from: v.status, appliedHash, targetType: v.targetType, targetId: v.targetId, before: target?.data };
  });
  if (to === "VALIDATED") invalidateCatalogCache();
  await audit({ actorUserId: actor.userId, actorEmail: actor.email, action: `validation.${to.toLowerCase()}`, entity: "ReferenceValidation", entityId: id, before: { status: result.from, data: result.before }, after: { status: to, appliedHash: result.appliedHash } });
  return result;
}

// ---------------------------------------------------------------------------
// Lecture : conséquences, manques, divergences
// ---------------------------------------------------------------------------

export interface Impact {
  configurations: number;
  activeCartLines: number;
  openQuotes: number;
  orders: number;
  scope: "sku" | "family";
}

async function countImpact(type: TargetType, targetId: string, familySlug: string | null): Promise<Impact> {
  if (type === "VARIANT") {
    const [c] = await prisma.$queryRaw<Array<{ configurations: bigint; cart: bigint; quotes: bigint; orders: bigint }>>`
      SELECT
        (SELECT count(*) FROM "Configuration" WHERE jsonb_path_exists("result", '$.** ? (@.sku == $s)', jsonb_build_object('s', ${targetId}::text))) AS configurations,
        (SELECT count(*) FROM "CartLine" l JOIN "Cart" c ON c.id = l."cartId" LEFT JOIN "Configuration" g ON g.id = l."configurationId"
           WHERE c.status = 'ACTIVE' AND (jsonb_path_exists(l."input", '$.** ? (@.familySlug == $f || @.closureFamilySlug == $f)', jsonb_build_object('f', ${familySlug ?? ""}::text))
             AND (g.id IS NULL OR jsonb_path_exists(g."result", '$.** ? (@.sku == $s)', jsonb_build_object('s', ${targetId}::text))))) AS cart,
        (SELECT count(*) FROM "Quote" WHERE status IN ('NEW','IN_REVIEW','SENT') AND jsonb_path_exists("snapshot", '$.** ? (@.sku == $s)', jsonb_build_object('s', ${targetId}::text))) AS quotes,
        (SELECT count(DISTINCT "orderId") FROM "OrderLine" WHERE sku = ${targetId}) AS orders`;
    return { configurations: Number(c!.configurations), activeCartLines: Number(c!.cart), openQuotes: Number(c!.quotes), orders: Number(c!.orders), scope: "sku" };
  }
  const slug = familySlug ?? "";
  const [c] = await prisma.$queryRaw<Array<{ configurations: bigint; cart: bigint; quotes: bigint; orders: bigint }>>`
    SELECT
      (SELECT count(*) FROM "Configuration" WHERE jsonb_path_exists("input", '$.** ? (@.familySlug == $f || @.closureFamilySlug == $f)', jsonb_build_object('f', ${slug}::text))) AS configurations,
      (SELECT count(*) FROM "CartLine" l JOIN "Cart" c ON c.id = l."cartId" WHERE c.status = 'ACTIVE' AND jsonb_path_exists(l."input", '$.** ? (@.familySlug == $f || @.closureFamilySlug == $f)', jsonb_build_object('f', ${slug}::text))) AS cart,
      (SELECT count(*) FROM "Quote" WHERE status IN ('NEW','IN_REVIEW','SENT') AND jsonb_path_exists("snapshot", '$.** ? (@.familySlug == $f || @.closureFamilySlug == $f)', jsonb_build_object('f', ${slug}::text))) AS quotes,
      (SELECT count(DISTINCT "orderId") FROM "OrderLine" WHERE "configurationSnapshot" IS NOT NULL AND jsonb_path_exists("configurationSnapshot", '$.** ? (@.familySlug == $f || @.closureFamilySlug == $f)', jsonb_build_object('f', ${slug}::text))) AS orders`;
  return { configurations: Number(c!.configurations), activeCartLines: Number(c!.cart), openQuotes: Number(c!.quotes), orders: Number(c!.orders), scope: "family" };
}

async function unknownRulesFor(familySlug: string | null): Promise<number> {
  if (!familySlug) return 0;
  const [cl, op] = await Promise.all([
    prisma.closureCompatRule.count({ where: { status: "UNKNOWN", OR: [{ closureFamilySlug: familySlug }, { pergolaFamilySlug: familySlug }] } }),
    prisma.optionCompatRule.count({ where: { status: "UNKNOWN", OR: [{ optionFamilySlug: familySlug }, { pergolaFamilySlug: familySlug }] } }),
  ]);
  return cl + op;
}

const toSpecValue = (s: { source: string; valueNum: number | null; unit: string | null; valueText: string | null; sourceRef: string; observedAt: string | null }, key: string, label: string): TechnicalSpecValue => ({
  key, label, valueNum: s.valueNum, unit: s.unit, valueText: s.valueText, source: s.source.toLowerCase() as SpecSource, sourceRef: s.sourceRef, observedAt: s.observedAt,
});

export interface DossierView {
  validation: NonNullable<Awaited<ReturnType<typeof findDossier>>>;
  target: TargetSnapshot | null;
  stale: boolean;
  diff: DiffRow[];
  missing: string[];
  divergences: string[];
  impact: Impact;
  checklist: CommercialChecklist | null;
  specCandidates: TechnicalSpecValue[];
  blockers: string[];
}

function findDossier(id: string) {
  return prisma.referenceValidation.findUnique({
    where: { id },
    include: {
      document: { select: { id: true, title: true, version: true, status: true, kind: true, groupKey: true } },
      createdBy: { select: { email: true, name: true } },
      decidedBy: { select: { email: true, name: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function getDossier(id: string): Promise<DossierView | null> {
  const v = await findDossier(id);
  if (!v) return null;
  const target = await loadTarget(prisma, v.targetType, v.targetId);
  const base = v.baseData as Record<string, unknown>;
  const proposed = v.proposed as Record<string, unknown>;
  const current = (target?.data ?? base) as Record<string, unknown>;
  const stale = !target || target.hash !== v.baseHash;
  const diff = diffProposal(v.status === "VALIDATED" ? base : current, proposed);
  const missing: string[] = [];
  const divergences: string[] = [];
  if (!target) divergences.push("La cible n'existe plus (supprimée ou recréée par un import) : ce dossier ne peut plus être validé.");
  else if (stale && v.status !== "VALIDATED") divergences.push("Les données actuelles diffèrent de la version proposée (empreinte modifiée) : remettre en brouillon pour actualiser la base.");
  if (!v.sourceKind) missing.push("Nature de la source");
  if (v.sourceKind === "SUPPLIER_DOCUMENT" && !v.documentId) missing.push("Document justificatif (médiathèque)");
  if (v.document && v.document.status !== "PUBLISHED") divergences.push(`Le document justificatif « ${v.document.title} » v${v.document.version} n'est pas publié (${v.document.status}).`);
  if (v.sourceKind === "OBSERVED_REFERENCE") divergences.push("Source = observation sur la référence : la validation donnera au mieux le statut « Observé », jamais « Vérifié fournisseur ».");
  if (v.sourceKind === "OTHER") missing.push("Source exploitable (document ou écrit fournisseur)");

  let checklist: CommercialChecklist | null = null;
  let specCandidates: TechnicalSpecValue[] = [];
  if (v.targetType === "VARIANT" && target) {
    const d = current as { dataStatus: DbDataStatus; availability: string; leadSource: DbDataStatus; leadMinDays: number | null; leadMaxDays: number | null; purchasable: boolean; attributes: Record<string, unknown> };
    const unknown = await unknownRulesFor(target.familySlug);
    checklist = commercialChecklist(d, unknown);
    if (d.dataStatus !== "SUPPLIER_VERIFIED" && proposed.priceCents === undefined) missing.push("Prix fournisseur (aucun prix vérifié ni proposé)");
    if (d.availability === "TO_CONFIRM" && proposed.availability === undefined) missing.push("Disponibilité");
    if ((d.leadMinDays == null || d.leadMaxDays == null) && (proposed.leadMinDays === undefined || proposed.leadMaxDays === undefined)) missing.push("Délai minimum / maximum");
    if (unknown) missing.push(`Compatibilités de la gamme (${unknown} règle(s) inconnue(s))`);
    if (d.attributes?.validation === "to_confirm") missing.push(`Assemblage à confirmer${d.attributes.assembly === "modular" ? ` (${String(d.attributes.modules ?? "?")} modules, ${String(d.attributes.intermediatePosts ?? "?")} poteau(x) intermédiaire(s), largeur utile ${String(d.attributes.usableWidthMm ?? "?")} mm : valeurs de démonstration)` : ""}`);
  }
  if (v.targetType === "FAMILY_SPEC") {
    const specs = (current.specs as Array<{ source: string; valueNum: number | null; unit: string | null; valueText: string | null; sourceRef: string; observedAt: string | null }>) ?? [];
    specCandidates = specs.map((s) => toSpecValue(s, String(current.key), String(current.label)));
    const r = reviewSpec(specCandidates, String(current.key));
    if (r?.conflict) divergences.push(`Valeurs divergentes selon les sources : ${specCandidates.map((s) => `${s.valueNum ?? s.valueText} ${s.unit ?? ""} (${s.source})`).join(" / ")}.`);
    if (!r?.confirmed) missing.push("Valeur confirmée par le fournisseur");
    if (proposed.valueNum === undefined && proposed.valueText === undefined) missing.push("Valeur proposée");
    const observed = specCandidates.find((s) => s.source === "observed_reference");
    if (observed && proposed.valueNum !== undefined && proposed.valueNum !== observed.valueNum) divergences.push(`La valeur proposée (${String(proposed.valueNum)}) diffère de l'observation sur la référence (${String(observed.valueNum)}).`);
  }
  if (v.targetType === "CLOSURE_RULE" || v.targetType === "OPTION_RULE") {
    if (current.status === "UNKNOWN" && proposed.status === undefined) missing.push("Statut de compatibilité (autorisé / interdit)");
    if (v.targetType === "CLOSURE_RULE" && target) {
      const twins = await prisma.closureCompatRule.count({ where: { id: { not: v.targetId }, closureFamilySlug: String(current.closureFamilySlug), pergolaFamilySlug: String(current.pergolaFamilySlug), segmentLengthMm: (current.segmentLengthMm as number | null) ?? null, pergolaFinishCode: String(current.pergolaFinishCode), mounting: String(current.mounting), status: { not: current.status as never } } });
      if (twins) divergences.push(`${twins} autre(s) règle(s) de même portée avec un statut différent.`);
    }
  }
  const others = await prisma.referenceValidation.count({ where: { id: { not: v.id }, targetType: v.targetType, targetId: v.targetId, status: { in: ["DRAFT", "TO_REVIEW"] } } });
  if (others) divergences.push(`${others} autre(s) dossier(s) ouvert(s) sur la même cible.`);
  const impact = await countImpact(v.targetType, v.targetId, target?.familySlug ?? v.familySlug);
  const blockers = v.status === "TO_REVIEW"
    ? validationBlockers({ status: v.status, sourceKind: v.sourceKind, documentId: v.documentId, documentPublished: v.document ? v.document.status === "PUBLISHED" : undefined, sourceUrl: v.sourceUrl, sourceNote: v.sourceNote, baseHash: v.baseHash, currentHash: target?.hash ?? "cible-absente", targetType: v.targetType, proposed })
    : [];
  return { validation: v, target, stale, diff, missing, divergences, impact, checklist, specCandidates, blockers };
}

export async function listValidations(filter: { status?: ValidationStatus; targetType?: TargetType }) {
  return prisma.referenceValidation.findMany({
    where: { ...(filter.status ? { status: filter.status } : {}), ...(filter.targetType ? { targetType: filter.targetType } : {}) },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
    include: { createdBy: { select: { email: true } }, decidedBy: { select: { email: true } }, _count: { select: { events: true } } },
  });
}

