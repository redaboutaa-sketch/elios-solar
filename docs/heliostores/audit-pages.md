# Audit des pages héritées (2026-10-21)

Pages et contenus repris de l'ancien catalogue de démonstration, et décision appliquée. Décisions client du 2026-10-21 :
- masquer Réalisations et Showroom ;
- garder visibles les autres pages sans contenu réel, signalées comme provisoires, pour suivre ce qui reste à fournir ;
- permettre la commande en ligne d'une configuration entièrement tarifée (paiement simulé).

| Page ou élément | Constat | Décision |
|---|---|---|
| `/realisations` | aucune réalisation réelle (fiche d'exemple non publiée) | **masquée** : 404, hors navigation et sitemap ; gérable dans l'administration (`PUBLIC_SECTIONS`, `src/config/brand.ts`) |
| `/showroom` | aucun showroom réel (fiche « à renseigner » non publiée) | **masquée**, comme ci-dessus |
| `/accessoires`, `/accessoires/<produit>`, `/comparer` | ancien catalogue | déjà redirigées vers `/pergolas` (inchangé) |
| `/guides/*` | conseils génériques (principe, implantation, urbanisme) | conservés ; les seuils d'urbanisme sont ceux de la France, à valider selon la clientèle visée |
| `/cgv`, `/mentions-legales`, `/confidentialite`, `/livraison-installation` | textes provisoires, champs vendeur manquants | **conservés**, mention « Document provisoire » ; CGV et livraison réécrites (prix HT, TVA au panier, livraison et pose non comprises) |
| `/aide` | FAQ générique | complétée (commande en ligne de la structure seule, suite de la commande) |
| `/rappel`, `/contact`, `/devis` | formulaires | conservés |
| Panier vide | renvoyait vers « Accessoires » | renvoie vers le configurateur et le devis |
| Panier de systèmes | ancien calcul de livraison (montants de démonstration), estimation de délai, code promotionnel | livraison « non comprise », aucun délai affiché, code promotionnel masqué |
| Code `BIENVENUE5` | promotion de l'ancien catalogue (pergolas archivées) | sans effet sur les produits HELIOSTORES, plus proposé au panier ; conservé en base pour les tests de l'ancien catalogue |
| Accusé de réception de devis | « réponse sous 48 h ouvrées » (engagement non validé) | « dans les meilleurs délais » ; prix de la structure HT ajouté |
| Récapitulatif « Prix : établi sur devis » | contredisait le prix affiché | prix de la structure HT, ou « sur devis » hors grille |
| Accueil, étape 4 | « Recevoir le devis » | « Commander ou demander un devis » |
| Nom « ELIOS SOLAR » | aucune occurrence publique | restent seulement des noms techniques : dépôt, conteneurs, domaine d'expédition de test non routable |

Contrôle : `tests/e2e/08-commande-systeme.spec.ts` vérifie le 404 des deux rubriques, la mention provisoire et l'absence d'« ELIOS SOLAR » dans les CGV.
