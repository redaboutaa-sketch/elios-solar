/** Remplace les variables « {nom} » d'un message ; les valeurs absentes laissent la variable visible (erreur détectable). */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
