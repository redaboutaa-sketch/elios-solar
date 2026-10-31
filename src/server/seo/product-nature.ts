/**
 * Nature d'un produit pour les titres « Nom — Nature » (ex. « HelioScreen — Store screen extérieur »), dérivée des
 * règles documentées du modèle : une qualification « à confirmer » n'est jamais retenue (repli sur le terme générique).
 * « Bioclimatique » n'est pas employé dans la nature affichée : c'est un terme commercial, pas une caractéristique
 * documentée. Il n'apparaît que dans la balise <title> des pergolas à lames orientables (désignation usuelle de ce type
 * de pergola dans les recherches), sans aucune promesse de performance thermique (docs/seo/changes-and-validation.md).
 */
const OPENING: Record<string, string> = { roller_vertical: "enroulable verticale", roller_lateral: "enroulable latérale", pleated: "plissée", sliding: "coulissante", fixed: "à cadre fixe", hinged: "battante" };

export interface NatureRules {
  type: string;
  roof?: string | null;
  protection?: { level?: string | null; status?: string | null } | null;
  insect?: { opening?: string | null; leaves?: number | null } | null;
  /** tailles définies (ex. HelioSky) : le modèle n'est pas présenté « sur mesure » */
  fixedSizes?: unknown[] | null;
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

/**
 * Titre de fiche (balise <title>) : « Nature Nom sur mesure » ; le gabarit du site ajoute « — HELIOSTORES ».
 * La nature vient en tête (termes recherchés) ; « sur mesure » seulement sans tailles définies ; un modèle sans nature
 * établie garde son seul nom.
 */
export function productTitle(name: string, r: NatureRules | null | undefined): string {
  const n = productNature(r);
  if (!n) return name;
  const nature = r?.type === "pergola" && r.roof === "louvres" ? "Pergola bioclimatique" : n;
  return `${nature} ${name}${r?.fixedSizes?.length ? "" : " sur mesure"}`;
}

/** Retire d'une description les mentions de prix lorsqu'aucun prix public n'est affiché. */
export function quoteSafeDescription(text: string, hasPublicPrice: boolean): string {
  if (hasPublicPrice) return text;
  return text.replace(/\s*[—–-]\s*prix selon vos dimensions/gi, "").replace(/,?\s*avec (le )?prix[^.]*\./gi, ".").replace(/\s+\./g, ".").trim();
}
