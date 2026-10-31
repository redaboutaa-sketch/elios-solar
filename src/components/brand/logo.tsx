import Image from "next/image";
import { BRAND } from "@/config/brand";

/**
 * Logo HELIOSTORES fourni par le client (détouré, couleurs d'origine, jamais redessiné ni recoloré).
 * - `variant="dark"` (défaut) : logo transparent, à poser sur une surface sombre (`surface-night`).
 * - `variant="plate"` : logo intact sur sa plaque sombre arrondie, pour les fonds clairs.
 * La hauteur est pilotée par `className` (ex. `h-7`), la largeur suit le ratio 1240:347.
 */
export function Logo({ variant = "dark", className = "h-7", priority = false }: { variant?: "dark" | "plate"; className?: string; priority?: boolean }) {
  const img = variant === "plate" ? BRAND.logoPlate : BRAND.logo;
  return (
    <Image src={img.src} width={img.width} height={img.height} alt={BRAND.name} priority={priority} quality={90} sizes="240px" className={`w-auto ${className}`} />
  );
}

/** Marque « soleil » (point du i du logo), recadrée sans retouche. Décorative. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return <Image src="/brand/heliostores-soleil.png" width={86} height={86} alt="" aria-hidden="true" className={className} />;
}
