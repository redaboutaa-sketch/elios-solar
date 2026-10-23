export interface NavItem { href: string; label: string; children?: NavItem[] }

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/commandes", label: "Commandes" },
  { href: "/admin/devis", label: "Devis" },
  { href: "/admin/contacts", label: "Contacts" },
  { href: "/admin/tarifs", label: "Tarifs (admin)" },
  {
    href: "/admin/catalogue/familles",
    label: "Catalogue",
    children: [
      { href: "/admin/catalogue/familles", label: "Familles" },
      { href: "/admin/catalogue/variantes", label: "Variantes" },
      { href: "/admin/catalogue/regles", label: "Règles de compatibilité" },
      { href: "/admin/catalogue/tarifs", label: "Montage & livraison" },
      { href: "/admin/catalogue/promotions", label: "Promotions" },
      { href: "/admin/catalogue/stocks", label: "Stocks & délais" },
      { href: "/admin/catalogue/sur-mesure", label: "Sur mesure" },
      { href: "/admin/catalogue/grilles", label: "Grilles sur mesure" },
      { href: "/admin/catalogue/tarifs-fournisseur", label: "Fichiers de tarifs importés (admin)" },
      { href: "/admin/catalogue/validations", label: "Validation des références" },
    ],
  },
  { href: "/admin/conversations", label: "Conversations" },
  {
    href: "/admin/contenus/pages",
    label: "Contenus",
    children: [
      { href: "/admin/contenus/pages", label: "Pages" },
      { href: "/admin/contenus/realisations", label: "Réalisations" },
      { href: "/admin/contenus/showroom", label: "Showroom" },
    ],
  },
  {
    href: "/admin/medias",
    label: "Médiathèque",
    children: [
      { href: "/admin/medias", label: "Médias" },
      { href: "/admin/documents", label: "Documents" },
    ],
  },
  { href: "/admin/paiement", label: "Paiement fractionné" },
  { href: "/admin/import", label: "Import catalogue" },
  { href: "/admin/emails", label: "E-mails" },
  { href: "/admin/reglages", label: "Réglages" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/journal", label: "Journal" },
];
