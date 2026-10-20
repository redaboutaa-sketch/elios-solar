/**
 * Scène de terrasse originale (SVG) : pergola bioclimatique vue de trois quarts dans un jardin,
 * avec mobilier et végétation stylisés. Sert de visuel principal tant qu'aucune photographie
 * autorisée n'est disponible et alimente les rendus PNG de la médiathèque (nature RENDER).
 * Les fermetures et l'éclairage sont pilotés par props : rien n'est représenté comme inclus
 * s'il ne l'est pas. Le mobilier et la végétation sont du décor (non compris).
 */
import { colorOf, shade } from "./pergola";

export interface SceneProps {
  structure?: string;
  blades?: string;
  mounting?: "freestanding" | "wall";
  lighting?: boolean;
  closures?: Partial<Record<"left" | "right" | "front", "glass" | "slats" | "screen">>;
  evening?: boolean;
  className?: string;
  title?: string;
}

export function TerraceScene({ structure = "#3a3d41", blades = "#3a3d41", mounting = "freestanding", lighting = false, closures = {}, evening = false, className = "", title = "Terrasse avec pergola bioclimatique" }: SceneProps) {
  const st = colorOf(structure), bl = colorOf(blades);
  const stDark = shade(st, -0.22), stLight = shade(st, 0.12), blDark = shade(bl, -0.18);
  const sky: [string, string, string] = evening ? ["#1f2440", "#4a3f5c", "#c7775a"] : ["#9fc3d9", "#d7e6ee", "#f5efe3"];
  const lawn: [string, string] = evening ? ["#4b5a3c", "#5c6b45"] : ["#8fa36a", "#a9b97f"];
  const hills = evening ? "#56634a" : "#9aa97a";
  const deck: [string, string] = evening ? ["#8d7357", "#6f5a44"] : ["#d3bf9f", "#b99f7b"];
  const foliage: [string, string] = evening ? ["#3f4c33", "#55663f"] : ["#6f7a4a", "#8a9a5b"];
  const wall = evening ? "#b9aea0" : "#ece6da";
  const sunColor = evening ? "#f0a46a" : "#fff2cf";
  return (
    <svg viewBox="0 0 1200 720" role="img" aria-label={title} className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sc-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={sky[0]} /><stop offset="0.6" stopColor={sky[1]} /><stop offset="1" stopColor={sky[2]} /></linearGradient>
        <linearGradient id="sc-ground" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={deck[0]} /><stop offset="1" stopColor={deck[1]} /></linearGradient>
        <linearGradient id="sc-lawn" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor={lawn[0]} /><stop offset="1" stopColor={lawn[1]} /></linearGradient>
        <radialGradient id="sc-glow" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stopColor="#ffd9a0" stopOpacity="0.85" /><stop offset="1" stopColor="#ffd9a0" stopOpacity="0" /></radialGradient>
        <radialGradient id="sc-sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor={sunColor} stopOpacity="0.95" /><stop offset="0.55" stopColor={sunColor} stopOpacity="0.35" /><stop offset="1" stopColor={sunColor} stopOpacity="0" /></radialGradient>
        <linearGradient id="sc-glass" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#e4f0f5" stopOpacity="0.6" /><stop offset="0.5" stopColor="#bcd6e0" stopOpacity="0.3" /><stop offset="1" stopColor="#8fb3c2" stopOpacity="0.45" /></linearGradient>
        <linearGradient id="sc-post" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor={stLight} /><stop offset="0.45" stopColor={st} /><stop offset="1" stopColor={stDark} /></linearGradient>
        <linearGradient id="sc-shadow" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#1a1612" stopOpacity={evening ? 0.35 : 0.22} /><stop offset="1" stopColor="#1a1612" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="1200" height="720" fill="url(#sc-sky)" />
      {/* soleil bas et halo ; étoiles le soir */}
      <circle cx="980" cy="150" r="150" fill="url(#sc-sun)" />
      <circle cx="980" cy="150" r="46" fill={evening ? "#f2b27c" : "#fff7e3"} opacity="0.95" />
      {evening && [[120, 60], [240, 110], [420, 50], [640, 90], [760, 40], [1120, 70], [560, 150]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#fff" opacity="0.8" />)}
      {!evening && <g fill="#fff" opacity="0.65"><ellipse cx="220" cy="130" rx="90" ry="22" /><ellipse cx="270" cy="118" rx="60" ry="26" /><ellipse cx="640" cy="90" rx="70" ry="16" /><ellipse cx="680" cy="80" rx="40" ry="18" /></g>}
      {/* collines / haies */}
      <path d="M0 430 C 200 380, 420 400, 620 390 S 1000 360, 1200 400 L1200 470 L0 470 Z" fill={hills} />
      <path d="M0 455 C 150 430, 300 445, 480 438 S 900 420, 1200 445 L1200 480 L0 480 Z" fill={shade(hills, -0.1)} />
      <path d="M0 470 C 300 440, 600 455, 1200 440 L1200 720 L0 720 Z" fill="url(#sc-lawn)" />
      {/* terrasse en lames de bois */}
      <polygon points="120,520 1080,520 1200,720 0,720" fill="url(#sc-ground)" />
      {Array.from({ length: 11 }).map((_, i) => <line key={i} x1={100 + i * 98} y1={520} x2={-80 + i * 136} y2={720} stroke={shade(deck[1], -0.2)} strokeOpacity="0.45" strokeWidth="1.5" />)}
      {[560, 600, 650, 700].map((y, i) => <line key={y} x1={120 - i * 30} y1={y} x2={1080 + i * 30} y2={y} stroke={shade(deck[1], -0.2)} strokeOpacity="0.25" />)}
      {/* ombre portée du toit sur la terrasse */}
      <polygon points="330,560 960,560 1060,700 230,700" fill="url(#sc-shadow)" />
      {/* mur de la maison si adossée */}
      {mounting === "wall" && (
        <g>
          <rect x="0" y="110" width="300" height="410" fill={wall} />
          <rect x="0" y="110" width="300" height="12" fill={shade(wall, -0.15)} />
          <rect x="60" y="200" width="100" height="150" rx="2" fill={evening ? "#f3cf8a" : "#cfd8dc"} stroke="#9fb0b8" strokeWidth="3" />
          <line x1="110" y1="200" x2="110" y2="350" stroke="#9fb0b8" strokeWidth="3" /><line x1="60" y1="275" x2="160" y2="275" stroke="#9fb0b8" strokeWidth="3" />
          <rect x="200" y="330" width="70" height="190" fill={evening ? "#d9b374" : "#b8c4c9"} stroke="#8fa0a8" strokeWidth="3" />
        </g>
      )}
      {/* lumière */}
      {lighting && <ellipse cx="640" cy="470" rx="340" ry="120" fill="url(#sc-glow)" />}
      {/* pergola : poteaux arrière */}
      <g>
        {mounting === "freestanding" && <rect x="372" y="236" width="16" height="286" fill="url(#sc-post)" />}
        <rect x="868" y="236" width="16" height="286" fill="url(#sc-post)" />
      </g>
      {/* fermetures arrière/latérales (derrière le mobilier) */}
      {closures.left && <Panel kind={closures.left} points="302,260 380,246 380,520 302,520" />}
      {closures.right && <Panel kind={closures.right} points="882,246 960,262 960,520 882,520" />}
      {/* mobilier (décor, non compris) */}
      <g>
        <ellipse cx="640" cy="512" rx="230" ry="18" fill="#1a1612" opacity="0.12" />
        {/* canapé bas */}
        <rect x="500" y="430" width="260" height="60" rx="10" fill={evening ? "#5a5248" : "#d7cdbb"} />
        <rect x="500" y="418" width="260" height="22" rx="8" fill={evening ? "#6b6256" : "#e6ddcc"} />
        <rect x="508" y="438" width="72" height="34" rx="6" fill={evening ? "#8a6a4f" : "#c2a98c"} /><rect x="594" y="438" width="72" height="34" rx="6" fill={evening ? "#8a6a4f" : "#c2a98c"} /><rect x="680" y="438" width="72" height="34" rx="6" fill={evening ? "#8a6a4f" : "#c2a98c"} />
        <rect x="512" y="490" width="10" height="18" fill="#6f5b43" /><rect x="738" y="490" width="10" height="18" fill="#6f5b43" />
        {/* table basse */}
        <rect x="560" y="520" width="140" height="10" rx="3" fill="#8b7355" /><rect x="570" y="530" width="8" height="30" fill="#6f5b43" /><rect x="682" y="530" width="8" height="30" fill="#6f5b43" />
        <ellipse cx="630" cy="518" rx="18" ry="6" fill="#6f7a4a" /><rect x="624" y="500" width="12" height="18" rx="3" fill="#b9a48a" />
        {/* fauteuils */}
        <rect x="430" y="440" width="56" height="56" rx="10" fill={evening ? "#5a5248" : "#d7cdbb"} /><rect x="774" y="440" width="56" height="56" rx="10" fill={evening ? "#5a5248" : "#d7cdbb"} />
        {/* jardinières */}
        <rect x="396" y="470" width="30" height="48" rx="3" fill="#8e7a62" /><ellipse cx="411" cy="462" rx="24" ry="18" fill={foliage[1]} />
        <rect x="836" y="470" width="30" height="48" rx="3" fill="#8e7a62" /><ellipse cx="851" cy="462" rx="24" ry="18" fill={foliage[1]} />
        {lighting && <g><rect x="470" y="300" width="4" height="120" fill={stDark} /><ellipse cx="472" cy="424" rx="16" ry="8" fill="#ffd9a0" opacity="0.9" /></g>}
      </g>
      {/* poteaux avant */}
      <g>
        <rect x="296" y="258" width="18" height="300" fill="url(#sc-post)" />
        <rect x="946" y="258" width="18" height="300" fill="url(#sc-post)" />
        <rect x="290" y="554" width="30" height="6" rx="1" fill={stDark} /><rect x="940" y="554" width="30" height="6" rx="1" fill={stDark} />
      </g>
      {closures.front && <Panel kind={closures.front} points="314,268 946,268 946,560 314,560" />}
      {/* toit : cadre en perspective */}
      <polygon points="286,250 974,250 892,228 364,228" fill={stDark} />
      {Array.from({ length: 12 }).map((_, i) => {
        const t = (i + 0.5) / 12;
        const xa = 300 + t * 660, xb = 372 + t * 512;
        return <g key={i}><polygon points={`${xa - 22},250 ${xa + 10},250 ${xb + 8},232 ${xb - 16},232`} fill={bl} stroke={blDark} strokeWidth="1" /><polygon points={`${xa - 22},250 ${xa - 16},254 ${xa + 16},254 ${xa + 10},250`} fill={blDark} /></g>;
      })}
      {/* gouttière avant et poutre arrière */}
      <rect x="286" y="246" width="688" height="14" rx="2" fill="url(#sc-post)" />
      <rect x="286" y="258" width="688" height="4" fill={stDark} />
      <rect x="364" y="226" width="528" height="8" rx="2" fill={st} />
      {lighting && <rect x="300" y="259" width="660" height="3" fill="#ffe3b0" opacity="0.9" />}
      {/* végétation */}
      <g>
        <ellipse cx="110" cy="560" rx="70" ry="60" fill={foliage[0]} /><ellipse cx="150" cy="600" rx="55" ry="45" fill={foliage[1]} /><ellipse cx="70" cy="610" rx="48" ry="40" fill={shade(foliage[1], 0.08)} />
        <ellipse cx="1090" cy="580" rx="80" ry="65" fill={foliage[0]} /><ellipse cx="1040" cy="620" rx="50" ry="40" fill={foliage[1]} />
        <rect x="1000" y="500" width="60" height="70" rx="6" fill="#b9a48a" /><ellipse cx="1030" cy="490" rx="40" ry="30" fill={shade(foliage[1], -0.05)} />
        <rect x="1120" y="440" width="14" height="140" fill="#7a6248" /><ellipse cx="1127" cy="420" rx="60" ry="50" fill={foliage[0]} /><ellipse cx="1150" cy="400" rx="40" ry="34" fill={foliage[1]} />
      </g>
    </svg>
  );
}

function Panel({ kind, points }: { kind: "glass" | "slats" | "screen"; points: string }) {
  if (kind === "glass") return <polygon points={points} fill="url(#sc-glass)" stroke="#8fb0bd" strokeWidth="2" />;
  if (kind === "screen") return <polygon points={points} fill="#6c6f72" opacity="0.6" />;
  return <polygon points={points} fill="#8d6b4e" opacity="0.9" />;
}
