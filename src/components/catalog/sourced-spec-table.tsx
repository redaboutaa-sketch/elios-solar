import { formatSpecValue, reviewSpec, type TechnicalSpecValue } from "@/domain/technical-spec";

/**
 * Caractéristiques sourcées : une valeur n'est présentée comme établie que si toutes les sources qui font autorité
 * concordent ; sinon les valeurs divergentes sont affichées avec la mention « à confirmer ». Les sources ne sont
 * pas citées sur le site public (elles restent dans l'administration).
 */
export function SourcedSpecTable({ specs }: { specs: TechnicalSpecValue[] }) {
  const keys = [...new Set(specs.map((s) => s.key))];
  if (!keys.length) return <p className="text-sm text-stone-700">Caractéristiques en cours de mise à jour.</p>;
  return (
    <table className="w-full text-sm" data-testid="sourced-specs">
      <caption className="sr-only">Caractéristiques</caption>
      <thead><tr className="border-b border-sand-300 text-left text-xs text-stone-700"><th className="py-2 pr-3 font-medium">Caractéristique</th><th className="py-2 pr-3 font-medium">Valeur</th></tr></thead>
      <tbody>
        {keys.map((k) => {
          const r = reviewSpec(specs, k)!;
          const distinct = [...new Map(r.candidates.map((c) => [formatSpecValue(c), c])).values()];
          return (
            <tr key={k} className="border-b border-sand-200 align-top" data-spec={k} data-status={r.confirmed ? "established" : "to_confirm"}>
              <th scope="row" className="py-2 pr-3 text-left font-medium w-1/3">{r.label}</th>
              <td className="py-2 pr-3">
                {r.confirmed ? formatSpecValue(r.confirmed) : <>{distinct.map((c) => formatSpecValue(c)).join(" / ")} <span className="badge-warn ml-1">à confirmer</span></>}
                {r.candidates.some((c) => c.note) && <p className="mt-1 text-xs text-stone-700">{r.candidates.filter((c) => c.note).map((c) => c.note).join(" ")}</p>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
