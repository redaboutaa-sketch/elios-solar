/**
 * Image de la médiathèque avec variantes réduites en `srcset` : 640 px (produite à l'import) et 1080 px (écrans
 * mobiles haute densité, `pnpm media:variants`). Le navigateur charge la plus légère adaptée à l'affichage. Les médias
 * sont servis par /api/media (pas d'optimiseur Next pour ces fichiers).
 */
interface MediaLike { path: string; alt: string; width?: number | null; height?: number | null; smallPath?: string | null; mediumPath?: string | null; provenance?: unknown }
type Variants = { variants?: { small?: { path?: string }; medium?: { path?: string; width?: number } } } | null;

export const smallPathOf = (m: MediaLike) => m.smallPath ?? (m.provenance as Variants)?.variants?.small?.path ?? null;
export const mediumPathOf = (m: MediaLike) => m.mediumPath ?? (m.provenance as Variants)?.variants?.medium?.path ?? null;

/** Largeur de la variante intermédiaire (scripts/media-variants.ts). */
export const MEDIUM_W = 1080;

/** `srcset` d'un média : variantes plus étroites que l'original seulement ; undefined si aucune n'existe. */
export function mediaSrcSet(m: MediaLike): string | undefined {
  if (!m.width) return undefined;
  const small = smallPathOf(m), medium = mediumPathOf(m);
  const parts = [small && m.width > 640 ? `${small} 640w` : null, medium && m.width > MEDIUM_W ? `${medium} ${MEDIUM_W}w` : null].filter(Boolean);
  return parts.length ? [...parts, `${m.path} ${m.width}w`].join(", ") : undefined;
}

export function MediaImage({ media: m, sizes, className = "", eager = false, alt }: { media: MediaLike; sizes: string; className?: string; eager?: boolean; alt?: string }) {
  const small = smallPathOf(m);
  const srcSet = mediaSrcSet(m);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- média de la médiathèque (variantes produites à l'import)
    <img src={srcSet ? m.path : (small ?? m.path)} srcSet={srcSet} sizes={srcSet ? sizes : undefined} alt={alt ?? m.alt} width={m.width ?? undefined} height={m.height ?? undefined} loading={eager ? "eager" : "lazy"} decoding="async" className={className} />
  );
}
