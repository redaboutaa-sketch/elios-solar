import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

/** Numéro lisible : PREFIX-AAAAMM-XXXXXX (non séquentiel : n'expose pas le volume). */
export function businessNumber(prefix: "CMD" | "DEV"): string {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${ym}-${randomCode(6)}`;
}

export function shareToken(): string {
  return randomBytes(24).toString("base64url");
}
