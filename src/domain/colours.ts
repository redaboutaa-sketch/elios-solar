/**
 * Teintes du configurateur : lecture du libellé enregistré (« RAL 7016 mat ») en code, nom et aspect. Le nom est celui
 * de la norme RAL Classic (désignation française officielle) ; un code hors RAL (ex. FSM, DB) n'a pas de nom : seul son
 * code est affiché. Aucun nom n'est inventé ; l'aperçu écran reste indicatif (nuancier physique de référence).
 */
const RAL_CLASSIC_FR: Readonly<Record<string, string>> = {
  "1013": "Blanc perlé", "1015": "Ivoire clair",
  "7001": "Gris argent", "7012": "Gris basalte", "7015": "Gris ardoise", "7016": "Gris anthracite", "7021": "Gris noir", "7022": "Gris terre d'ombre",
  "7024": "Gris graphite", "7035": "Gris clair", "7037": "Gris poussière", "7039": "Gris quartz", "7043": "Gris signalisation B",
  "8003": "Brun argile", "8014": "Brun sépia", "8016": "Brun acajou",
  "9001": "Blanc crème", "9005": "Noir foncé", "9006": "Aluminium blanc", "9007": "Aluminium gris", "9010": "Blanc pur", "9016": "Blanc signalisation",
};

const FINISH_FR: Readonly<Record<string, string>> = { mat: "mat", satin: "satiné", str: "structuré", structure: "structuré", brillant: "brillant" };

export interface ColourInfo {
  /** code lisible (« RAL 7016 », « FSM 71319 ») ou null pour une teinte sans code (décor, autre teinte) */
  code: string | null;
  /** nom normalisé (RAL Classic) ou libellé d'origine lorsqu'il n'y a pas de code */
  name: string | null;
  /** aspect de surface indiqué par la source (mat, satiné, structuré) */
  finish: string | null;
}

export function colourInfo(label: string): ColourInfo {
  const m = /^(RAL|FSM|DB)\s?(\d{3,5})\b\s*(.*)$/i.exec(label.trim());
  if (!m) return { code: null, name: label.trim(), finish: null };
  const [, sys, num, rest] = m;
  const finishKey = rest?.trim().toLowerCase().replace(/[()]/g, "") ?? "";
  return { code: `${sys!.toUpperCase()} ${num}`, name: sys!.toUpperCase() === "RAL" ? RAL_CLASSIC_FR[num!] ?? null : null, finish: FINISH_FR[finishKey] ?? (finishKey || null) };
}

/** Nom accessible d'une teinte (lecteurs d'écran, libellés de choix). */
export function colourLabel(label: string): string {
  const c = colourInfo(label);
  return [c.name, c.code, c.finish].filter(Boolean).join(" · ") || label;
}
