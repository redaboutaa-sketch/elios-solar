"use server";
import { z } from "zod";
import { createContactRequest } from "@/server/contact/service";
import { rateLimit } from "@/server/rate-limit";

const schema = z.object({ kind: z.enum(["contact", "callback"]), name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(200), phone: z.string().trim().max(30).optional(), message: z.string().trim().max(4000).optional(), preferredSlot: z.string().trim().max(120).optional(), consent: z.literal("on"), website: z.string().max(0).optional() });

export type ContactState = { ok?: boolean; error?: string } | null;

export async function contactAction(_prev: ContactState, formData: FormData): Promise<ContactState> {
  if (!(await rateLimit("contact", 8, 600))) return { error: "Trop de demandes, réessayez plus tard." };
  const get = (k: string) => (formData.get(k) === null ? undefined : String(formData.get(k)));
  const parsed = schema.safeParse({ kind: get("kind"), name: get("name"), email: get("email"), phone: get("phone") || undefined, message: get("message") || undefined, preferredSlot: get("preferredSlot") || undefined, consent: get("consent"), website: get("website") });
  if (!parsed.success) return { error: "Vérifiez les champs obligatoires et le consentement." };
  if (parsed.data.kind === "callback" && !parsed.data.phone) return { error: "Un numéro de téléphone est nécessaire pour être rappelé." };
  await createContactRequest(parsed.data);
  return { ok: true };
}
