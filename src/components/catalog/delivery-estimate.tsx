import { Truck } from "lucide-react";
import type { DeliveryEstimate } from "@/domain/lead-time";
import { LOCALE_DEFS } from "@/i18n/config";
import { fmt as tpl } from "@/i18n/format";
import { getLocale, getT } from "@/i18n/server";

const fmtDate = (iso: string, intl: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "long" });

/** Estimation de livraison : affichée seulement si les données permettent de la calculer. */
export async function DeliveryEstimateBlock({ estimate, demo }: { estimate: DeliveryEstimate; demo?: boolean }) {
  const t = (await getT("catalog")).delivery;
  const intl = LOCALE_DEFS[await getLocale()].intl;
  return (
    <div className="mt-4 rounded-lg border border-sand-200 bg-sand-50 p-3 text-sm" data-testid="delivery-estimate">
      <p className="flex items-center gap-2 font-medium"><Truck className="size-4" aria-hidden="true" /> {t.title}{demo && <span className="badge-warn ml-1">{t.demo}</span>}</p>
      {estimate.status === "estimated" && (
        <ul className="mt-2 space-y-1">
          {estimate.shipments.map((s, i) => (
            <li key={i}>
              {estimate.shipments.length > 1 && <span className="font-medium">{tpl(t.shipment, { n: i + 1 })}</span>}
              {tpl(t.between, { min: fmtDate(s.minDate, intl), max: fmtDate(s.maxDate, intl) })}
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
      <p className="mt-2 text-xs text-stone-700">{estimate.explanation} {t.recheck}</p>
    </div>
  );
}
