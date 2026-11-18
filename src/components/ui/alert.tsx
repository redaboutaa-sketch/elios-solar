import type { Issue } from "@/domain/types";

export function IssueList({ issues, className = "" }: { issues: Issue[]; className?: string }) {
  if (issues.length === 0) return null;
  const tone = (s: Issue["severity"]) => (s === "blocking" ? "border-danger/40 bg-danger/5 text-danger" : s === "review" ? "border-warning/40 bg-warning/5 text-warning" : "border-sand-300 bg-sand-100 text-stone-800");
  return (
    <ul className={`space-y-2 ${className}`} aria-live="polite">
      {issues.map((i, k) => (
        <li key={`${i.code}-${i.path ?? k}`} className={`rounded-lg border px-3 py-2 text-sm ${tone(i.severity)}`}>
          <span className="font-medium">{i.severity === "blocking" ? "Impossible : " : i.severity === "review" ? "À confirmer : " : ""}</span>
          {i.message}
        </li>
      ))}
    </ul>
  );
}

export function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "error" | "success" }) {
  const cls = { info: "border-sand-300 bg-sand-100 text-stone-800", warn: "border-warning/40 bg-warning/5 text-warning", error: "border-danger/40 bg-danger/5 text-danger", success: "border-success/40 bg-success/5 text-success" }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
