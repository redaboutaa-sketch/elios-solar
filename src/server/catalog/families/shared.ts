/** Outils communs aux fiches du catalogue HELIOSTORES (sources, teintes). Données publiables uniquement. */
import type { Choice, SourceRef } from "@/domain/system";

export const src = (id: string, label: string, url?: string): SourceRef => (url ? { id, label, url } : { id, label });

/** Aperçus écran indicatifs des teintes (jamais une référence de teinte). */
export const SWATCH: Record<string, string> = {
  "RAL 9016": "#f1f0ea", "RAL 7016": "#383e42", "FSM 71319": "#4a4c4e", "RAL 9010": "#f1ece1", "RAL 1015": "#e6d2b5", "RAL 8014": "#4a3526", "RAL 9006": "#a5a8a6", "RAL 9001": "#e9e0d2",
  "RAL 7015": "#4f5358", "RAL 7021": "#2f3234", "RAL 7012": "#4e5754", "RAL 7039": "#6b665e", "RAL 7043": "#4e5452", "RAL 8003": "#7e4b26", "RAL 1013": "#e3d9c6", "RAL 7035": "#cbd0cc",
  "RAL 7037": "#7a7b7a", "RAL 7024": "#45494e", "RAL 9005": "#0e0e10", "RAL 9007": "#8f8f8c", "RAL 8016": "#4c2f26", "RAL 7001": "#8a9597", "RAL 7022": "#4b4d46", "DB 703": "#4a4b4c",
  "RAL 7038": "#b5b8b1", "RAL 7048": "#7e7b73",
};

const codeOf = (label: string) => label.replace(/\s+/g, "_").toUpperCase();

export function finishOf(label: string, sources: SourceRef[], note?: string): Choice {
  return { code: codeOf(label), label, status: "established", sources, swatch: SWATCH[label.replace(/ (MAT|SATIN|mat|STR)$/i, "")], note };
}
