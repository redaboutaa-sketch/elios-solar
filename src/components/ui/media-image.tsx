/**
 * Image de la médiathèque avec variante réduite (640 px, produite à l'import) en `srcset` : le navigateur charge la
 * plus légère adaptée à l'affichage. Les médias sont servis par /api/media (pas d'optimiseur Next pour ces fichiers).
 */
interface MediaLike { path: string; alt: string; width?: number | null; height?: number | null; smallPath?: string | null; provenance?: unknown }

export const smallPathOf = (m: MediaLike) => m.smallPath ?? (m.provenance as { variants?: { small?: { path?: string } } } | null)?.variants?.small?.path ?? null;

export function MediaImage({ media: m, sizes, className = "", eager = false, alt }: { media: MediaLike; sizes: string; className?: string; eager?: boolean; alt?: string }) {
  const small = smallPathOf(m);
  const srcSet = small && m.width && m.width > 640 ? `${small} 640w, ${m.path} ${m.width}w` : undefined;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- média de la médiathèque (variantes produites à l'import)
    <img src={srcSet ? m.path : (small ?? m.path)} srcSet={srcSet} sizes={srcSet ? sizes : undefined} alt={alt ?? m.alt} width={m.width ?? undefined} height={m.height ?? undefined} loading={eager ? "eager" : "lazy"} decoding="async" className={className} />
  );
}
