/**
 * Rapport de campagne de recette : agrège les résultats bruts (Playwright JSON, Vitest JSON, audit des tarifs) en cinq
 * statuts — Réussi, Échoué, Non testé, Bloqué, Sans objet — sans jamais compter un test ignoré comme réussi.
 *   - Non testé  : test ignoré (skip) sans justification « sans objet », ou suite non exécutée volontairement ;
 *   - Bloqué     : suite prévue mais non exécutable (prérequis absent, environnement en panne, rapport manquant) ;
 *   - Sans objet : test ignoré dont le motif commence par « sans objet : » (justification obligatoire).
 *
 *   tsx scripts/recette/report.ts <dossier-de-campagne>
 * Lit <dossier>/campaign.json (contexte, suites prévues) ; écrit <dossier>/rapport.md (PRIVÉ : peut citer des montants)
 * et <dossier>/resume-public.md (sans montant ni information fournisseur).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

type Status = "Réussi" | "Échoué" | "Non testé" | "Bloqué" | "Sans objet";
type Row = { suite: string; name: string; project?: string; status: Status; detail?: string; artefact?: string };
type Suite = { id: string; label: string; kind: "playwright" | "vitest" | "audit-a" | "audit-b" | "audit-ref" | "shell"; file: string; planned: boolean; reason?: string };
type Campaign = { id: string; date: string; environment: string; baseUrl: string; commit: string; dirty: boolean; health?: unknown; tariffVersions?: string; reference?: string; suites: Suite[] };

const dir = process.argv[2]!;
const c: Campaign = JSON.parse(readFileSync(`${dir}/campaign.json`, "utf8"));
const rows: Row[] = [];
const blocked = (s: Suite, why: string) => rows.push({ suite: s.label, name: "(suite entière)", status: "Bloqué", detail: why });

function playwright(s: Suite) {
  const j = JSON.parse(readFileSync(s.file, "utf8"));
  if (j.errors?.length && !j.suites?.length) return blocked(s, j.errors.map((e: { message?: string }) => e.message).join(" ").slice(0, 300));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rapport JSON de Playwright (format externe)
  const walk = (suite: any, path: string[]) => {
    for (const sp of suite.specs ?? []) {
      for (const t of sp.tests ?? []) {
        const last = t.results?.[t.results.length - 1];
        const skipNote = (t.annotations ?? []).find((a: { type: string }) => a.type === "skip")?.description ?? "";
        let status: Status;
        if (!last) status = "Bloqué";
        else if (last.status === "passed") status = t.status === "flaky" ? "Échoué" : "Réussi";
        else if (last.status === "skipped") status = /^sans objet/i.test(skipNote) ? "Sans objet" : "Non testé";
        else if (last.status === "interrupted") status = "Bloqué";
        else status = "Échoué";
        const err = last?.errors?.[0]?.message ?? last?.error?.message;
        const att = (last?.attachments ?? []).find((a: { name: string }) => a.name === "trace")?.path;
        rows.push({ suite: s.label, name: [...path, sp.title].filter(Boolean).join(" › "), project: t.projectName, status, detail: status === "Échoué" ? String(err ?? "").replace(/\u001b\[[0-9;]*m/g, "").split("\n").slice(0, 3).join(" ").slice(0, 300) : skipNote || undefined, artefact: att });
      }
    }
    for (const ch of suite.suites ?? []) walk(ch, [...path, ch.title && !/\.ts$/.test(ch.title) ? ch.title : ""]);
  };
  for (const su of j.suites ?? []) walk(su, [su.title]);
}

function vitest(s: Suite) {
  const j = JSON.parse(readFileSync(s.file, "utf8"));
  for (const f of j.testResults ?? []) {
    if (f.status === "failed" && !(f.assertionResults ?? []).length) rows.push({ suite: s.label, name: f.name.replace(/^.*\/tests\//, "tests/"), status: "Bloqué", detail: String(f.message ?? "").slice(0, 300) });
    for (const a of f.assertionResults ?? []) {
      const status: Status = a.status === "passed" ? "Réussi" : a.status === "failed" ? "Échoué" : "Non testé";
      rows.push({ suite: s.label, name: `${f.name.replace(/^.*\/tests\//, "tests/")} › ${a.fullName}`, status, detail: status === "Échoué" ? String(a.failureMessages?.[0] ?? "").split("\n")[0]!.slice(0, 300) : undefined });
    }
  }
}

function auditA(s: Suite) {
  const j = JSON.parse(readFileSync(s.file, "utf8"));
  const bad = j.ecarts.filter((e: { gravite: string }) => e.gravite !== "info");
  rows.push({ suite: s.label, name: `PDF → base (${j.source}) : ${j.cellulesComparees} cellules vendues comparées, ${j.lignesVenteActives} lignes de vente actives`, status: bad.length ? "Échoué" : "Réussi", detail: bad.length ? `${bad.length} écart(s) — voir ${s.file}` : `${j.ecarts.length} remarque(s) informative(s)` });
}
function auditB(s: Suite) {
  const j = JSON.parse(readFileSync(s.file, "utf8"));
  for (const r of j.results) {
    if (r.status === "réussi") continue;
    rows.push({ suite: s.label, name: `${r.grid} — ${r.case} (${r.widthMm} × ${r.dimMm})`, status: r.status === "sans objet" ? "Sans objet" : r.status === "bloqué" ? "Bloqué" : "Échoué", detail: r.detail ?? JSON.stringify({ attendu: r.expectedSaleHtMinor, moteur: r.engineSaleHtMinor }) });
  }
  rows.push({ suite: s.label, name: `référence → moteur : ${j.summary.réussi} cas réussis sur ${j.summary.cas}`, status: j.summary.échoué + j.summary.bloqué ? "Échoué" : "Réussi" });
}
function auditRef(s: Suite) {
  const j = JSON.parse(readFileSync(s.file, "utf8"));
  const anomalies = existsSync(s.file.replace("reference.json", "reference-anomalies.json")) ? JSON.parse(readFileSync(s.file.replace("reference.json", "reference-anomalies.json"), "utf8")) : [];
  const cells = j.grids.reduce((a: number, g: { cellsRead: number }) => a + g.cellsRead, 0);
  rows.push({ suite: s.label, name: `extraction PDF indépendante : ${j.grids.length} grilles, ${cells} cellules`, status: anomalies.length ? "Échoué" : "Réussi", detail: `${anomalies.length} anomalie(s), ${j.uncertainties?.length ?? 0} incertitude(s) signalée(s)` });
}
function shell(s: Suite) {
  for (const line of readFileSync(s.file, "utf8").split("\n").filter(Boolean)) {
    const [status, name, detail] = line.split("\t");
    rows.push({ suite: s.label, name: name!, status: status as Status, detail });
  }
}

for (const s of c.suites) {
  if (!s.planned) { rows.push({ suite: s.label, name: "(suite entière)", status: /^sans objet/i.test(s.reason ?? "") ? "Sans objet" : "Non testé", detail: s.reason }); continue; }
  if (!existsSync(s.file)) { blocked(s, `résultat absent (${s.file}) : suite non exécutée ou interrompue`); continue; }
  try {
    ({ playwright, vitest, "audit-a": auditA, "audit-b": auditB, "audit-ref": auditRef, shell } as const)[s.kind](s);
  } catch (e) { blocked(s, `résultat illisible : ${(e as Error).message}`); }
}

const STATUSES: Status[] = ["Réussi", "Échoué", "Non testé", "Bloqué", "Sans objet"];
const count = (xs: Row[]) => Object.fromEntries(STATUSES.map((k) => [k, xs.filter((r) => r.status === k).length])) as Record<Status, number>;
const total = count(rows);
const suites = [...new Set(rows.map((r) => r.suite))];
const table = (pub: boolean) => [
  "| Suite | Réussi | Échoué | Non testé | Bloqué | Sans objet |", "|---|---:|---:|---:|---:|---:|",
  ...suites.filter((s) => !pub || !/audit/i.test(s) || true).map((s) => { const k = count(rows.filter((r) => r.suite === s)); return `| ${s} | ${k["Réussi"]} | ${k["Échoué"]} | ${k["Non testé"]} | ${k["Bloqué"]} | ${k["Sans objet"]} |`; }),
  `| **Total** | **${total["Réussi"]}** | **${total["Échoué"]}** | **${total["Non testé"]}** | **${total["Bloqué"]}** | **${total["Sans objet"]}** |`,
];
const verdict = total["Échoué"] || total["Bloqué"] ? "ÉCHEC (au moins un test échoué ou bloqué)" : total["Non testé"] ? "RÉUSSIE AVEC LIMITES (tests non exécutés listés)" : "RÉUSSIE";
const head = [`- Date : ${c.date}`, `- Environnement : ${c.environment} (${c.baseUrl})`, `- Commit de l'application : ${c.commit}${c.dirty ? " (+ modifications locales non commitées)" : ""}`, c.tariffVersions ? `- Versions tarifaires actives : ${c.tariffVersions}` : "", c.reference ? `- Référence PDF : ${c.reference}` : "", `- Verdict : **${verdict}**`].filter(Boolean);
const list = (st: Status, pub: boolean) => rows.filter((r) => r.status === st).map((r) => `- [${r.suite}${r.project ? ` · ${r.project}` : ""}] ${r.name}${r.detail && !pub ? ` — ${r.detail}` : r.detail && st !== "Échoué" ? ` — ${r.detail}` : ""}${r.artefact && !pub ? ` (trace : ${r.artefact})` : ""}`);

const priv = [`# Rapport de recette ${c.id} (PRIVÉ)`, "", "> Peut contenir des montants et informations fournisseur : ne pas publier. Résumé publiable : resume-public.md.", "", ...head, "", "## Résultats", "", ...table(false), "",
  ...(["Échoué", "Bloqué", "Non testé", "Sans objet"] as Status[]).flatMap((st) => { const l = list(st, false); return l.length ? [`## ${st} (${l.length})`, "", ...l, ""] : []; })];
const pub = [`# Recette ${c.id} — résumé`, "", ...head.filter((h) => !/Référence PDF/.test(h)), "", ...table(true), "",
  ...(["Échoué", "Bloqué", "Non testé", "Sans objet"] as Status[]).flatMap((st) => { const l = list(st, true).map((x) => x.replace(/\d[\d   ]*(,\d+)?\s?€/g, "[montant]")); return l.length ? [`## ${st} (${l.length})`, "", ...l, ""] : []; })];
writeFileSync(`${dir}/rapport.md`, priv.join("\n"));
writeFileSync(`${dir}/resume-public.md`, pub.join("\n"));
writeFileSync(`${dir}/resultats.json`, JSON.stringify({ total, rows }, null, 1));
console.log(`${verdict} — ${STATUSES.map((s) => `${s} ${total[s]}`).join(", ")}`);
process.exit(total["Échoué"] || total["Bloqué"] ? 1 : 0);
