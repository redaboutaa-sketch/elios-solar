import path from "node:path";

/** Types acceptés → extension de stockage. */
export const MEDIA_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
} as const;
export type MediaMime = keyof typeof MEDIA_TYPES;

export const EXT_TO_MIME: Record<string, MediaMime> = Object.fromEntries(Object.entries(MEDIA_TYPES).map(([m, e]) => [e, m as MediaMime]));

export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
export const MEDIA_URL_PREFIX = "/api/media/";

/**
 * Nom de fichier généré : 32 caractères hexadécimaux, ou nom public descriptif (minuscules, chiffres, tirets) suivi
 * de 8 caractères hexadécimaux aléatoires ; extension connue.
 */
const NAME_RE = /^(?:[a-f0-9]{32}|[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{8})\.(jpg|png|webp|avif|svg|pdf)$/;
/** Préfixe descriptif accepté pour un nom public (sans extension ni suffixe aléatoire). */
export const MEDIA_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function mediaDir(): string {
  return path.resolve(process.env.MEDIA_STORAGE_DIR ?? "./uploads");
}

/** Résout un nom de fichier dans le répertoire des médias ; null si invalide ou hors du répertoire. */
export function resolveMediaFile(name: string): string | null {
  if (!NAME_RE.test(name)) return null;
  const dir = mediaDir();
  const full = path.resolve(dir, name);
  if (path.dirname(full) !== dir) return null;
  return full;
}

export function isMediaMime(m: string): m is MediaMime {
  return Object.prototype.hasOwnProperty.call(MEDIA_TYPES, m);
}

/** Vérifie la signature binaire du fichier (le type déclaré par le navigateur ne suffit pas). */
export function checkSignature(buf: Buffer, mime: MediaMime): string | null {
  const head = (n: number) => buf.subarray(0, n);
  switch (mime) {
    case "image/jpeg":
      return head(3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? null : "Fichier JPEG invalide";
    case "image/png":
      return head(8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? null : "Fichier PNG invalide";
    case "image/webp":
      return buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP" ? null : "Fichier WebP invalide";
    case "image/avif":
      return buf.subarray(4, 8).toString("ascii") === "ftyp" && /^avi[fs]$/.test(buf.subarray(8, 12).toString("ascii")) ? null : "Fichier AVIF invalide";
    case "application/pdf":
      return buf.subarray(0, 5).toString("ascii") === "%PDF-" ? null : "Fichier PDF invalide";
    case "image/svg+xml": {
      const text = buf.toString("utf8");
      if (!/<svg[\s>]/i.test(text.slice(0, 4096))) return "Fichier SVG invalide";
      if (/<script|javascript:|<foreignObject|<iframe|<embed|<object|\son[a-z]+\s*=/i.test(text)) return "SVG refusé : contenu actif (script, gestionnaire d'événement…)";
      return null;
    }
  }
}

/**
 * Écrit un fichier dans le répertoire des médias sous un nom aléatoire (32 hex + extension), ou sous un nom public
 * descriptif (`slug` + 8 hex) quand `slug` est fourni. Retourne le nom de fichier et l'URL publique. Utilisé par le
 * téléversement, les rendus générés et les imports.
 */
export async function storeMediaBuffer(buf: Buffer | Uint8Array, mime: MediaMime, opts: { slug?: string } = {}): Promise<{ name: string; url: string; fullPath: string }> {
  if (opts.slug !== undefined && !MEDIA_SLUG_RE.test(opts.slug)) throw new Error("Nom public de média invalide");
  const { randomBytes } = await import("node:crypto");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const dir = mediaDir();
  await mkdir(dir, { recursive: true });
  for (let attempt = 0; attempt < 3; attempt++) {
    const name = opts.slug ? `${opts.slug}-${randomBytes(4).toString("hex")}.${MEDIA_TYPES[mime]}` : `${randomBytes(16).toString("hex")}.${MEDIA_TYPES[mime]}`;
    const full = resolveMediaFile(name);
    if (!full) throw new Error("Nom de fichier média invalide");
    try {
      await writeFile(full, buf, { flag: "wx" });
      return { name, url: `${MEDIA_URL_PREFIX}${name}`, fullPath: full };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
  throw new Error("Impossible de générer un nom de fichier unique");
}

/** Supprime un fichier du répertoire des médias à partir de son URL publique (silencieux si absent). */
export async function removeMediaByUrl(url: string): Promise<void> {
  if (!url.startsWith(MEDIA_URL_PREFIX)) return;
  const { unlink } = await import("node:fs/promises");
  const full = resolveMediaFile(url.slice(MEDIA_URL_PREFIX.length));
  if (!full) return;
  await unlink(full).catch(() => undefined);
}
