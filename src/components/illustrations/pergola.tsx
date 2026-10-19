/**
 * Illustrations originales (SVG) représentant le type de produit affiché. Elles remplacent
 * des photographies tant que des médias autorisés ne sont pas fournis. Aucune option n'est
 * dessinée comme incluse si elle ne l'est pas : les fermetures et l'éclairage sont pilotés par props.
 */
export interface PergolaArtProps {
  structure?: string; // couleur CSS
  blades?: string;
  mounting?: "freestanding" | "wall";
  lighting?: boolean;
  closures?: Partial<Record<"left" | "right" | "front", "glass" | "slats" | "screen">>;
  className?: string;
  title?: string;
}

const COLORS: Record<string, string> = { ANTHRACITE: "#3a3d41", WHITE: "#e9e6df", BLACK: "#15161a" };
export const colorOf = (code?: string) => (code ? (COLORS[code] ?? code) : "#3a3d41");

export function PergolaArt({ structure = "#3a3d41", blades = "#3a3d41", mounting = "freestanding", lighting = false, closures = {}, className = "", title = "Illustration de pergola" }: PergolaArtProps) {
  const bladeCount = 9;
  return (
    <svg viewBox="0 0 640 400" role="img" aria-label={title} className={className}>
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f6f1e8" /><stop offset="1" stopColor="#ede6d8" /></linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ffd9a0" stopOpacity="0.9" /><stop offset="1" stopColor="#ffd9a0" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="640" height="400" fill="url(#sky)" />
      {/* sol / terrasse */}
      <polygon points="0,330 640,330 640,400 0,400" fill="#d9cfbf" />
      <polygon points="60,330 580,330 640,400 0,400" fill="#cbbfa9" opacity="0.6" />
      {mounting === "wall" && <rect x="0" y="40" width="130" height="290" fill="#e2dccf" stroke="#cfc6b4" />}
      {/* lumière */}
      {lighting && <ellipse cx="330" cy="250" rx="220" ry="90" fill="url(#glow)" />}
      {/* poteaux */}
      <g fill={structure}>
        {mounting === "freestanding" && <rect x="150" y="120" width="14" height="210" />}
        <rect x="486" y="120" width="14" height="210" />
        {mounting === "freestanding" && <rect x="196" y="150" width="10" height="180" opacity="0.85" />}
        <rect x="440" y="150" width="10" height="180" opacity="0.85" />
      </g>
      {/* fermetures latérales */}
      {closures.left && <ClosurePanel x={164} y={135} w={32} h={195} kind={closures.left} skew />}
      {closures.right && <ClosurePanel x={450} y={135} w={36} h={195} kind={closures.right} />}
      {closures.front && <ClosurePanel x={206} y={160} w={234} h={170} kind={closures.front} />}
      {/* toit : cadre */}
      <polygon points="130,120 520,120 470,150 180,150" fill={structure} opacity="0.95" />
      {/* lames */}
      {Array.from({ length: bladeCount }).map((_, i) => {
        const t = (i + 0.5) / bladeCount;
        const x1 = 140 + t * 370, x2 = 184 + t * 282;
        return <polygon key={i} points={`${x1},122 ${x1 + 26},122 ${x2 + 20},148 ${x2},148`} fill={blades} stroke={structure} strokeWidth="1" />;
      })}
      <rect x="130" y="112" width="390" height="10" fill={structure} />
      <rect x="180" y="148" width="290" height="6" fill={structure} />
    </svg>
  );
}

function ClosurePanel({ x, y, w, h, kind, skew = false }: { x: number; y: number; w: number; h: number; kind: "glass" | "slats" | "screen"; skew?: boolean }) {
  const transform = skew ? `skewY(-12) translate(0 ${x * 0.21})` : undefined;
  if (kind === "glass") return <g transform={transform}><rect x={x} y={y} width={w} height={h} fill="#bcd3dd" opacity="0.45" stroke="#88a6b3" /><line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#88a6b3" /></g>;
  if (kind === "slats") return <g transform={transform}>{Array.from({ length: Math.floor(h / 10) }).map((_, i) => <rect key={i} x={x} y={y + i * 10} width={w} height={6} fill="#8d6b4e" opacity="0.9" />)}</g>;
  return <g transform={transform}><rect x={x} y={y} width={w} height={h} fill="#6c6f72" opacity="0.6" /><rect x={x} y={y} width={w} height={8} fill="#3a3d41" /></g>;
}

export function AwningArt({ cabinet = "#3a3d41", fabric = "#9a9a94", className = "", lighting = true }: { cabinet?: string; fabric?: string; className?: string; lighting?: boolean }) {
  return (
    <svg viewBox="0 0 640 400" role="img" aria-label="Illustration de store banne" className={className}>
      <rect width="640" height="400" fill="#f3eee4" />
      <rect x="0" y="0" width="640" height="260" fill="#e6dfd0" />
      <rect x="120" y="120" width="120" height="140" fill="#cfd8dc" stroke="#9fb0b8" />
      <rect x="400" y="120" width="120" height="140" fill="#cfd8dc" stroke="#9fb0b8" />
      <polygon points="0,260 640,260 640,400 0,400" fill="#d9cfbf" />
      {lighting && <ellipse cx="320" cy="250" rx="240" ry="40" fill="#ffd9a0" opacity="0.5" />}
      <rect x="60" y="70" width="520" height="22" rx="6" fill={cabinet} />
      <polygon points="70,92 570,92 610,190 30,190" fill={fabric} />
      <polygon points="30,190 610,190 612,206 28,206" fill={fabric} opacity="0.8" />
      <line x1="70" y1="92" x2="36" y2="188" stroke={cabinet} strokeWidth="4" />
      <line x1="570" y1="92" x2="604" y2="188" stroke={cabinet} strokeWidth="4" />
    </svg>
  );
}

export function ClosureArt({ kind, color = "#3a3d41", className = "" }: { kind: "glass" | "slats" | "screen" | "led" | "heater" | "lantern" | "sensor"; color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 640 400" role="img" aria-label="Illustration d'accessoire" className={className}>
      <rect width="640" height="400" fill="#f3eee4" />
      <rect x="150" y="60" width="14" height="300" fill={color} />
      <rect x="476" y="60" width="14" height="300" fill={color} />
      <rect x="150" y="52" width="340" height="14" fill={color} />
      {kind === "glass" && <g><rect x="170" y="70" width="300" height="290" fill="#bcd3dd" opacity="0.5" stroke="#88a6b3" /><line x1="320" y1="70" x2="320" y2="360" stroke="#88a6b3" strokeWidth="3" /></g>}
      {kind === "slats" && Array.from({ length: 24 }).map((_, i) => <rect key={i} x="170" y={74 + i * 12} width="300" height="8" fill="#8d6b4e" />)}
      {kind === "screen" && <g><rect x="166" y="66" width="308" height="22" fill={color} /><rect x="170" y="88" width="300" height="200" fill="#6c6f72" opacity="0.55" /></g>}
      {kind === "led" && <g><rect x="164" y="66" width="312" height="6" fill="#ffd27a" /><ellipse cx="320" cy="120" rx="200" ry="60" fill="#ffd9a0" opacity="0.5" /></g>}
      {kind === "heater" && <g><rect x="250" y="80" width="140" height="36" rx="6" fill={color} /><rect x="258" y="88" width="124" height="20" fill="#e2733a" opacity="0.8" /><ellipse cx="320" cy="200" rx="120" ry="70" fill="#f0a060" opacity="0.25" /></g>}
      {kind === "lantern" && <g><rect x="290" y="200" width="60" height="120" rx="8" fill={color} /><rect x="300" y="215" width="40" height="80" fill="#ffd9a0" opacity="0.9" /></g>}
      {kind === "sensor" && <g><rect x="296" y="90" width="48" height="60" rx="8" fill={color} /><circle cx="320" cy="120" r="10" fill="#9ad38e" /></g>}
    </svg>
  );
}
