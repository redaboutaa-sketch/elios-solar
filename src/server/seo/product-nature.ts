/**
 * Nature d'un produit pour les titres « Nom — Nature » (ex. « HelioScreen — Store screen extérieur »), dérivée des
 * règles documentées du modèle : une qualification « à confirmer » n'est jamais retenue (repli sur le terme générique).
 * « Bioclimatique » n'est pas employé : c'est un terme commercial, pas une caractéristique documentée.
 */
const OPENING: Record<string, string> = { roller_vertical: "enroulable verticale", roller_lateral: "enroulable latérale", pleated: "plissée", sliding: "coulissante", fixed: "à cadre fixe", hinged: "battante" };

export interface NatureRules {
  type: string;
  roof?: string | null;
  protection?: { level?: string | null; status?: string | null } | null;
  insect?: { opening?: string | null; leaves?: number | null } | null;
}

export function productNature(r: NatureRules | null | undefined): string | null {
  if (!r) return null;
  switch (r.type) {
    case "pergola":
      return r.roof === "fabric" ? "Pergola à toiture en toile" : r.roof === "louvres" ? "Pergola à lames orientables" : "Pergola";
    case "screen":
      return "Store screen extérieur";
    case "roof_blind":
      return "Store de toiture pour véranda";
    case "awning": {
      const p = r.protection;
      if (!p || p.status === "to_confirm") return "Store banne";
      return p.level === "full" ? "Store banne à coffre" : p.level === "semi" ? "Store banne semi-coffre" : p.level === "none" ? "Store banne sans coffre" : "Store banne";
    }
    case "insect_screen": {
      const o = r.insect?.opening ? OPENING[r.insect.opening] : null;
      return o ? `Moustiquaire ${o}${r.insect?.leaves === 2 ? " à deux vantaux" : ""}` : "Moustiquaire";
    }
    default:
      return null;
  }
}

/** Titre de fiche : « Nom — Nature » (le gabarit du site ajoute « — HELIOSTORES »). */
export function productTitle(name: string, r: NatureRules | null | undefined): string {
  const n = productNature(r);
  return n ? `${name} — ${n}` : name;
}

/** Retire d'une description les mentions de prix lorsqu'aucun prix public n'est affiché. */
export function quoteSafeDescription(text: string, hasPublicPrice: boolean): string {
  if (hasPublicPrice) return text;
  return text.replace(/\s*[—–-]\s*prix selon vos dimensions/gi, "").replace(/,?\s*avec (le )?prix[^.]*\./gi, ".").replace(/\s+\./g, ".").trim();
}
