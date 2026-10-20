import { prisma } from "@/lib/prisma";
import { evaluate, revalidate } from "@/domain/engine";
import type { ConfigurationInput, EvaluationResult } from "@/domain/types";
import { loadCatalog } from "@/server/catalog/load";
import { shareToken } from "@/server/ids";
import type { ConfigurationStatus } from "@/generated/prisma/enums";

export function statusFor(result: EvaluationResult): ConfigurationStatus {
  if (result.purchasable) return "VALID";
  if (result.issues.some((i) => i.severity === "review")) return "NEEDS_REVIEW";
  if (result.quoteRecommended) return "QUOTE_REQUIRED";
  return "DRAFT";
}

export async function evaluateInput(input: ConfigurationInput): Promise<EvaluationResult> {
  const catalog = await loadCatalog();
  return evaluate(catalog, input);
}

export async function saveConfiguration(opts: { input: ConfigurationInput; ownerUserId?: string | null; guestKey?: string | null; title?: string; parentId?: string | null }) {
  const catalog = await loadCatalog();
  const result = evaluate(catalog, opts.input);
  return prisma.configuration.create({
    data: {
      shareToken: shareToken(),
      ownerUserId: opts.ownerUserId ?? null,
      guestKey: opts.guestKey ?? null,
      kind: opts.input.kind,
      title: opts.title ?? null,
      engineVersion: result.engineVersion,
      catalogVersion: result.catalogVersion,
      input: opts.input as never,
      result: result as never,
      status: statusFor(result),
      parentId: opts.parentId ?? null,
    },
  });
}

/** Met à jour une configuration existante (nouvelle version) si l'appelant en est propriétaire. */
export async function updateConfiguration(id: string, input: ConfigurationInput, owner: { userId?: string | null; guestKey?: string | null }, title?: string) {
  const existing = await prisma.configuration.findUnique({ where: { id } });
  if (!existing || !isOwner(existing, owner)) throw new Error("Configuration introuvable");
  const catalog = await loadCatalog();
  const result = evaluate(catalog, input);
  return prisma.configuration.update({
    where: { id },
    data: { input: input as never, result: result as never, version: { increment: 1 }, engineVersion: result.engineVersion, catalogVersion: result.catalogVersion, status: statusFor(result), lastValidatedAt: new Date(), title: title ?? existing.title },
  });
}

export function isOwner(c: { ownerUserId: string | null; guestKey: string | null }, owner: { userId?: string | null; guestKey?: string | null }): boolean {
  if (owner.userId && c.ownerUserId === owner.userId) return true;
  if (!c.ownerUserId && owner.guestKey && c.guestKey === owner.guestKey) return true;
  return false;
}

/**
 * Lecture avec revalidation automatique si le catalogue a changé : le résultat stocké est
 * remplacé, la différence est retournée pour affichage (« prix mis à jour », « à confirmer »).
 */
export async function getConfigurationWithRevalidation(where: { id: string } | { shareToken: string }) {
  const c = await prisma.configuration.findUnique({ where });
  if (!c) return null;
  if ("shareToken" in where && c.shareRevoked) return null;
  const catalog = await loadCatalog();
  const previous = c.result as unknown as EvaluationResult;
  if (previous.catalogVersion === catalog.version && previous.engineVersion === (await import("@/domain/engine")).ENGINE_VERSION) {
    return { configuration: c, result: previous, diff: null };
  }
  const { result, diff } = revalidate(catalog, previous);
  const updated = await prisma.configuration.update({ where: { id: c.id }, data: { result: result as never, catalogVersion: result.catalogVersion, engineVersion: result.engineVersion, status: statusFor(result), lastValidatedAt: new Date() } });
  return { configuration: updated, result, diff };
}

export async function listConfigurations(owner: { userId?: string | null; guestKey?: string | null }) {
  if (!owner.userId && !owner.guestKey) return [];
  return prisma.configuration.findMany({
    where: owner.userId ? { ownerUserId: owner.userId } : { guestKey: owner.guestKey!, ownerUserId: null },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

export async function duplicateConfiguration(id: string, owner: { userId?: string | null; guestKey?: string | null }) {
  const c = await prisma.configuration.findUnique({ where: { id } });
  if (!c || !isOwner(c, owner)) throw new Error("Configuration introuvable");
  return saveConfiguration({ input: c.input as unknown as ConfigurationInput, ownerUserId: owner.userId, guestKey: owner.guestKey, title: `${c.title ?? "Projet"} (copie)`, parentId: c.id });
}

export async function setShareRevoked(id: string, owner: { userId?: string | null; guestKey?: string | null }, revoked: boolean) {
  const c = await prisma.configuration.findUnique({ where: { id } });
  if (!c || !isOwner(c, owner)) throw new Error("Configuration introuvable");
  return prisma.configuration.update({ where: { id }, data: { shareRevoked: revoked, ...(revoked ? {} : { shareToken: shareToken() }) } });
}

/** Rattache les configurations invité au compte après connexion. */
export async function claimGuestConfigurations(userId: string, guestKey: string) {
  await prisma.configuration.updateMany({ where: { guestKey, ownerUserId: null }, data: { ownerUserId: userId } });
}
