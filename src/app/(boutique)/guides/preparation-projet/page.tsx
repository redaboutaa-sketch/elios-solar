import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PUBLISHED_GUIDES } from "@/server/content/guides";

const TITLE = "Préparer son projet et prendre les mesures";
const DESCRIPTION = "Emplacement, cotes extérieur poteau à extérieur poteau, hauteur, pente, ancrage, câble 230 V, orientation, accès livraison et démarches : la liste de contrôle avant de commander.";

export const metadata: Metadata = { title: TITLE, description: DESCRIPTION, alternates: { canonical: "/guides/preparation-projet" } };

const INK = "#2f2c29", ACCENT = "#b5683c", POST = "#3a3d41", SOFT = "#e9e2d4";

function Figure({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <figure className="my-6 card p-4">
      <svg viewBox="0 0 640 300" role="img" aria-label={title} className="w-full h-auto">{children}</svg>
      <figcaption className="mt-2 text-sm text-stone-700">{caption}</figcaption>
    </figure>
  );
}

function Arrow({ x1, y1, x2, y2, label, lx, ly }: { x1: number; y1: number; x2: number; y2: number; label: string; lx: number; ly: number }) {
  return (
    <g stroke={ACCENT} fill={ACCENT}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="2" markerStart="url(#g-a)" markerEnd="url(#g-a)" />
      <text x={lx} y={ly} stroke="none" fontSize="15" fontFamily="sans-serif" textAnchor="middle" fill={INK}>{label}</text>
    </g>
  );
}

const Marker = () => (
  <defs>
    <marker id="g-a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill={ACCENT} /></marker>
  </defs>
);

export default function Page() {
  return (
    <div className="container-x py-8 max-w-3xl">
      <Breadcrumbs items={[{ label: "Guides" }, { label: TITLE }]} />
      <h1 className="mt-4 font-display text-4xl">{TITLE}</h1>
      <p className="mt-2 text-stone-700">{DESCRIPTION}</p>
      <p className="mt-3 text-sm text-stone-700">Guide pratique original. Les valeurs propres à chaque modèle (hauteur de passage, dimensions des platines, alimentation) figurent sur la fiche technique et la notice du fournisseur : reportez-vous toujours à ces documents.</p>

      <div className="prose-shop mt-6">
        <h2>1. Choisir l'emplacement</h2>
        <ul>
          <li>Repérez la zone à couvrir et l'usage (repas, salon, bord de piscine) : prévoyez un dégagement pour circuler autour du mobilier.</li>
          <li>Adossée : le mur doit être porteur, plan et disponible sur toute la longueur de la pergola (sans fenêtre, volet ou descente d'eau gênant la poutre).</li>
          <li>Autoportée : quatre poteaux, à placer sur un sol capable de recevoir les fixations.</li>
          <li>Pensez à l'évacuation de l'eau des modèles à lames : la fiche du modèle indique par où elle s'écoule, vérifiez où elle aboutira.</li>
        </ul>

        <h2>2. Mesurer : extérieur poteau à extérieur poteau</h2>
        <p>Les dimensions commerciales (3 × 4 m, 4 × 6 m…) correspondent à l'encombrement extérieur de la structure, mesuré d'extérieur de poteau à extérieur de poteau. Tracez au sol le rectangle exact et vérifiez qu'il tient sur la terrasse, débords de gouttière compris selon la fiche technique.</p>
      </div>
      <Figure title="Vue de dessus : largeur et longueur mesurées d'extérieur de poteau à extérieur de poteau" caption="Vue de dessus (schéma). Mesurez les deux diagonales : si elles sont égales, votre tracé est bien d'équerre.">
        <Marker />
        <rect x="0" y="0" width="640" height="300" fill="#faf7f1" />
        <rect x="150" y="60" width="340" height="180" fill={SOFT} stroke={INK} strokeDasharray="6 5" />
        {[[150, 60], [474, 60], [150, 224], [474, 224]].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="16" height="16" fill={POST} />)}
        <line x1="166" y1="76" x2="474" y2="224" stroke={INK} strokeOpacity="0.35" /><line x1="474" y1="76" x2="166" y2="224" stroke={INK} strokeOpacity="0.35" />
        <Arrow x1={150} y1={30} x2={490} y2={30} label="Largeur (extérieur → extérieur)" lx={320} ly={22} />
        <Arrow x1={520} y1={60} x2={520} y2={240} label="" lx={0} ly={0} />
        <text x="530" y="155" fontSize="15" fontFamily="sans-serif" fill={INK}>Longueur</text>
        <text x="320" y="275" fontSize="14" fontFamily="sans-serif" textAnchor="middle" fill={INK}>Poteau ■ · diagonales en trait fin</text>
      </Figure>

      <div className="prose-shop">
        <h2>3. Hauteur disponible</h2>
        <ul>
          <li>Adossée : mesurez la hauteur sous l'obstacle le plus bas du mur (débord de toit, appui de fenêtre à l'étage, linteau, volet roulant) ; la poutre murale doit passer dessous.</li>
          <li>Autoportée : vérifiez l'absence d'obstacle au-dessus (branches, câbles, avancée de toit).</li>
          <li>Comparez avec la hauteur de passage indiquée sur la fiche technique du modèle.</li>
        </ul>
      </div>
      <Figure title="Vue de côté : hauteur sous obstacle et pente du sol" caption="Vue de côté (schéma). Mesurez la hauteur disponible sous l'obstacle le plus bas et le dénivelé entre le pied du mur et le point le plus éloigné.">
        <Marker />
        <rect x="0" y="0" width="640" height="300" fill="#faf7f1" />
        <rect x="40" y="20" width="60" height="250" fill={SOFT} stroke={INK} />
        <polygon points="40,20 160,20 160,34 40,34" fill={INK} opacity="0.75" />
        <text x="170" y="32" fontSize="14" fontFamily="sans-serif" fill={INK}>Débord de toit / obstacle</text>
        <polygon points="100,262 600,276 600,290 100,290" fill="#cbbfa9" />
        <rect x="100" y="90" width="420" height="10" fill={POST} /><rect x="506" y="100" width="14" height="172" fill={POST} />
        <Arrow x1={140} y1={36} x2={140} y2={262} label="" lx={0} ly={0} />
        <text x="150" y="160" fontSize="15" fontFamily="sans-serif" fill={INK}>Hauteur disponible</text>
        <line x1="100" y1="262" x2="600" y2="262" stroke={INK} strokeDasharray="4 5" />
        <Arrow x1={580} y1={262} x2={580} y2={276} label="" lx={0} ly={0} />
        <text x="575" y="250" fontSize="15" fontFamily="sans-serif" textAnchor="end" fill={INK}>Dénivelé du sol</text>
      </Figure>

      <div className="prose-shop">
        <h2>4. Pente et nature du sol</h2>
        <ul>
          <li>Mesurez le dénivelé à l'aide d'un niveau et d'une règle (ou d'un niveau laser) entre les emplacements des poteaux. Une terrasse présente souvent une légère pente pour l'écoulement : les pieds réglables ou des cales adaptées sont à prévoir selon la notice.</li>
          <li>Identifiez le support d'ancrage : dalle béton, carrelage sur dalle, terrasse bois sur plots, terre. Les fixations (chevilles, scellement, plots béton) ne sont pas fournies et dépendent du support.</li>
          <li>Adossée : identifiez la nature du mur (béton, parpaing, brique, isolation par l'extérieur). En cas de doute, faites vérifier par un professionnel.</li>
        </ul>

        <h2>5. Électricité : passage du câble 230 V</h2>
        <p>Les modèles motorisés et l'éclairage intégré nécessitent une alimentation 230 V au plus près d'un poteau. Le raccordement n'est pas inclus et doit être réalisé par un électricien, conformément aux règles en vigueur (protection, circuit adapté à l'extérieur).</p>
      </div>
      <Figure title="Vue de dessus : orientation, arrivée électrique et accès livraison" caption="Plan de préparation (schéma) : repérez le nord, la trajectoire du soleil, l'arrivée du câble 230 V et le chemin de livraison jusqu'à l'emplacement.">
        <Marker />
        <rect x="0" y="0" width="640" height="300" fill="#faf7f1" />
        <rect x="20" y="20" width="160" height="260" fill={SOFT} stroke={INK} /><text x="100" y="155" fontSize="15" fontFamily="sans-serif" textAnchor="middle" fill={INK}>Maison</text>
        <rect x="230" y="70" width="230" height="150" fill="none" stroke={INK} strokeDasharray="6 5" />
        {[[230, 70], [444, 70], [230, 204], [444, 204]].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="16" height="16" fill={POST} />)}
        <path d="M180 120 C 200 120, 210 90, 232 82" fill="none" stroke="#c9a227" strokeWidth="3" strokeDasharray="8 4" />
        <text x="186" y="60" fontSize="13" fontFamily="sans-serif" fill={INK}>Câble 230 V</text>
        <path d="M600 280 L600 240 Q 600 230 590 230 L470 230" fill="none" stroke={ACCENT} strokeWidth="2" markerEnd="url(#g-a)" />
        <text x="560" y="270" fontSize="13" fontFamily="sans-serif" textAnchor="end" fill={INK}>Accès livraison</text>
        <g transform="translate(580 60)"><circle r="26" fill="none" stroke={INK} /><path d="M0 -22 L7 0 L0 -5 L-7 0 Z" fill={INK} /><text y="-30" fontSize="13" fontFamily="sans-serif" textAnchor="middle" fill={INK}>N</text></g>
        <path d="M470 270 Q 560 120 520 20" fill="none" stroke="#e0a73b" strokeWidth="2" strokeDasharray="2 6" />
        <text x="512" y="130" fontSize="13" fontFamily="sans-serif" fill={INK}>Soleil</text>
      </Figure>

      <div className="prose-shop">
        <h2>6. Orientation et ensoleillement</h2>
        <ul>
          <li>Repérez le nord et la course du soleil sur la journée : l'orientation détermine les côtés à fermer en priorité (store vertical côté soleil couchant, paroi vitrée côté vent dominant…).</li>
          <li>Observez les vents dominants et les vis-à-vis : ils guident le choix des fermetures latérales.</li>
        </ul>

        <h2>7. Accès pour la livraison</h2>
        <ul>
          <li>Les modalités de livraison sont précisées au devis : vérifiez dès maintenant la largeur des accès (portail, allée, passage latéral), les marches et la possibilité de stationner un véhicule de livraison.</li>
          <li>Les profilés sont longs : prévoyez un chemin dégagé jusqu'à l'emplacement et un lieu de stockage à l'abri avant la pose.</li>
          <li>Prévoyez au moins deux personnes et du matériel adapté pour le montage (voir notice du fournisseur).</li>
        </ul>

        <h2>8. Démarches administratives</h2>
        <p>Une pergola peut nécessiter une autorisation d'urbanisme selon sa surface, son implantation et les règles locales (plan local d'urbanisme, secteur protégé, règlement de copropriété ou de lotissement). <strong>Renseignez-vous auprès de votre mairie</strong> avant de commander et conservez une trace de sa réponse. Voir aussi notre <Link href="/guides/autorisation-urbanisme">guide sur l'autorisation d'urbanisme</Link> (indicatif, ne constitue pas un conseil juridique).</p>

        <h2>Liste de contrôle avant la demande de devis</h2>
        <ul>
          <li>Rectangle tracé au sol, cotes extérieur poteau à extérieur poteau et diagonales relevées.</li>
          <li>Hauteur disponible sous l'obstacle le plus bas mesurée.</li>
          <li>Dénivelé du sol mesuré entre les emplacements des poteaux.</li>
          <li>Support d'ancrage (sol et, si adossée, mur) identifié ; fixations adaptées prévues.</li>
          <li>Arrivée 230 V prévue près d'un poteau (modèles motorisés / éclairage), avec un électricien.</li>
          <li>Orientation, vents dominants et côtés à fermer choisis.</li>
          <li>Accès livraison vérifié.</li>
          <li>Mairie consultée.</li>
        </ul>
      </div>

      <nav aria-label="Autres guides" className="mt-10 card p-5"><p className="font-medium">Autres guides</p><ul className="mt-2 list-disc pl-5">{PUBLISHED_GUIDES.filter((g) => g.href !== "/guides/preparation-projet").map((g) => <li key={g.href}><Link href={g.href} className="underline">{g.title}</Link></li>)}</ul></nav>
      <p className="mt-6 flex flex-wrap gap-3"><Link href="/configurateur" className="btn-accent">Configurer ma pergola</Link><Link href="/devis" className="btn-ghost">Demander un devis</Link></p>
    </div>
  );
}
