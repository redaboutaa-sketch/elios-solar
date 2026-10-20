# PRD — ELIOS SOLAR (boutique pergolas & aménagement extérieur)

Nom d'affichage provisoire : **ELIOS SOLAR** (déduit du nom du dépôt, modifiable dans `src/config/brand.ts`
et dans l'administration). Référence fonctionnelle : pergolux.fr (audit dans `reference-audit.md`).

## 1. Objectif
Boutique française premium permettant de **configurer** une pergola bioclimatique (gamme, implantation,
dimension, finition, fermetures par ouverture, options, montage, livraison), de **calculer un prix
autoritaire côté serveur**, de **commander** des références validées en mode test, de **demander un
devis** (standard, sur mesure, accessoire), d'**acheter un accessoire seul** après vérification de
compatibilité, et d'**administrer** catalogue, règles, prix, commandes, devis, contenus et médias.

## 2. Périmètre fonctionnel (version intégrée)
| Domaine | Inclus |
|---|---|
| Catalogue | 3 gammes standard (toit manuel / motorisé LED gouttière / motorisé LED lames), sur mesure (devis), store banne (12 tailles réelles × 2 coffres × 2 toiles), 3 fermetures (paroi vitrée 3 options, persienne, store vertical ZIP), options (bandes LED, lampe chauffante, lanterne, anémomètre), service de montage |
| Configurateur | 8 étapes, aperçu 2D (plan) fidèle + illustration, segments réels (côté 6 m divisé), adaptations à confirmer (rien n'est supprimé silencieusement), explications d'incompatibilité, inconnu ⇒ devis, options incluses non refacturées, montage et livraison distincts, code postal requis pour un total définitif |
| Projets | sauvegarde versionnée, revalidation automatique au changement de catalogue, duplication, partage par jeton révocable, PDF |
| Commerce | panier modifiable, checkout invité ou connecté, commande figée (snapshot), paiement hébergé (démo signé / Stripe), webhook idempotent, réservation de stock atomique avec expiration, états paiement / commande / préparation, e-mails en file persistante avec reprises |
| Compte | inscription, connexion, réinitialisation, commandes, projets, devis, export et suppression (anonymisation des commandes) |
| Contenus | accueil, collections (filtres, tri, état vide), fiches, comparateur, devis, contact, rappel, livraison/installation, aide, guides, réalisations et showroom (administrables, non publiés tant que non réels), pages légales avec champs manquants visibles |
| Conformité | bannière cookies (refus = aucun script optionnel), consentements persistés, préproduction `noindex` + pas de sitemap, aucune donnée personnelle dans les liens de partage |
| Administration | rôles CUSTOMER / MANAGER / ADMIN, autorisation serveur sur chaque action, journal d'audit, gestion catalogue / règles / tarifs / promotions / sur mesure / contenus / médias (registre des droits) / import CSV-JSON avec aperçu / e-mails / réglages / utilisateurs |

Hors périmètre : panneaux photovoltaïques, paiement fractionné (aucun prestataire configuré), vue 3D
(prévue après stabilisation), avis clients.

## 3. Critères d'acceptation
1. Une configuration standard complète (côté équipé, option, montage, code postal) donne le même total
   dans le configurateur, le panier, la commande et le PDF ; le total vient uniquement du serveur.
2. Une combinaison interdite est refusée avec une explication ; une combinaison inconnue bloque l'achat
   et propose un devis ; une option déjà incluse n'est pas facturée.
3. Changer de dimension ne supprime pas une fermeture : elle est présentée « à confirmer ».
4. Une commande test est créée avant le paiement, confirmée uniquement par webhook signé ; un webhook
   rejoué ou invalide n'a aucun effet ; un prix modifié ensuite ne change pas la commande.
5. Le dernier exemplaire en stock ne peut être réservé qu'une fois en cas de requêtes concurrentes ;
   la réservation expire et se libère.
6. Un accessoire s'achète seul après vérification de compatibilité (longueur, couleur, implantation).
7. Un devis sur mesure est persisté et notifié (client + administrateur) ; aucun prix au m² n'est affiché.
8. Le store banne ne propose que les variantes réellement disponibles.
9. Un changement de tarif dans l'administration s'applique au configurateur sans altérer une commande passée.
10. Le refus des cookies optionnels empêche le chargement des scripts concernés.
11. Lint, contrôle TypeScript, tests métier et d'intégration, build de production passent en CI.

## 4. Non-objectifs et garde-fous
Pas de « prêt à vendre » sans données fournisseur validées ni paiement réel vérifié ; pas de faux avis,
d'urgence artificielle, de réduction permanente inventée ; données de démonstration marquées.
