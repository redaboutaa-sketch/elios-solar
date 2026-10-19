import Link from "next/link";
import { PergolaArt, ClosureArt, AwningArt, colorOf } from "@/components/illustrations/pergola";
import { artKind } from "@/components/illustrations/art-kind";
import { Price } from "@/components/ui/price";
import { DemoBadge } from "@/components/ui/demo-badge";
import type { FamilyListItem } from "@/server/catalog/queries";
import type { AccessoryCompatSummary } from "@/server/catalog/accessory-compat";
import { priceFrom } from "@/server/catalog/queries";

const SWATCH: Record<string, string> = { anthracite: "#3a3d41", blanc: "#e9e6df", noir: "#15161a" };

export function FamilyCard({ f, href, finishCode = "ANTHRACITE", compat }: { f: FamilyListItem; href: string; finishCode?: string; compat?: AccessoryCompatSummary }) {
  const from = priceFrom(f);
  const fin = f.finishes.find((x) => x.finishCode === finishCode)?.finish ?? f.finishes[0]?.finish;
  return (
    <article className="card overflow-hidden flex flex-col">
      <Link href={href} className="block" aria-label={f.name}>
        {f.kind === "AWNING" ? <AwningArt className="w-full h-auto" /> : f.kind === "SIDE_CLOSURE" || f.kind === "OPTION" ? <ClosureArt kind={artKind(f.slug)} className="w-full h-auto" /> : <PergolaArt structure={colorOf(fin?.structureColor)} blades={colorOf(fin?.bladeColor)} lighting={!!f.lightingIncluded && f.lightingIncluded !== "none"} className="w-full h-auto" title={`Illustration ${f.name}`} />}
      </Link>
      <div className="p-5 flex-1 flex flex-col">
        <h2 className="font-display text-xl"><Link href={href} className="hover:text-copper-600">{f.name}</Link></h2>
        <p className="mt-1 text-sm text-stone-700 flex-1">{f.shortDescription}</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          {from ? <span>À partir de <Price cents={from} className="font-semibold" /></span> : <span className="text-stone-700">Sur devis</span>}
          {f.dataStatus === "DEMO" && <DemoBadge label="démo" />}
        </div>
        {compat && (
          <div className="mt-3 text-xs text-stone-800 space-y-1.5">
            <p><span className="badge bg-sand-100 border border-sand-300">{compat.label}</span></p>
            <div className="flex items-center gap-2">
              {compat.colors.length > 0 && <span className="flex items-center gap-1" aria-label={`Couleurs : ${compat.colors.join(", ")}`}>{compat.colors.map((c) => <span key={c} title={c} className="size-3.5 rounded-full border border-sand-300" style={{ background: SWATCH[c] ?? "#999" }} />)}</span>}
              {compat.lengthsMm.length > 0 && <span>Longueurs {compat.lengthsMm.map((l) => `${l / 1000} m`).join(" · ")}</span>}
            </div>
          </div>
        )}
        {f.kind === "PERGOLA_STANDARD" && <div className="mt-2 text-xs text-stone-700">{f.roof === "motorized" ? "Toit motorisé" : "Toit manuel"} · {f.lightingIncluded && f.lightingIncluded !== "none" ? "éclairage inclus" : "éclairage en option"} · {f.dimensions.length} dimensions · {f.finishes.length} finitions</div>}
      </div>
    </article>
  );
}
