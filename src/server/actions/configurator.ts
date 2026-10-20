"use server";
import { redirect } from "next/navigation";
import { configurationInputSchema, quoteFormSchema } from "@/domain/schemas";
import type { ConfigurationInput, EvaluationResult } from "@/domain/types";
import { getSession } from "@/lib/session";
import { ensureGuestKey, getGuestKey } from "@/server/guest";
import { evaluateInput, saveConfiguration, updateConfiguration } from "@/server/configuration/service";
import { addLine, CartError, replaceLine } from "@/server/cart/service";
import { createQuote } from "@/server/quote/service";
import { rateLimit } from "@/server/rate-limit";
import { ensureCatalogSnapshot } from "@/server/catalog/public-snapshot";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; issues?: EvaluationResult["issues"] };

export async function evaluateAction(raw: unknown): Promise<ActionResult<EvaluationResult>> {
  const parsed = configurationInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Configuration invalide." };
  if (!(await rateLimit("evaluate", 240, 60))) return { ok: false, error: "Trop de requêtes, réessayez dans une minute." };
  return { ok: true, data: await evaluateInput(parsed.data as ConfigurationInput) };
}

export async function saveConfigurationAction(raw: unknown, title: string | null, existingId: string | null): Promise<ActionResult<{ id: string; token: string }>> {
  const parsed = configurationInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Configuration invalide." };
  if (!(await rateLimit("save-config", 60, 60))) return { ok: false, error: "Trop de requêtes." };
  const session = await getSession();
  const guestKey = await ensureGuestKey();
  const owner = { userId: session?.user.id ?? null, guestKey };
  const safeTitle = title?.trim().slice(0, 80) || null;
  try {
    const c = existingId ? await updateConfiguration(existingId, parsed.data as ConfigurationInput, owner, safeTitle ?? undefined) : await saveConfiguration({ input: parsed.data as ConfigurationInput, ownerUserId: owner.userId, guestKey, title: safeTitle ?? undefined });
    return { ok: true, data: { id: c.id, token: c.shareToken } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur d'enregistrement." };
  }
}

export async function addToCartAction(raw: unknown, configurationId: string | null, replaceLineId: string | null = null): Promise<ActionResult<{ lineId: string }>> {
  const parsed = configurationInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Configuration invalide." };
  if (!(await rateLimit("add-to-cart", 60, 60))) return { ok: false, error: "Trop de requêtes." };
  const session = await getSession();
  const guestKey = await ensureGuestKey();
  const owner = { userId: session?.user.id ?? null, guestKey };
  try {
    if (replaceLineId) {
      const line = await replaceLine(owner, replaceLineId, parsed.data as ConfigurationInput, configurationId);
      return { ok: true, data: { lineId: line.id } };
    }
    const { line } = await addLine(owner, parsed.data as ConfigurationInput, configurationId);
    return { ok: true, data: { lineId: line.id } };
  } catch (e) {
    if (e instanceof CartError) return { ok: false, error: e.message, issues: e.issues };
    throw e;
  }
}

export async function addToCartAndGo(raw: unknown, configurationId: string | null) {
  const r = await addToCartAction(raw, configurationId);
  if (r.ok) redirect("/panier");
  return r;
}

export async function requestQuoteAction(raw: unknown, form: unknown, kind: "configuration" | "custom" | "accessory" | "general", configurationId: string | null, visual: unknown = null): Promise<ActionResult<{ id: string; number: string; visual: "SCENE_3D" | "PLAN_2D" | "NONE" }>> {
  const f = quoteFormSchema.safeParse(form);
  if (!f.success) return { ok: false, error: f.error.issues[0]?.message ?? "Formulaire incomplet." };
  if (!(await rateLimit("quote", 10, 600))) return { ok: false, error: "Trop de demandes, réessayez plus tard." };
  let input: ConfigurationInput | null = null;
  let result: EvaluationResult | null = null;
  if (raw) {
    const parsed = configurationInputSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Configuration invalide." };
    input = parsed.data as ConfigurationInput;
    result = await evaluateInput(input);
  }
  const session = await getSession();
  const guestKey = await ensureGuestKey();
  const q = await createQuote({ kind, ...f.data, input, result, configurationId, visual }, { userId: session?.user.id ?? null, guestKey });
  return { ok: true, data: { id: q.id, number: q.number, visual: q.visualKind } };
}

export async function getCatalogForClient() {
  return ensureCatalogSnapshot();
}

export async function currentOwner() {
  const session = await getSession();
  return { userId: session?.user.id ?? null, guestKey: await getGuestKey() };
}
