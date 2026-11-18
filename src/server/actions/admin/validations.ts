"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { back, fields } from "@/server/admin/form";
import { PROPOSABLE } from "@/server/validation/core";
import { createValidation, transitionValidation, updateDraft, ValidationError, type Actor, type SourceInput } from "@/server/validation/service";

const PATH = "/admin/catalogue/validations";

const targetType = z.enum(["VARIANT", "FAMILY_SPEC", "CLOSURE_RULE", "OPTION_RULE"]);
const sourceSchema = z.object({
  sourceKind: z.enum(["SUPPLIER_DOCUMENT", "SUPPLIER_WRITTEN", "OBSERVED_REFERENCE", "OTHER", ""]).default(""),
  sourceUrl: z.string().max(500).default(""),
  documentId: z.string().max(64).default(""),
  sourceNote: z.string().max(4000).default(""),
});

function actorFrom(session: { user: { id: string; email: string } }, role: string): Actor {
  return { userId: session.user.id, email: session.user.email, role };
}

function sourceFrom(f: Record<string, string>): SourceInput {
  const s = sourceSchema.parse(f);
  return { sourceKind: s.sourceKind || null, sourceUrl: s.sourceUrl.trim() || null, documentId: s.documentId.trim() || null, sourceNote: s.sourceNote.trim() };
}

/** Champs proposés : préfixe `p_` dans le formulaire (vide = pas de changement). */
function proposedFrom(type: z.infer<typeof targetType>, f: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(PROPOSABLE[type])) if (f[`p_${k}`] !== undefined && f[`p_${k}`] !== "") out[k] = f[`p_${k}`];
  return out;
}

function message(e: unknown): string {
  if (e instanceof ValidationError || e instanceof z.ZodError) return e instanceof z.ZodError ? "Formulaire invalide." : e.message;
  throw e;
}

export async function createValidationAction(formData: FormData) {
  const { session, role } = await assertRole(["ADMIN", "MANAGER"]);
  const f = fields(formData);
  const t = targetType.safeParse(f.targetType);
  const targetId = (f.targetId ?? "").trim().slice(0, 200);
  if (!t.success || !targetId) back(`${PATH}/nouveau`, "Choisissez une cible.", "err");
  let id: string;
  try {
    id = (await createValidation({ targetType: t.data, targetId, proposed: proposedFrom(t.data, f), ...sourceFrom(f) }, actorFrom(session, role))).id;
  } catch (e) {
    back(`${PATH}/nouveau?type=${t.data}&cible=${encodeURIComponent(targetId)}`, message(e), "err");
  }
  back(`${PATH}/${id}`, "Dossier créé en brouillon.");
}

export async function updateValidationAction(formData: FormData) {
  const { session, role } = await assertRole(["ADMIN", "MANAGER"]);
  const f = fields(formData);
  const id = (f.id ?? "").slice(0, 64);
  const t = targetType.safeParse(f.targetType);
  if (!id || !t.success) back(PATH, "Requête invalide.", "err");
  try {
    await updateDraft(id, { proposed: proposedFrom(t.data, f), ...sourceFrom(f) }, actorFrom(session, role));
  } catch (e) {
    back(`${PATH}/${id}`, message(e), "err");
  }
  back(`${PATH}/${id}`, "Brouillon enregistré.");
}

const transitionSchema = z.object({ id: z.string().min(1).max(64), to: z.enum(["DRAFT", "TO_REVIEW", "VALIDATED", "REJECTED"]), note: z.string().max(2000).default("") });
const DONE: Record<string, string> = { DRAFT: "Dossier remis en brouillon.", TO_REVIEW: "Dossier soumis : à vérifier.", VALIDATED: "Validation appliquée à la version vérifiée des données (la mise en vente reste une décision séparée).", REJECTED: "Dossier rejeté." };

export async function transitionValidationAction(formData: FormData) {
  const { session, role } = await assertRole(["ADMIN", "MANAGER"]);
  const p = transitionSchema.safeParse(fields(formData));
  if (!p.success) back(PATH, "Requête invalide.", "err");
  try {
    await transitionValidation(p.data.id, p.data.to, p.data.note.trim() || null, actorFrom(session, role));
  } catch (e) {
    back(`${PATH}/${p.data.id}`, message(e), "err");
  }
  back(`${PATH}/${p.data.id}`, DONE[p.data.to]!);
}
