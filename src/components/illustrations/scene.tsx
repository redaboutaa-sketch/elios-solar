/**
 * Scène de terrasse originale (SVG) : pergola bioclimatique vue de trois quarts dans un jardin,
 * avec mobilier et végétation stylisés. Sert de visuel principal tant qu'aucune photographie
 * autorisée n'est disponible. Les fermetures et l'éclairage sont pilotés par props (rien n'est
 * représenté comme inclus s'il ne l'est pas).
 */
import { colorOf } from "./pergola";

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
  const sky1 = evening ? "#2b2f45" : "#dfe9ee", sky2 = evening ? "#7a5a52" : "#f3efe6";
  return (
    <svg viewBox="0 0 1200 720" role="img" aria-label={title} className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sc-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={sky1} /><stop offset="1" stopColor={sky2} /></linearGradient>
        <linearGradient id="sc-ground" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#cbb89c" /><stop offset="1" stopColor="#b8a384" /></linearGradient>
        <linearGradient id="sc-lawn" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#8fa36a" /><stop offset="1" stopColor="#a9b97f" /></linearGradient>
        <radialGradient id="sc-glow" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stopColor="#ffd9a0" stopOpacity="0.85" /><stop offset="1" stopColor="#ffd9a0" stopOpacity="0" /></radialGradient>
        <linearGradient id="sc-glass" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#dbe9ef" stopOpacity="0.55" /><stop offset="1" stopColor="#9fbfcc" stopOpacity="0.35" /></linearGradient>
      </defs>
      <rect width="1200" height="720" fill="url(#sc-sky)" />
      {/* soleil bas */}
      <circle cx="980" cy="150" r="54" fill={evening ? "#e9a26b" : "#f6dfb7"} opacity="0.9" />
      {/* collines / haies */}
      <path d="M0 430 C 200 380, 420 400, 620 390 S 1000 360, 1200 400 L1200 470 L0 470 Z" fill="#9aa97a" />
      <path d="M0 470 C 300 440, 600 455, 1200 440 L1200 520 L0 520 Z" fill="url(#sc-lawn)" />
      {/* terrasse */}
      <polygon points="120,520 1080,520 1200,720 0,720" fill="url(#sc-ground)" />
      {Array.from({ length: 9 }).map((_, i) => <line key={i} x1={120 + i * 120} y1={520} x2={-40 + i * 155} y2={720} stroke="#a9947a" strokeOpacity="0.5" />)}
      {/* mur de la maison si adossée */}
      {mounting === "wall" && <g><rect x="0" y="120" width="300" height="400" fill="#e8e2d6" /><rect x="60" y="200" width="90" height="140" fill="#cfd8dc" stroke="#9fb0b8" strokeWidth="3" /><rect x="0" y="118" width="300" height="10" fill="#d9d1c2" /></g>}
      {/* lumière */}
      {lighting && <ellipse cx="640" cy="470" rx="330" ry="110" fill="url(#sc-glow)" />}
      {/* pergola : poteaux arrière */}
      <g fill={st}>
        {mounting === "freestanding" && <rect x="372" y="236" width="16" height="286" />}
        <rect x="868" y="236" width="16" height="286" />
      </g>
      {/* fermetures arrière/latérales (derrière le mobilier) */}
      {closures.left && <Panel kind={closures.left} points="302,260 380,246 380,520 302,520" />}
      {closures.right && <Panel kind={closures.right} points="882,246 960,262 960,520 882,520" />}
      {/* mobilier */}
      <g>
        <rect x="520" y="440" width="220" height="14" rx="4" fill="#8b7355" />
        <rect x="530" y="454" width="10" height="56" fill="#6f5b43" /><rect x="720" y="454" width="10" height="56" fill="#6f5b43" />
        <rect x="440" y="430" width="60" height="60" rx="8" fill="#d7cdbb" /><rect x="760" y="430" width="60" height="60" rx="8" fill="#d7cdbb" />
        <ellipse cx="620" cy="430" rx="24" ry="10" fill="#6f7a4a" />
      </g>
      {/* poteaux avant */}
      <g fill={st}>
        <rect x="296" y="258" width="18" height="300" />
        <rect x="946" y="258" width="18" height="300" />
      </g>
      {closures.front && <Panel kind={closures.front} points="314,268 946,268 946,560 314,560" />}
      {/* toit : cadre en perspective */}
      <polygon points="286,250 974,250 892,228 364,228" fill={st} />
      {Array.from({ length: 12 }).map((_, i) => {
        const t = (i + 0.5) / 12;
        const xa = 300 + t * 660, xb = 372 + t * 512;
        return <polygon key={i} points={`${xa - 22},250 ${xa + 10},250 ${xb + 8},232 ${xb - 16},232`} fill={bl} stroke={st} strokeWidth="1" />;
      })}
      <rect x="286" y="246" width="688" height="12" rx="2" fill={st} />
      <rect x="364" y="226" width="528" height="8" rx="2" fill={st} />
      {/* végétation */}
      <g>
        <ellipse cx="110" cy="560" rx="70" ry="60" fill="#6f7a4a" /><ellipse cx="150" cy="600" rx="55" ry="45" fill="#8a9a5b" />
        <ellipse cx="1090" cy="580" rx="80" ry="65" fill="#6f7a4a" /><ellipse cx="1040" cy="620" rx="50" ry="40" fill="#8a9a5b" />
        <rect x="1000" y="500" width="60" height="70" rx="6" fill="#b9a48a" /><ellipse cx="1030" cy="490" rx="40" ry="30" fill="#7f8f4e" />
      </g>
    </svg>
  );
}

function Panel({ kind, points }: { kind: "glass" | "slats" | "screen"; points: string }) {
  if (kind === "glass") return <polygon points={points} fill="url(#sc-glass)" stroke="#8fb0bd" strokeWidth="2" />;
  if (kind === "screen") return <polygon points={points} fill="#6c6f72" opacity="0.6" />;
  return <polygon points={points} fill="#8d6b4e" opacity="0.9" />;
}
