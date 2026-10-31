/**
 * Transcodification HELIO validée par le client le 2026-10-31 — module SERVEUR (références fournisseur privées).
 * Source de `docs/product-naming-transco.csv` ; lue par le seed (historique des noms) et l'administration.
 */
/** Statut technique d'une correspondance nom public ↔ système fournisseur. */
export type TechnicalStatus = "etabli" | "a_confirmer";

/**
 * Transcodification validée par le client (2026-10-31). `kind` : produit du catalogue (`slug` = identifiant stable de
 * la famille) ou équipement de fermeture (`slug` = code stable du souhait de fermeture). `supplierRef` est la référence
 * fournisseur privée (administration, documentation interne) : jamais affichée, jamais dans une URL ni une réponse du
 * chat. `technical` = « a_confirmer » lorsque les données enregistrées ne prouvent pas la correspondance.
 */
export const NAME_TRANSCO = [
  { slug: "helioscreen", kind: "product", previous: ["HelioScreen"], name: "HelioScreen", supplierRef: "Screen R 120 ZiiiP", technical: "etabli" },
  { slug: "marbella", kind: "product", previous: ["Marbella"], name: "HelioMax", supplierRef: "SB450", technical: "etabli" },
  { slug: "sevilla", kind: "product", previous: ["Sevilla", "Sevillia"], name: "HelioLux", supplierRef: "SOLID", technical: "a_confirmer", note: "données enregistrées issues de PERGOLA V ZiiiP : non transférées vers SOLID" },
  { slug: "malaga", kind: "product", previous: ["Malaga"], name: "HelioSky", supplierRef: "SB350", technical: "etabli" },
  { slug: "helioroof-screen", kind: "product", previous: ["HelioRoof Screen"], name: "HelioRoof", supplierRef: "VERANDA V ZiiiP", technical: "a_confirmer", note: "données enregistrées issues de « Veranda » standard ; jamais assimilé à VERANDA FTS" },
  { slug: "casablanca", kind: "product", previous: ["Casablanca"], name: "HelioSun", supplierRef: "CASABLANCA", technical: "etabli" },
  { slug: "sliding_panels", kind: "closure", previous: ["Panneaux coulissants (lames ou plein)", "Remplissage de pergola en aluminium"], name: "HelioSlide ALU", supplierRef: "SYSTEM SLIDE", technical: "a_confirmer", note: "souhait de fermeture existant (modules coulissants cités pour HelioMax) ; modèle, dimensions et fixations à confirmer" },
  { slug: "sliding_glass", kind: "closure", previous: ["Fermetures latérales coulissantes (vitrage)", "Fermeture vitrée de pergola"], name: "HelioSlide VERRE", supplierRef: "OPEN SLIDE", technical: "etabli", note: "souhait de fermeture existant (système vitré coulissant documenté) ; compatibilité par modèle étudiée au devis" },
  { slug: "corsica", kind: "product", previous: ["Corsica"], name: "HelioShade", supplierRef: "CORSICA", technical: "etabli" },
  { slug: "jamaica", kind: "product", previous: ["Jamaica"], name: "HelioPro", supplierRef: "JAMAICA", technical: "etabli" },
  { slug: "madera", kind: "product", previous: ["Madera"], name: "HelioSquare", supplierRef: "MADERA", technical: "etabli" },
] as const satisfies ReadonlyArray<{ slug: string; kind: "product" | "closure"; previous: readonly string[]; name: string; supplierRef: string; technical: TechnicalStatus; note?: string }>;

