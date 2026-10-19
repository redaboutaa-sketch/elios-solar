import Link from "next/link";
import { Price } from "@/components/ui/price";
import type { FamilyListItem } from "@/server/catalog/queries";
import { priceFrom } from "@/server/catalog/queries";
import type { RangeHighlights } from "@/server/catalog/highlights";

export function RangeComparison({ fams, highlights, current }: { fams: FamilyListItem[]; highlights: Record<string, RangeHighlights | null>; current?: string }) {
  const rows: Array<[string, (f: FamilyListItem) => React.ReactNode]> = [
    ["Prix de base (à partir de)", (f) => (priceFrom(f) ? <Price cents={priceFrom(f)!} className="font-semibold" /> : "—")],
    ["Toit", (f) => (f.roof === "motorized" ? "Motorisé, télécommande" : "Manuel (manivelle)")],
    ["Éclairage", (f) => (f.lightingIncluded === "gutter_led" ? "LED de gouttière inclus (blanc chaud ou RGB)" : f.lightingIncluded === "blade_led" ? "LED intégré aux lames inclus" : "En option (bandes LED)")],
    ["Rails d'accessoires", (f) => `${f.accessoryRails ?? "—"} par poutre`],
    ["Fermetures compatibles", (f) => highlights[f.slug]?.closures.join(", ") ?? "—"],
    ["Options", (f) => highlights[f.slug]?.options.join(", ") ?? "—"],
    ["Finitions", (f) => f.finishes.map((x) => x.finish.label).join(", ")],
    ["Dimensions", (f) => f.dimensions.map((d) => d.dimension.label).join(" · ")],
    ["Implantation", (f) => f.mountings.map((m) => (m === "WALL" ? "adossée" : "autoportée")).join(" / ")],
    ["Électricité requise", (f) => (f.roof === "motorized" ? "Oui (230 V)" : "Non")],
    ["Délai indicatif", (f) => (highlights[f.slug]?.leadTimeDays ? `${highlights[f.slug]!.leadTimeDays} jours` : "—")],
    ["Données", (f) => (f.dataStatus === "DEMO" ? "démonstration" : f.dataStatus.toLowerCase())],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm card">
        <thead><tr><th className="p-3 text-left">Critère</th>{fams.map((f) => <th key={f.slug} className={`p-3 text-left font-display text-lg ${f.slug === current ? "bg-sand-100" : ""}`}><Link href={`/pergolas/${f.slug}`} className="hover:underline">{f.name}</Link>{f.slug === current && <span className="block text-xs font-sans font-normal text-stone-700">cette gamme</span>}</th>)}</tr></thead>
        <tbody>{rows.map(([label, cell]) => <tr key={label} className="border-t border-sand-200"><th scope="row" className="p-3 text-left font-medium align-top">{label}</th>{fams.map((f) => <td key={f.slug} className={`p-3 align-top ${f.slug === current ? "bg-sand-100/60" : ""}`}>{cell(f)}</td>)}</tr>)}</tbody>
        <tfoot><tr className="border-t border-sand-200"><td className="p-3" />{fams.map((f) => <td key={f.slug} className="p-3"><Link href={`/configurateur?gamme=${f.slug}`} className="btn-primary w-full">Configurer</Link></td>)}</tr></tfoot>
      </table>
    </div>
  );
}
