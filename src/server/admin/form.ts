import { redirect } from "next/navigation";
import { z } from "zod";

/** Valeurs texte d'un FormData (la dernière valeur l'emporte ; les fichiers sont ignorés). */
export function fields(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/** Convertit une saisie en euros (« 1 234,50 », « 99.9 ») en centimes entiers. */
export function eurosToCents(input: string): number | null {
  const s = input.replace(/[\s €]/g, "").replace(",", ".");
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error("Montant invalide");
  return Math.round(Number(s) * 100);
}

export function centsToEuros(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

const text = z.preprocess((v) => (v == null ? "" : v), z.string().trim());

/** Texte obligatoire. */
export const zReq = (max = 200) => text.pipe(z.string().min(1, "Champ obligatoire").max(max));
/** Texte facultatif : chaîne vide → null. */
export const zOpt = (max = 500) => text.pipe(z.string().max(max)).transform((v) => (v === "" ? null : v));
/** Texte facultatif conservé en chaîne (vide autorisé). */
export const zText = (max = 20_000) => text.pipe(z.string().max(max));
/** Case à cocher. */
export const zBool = z.preprocess((v) => v === "on" || v === "true" || v === "1", z.boolean());
/** Entier facultatif (vide → null). */
export const zOptInt = (min = 0, max = 10_000_000) =>
  text.transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message: `Entier attendu entre ${min} et ${max}` });
      return z.NEVER;
    }
    return n;
  });
/** Entier obligatoire. */
export const zInt = (min = 0, max = 10_000_000) => z.preprocess((v) => (v == null || v === "" ? undefined : Number(v)), z.number({ error: "Nombre attendu" }).int("Entier attendu").min(min).max(max));
/** Montant en euros → centimes (obligatoire). */
export const zEuros = text.transform((v, ctx) => {
  try {
    const c = eurosToCents(v);
    if (c === null) throw new Error("Montant obligatoire");
    return c;
  } catch (e) {
    ctx.addIssue({ code: "custom", message: (e as Error).message });
    return z.NEVER;
  }
});
/** Montant en euros → centimes (facultatif). */
export const zOptEuros = text.transform((v, ctx) => {
  try {
    return eurosToCents(v);
  } catch (e) {
    ctx.addIssue({ code: "custom", message: (e as Error).message });
    return z.NEVER;
  }
});
/** Date (input type="date") facultative. */
export const zOptDate = text.transform((v, ctx) => {
  if (v === "") return null;
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: "custom", message: "Date invalide" });
    return z.NEVER;
  }
  return d;
});

export function firstError(err: z.ZodError): string {
  const i = err.issues[0];
  if (!i) return "Saisie invalide";
  return `${i.path.length ? `${i.path.join(".")} : ` : ""}${i.message}`;
}

/** Retour vers une page d'administration avec un message (affiché par <Flash />). */
export function back(path: string, message: string, tone: "ok" | "err" = "ok"): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${tone}=${encodeURIComponent(message.slice(0, 300))}`);
}

/** Chemin de retour fourni par le formulaire, limité à l'administration. */
export function safeReturn(value: string | undefined, fallback: string): string {
  if (value && /^\/admin(\/[\w\-/]*)?(\?[\w\-=&%.]*)?$/.test(value)) return value.replace(/[?&](ok|err)=[^&]*/g, "");
  return fallback;
}

export function actorOf(session: { user: { id: string; email: string } }) {
  return { actorUserId: session.user.id, actorEmail: session.user.email };
}

/** Pour les formats d'affichage des dates dans les champs input. */
export function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  const u = user.length <= 2 ? `${user[0] ?? ""}•` : `${user.slice(0, 2)}${"•".repeat(Math.min(6, user.length - 2))}`;
  const [d0 = "", ...rest] = domain.split(".");
  return `${u}@${d0.slice(0, 1)}•••${rest.length ? `.${rest.join(".")}` : ""}`;
}
