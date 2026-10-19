import { formatEur } from "@/domain/money";

export function Price({ cents, className = "", showCents }: { cents: number; className?: string; showCents?: boolean }) {
  return <span className={`tabular-nums ${className}`}>{formatEur(cents, { showCents })}</span>;
}
