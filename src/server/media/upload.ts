import "server-only";
import sharp from "sharp";
import { MAX_MEDIA_BYTES, type MediaMime, checkSignature, isMediaMime, storeMediaBuffer } from "@/server/media/storage";

export interface StoredUpload {
  path: string;
  mimeType: MediaMime;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  kind: "image" | "document";
}

/**
 * Valide (taille, type déclaré, signature binaire) puis stocke un fichier reçu d'un formulaire.
 * Retourne une erreur lisible plutôt que de lever : l'action serveur décide du retour.
 */
export async function storeUploadedFile(file: unknown, opts: { accept?: readonly MediaMime[] } = {}): Promise<{ ok: true; stored: StoredUpload } | { ok: false; error: string }> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Aucun fichier reçu." };
  if (file.size > MAX_MEDIA_BYTES) return { ok: false, error: "Fichier trop volumineux (8 Mo maximum)." };
  const mime = file.type;
  if (!isMediaMime(mime)) return { ok: false, error: "Type de fichier refusé (JPEG, PNG, WebP, SVG ou PDF)." };
  if (opts.accept && !opts.accept.includes(mime)) return { ok: false, error: `Type de fichier refusé (${opts.accept.join(", ")} attendu).` };
  const buf = Buffer.from(await file.arrayBuffer());
  const bad = checkSignature(buf, mime);
  if (bad) return { ok: false, error: bad };
  let width: number | null = null, height: number | null = null;
  if (mime !== "application/pdf") {
    try {
      const m = await sharp(buf).metadata();
      width = m.width ?? null;
      height = m.height ?? null;
    } catch {
      return { ok: false, error: "Image illisible." };
    }
  }
  const { url } = await storeMediaBuffer(buf, mime);
  return { ok: true, stored: { path: url, mimeType: mime, sizeBytes: file.size, width, height, kind: mime === "application/pdf" ? "document" : "image" } };
}
