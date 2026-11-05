import type { SeasonalTheme } from "@/domain/seasonal";

/**
 * Décoration saisonnière purement visuelle : bande fine sous l'en-tête et guirlande au-dessus du pied de page.
 * `aria-hidden`, sans interaction (pointer-events: none), sans son ni fenêtre ; elle ne recouvre ni le logo, ni la
 * navigation, ni les produits, ni les boutons. Le léger balancement est coupé avec prefers-reduced-motion.
 */
function Pumpkin() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M12 6c-1-2 0-3.5 1.5-4" stroke="#44664d" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <ellipse cx="8" cy="14" rx="5" ry="7" fill="#c2410c" />
      <ellipse cx="16" cy="14" rx="5" ry="7" fill="#c2410c" />
      <ellipse cx="12" cy="14" rx="4.5" ry="7.5" fill="#ea580c" />
    </svg>
  );
}

function Bat() {
  return (
    <svg viewBox="0 0 32 16" width="26" height="13" aria-hidden="true" focusable="false">
      <path d="M16 5c1-2 2-2 2-2l.6 2.4C20 5 22 4 25 2c0 3 2 5 7 6-3 0-5 1-6 3-1-1-3-1-4 0-1-1-3-1-4 1-1-2-3-2-4-1-1-1-3-1-4 0-1-2-3-3-6-3 5-1 7-3 7-6 3 2 5 3 6.4 3.4L14 3s1 0 2 2z" fill="#1f1a24" />
    </svg>
  );
}

export function SeasonalHeaderAccent({ theme }: { theme: SeasonalTheme | null }) {
  if (!theme) return null;
  return <div aria-hidden="true" data-seasonal={theme} className="seasonal-accent" />;
}

export function SeasonalFooterGarland({ theme }: { theme: SeasonalTheme | null }) {
  if (!theme) return null;
  const items = Array.from({ length: 9 }, (_, i) => i);
  return (
    <div aria-hidden="true" data-seasonal={theme} className="seasonal-garland">
      {items.map((i) => <span key={i} className="seasonal-garland-item" style={{ animationDelay: `${(i % 3) * 0.4}s` }}>{i % 2 ? <Bat /> : <Pumpkin />}</span>)}
    </div>
  );
}
