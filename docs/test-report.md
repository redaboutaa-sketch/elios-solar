# Rapport de vérification — 2026-10-19 (itération 3)

## Itération 3 — résultats
Environnement : VPS, Node 22.23, PostgreSQL 16, Chromium Playwright 1.64 (WebGL SwiftShader pour la 3D). Préproduction Docker sur 127.0.0.1:3401, paiement DEMO + simulateur de paiement fractionné, e-mails en mode `log` (worker Docker).

| Contrôle | Commande | Résultat |
|---|---|---|
| TypeScript | `pnpm typecheck` | ✅ 0 erreur |
| Lint | `pnpm lint` | ✅ 0 erreur, 1 avertissement existant (`<img>` réalisations) |
| Unitaires (moteur, grilles, délais, euros/centimes, 3D, fractionné, médias) | `pnpm test:unit` | ✅ 105/105 |
| Intégration (base dédiée) | `pnpm test:integration` | ✅ 51/51 (+ 2 accès aux fichiers de la médiathèque) |
| Parcours navigateur contre le serveur de dev | `E2E_NO_SERVER=1 pnpm test:e2e` | ✅ après correction des sélecteurs du panier (aléa isolé sur l'envoi d'e-mail ponctuel, repassé) |
| Parcours navigateur contre **Docker 3401** | `E2E_BASE_URL=http://127.0.0.1:3401 … pnpm test:e2e` | 38/40 sur la suite complète ; les 2 échecs = limitation anti-force brute des connexions admin (« trop de tentatives ») déclenchée par l'enchaînement des connexions ; la spécification relancée seule passe 2/2 |
| Build de production | `pnpm build` + image Docker | ✅ |
| CI GitHub Actions | push `feat/storefront-configurator` | ✅ |
| Sauvegarde avant redéploiement | `pg_dump` + archive du volume médias + sommes de contrôle | ✅ `backups/preprod/` (non commité) |
| Restauration isolée | conteneur PostgreSQL éphémère, `pg_restore`, `prisma migrate deploy` | ✅ 291 références restaurées, 2 → 4 migrations, conteneur supprimé |
| Migrations, worker, notifications Docker | service `migrate`, `EmailOutbox` | ✅ migrations appliquées ; 18 e-mails SENT, 0 échec |
| Commit exécuté | `GET /api/health` → `commit`, `lastMigration` ; bandeau admin | ✅ |

Défaut trouvé et corrigé pendant ces tests : dans Docker, les webhooks simulés appelaient l'URL publique (port de l'hôte) et échouaient (ECONNREFUSED) ; ils utilisent désormais l'URL interne du conteneur.

Nouveaux scénarios navigateur : médiathèque et documents (07), vue 3D pergola et store (08), chat visiteur ↔ conseiller (09), paiement fractionné simulé avec acceptation, refus et repli carte (10), sur mesure en estimation et en devis (03).

Non testé en conditions réelles : transaction Stripe/Alma/Klarna, SMTP réel, assistant IA (aucune clé), flux fournisseur de stocks.

---

## Itération 2 (historique)

Environnement : VPS (Node 22.23, pnpm 10.33, PostgreSQL 16 en conteneur, Chromium Playwright 1.64),
serveur de développement Next.js 16.4 sur 127.0.0.1:3400, paiement en mode DEMO, e-mails en mode `log`/Mailpit.

| Contrôle | Commande | Résultat |
|---|---|---|
| Contrôle TypeScript | `pnpm typecheck` | ✅ 0 erreur |
| Lint | `pnpm lint` | ✅ 0 erreur, 1 avertissement (`<img>` dans réalisations) |
| Tests moteur (unitaires) | `pnpm test:unit` | ✅ 33/33 |
| Tests serveur (intégration, base dédiée) | `pnpm test:integration` | ✅ 14/14 |
| Parcours navigateur desktop 1440 px + mobile 390 px | `E2E_NO_SERVER=1 pnpm test:e2e` | ✅ 26/26 (13 scénarios × 2 viewports) |
| Build de production | `pnpm build` | ✅ |

## Scénarios navigateur couverts (tests/e2e)
1. Configurer une pergola standard, équiper un côté, vérifier le total, sauvegarder, recharger via le lien de partage, ouvrir le PDF.
2. Commander en test (paiement simulé accepté) et retrouver la configuration et le total dans la confirmation ; paiement refusé ⇒ commande non payée.
3. Combinaison incompatible refusée avec explication (paroi vitrée sur pergola noire) ; combinaison inconnue (gamme Max 5 m) ⇒ achat bloqué, devis proposé.
4. Acheter un store vertical seul après vérification de compatibilité (gamme, dimension, implantation, finition, côté).
5. Devis sur mesure : persistance en base, e-mails client et administrateur en file puis envoyés.
6. Store banne : seules les avancées réellement disponibles pour la largeur choisie ; supports inclus ; anémomètre.
7. Administration : changement de prix d'une variante ⇒ appliqué au configurateur, commande passée inchangée, journal d'audit `variant.update.price`.
8. Refus des cookies optionnels ⇒ aucun script optionnel chargé ; acceptation ultérieure ⇒ chargement.
9. Captures accueil, collection, fiche, comparateur, connexion, configurateur, panier, paiement, administration (tests/e2e/screenshots/*-1440.png et *-390.png) ; absence de débordement horizontal.
10. Changement de dimension ⇒ adaptations à confirmer, report de la fermeture sur une autre ouverture.
11. Modification d'une configuration depuis le panier : la ligne est remplacée (dimension et fermeture reportées), pas dupliquée.
12. Éclairage inclus (gamme Pro) : choix de couleur sans supplément, une seule ligne « inclus » dans le récapitulatif.

## Audit v2 (REA)
Scénarios `capture_browser_scenario` sur la référence (accueil, fiche Pro, configurateur Pro mobile avec ouverture de la modale d'un côté) ; captures Playwright référence/préproduction à 1440 et 390 px ; absence de débordement horizontal vérifiée sur accueil, fiche, configurateur, accessoires.

## Tests serveur (tests/integration)
Total serveur vs. valeurs falsifiées ; configuration non achetable refusée au panier ; isolement des commandes par propriétaire ;
absence de doublon de commande ; tarif modifié sans altérer la commande ; webhook rejoué (idempotent), non signé / mal signé (400),
montant incohérent ; refus ⇒ libération du stock ; remboursement complet ⇒ REFUNDED ; dernier exemplaire sous concurrence (4 requêtes,
1 succès) ; expiration des réservations et des commandes ; file d'e-mails avec échec, reprise et dédoublonnage ; devis sur mesure
persisté et notifié ; revalidation d'une configuration sauvegardée et révocation du lien.

## Non exécuté / limites
- CI GitHub Actions : ✅ run 39239526279 (lint, typecheck, unitaires, migrations, seed, intégration, build, Playwright) en 2 min 24.
- Tests Playwright exécutés contre le serveur de développement (Turbopack), pas contre l'image Docker.
- Stripe : code présent, non testé faute de clés ; le fournisseur DEMO suit le même chemin (signature, idempotence).
- Sauvegarde/restauration : exécutées sur la base de dev (dump 190 Ko, restauration vérifiée en base isolée) ; non testées sur la pile Docker.
- Pile Docker production : images construites, `compose.prod.yml` démarré sur 127.0.0.1:3401 (migrations, seed, santé 200, pages 200, `/admin` 307).
