import { Truck } from "lucide-react";
import type { DeliveryEstimate } from "@/domain/lead-time";

const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

/** Estimation de livraison : affichée seulement si les données permettent de la calculer. */
export function DeliveryEstimateBlock({ estimate, demo }: { estimate: DeliveryEstimate; demo?: boolean }) {
  return (
    <div className="mt-4 rounded-lg border border-sand-200 bg-sand-50 p-3 text-sm" data-testid="delivery-estimate">
      <p className="flex items-center gap-2 font-medium"><Truck className="size-4" aria-hidden="true" /> Délai de livraison estimé{demo && <span className="badge-warn ml-1">délais de démonstration</span>}</p>
      {estimate.status === "estimated" && (
        <ul className="mt-2 space-y-1">
          {estimate.shipments.map((s, i) => (
            <li key={i}>
              {estimate.shipments.length > 1 && <span className="font-medium">Envoi {i + 1} : </span>}
              entre le {fmt(s.minDate)} et le {fmt(s.maxDate)}
              <span className="block text-xs text-stone-700">{s.labels.join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
      {estimate.status === "unknown" && (
        <ul className="mt-2 space-y-1 text-stone-800">{estimate.unknown.map((u) => <li key={u.sku}>{u.label} : {u.reason}.</li>)}</ul>
      )}
      {estimate.status === "blocked" && (
        <ul className="mt-2 space-y-1 text-danger">{estimate.blocked.map((u) => <li key={u.sku}>{u.label} : {u.reason}.</li>)}</ul>
      )}
      <p className="mt-2 text-xs text-stone-700">{estimate.explanation} Disponibilité et délai sont revérifiés au moment de la commande.</p>
    </div>
  );
}
