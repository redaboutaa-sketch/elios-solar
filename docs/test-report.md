# Vérification de la mission SEO/GEO — 2026-10-26 (soir)

Commit déployé en production : **`1f311ba`**. Détail, conditions et limites : `docs/seo/changes-and-validation.md` § 3.
Unitaires 274/274, intégration 100/100, CI verte (push et PR), crawl des 34 URL du sitemap sans anomalie ni doublon,
captures avant/après 1440 et 390 px aux dimensions identiques, parcours fiche → configurateur → demande et
administration (suivi par origine) vérifiés sur une copie de la production. Recette navigateur complète
(`scripts/e2e-docker.sh`) **non rejouée** pour cette mission.

# Rapport de vérification — 2026-10-26 (préparation de la production)

Commit vérifié et déployé : **`e2afbed`** (préproduction et production ; `GET /api/health`). CI GitHub Actions verte
(push et pull request) sur ce commit.

| Contrôle | Environnement | Résultat |
|---|---|---|
| TypeScript, lint | local | ✅ 0 erreur (2 avertissements existants dans `guide-view.tsx`) |
| Unitaires | `pnpm test:unit` | ✅ 263/263 (dont mode d'encaissement, en-tête robots, SEO, demande d'étude) |
| Intégration (base dédiée) | `pnpm test:integration` | ✅ 99/99 (dont panier/commande/paiement de devis refusés quand l'encaissement est fermé) |
| Recette navigateur **HTTPS derrière Traefik** (pile équivalente à la production, identifiant de revue), 1440 et 390 px, une campagne, `retries: 0` | `scripts/e2e-docker.sh .env.prod` | ✅ **69 réussis, 0 échec, 4 ignorés** (10,5 min) |
| Recette navigateur sur build de production local (base de dev) | `pnpm build` + Playwright | 65 réussis, 4 échecs, 4 ignorés au premier passage ; les 4 échecs venaient d'une aide de test (grilles des modèles retirés comptées comme prix publics) ; specs rejouées après correction : 7/7 |
| Anti-force brute derrière le proxy | spec 13 (desktop + mobile) | ✅ 6/6 : verrou par compte avec essais espacés de plus de 10 s ; limite par IP vérifiée, X-Forwarded-For forgé sans effet (429 maintenu) ; comptes dédiés supprimés après le test |
| Production locale (127.0.0.1:3402) | curl | ✅ 200 ; `index, follow` ; canoniques `https://heliostores.com` ; sitemap 31 URL ; robots `Allow` hors pages privées ; `X-Robots-Tag` seulement sur les pages privées ; 0 « € » ; routes de paiement 404 ; aucun lien vers la démo ; aucun compte |
| Préproduction | curl externe | ✅ 401 sans identifiant ; `noindex` (en-tête et robots `Disallow: /`) |
| Autres sites du VPS | curl externe des hôtes routés par Traefik | ✅ réponses inchangées |
| Sauvegarde / restauration | PostgreSQL jetable sans réseau | ✅ sommes de contrôle OK ; 31 familles, 196 médias, 15 migrations restaurés ; conteneur supprimé |
| Captures 390 / 768 / 1440 px de la production locale | Playwright | ✅ 24 captures (hors dépôt) |

## Tests ignorés (motif et couverture)

| Test | Projet ignoré | Motif | Couverture effective |
|---|---|---|---|
| 14 — modifier une cellule, comparer, simuler, rejeter | mobile | parcours d'écriture exécuté une seule fois par campagne | exécuté et réussi en desktop |
| 14 — grille de test incomplète refusée, complète publiée puis désactivée | mobile | idem | exécuté et réussi en desktop |
| 16 — navigation latérale | mobile | la navigation latérale n'existe qu'à partir de 1024 px | exécutée en desktop ; le menu mobile est testé en mobile |
| 16 — menu mobile | desktop | le menu mobile n'existe que sous 1024 px | exécuté en mobile |

## Incidents de recette expliqués

- Une campagne HTTPS intermédiaire a été **interrompue et invalidée** : la création du réseau Docker de la production
  pendant son exécution a provoqué `net::ERR_NETWORK_CHANGED` dans Chromium. Aucune infrastructure n'a été modifiée
  pendant la campagne finale.
- Le premier essai du test anti-force brute derrière le proxy échouait au 4ᵉ essai : better-auth ne remet le compteur
  par IP à zéro qu'après 10 s **sans requête**. Les essais sont maintenant espacés en conséquence ; aucune limite n'a été
  relevée et aucun en-tête n'a été rendu de confiance.

## Non testé (raison)

- **Stripe en sandbox** : aucune clé de test disponible (aucun débit, aucun appel réseau Stripe).
- **Réception réelle d'un e-mail** (accusé de devis, notification) : aucun SMTP fourni ; `MAIL_PROVIDER=hold` en
  production. La création de la demande et sa consultation dans l'administration sont couvertes.
- **Production publique** (HTTPS, certificat, en-têtes vus de l'extérieur) : le DNS de heliostores.com pointe encore
  vers GoDaddy.
- Performances terrain (Core Web Vitals) : mesures de laboratoire seulement (`docs/seo-geo-plan-90-days.md` § 2).

---

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

## Itération 4 — recette complète contre Docker (2026-10-19)

Version exécutée : commit `95936fb` (préproduction Docker 127.0.0.1:3401, `GET /api/health` → `commit`, migration
`20261020090000_iteration4_specs_validations_quote_visuals`). Les commits suivants ne modifient que la documentation.

| Contrôle | Résultat |
|---|---|
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ 0 erreur (1 avertissement `<img>` antérieur, page Réalisations) |
| Unitaires (`tests/unit`) | ✅ 133/133 |
| Intégration (`tests/integration`, base de test) | ✅ 65/65 |
| Build (images Docker `app` + `tools`) | ✅ |
| **Recette navigateur complète contre Docker, une campagne** (`scripts/e2e-docker.sh .env.prod`) | ✅ **53/53** en 3,5 min — setup + 26 parcours × desktop 1440 / mobile 390, `retries: 0`, `failOnFlakyTests` |
| Reproductibilité | ✅ deux campagnes consécutives sur la même instance (`5060a12`) : 53/53 puis 53/53 (quotas non réinitialisés) |
| Worker e-mail | ✅ file d'attente : 129 envoyés, 0 échec (fournisseur `log`) |
| Sauvegarde avant redéploiement | ✅ `backups/preprod/db_20261019_210933.dump` + médias + sommes de contrôle (non commités) |
| Restauration isolée | ✅ PostgreSQL éphémère (tmpfs, 127.0.0.1:5499) : 292 variantes, migrations 4 → 5, câble converti en `DEMO_SEED` ; conteneur supprimé |

Nouveaux parcours : 11 (3D du sur-mesure aux cotes saisies, valeurs limites, devis avec visualisation jointe au compte, au PDF et à
l'administration ; sans WebGL : repli 2D et plan 2D joint), 12 (validation des références : dossier câble avec conflit et manques,
dossier de test à vérifier puis rejeté, historique), 13 (anti-force brute : verrou par compte malgré la rotation d'IP, limite par IP,
compte sain non bloqué). Échecs rencontrés et corrigés pendant la recette : course dans `createAccount` (visuel absent du compte en
image de production), quotas par IP partagés entre parcours, éclairage non chiffré représenté dans la 3D du sur-mesure.
Écart CI / Docker et corrections : `docs/iteration4/README.md`.

Non exécuté : paiements réels (Stripe, Alma, Klarna), SMTP réel, assistant IA réel, flux de stock fournisseur réel — intégrations
simulées ou désactivées.

## 2026-10-26 — contrôles de la bascule publique (commit `7a70796`)

Contrôles ciblés (changements : identité, pages légales, confirmation de devis, routeur public), sans relance de la
recette complète. Depuis le serveur avec résolution forcée vers `76.13.44.177` / `2a02:4780:7:f4ca::1`, puis sondes
externes :

- Unitaires 265/265, intégration 99/99, typage et lint sans erreur ; CI verte sur `7a70796`.
- HTTPS : certificats Let's Encrypt valides pour `heliostores.com` et `www.heliostores.com` ; HTTP → HTTPS (301) ;
  `www` → `https://heliostores.com` en 301 avec chemin et paramètres ; HSTS ; aucune authentification de revue ;
  IPv6 : 200 (certificats validés par Let's Encrypt, qui privilégie l'IPv6).
- SEO : 17 pages publiques en `index, follow`, sans `X-Robots-Tag`, canoniques sur `https://heliostores.com` ;
  configurateur et CGV en `noindex` ; `/compte` en `X-Robots-Tag: noindex, nofollow` ; sitemap de 33 URL
  (pages légales publiées incluses, aucune page privée) ; robots.txt ; 404 réelle ; JSON-LD Organization (marque
  HELIOSTORES, `legalName` THYSENS) sans offre ni prix 0.
- Parcours fiche Marbella → configurateur → demande : référence affichée **après** l'enregistrement en base, recours
  téléphone (`tel:`) et e-mail (`mailto:`), visualisation 3D jointe, aucun ajout au panier ni paiement simulé ;
  accusé de réception en file (`PENDING`, non envoyé). Demande, e-mail, visuel et consentements de test supprimés.
- Accès privés : `/admin*` → connexion ; visuels et PDF de devis, `/api/media/quotes/…`, `/paiement-demo`,
  webhooks : 404 sans session. Consultation administrative non testée avec un compte : aucun administrateur de
  production (création d'un compte temporaire non autorisée pendant la bascule).
- Captures 1440 et 390 px (hors dépôt). Préproduction : 401 ; autres sites du serveur : réponses inchangées.
- Externe IPv4 (check-host.net, 8 sondes) : **7 sur GoDaddy**, 1 sur notre serveur → DNS à corriger.

## 2026-10-26 — clôture après correction du DNS (commit applicatif `a8172e5`)

- DNS : ns55 et ns56 (série 2026102602), 1.1.1.1, 8.8.8.8 et 9.9.9.9 renvoient uniquement `76.13.44.177`,
  `2a02:4780:7:f4ca::1` et `www` → `heliostores.com` (OpenDNS ne répond pas depuis ce serveur).
- Externe : 11 sondes HTTPS sur 12 → 200 depuis ce serveur (12e : erreur interne de la sonde) ; `http://www` → 301 sur
  10 sondes ; IPv6 joignable sur 443 (ready.chair6.net). Un premier passage pendant le redéploiement a reçu des 404
  (Traefik ne route que les conteneurs « healthy ») : redéployer hors affluence.
- Par le DNS réel, en IPv4 et en IPv6 : 200 sur l'accueil, HTTP → HTTPS et `www` → apex en 301 avec chemin et
  paramètres, certificats Let's Encrypt vérifiés (code 0), HSTS, aucune authentification de revue, `/api/health` =
  `a8172e5`.
- Demande de devis de bout en bout (Marbella) par le DNS public : `DEV-202610-HGSLP3` enregistrée (NEW) avant la
  confirmation ; accusé de réception et notification administrateur en file (PENDING, non envoyés) ; aucun panier ni
  paiement. Demande conservée pour le contrôle de la consultation administrative, puis à supprimer.
- robots.txt, sitemap (33 URL, aucune page privée), mentions légales, confidentialité, cookies : 200.
- Tâches planifiées installées et exécutées une fois (purge : 0 ; sauvegarde valide).
- Consultation depuis l'administration : **non vérifiée** (aucun administrateur de production).

## 2026-10-26 — exploitation commerciale (image `0886bb3`, compose `5e1df9c`)

- Contrôles statiques et tests : typage et lint sans erreur ; unitaires 269/269 ; intégration 100/100, dont le seuil
  `MAIL_SEND_AFTER` et la mention de délai figée dans le devis ; CI verte (push et PR) sur `0886bb3`, `b0bad38` et `5e1df9c`.
- Administrateur créé par `pnpm admin:bootstrap` (mot de passe aléatoire passé par variable d'environnement, jamais
  affiché). Connexion par le vrai formulaire (`/compte/connexion`), arrivée sur `/admin` (« Tableau de bord »).
- Consultation administrative de `DEV-202610-HGSLP3` puis d'une nouvelle demande `DEV-202610-WXEV95` :
  - liste et coordonnées ;
  - origine (« entrée /pergolas/marbella ») ;
  - récapitulatif du produit et de la configuration ;
  - visualisation affichée (1 600 px) ;
  - visuel et PDF en 200 pour l'administrateur (`private, no-store`), 404 sans session ;
  - passage « En étude » et notes enregistrées ;
  - file des e-mails (4 en attente, fournisseur `hold`, mention du suivi manuel).
- Défauts relevés en administration et corrigés :
  - bandeau « préproduction » en production ;
  - mention « (préproduction) » incrustée dans la visualisation exportée ;
  - promesse d'e-mail au passage « Envoyé » sans SMTP ;
  - heures affichées en UTC (désormais heure de Paris) ;
  - message « e-mail de réinitialisation envoyé » sans SMTP.
- Coordonnées, contrôlées par le DNS public :
  - accueil, Contact, fiches et Livraison : aucun lien `tel:`, ni numéro, ni rue, ni THYSENS visible, ni adresse
    personnelle ; `contact@heliostores.com` présent ;
  - mentions légales et confidentialité : identité juridique conservée, téléphone en texte simple ;
  - PDF du devis : « HELIOSTORES - 59650 Villeneuve-d'Ascq, France - contact@heliostores.com ».
- Délai :
  - présent sur la fiche, dans le récapitulatif, la confirmation, l'e-mail en file et le PDF du nouveau devis ;
  - absent du PDF du devis antérieur (pas de modification rétroactive).
- Déploiement par relais, sous sonde publique toutes les 0,1 s :
  - 1re version du script : une 502 au retrait du relais ;
  - changement de labels : 49 × 404 (conflit de routeur Traefik), désormais détecté ;
  - version finale : 3 déploiements consécutifs, 1 001 requêtes, 0 erreur.
- SEO :
  - 34 URL du sitemap (dont `/livraison-installation`) : 200, sans `noindex` ni `X-Robots-Tag`, canonique exacte,
    Open Graph, aucun lien de préproduction ;
  - JSON-LD Organization : `name` HELIOSTORES, `legalName` THYSENS, e-mail et localité, sans téléphone ni rue ;
    aucune offre, aucun avis, aucun stock ;
  - balises de vérification Google et Bing lues à l'exécution (conteneur isolé, jetons fictifs) ;
  - préproduction : 401.
- Sauvegardes et purge : tâches actives à l'heure de Paris, sans doublon ; restauration isolée de
  `db_20261026_132425.dump` réussie.
- Nettoyage : demandes `HGSLP3` et `WXEV95`, leurs 2 visuels et leurs 4 notifications supprimés (trace `AuditLog`) ;
  les 7 consentements anonymes sont conservés (site public : origine non distinguable).
