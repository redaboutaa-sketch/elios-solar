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

/** Éclaircit (amount > 0) ou assombrit (amount < 0) une couleur hexadécimale ; les autres formats sont renvoyés tels quels. */
export function shade(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function PergolaArt({ structure = "#3a3d41", blades = "#3a3d41", mounting = "freestanding", lighting = false, closures = {}, className = "", title = "Illustration de pergola" }: PergolaArtProps) {
  const bladeCount = 9;
  const st = colorOf(structure), bl = colorOf(blades);
  const stDark = shade(st, -0.22), blDark = shade(bl, -0.18);
  return (
    <svg viewBox="0 0 640 400" role="img" aria-label={title} className={className}>
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#dbe7ee" /><stop offset="0.55" stopColor="#f3efe6" /><stop offset="1" stopColor="#ede6d8" /></linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ffd9a0" stopOpacity="0.9" /><stop offset="1" stopColor="#ffd9a0" stopOpacity="0" /></radialGradient>
        <linearGradient id="pa-floor" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#dbd1c0" /><stop offset="1" stopColor="#c6b89f" /></linearGradient>
        <linearGradient id="pa-shadow" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#1a1612" stopOpacity="0.2" /><stop offset="1" stopColor="#1a1612" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="640" height="400" fill="url(#sky)" />
      {/* haie lointaine */}
      <path d="M0 300 C 120 280, 260 290, 400 282 S 560 272, 640 285 L640 332 L0 332 Z" fill="#aab58b" opacity="0.8" />
      {/* sol / terrasse */}
      <polygon points="0,330 640,330 640,400 0,400" fill="url(#pa-floor)" />
      {Array.from({ length: 7 }).map((_, i) => <line key={i} x1={40 + i * 95} y1={330} x2={-20 + i * 115} y2={400} stroke="#a9947a" strokeOpacity="0.35" />)}
      <polygon points="150,336 500,336 540,392 110,392" fill="url(#pa-shadow)" />
      {mounting === "wall" && <g><rect x="0" y="40" width="130" height="290" fill="#e2dccf" stroke="#cfc6b4" /><rect x="30" y="110" width="60" height="90" fill="#cfd8dc" stroke="#9fb0b8" strokeWidth="2" /></g>}
      {/* lumière */}
      {lighting && <ellipse cx="330" cy="250" rx="220" ry="90" fill="url(#glow)" />}
      {/* poteaux */}
      <g>
        {mounting === "freestanding" && <g><rect x="150" y="120" width="14" height="210" fill={st} /><rect x="160" y="120" width="4" height="210" fill={stDark} /></g>}
        <rect x="486" y="120" width="14" height="210" fill={st} /><rect x="496" y="120" width="4" height="210" fill={stDark} />
        {mounting === "freestanding" && <rect x="196" y="150" width="10" height="180" fill={st} opacity="0.85" />}
        <rect x="440" y="150" width="10" height="180" fill={st} opacity="0.85" />
      </g>
      {/* fermetures latérales */}
      {closures.left && <ClosurePanel x={164} y={135} w={32} h={195} kind={closures.left} skew />}
      {closures.right && <ClosurePanel x={450} y={135} w={36} h={195} kind={closures.right} />}
      {closures.front && <ClosurePanel x={206} y={160} w={234} h={170} kind={closures.front} />}
      {/* toit : cadre */}
      <polygon points="130,120 520,120 470,150 180,150" fill={stDark} opacity="0.95" />
      {/* lames */}
      {Array.from({ length: bladeCount }).map((_, i) => {
        const t = (i + 0.5) / bladeCount;
        const x1 = 140 + t * 370, x2 = 184 + t * 282;
        return <g key={i}><polygon points={`${x1},122 ${x1 + 26},122 ${x2 + 20},148 ${x2},148`} fill={bl} stroke={blDark} strokeWidth="1" /><polygon points={`${x1},122 ${x1 + 4},125 ${x1 + 30},125 ${x1 + 26},122`} fill={blDark} /></g>;
      })}
      <rect x="130" y="110" width="390" height="12" rx="1" fill={st} /><rect x="130" y="119" width="390" height="3" fill={stDark} />
      <rect x="180" y="148" width="290" height="6" fill={st} />
      {lighting && <rect x="134" y="121" width="382" height="2" fill="#ffe3b0" opacity="0.9" />}
    </svg>
  );
}

function ClosurePanel({ x, y, w, h, kind, skew = false }: { x: number; y: number; w: number; h: number; kind: "glass" | "slats" | "screen"; skew?: boolean }) {
  const transform = skew ? `skewY(-12) translate(0 ${x * 0.21})` : undefined;
  if (kind === "glass") return <g transform={transform}><rect x={x} y={y} width={w} height={h} fill="#bcd3dd" opacity="0.45" stroke="#88a6b3" /><line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#88a6b3" /></g>;
  if (kind === "slats") return <g transform={transform}>{Array.from({ length: Math.floor(h / 10) }).map((_, i) => <rect key={i} x={x} y={y + i * 10} width={w} height={6} fill="#8d6b4e" opacity="0.9" />)}</g>;
  return <g transform={transform}><rect x={x} y={y} width={w} height={h} fill="#6c6f72" opacity="0.6" /><rect x={x} y={y} width={w} height={8} fill="#3a3d41" /></g>;
}

/** Vue de détail du toit : coupe des lames orientables, gouttière et poutre (schéma original). */
export function RoofDetailArt({ structure = "#3a3d41", blades = "#3a3d41", angle = 35, className = "", title = "Détail des lames orientables" }: { structure?: string; blades?: string; angle?: number; className?: string; title?: string }) {
  const st = colorOf(structure), bl = colorOf(blades);
  const stDark = shade(st, -0.22), blDark = shade(bl, -0.2), blLight = shade(bl, 0.15);
  return (
    <svg viewBox="0 0 640 400" role="img" aria-label={title} className={className}>
      <defs>
        <linearGradient id="rd-bg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#dbe7ee" /><stop offset="1" stopColor="#f3efe6" /></linearGradient>
        <linearGradient id="rd-blade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={blLight} /><stop offset="1" stopColor={blDark} /></linearGradient>
      </defs>
      <rect width="640" height="400" fill="url(#rd-bg)" />
      {/* poutre / gouttière en coupe */}
      <rect x="40" y="150" width="60" height="110" rx="6" fill={st} /><rect x="88" y="150" width="12" height="110" fill={stDark} />
      <rect x="540" y="150" width="60" height="110" rx="6" fill={st} /><rect x="540" y="150" width="12" height="110" fill={shade(st, 0.12)} />
      <path d="M100 232 L540 232 L540 250 L100 250 Z" fill={stDark} opacity="0.4" />
      {/* lames en coupe, inclinées */}
      {Array.from({ length: 6 }).map((_, i) => {
        const cx = 140 + i * 72, cy = 196;
        return (
          <g key={i} transform={`rotate(${-angle} ${cx} ${cy})`}>
            <rect x={cx - 34} y={cy - 7} width="68" height="14" rx="5" fill="url(#rd-blade)" stroke={blDark} strokeWidth="1" />
            <circle cx={cx} cy={cy} r="3" fill={stDark} />
          </g>
        );
      })}
      {/* axe de rotation et cote */}
      <line x1="120" y1="196" x2="520" y2="196" stroke={stDark} strokeDasharray="4 6" strokeWidth="1" />
      <path d="M540 310 Q 540 240 512 214" fill="none" stroke="#b5683c" strokeWidth="2" /><polygon points="508,208 522,214 512,222" fill="#b5683c" />
      <text x="470" y="330" fontFamily="sans-serif" fontSize="14" fill="#4a4540">Lames orientables</text>
      <text x="40" y="330" fontFamily="sans-serif" fontSize="14" fill="#4a4540">Gouttière intégrée</text>
      <line x1="70" y1="270" x2="70" y2="312" stroke="#4a4540" strokeWidth="1" />
    </svg>
  );
}

export function AwningArt({ cabinet = "#3a3d41", fabric = "#9a9a94", className = "", lighting = true, extended = true, evening = false, title = "Illustration de store banne" }: { cabinet?: string; fabric?: string; className?: string; lighting?: boolean; extended?: boolean; evening?: boolean; title?: string }) {
  const cab = colorOf(cabinet), cabDark = shade(cab, -0.22), fabDark = shade(fabric, -0.15);
  const wallTop = evening ? "#b9ad9c" : "#e6dfd0", wallBottom = evening ? "#a39483" : "#efe9dc", floor = evening ? "#9a8266" : "#d9cfbf";
  return (
    <svg viewBox="0 0 640 400" role="img" aria-label={title} className={className}>
      <defs>
        <linearGradient id="aw-wall" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={wallTop} /><stop offset="1" stopColor={wallBottom} /></linearGradient>
        <linearGradient id="aw-fabric" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={fabric} /><stop offset="1" stopColor={fabDark} /></linearGradient>
      </defs>
      <rect width="640" height="400" fill="url(#aw-wall)" />
      <rect x="120" y="120" width="120" height="140" rx="2" fill={evening ? "#f1c988" : "#cfd8dc"} stroke="#9fb0b8" strokeWidth="2" /><line x1="180" y1="120" x2="180" y2="260" stroke="#9fb0b8" strokeWidth="2" />
      <rect x="400" y="120" width="120" height="140" rx="2" fill={evening ? "#f1c988" : "#cfd8dc"} stroke="#9fb0b8" strokeWidth="2" /><line x1="460" y1="120" x2="460" y2="260" stroke="#9fb0b8" strokeWidth="2" />
      <polygon points="0,260 640,260 640,400 0,400" fill={floor} />
      {Array.from({ length: 6 }).map((_, i) => <line key={i} x1={0} y1={280 + i * 22} x2={640} y2={280 + i * 22} stroke="#1a1612" strokeOpacity="0.08" />)}
      {extended && <polygon points="60,262 580,262 620,330 20,330" fill="#1a1612" opacity={evening ? 0.3 : 0.14} />}
      {lighting && extended && <ellipse cx="320" cy="250" rx="240" ry="40" fill="#ffd9a0" opacity={evening ? 0.75 : 0.5} />}
      {/* coffre intégral */}
      <rect x="60" y="70" width="520" height="24" rx="7" fill={cab} /><rect x="60" y="88" width="520" height="6" rx="2" fill={cabDark} />
      {extended && (
        <g>
          <polygon points="70,92 570,92 610,190 30,190" fill="url(#aw-fabric)" />
          {Array.from({ length: 7 }).map((_, i) => <line key={i} x1={70 + i * 83.3} y1="92" x2={30 + i * 96.6} y2="190" stroke="#1a1612" strokeOpacity="0.08" />)}
          <polygon points="30,190 610,190 612,206 28,206" fill={fabDark} opacity="0.9" />
          <line x1="70" y1="92" x2="36" y2="188" stroke={cab} strokeWidth="4" /><line x1="570" y1="92" x2="604" y2="188" stroke={cab} strokeWidth="4" />
          <line x1="52" y1="140" x2="36" y2="188" stroke={cabDark} strokeWidth="3" /><line x1="588" y1="140" x2="604" y2="188" stroke={cabDark} strokeWidth="3" />
          {lighting && <rect x="40" y="204" width="560" height="3" fill="#ffe3b0" opacity="0.9" />}
        </g>
      )}
      {/* mobilier (décor) */}
      <rect x="230" y="300" width="180" height="10" rx="3" fill="#8b7355" /><rect x="240" y="310" width="8" height="34" fill="#6f5b43" /><rect x="392" y="310" width="8" height="34" fill="#6f5b43" />
      <rect x="160" y="290" width="46" height="46" rx="8" fill={evening ? "#5a5248" : "#d7cdbb"} /><rect x="434" y="290" width="46" height="46" rx="8" fill={evening ? "#5a5248" : "#d7cdbb"} />
    </svg>
  );
}

export function ClosureArt({ kind, color = "#3a3d41", className = "", title = "Illustration d'accessoire" }: { kind: "glass" | "slats" | "screen" | "led" | "heater" | "lantern" | "sensor"; color?: string; className?: string; title?: string }) {
  const c = colorOf(color), cDark = shade(c, -0.22);
  return (
    <svg viewBox="0 0 640 400" role="img" aria-label={title} className={className}>
      <defs><linearGradient id="ca-bg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#dbe7ee" /><stop offset="1" stopColor="#f3eee4" /></linearGradient></defs>
      <rect width="640" height="400" fill="url(#ca-bg)" />
      <polygon points="0,360 640,360 640,400 0,400" fill="#d9cfbf" />
      <rect x="150" y="60" width="14" height="300" fill={c} /><rect x="160" y="60" width="4" height="300" fill={cDark} />
      <rect x="476" y="60" width="14" height="300" fill={c} /><rect x="486" y="60" width="4" height="300" fill={cDark} />
      <rect x="150" y="52" width="340" height="14" fill={c} /><rect x="150" y="62" width="340" height="4" fill={cDark} />
      {kind === "glass" && <g><rect x="170" y="70" width="300" height="290" fill="#bcd3dd" opacity="0.5" stroke="#88a6b3" /><line x1="320" y1="70" x2="320" y2="360" stroke="#88a6b3" strokeWidth="3" /><polygon points="190,80 230,80 190,200" fill="#fff" opacity="0.35" /></g>}
      {kind === "slats" && Array.from({ length: 24 }).map((_, i) => <g key={i}><rect x="170" y={74 + i * 12} width="300" height="8" fill="#8d6b4e" /><rect x="170" y={80 + i * 12} width="300" height="2" fill="#6a4f38" /></g>)}
      {kind === "screen" && <g><rect x="166" y="66" width="308" height="22" rx="3" fill={c} /><rect x="170" y="88" width="300" height="200" fill="#6c6f72" opacity="0.55" /><rect x="170" y="284" width="300" height="6" fill={cDark} /></g>}
      {kind === "led" && <g><rect x="164" y="66" width="312" height="6" fill="#ffd27a" /><ellipse cx="320" cy="120" rx="200" ry="60" fill="#ffd9a0" opacity="0.5" /></g>}
      {kind === "heater" && <g><rect x="250" y="80" width="140" height="36" rx="6" fill={c} /><rect x="258" y="88" width="124" height="20" fill="#e2733a" opacity="0.8" /><ellipse cx="320" cy="200" rx="120" ry="70" fill="#f0a060" opacity="0.25" /></g>}
      {kind === "lantern" && <g><rect x="290" y="200" width="60" height="120" rx="8" fill={c} /><rect x="300" y="215" width="40" height="80" fill="#ffd9a0" opacity="0.9" /><ellipse cx="320" cy="260" rx="90" ry="60" fill="#ffd9a0" opacity="0.2" /></g>}
      {kind === "sensor" && <g><rect x="296" y="90" width="48" height="60" rx="8" fill={c} /><circle cx="320" cy="120" r="10" fill="#9ad38e" /><path d="M250 70 Q 320 30 390 70" fill="none" stroke={cDark} strokeWidth="2" strokeDasharray="4 4" /></g>}
    </svg>
  );
}
