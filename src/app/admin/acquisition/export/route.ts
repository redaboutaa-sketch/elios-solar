import { auth } from "@/lib/auth";
import { csvLine } from "@/domain/acquisition";
import { acquisitionReport, periodFrom } from "@/server/admin/acquisition";

/** Export CSV du suivi par origine (administration seulement ; aucune donnée personnelle, agrégats uniquement). */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN" && role !== "MANAGER") return new Response("Introuvable", { status: 404 });
  const p = periodFrom(Object.fromEntries(new URL(req.url).searchParams));
  const r = await acquisitionReport(p);
  const euros = (c: number | null) => (c == null ? "non renseigné" : (c / 100).toFixed(2).replace(".", ","));
  const lines = [csvLine(["vue", "clé", "demandes", "qualifiées", "non qualifiées", "gagnées", "perdues", "gagnées avec montant", "CA HT encaissé (EUR)"])];
  for (const [view, rows] of [["origine", r.bySource], ["campagne", r.byCampaign], ["page d'entrée", r.byLanding]] as const) {
    for (const x of rows) lines.push(csvLine([view, x.key, x.requests, x.qualified, x.notQualified, x.won, x.lost, x.cashedKnown, euros(x.cashedNetCents)]));
  }
  for (const [k, n] of r.contactsBySource) lines.push(csvLine(["contact (origine)", k, n, null, null, null, null, null, null]));
  const name = `suivi-origine_${p.fromInput || "debut"}_${p.toInput || "aujourdhui"}.csv`;
  return new Response(`﻿${lines.join("\r\n")}\r\n`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
