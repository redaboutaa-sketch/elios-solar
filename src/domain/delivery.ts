/**
 * Délai de livraison communiqué par le client (2026-10-26), formulation exacte. Aucun point de départ, frais de
 * transport ni zone desservie n'est affirmé : les modalités précises figurent dans chaque devis.
 * Les nouveaux devis figent cette mention dans leur instantané (`deliveryNote`) : un devis émis n'est jamais modifié
 * rétroactivement si la formulation change.
 */
export const DELIVERY_LEAD_TIME = "Délai de livraison : entre 4 et 7 semaines selon le lieu de livraison.";
export const DELIVERY_TERMS_IN_QUOTE = "Les modalités précises de livraison sont indiquées dans le devis.";
