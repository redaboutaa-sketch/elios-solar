# Modifications SEO livrées et validation (2026-10-26)

Production : `https://heliostores.com`, commit applicatif **`1f311ba`** (`/api/health` : `commit 1f311bac2fc5…`,
dernière migration `20261026160000_vente_encaissement`). CI verte (push et PR) sur `1f311ba` avant déploiement.
Design et structure inchangés (contrainte client) : aucune section, FAQ, tableau, page ou fonctionnalité publique ajoutée.

## 1. Modifications

| Domaine | Modification | URL / composant |
|---|---|---|
| Cohérence commerciale | FAQ « Le prix est-il affiché en ligne ? » et « Peut-on commander en ligne ? » : réponses « Non », sur devis, délai communiqué (mêmes questions, même emplacement) | `/screens/helioscreen`, `/stores-bannes/casablanca` (base + `src/server/catalog/heliostores-data.ts`) |
| Cohérence commerciale | Centre d'aide : plus de commande en ligne ni de suivi de commande annoncés ; liens vers « Prise de mesures », « Adossée ou autoportante », Contact ; seuil de 40 m² précisé | `/aide` (base + `src/server/content/default-pages.ts`, empreinte de l'ancien texte ajoutée) |
| Titres de fiche | « Nature Nom sur mesure » (« sur mesure » omis pour les tailles définies : Malaga) ; « Pergola bioclimatique » pour les pergolas à lames, **dans la balise `<title>` seulement** (la nature affichée reste « Pergola à lames orientables ») | 11 fiches (`src/server/seo/product-nature.ts`) |
| Titres et descriptions | Familles : `Pergolas bioclimatiques et pergolas à toiture en toile`, `Stores screens extérieurs sur mesure et screens de toiture`, `Stores bannes sur mesure : coffre, semi-coffre ou sans coffre`, `Moustiquaires plissées sur mesure pour portes-fenêtres` ; `/devis` : `Demander un devis de pergola, store ou moustiquaire` | 4 familles, `/devis` |
| Descriptions | Description propre à chaque page de contenu (au lieu de la description générique) | `/aide`, `/livraison-installation`, `/mentions-legales`, `/confidentialite`, `/cookies` |
| Indexation | `/modes-de-paiement` en `noindex, follow` tant qu'aucun moyen n'est actif (rétabli automatiquement à l'ouverture) | `/modes-de-paiement` |
| Images | Variante WebP 1080 px des photos et rendus publiés plus larges (91 en production, originaux et variantes 640 px inchangés) ; `srcset` commun ; `sizes` exacts de la photo principale ; `fetchpriority="high"` sur la photo principale, `"low"` sur les vignettes ; vignettes dimensionnées | galerie des fiches, accueil, familles ; `scripts/media-variants.ts` ; `/api/media` |
| Mesure commerciale | Devis : « Montant HT encaissé », « Encaissé le », « Motif du gain ou de la perte » (migration additive, valeurs nulles = « non renseigné ») ; écran **Suivi par origine** (`/admin/acquisition`) et export CSV | administration |

### Décision « bioclimatique »
Le terme était exclu car « commercial, non documenté ». Il désigne couramment en France une pergola à lames orientables
et correspond à la priorité « pergola bioclimatique sur mesure ». Il est employé **uniquement** dans le `<title>` et la
description de la famille Pergolas, sans aucune promesse de performance thermique. À retirer si le client le refuse.

## 2. Mesure commerciale : chaîne et définitions

source/campagne/page d'entrée (attribution transmise avec la demande, sans cookie) → demande enregistrée côté serveur
(numéro attribué : seul événement compté, jamais le clic) → qualification (À qualifier, Qualifié, Non qualifié) →
gagné (« Accepté ») ou perdu (« Refusé », « Expiré ») → montant HT encaissé saisi sur le devis.

Indicateurs de `/admin/acquisition` (filtre par période) :
- demandes de devis, demandes de contact ; prospects qualifiés ;
- taux de qualification = qualifiées / demandes de devis ;
- taux de transformation = gagnées / (gagnées + perdues), et gagnées / demandes de devis ;
- CA HT encaissé attribué : somme des montants saisis ; « non renseigné » sinon (jamais 0) ; nombre de ventes gagnées
  sans montant affiché ;
- coût par prospect et par vente : « non renseigné » (aucune dépense saisie) ; marge : non calculée (aucun coût de
  revient fiable). Vues par origine, campagne et page d'entrée ; export CSV (agrégats, aucune donnée personnelle).

Aucun traceur ni outil d'audience tiers ajouté.

## 3. Vérifications réalisées

| Contrôle | Résultat |
|---|---|
| Typage (`tsc`), lint (fichiers modifiés) | OK |
| Tests unitaires | 274/274 (dont `acquisition.test.ts`, `media-srcset.test.ts`, titres dans `seo.test.ts`) |
| Tests d'intégration | 100/100 (base de développement) |
| CI GitHub (push et PR) sur `1f311ba` | succès |
| Crawl des 34 URL du sitemap (production après déploiement) | 34 × 200, canonique exacte, 1 H1, aucun `noindex`, aucun lien de préproduction, **0 titre et 0 description en double** |
| Texte rendu : « Oui pour la structure seule », « s'ajoute au panier » | 0 occurrence sur HelioScreen, Casablanca, `/aide` |
| `robots.txt`, sitemap, HTTP → HTTPS, `www` → apex (paramètres conservés) | 200 / 200 / 301 / 301 |
| Paiement fermé | `/paiement-demo` 404, webhook Stripe 405 |
| Administration sans session | `/admin/acquisition` → connexion ; export CSV 404 |
| Variante 1080 px publique | 200, `public, max-age=31536000, immutable` |
| Préproduction | 401 (protégée) |
| Autres sites du serveur | réponses inchangées (200, ou 401/403 pour les accès protégés) |

### Contrôles sur une copie de la production (avant déploiement)
Base restaurée de la sauvegarde `db_20261026_170042` dans un PostgreSQL jetable (réseau Docker interne), copie du
volume des médias ; ancienne image `0886bb3` et nouvelle image côte à côte. Environnement supprimé ensuite.
- **Captures avant/après** (Playwright, pleine page, 1440 px et 390 px, 15 pages : accueil, 4 familles, 4 fiches,
  1 fiche moustiquaire, 1 guide, aide, devis, contact, modes de paiement) : **dimensions identiques sur les 30
  captures**. Écarts de pixels limités à la photo principale des fiches (variante rééchantillonnée, rendu équivalent
  contrôlé visuellement) et aux pages animées (accueil, familles en mobile), où deux captures de la même version
  diffèrent déjà autant.
- **Parcours** fiche Marbella → configurateur → coordonnées → demande enregistrée → confirmation (référence, délai,
  `mailto` de recours) : OK ; aucun ajout au panier ni paiement visible. La visualisation n'a pas pu être jointe dans
  cet environnement (volume monté en lecture seule, voulu) ; elle n'est pas concernée par les modifications.
- **Administration** : saisie du montant HT, de la date et du motif sur un devis de test, écran « Suivi par origine »
  et export CSV conformes ; aucune erreur JavaScript.
- **Attribution** : la demande de test porte sa page d'entrée (`/pergolas/marbella`).

### Performance (laboratoire, pas de données terrain)
Conditions : Chromium, 390 × 844, densité 3, processeur ralenti 4×, 1,6 Mbit/s, 150 ms, cache désactivé, deux passages ;
serveur sur la copie locale (sans Traefik ni latence Internet réelle).

| Page | LCP avant | LCP après | Élément LCP | Photo principale |
|---|---|---|---|---|
| `/stores-bannes/casablanca` | 5,1–5,6 s | **4,4–4,5 s** | photo | 279 Ko → 168 Ko |
| `/screens/helioscreen` | 2,15–2,16 s | 2,16–2,17 s | photo | 72 Ko (inchangée, plus étroite que 1080 px) |
| `/pergolas/malaga` | 1,18–1,19 s | 1,18–1,19 s | photo | inchangée |
| `/pergolas/sevilla` | — | 1,18–1,19 s | photo | 9 Ko |

CLS : 0 sur toutes les pages mesurées. Lighthouse n'a pas été exécuté (non disponible dans l'environnement). Les Core
Web Vitals terrain n'existeront qu'avec un trafic suffisant (rapport Search Console, CrUX).

### Non vérifié
- Disponibilité pendant ce déploiement : la sonde lancée en parallèle n'a pas enregistré ses résultats (erreur de
  script) ; aucune mesure n'est donc revendiquée pour ce déploiement (mesures précédentes : runbook § 2 bis).
- Indexation, requêtes et positions : aucun accès Search Console ni Bing dans cette session.

## 4. Données structurées et Merchant Center

- Organization (marque HELIOSTORES, `legalName` THYSENS, e-mail, localité), WebSite, BreadcrumbList, Product sans
  offre : **inchangés**, cohérents avec le contenu visible. Aucun prix à 0, aucun Offer, stock, avis ou note.
- Google exige `offers`, `review` ou `aggregateRating` pour les extraits produit : les fiches n'y sont pas éligibles,
  ce qui est accepté. Aucun balisage FAQ ajouté.
- **Merchant Center : non éligible aujourd'hui.** L'attribut `price` est obligatoire, doit correspondre au prix de la
  page et du paiement, et le produit doit pouvoir être acheté à ce prix. Sans prix public validé ni achat en ligne,
  aucun flux n'est soumis. Prérequis : grilles de prix validées (devise, TVA, inclusions, validité), paiement ouvert
  (compte de paiement raccordé et recette), conditions de vente et de livraison publiées, puis flux construit depuis le
  catalogue. Rien n'a été créé.

## 5. Procédures d'exploitation ajoutées

Variantes d'images après un import de médias (production, service `migrate` qui monte le volume des médias) :
```bash
docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod run --rm --no-deps migrate pnpm media:variants          # simulation
docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod run --rm --no-deps migrate pnpm media:variants --apply  # écriture, idempotente
```
Correctif de contenu appliqué en base : `private/seo-2026-10-26/apply-content.sql` (hors dépôt), conditionné à
l'ancien texte, tracé dans le journal (`content.seo_fix`). Sauvegardes avant migration : `db_/media_20261026_170042`
et `_173752`.

## 6. Search Console et Bing : procédure exacte (accès du client)

La Search Console est accessible au client (capture : accueil indexé). Elle n'a pas été consultée dans cette session.
1. Search Console → propriété `heliostores.com` → **Sitemaps** → saisir `sitemap.xml` → Envoyer. Contrôler l'état
   « Opération effectuée » et le nombre d'URL découvertes (34 attendues au 2026-10-26).
2. **Inspection de l'URL** puis « Demander l'indexation » pour : `/pergolas`, `/screens`, `/stores-bannes`,
   `/moustiquaires`, `/pergolas/marbella`, `/screens/helioscreen`, `/stores-bannes/casablanca`,
   `/guides/choisir-sa-pergola`, `/devis` (quota quotidien limité : étaler si nécessaire).
3. **Pages** : suivre « Explorée, actuellement non indexée » et « Détectée, actuellement non indexée » ; ne rien
   conclure avant plusieurs semaines.
4. **Performances** (après 3 à 4 semaines) : exporter requêtes et pages (CSV) ; les comparer à
   `docs/seo/keyword-page-map.csv` pour confirmer ou abandonner les hypothèses.
5. Bing Webmaster Tools → « Importer depuis Google Search Console » → soumettre le même sitemap.
Une soumission ne vaut pas indexation. Aucun mot de passe ni jeton n'est à transmettre.
