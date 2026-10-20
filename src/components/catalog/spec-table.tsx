type Spec = { label: string; value: string; status: string };
const STATUS: Record<string, { label: string; cls: string }> = {
  supplier_verified: { label: "validé fournisseur", cls: "badge-ok" },
  observed: { label: "à confirmer", cls: "badge-warn" },
  demo: { label: "démonstration", cls: "badge-demo" },
  unknown: { label: "non confirmé", cls: "badge-warn" },
};
export function SpecTable({ specs }: { specs: Spec[] }) {
  if (!specs.length) return <p className="text-sm text-stone-700">Caractéristiques en attente de la fiche fournisseur.</p>;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Caractéristiques</caption>
      <tbody>
        {specs.map((s) => {
          const st = STATUS[s.status] ?? STATUS.unknown!;
          return (
            <tr key={s.label} className="border-b border-sand-200">
              <th scope="row" className="py-2 pr-3 text-left font-medium align-top w-1/3">{s.label}</th>
              <td className="py-2 align-top">{s.value}</td>
              <td className="py-2 pl-3 text-right align-top"><span className={st.cls}>{st.label}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
