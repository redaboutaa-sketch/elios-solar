import Link from "next/link";
import { Check } from "lucide-react";
import { PergolaArt, colorOf } from "@/components/illustrations/pergola";
import { Price } from "@/components/ui/price";
import { DemoBadge } from "@/components/ui/demo-badge";
import type { FamilyListItem } from "@/server/catalog/queries";
import { priceFrom } from "@/server/catalog/queries";
import type { RangeHighlights } from "@/server/catalog/highlights";

export function RangeCard({ f, highlights }: { f: FamilyListItem; highlights: RangeHighlights | null }) {
  const from = priceFrom(f);
  const custom = f.kind === "PERGOLA_CUSTOM";
  const href = custom ? "/configurateur/sur-mesure" : `/pergolas/${f.slug}`;
  const finishes = f.finishes.map((x) => x.finish);
  return (
    <article className="card overflow-hidden flex flex-col">
      <Link href={href} className="block relative" aria-label={f.name}>
        <PergolaArt structure={colorOf("ANTHRACITE")} blades={colorOf("ANTHRACITE")} lighting={!!f.lightingIncluded && f.lightingIncluded !== "none"} className="w-full h-auto" title={`Illustration ${f.name}`} />
        {f.generation && <span className="absolute top-3 left-3 badge bg-white/90 border border-sand-300">{f.generation}</span>}
      </Link>
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-display text-2xl"><Link href={href} className="hover:text-copper-600">{f.name}</Link></h3>
        <p className="mt-1 text-sm text-stone-700">{f.shortDescription}</p>
        {highlights && !custom && (
          <ul className="mt-4 space-y-1.5 text-sm">
            <li className="flex gap-2"><Check className="size-4 mt-0.5 text-success shrink-0" aria-hidden="true" /><span>{highlights.sizes} tailles · {highlights.finishes} finitions · {highlights.roof}</span></li>
            <li className="flex gap-2"><Check className="size-4 mt-0.5 text-success shrink-0" aria-hidden="true" /><span>{highlights.lighting.charAt(0).toUpperCase() + highlights.lighting.slice(1)}</span></li>
            {highlights.closures.length > 0 && <li className="flex gap-2"><Check className="size-4 mt-0.5 text-success shrink-0" aria-hidden="true" /><span>Fermetures : {highlights.closures.join(", ")}</span></li>}
            {highlights.rails && <li className="flex gap-2"><Check className="size-4 mt-0.5 text-success shrink-0" aria-hidden="true" /><span>{highlights.rails} rail{highlights.rails > 1 ? "s" : ""} d'accessoires par poutre</span></li>}
          </ul>
        )}
        {custom && <ul className="mt-4 space-y-1.5 text-sm"><li className="flex gap-2"><Check className="size-4 mt-0.5 text-success shrink-0" aria-hidden="true" />Largeur, longueur, hauteur à vos cotes</li><li className="flex gap-2"><Check className="size-4 mt-0.5 text-success shrink-0" aria-hidden="true" />Fermetures par côté, étude incluse</li></ul>}
        <div className="mt-4 flex items-center gap-1.5" aria-label="Finitions disponibles">{finishes.map((fin) => <span key={fin.code} title={fin.label} className="size-4 rounded-full border border-sand-300" style={{ background: fin.swatch }} />)}</div>
        <div className="mt-4 flex items-end justify-between gap-2 flex-1">
          <div>{from ? <><span className="text-xs text-stone-700">À partir de</span><p className="text-xl font-semibold leading-tight"><Price cents={from} /></p></> : <p className="text-stone-700">Sur devis</p>}{f.dataStatus === "DEMO" && <DemoBadge label="démo" className="mt-1" />}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href={custom ? "/configurateur/sur-mesure" : `/configurateur?gamme=${f.slug}`} className="btn-primary py-2.5">Configurer</Link>
          <Link href={custom ? "/configurateur/sur-mesure" : "/comparer"} className="btn-secondary py-2.5">{custom ? "Devis" : "Comparer"}</Link>
        </div>
      </div>
    </article>
  );
}
