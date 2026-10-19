import { BRAND } from "@/config/brand";

/** Monogramme original ELIOS SOLAR : soleil bas derrière un toit à lames. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="21" r="9" fill="#b5693c" />
      <rect x="6" y="26" width="36" height="3" rx="1.5" fill="currentColor" />
      <rect x="9" y="31" width="30" height="2.4" rx="1.2" fill="currentColor" opacity="0.8" />
      <rect x="12" y="36" width="24" height="2.4" rx="1.2" fill="currentColor" opacity="0.6" />
      <rect x="8" y="29" width="2.6" height="13" fill="currentColor" />
      <rect x="37.4" y="29" width="2.6" height="13" fill="currentColor" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="font-display text-xl tracking-[0.08em] font-semibold">{BRAND.name}</span>
    </span>
  );
}
