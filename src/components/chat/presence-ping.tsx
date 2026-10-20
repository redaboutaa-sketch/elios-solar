"use client";
import { useEffect } from "react";

/** Maintient la présence du conseiller tant que l'onglet d'administration est visible. */
export function PresencePing({ intervalMs = 60_000 }: { intervalMs?: number }) {
  useEffect(() => {
    const ping = () => { if (document.visibilityState === "visible") fetch("/api/chat/presence", { method: "POST" }).catch(() => undefined); };
    const id = setInterval(ping, intervalMs);
    document.addEventListener("visibilitychange", ping);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", ping); };
  }, [intervalMs]);
  return null;
}
