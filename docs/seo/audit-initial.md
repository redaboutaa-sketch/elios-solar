# Audit SEO/GEO initial — heliostores.com (2026-10-26)

> Document publiable : aucun secret, aucun montant, aucune donnée personnelle. Les requêtes citées sont des
> **hypothèses** : aucune donnée Search Console exploitable n'existait au moment de l'audit (seule l'indexation de
> l'accueil est confirmée par la capture fournie ; aucun accès Search Console ni Bing dans cette session).
> Contrainte appliquée : design et structure validés par le client conservés strictement (aucune section, FAQ,
> tableau, page ou fonctionnalité visible ajoutée sans validation).

## Méthode

- Production publique `https://heliostores.com`, image `0886bb3` au début de l'audit ; préproduction contrôlée en 401.
- Exploration des 34 URL du sitemap (statut, `<title>`, description, H1, canonique, robots, JSON-LD, images, liens
  vers la préproduction), contrôles ciblés des redirections, pages archivées, paramètres et 404 (outil Playwright /
  `fetch`, scripts hors dépôt).
- Lecture du code : métadonnées (`src/app/(boutique)/**`), `src/server/seo/*`, galerie, médias, attribution.
- Recherche de formulations publiques incohérentes avec le mode sur devis (prix, commande en ligne, garantie,
  showroom, Belgique, fabricant…) dans le texte rendu des 34 pages.
- Documentation officielle vérifiée le 2026-10-26 : Google Search Central (liens de titre, sitemaps, extraits produit,
  dernière mise à jour 2026-09-08) et aide Merchant Center (attribut `price`, règles Shopping).

## Observations

### Ce qui fonctionne (aucune action)
- 34/34 URL du sitemap en 200, canonique absolue exacte, aucun `noindex`, aucun lien vers la préproduction.
- `robots.txt` correct (zones privées exclues, `/_next` ouvert, sitemap indiqué) ; HTTP → HTTPS et `www` → apex en 301.
- Anciens noms : 308 directs vers la cible (`/screens/helio-ombra` → `/screens/helioscreen`, `/stores-bannes/helio-riviera`
  → `/stores-bannes/casablanca`, `/guides/pergola-bioclimatique` → `/guides/choisir-sa-pergola`).
- Modèles archivés (`helio-horizon`, `helio-panorama`) : page explicative en 200 `noindex, follow`, hors sitemap.
  Brouillons (MoskiUp, MoskiSlide, MoskiFix) : fiches et configurateurs en 404 ; mention « en préparation » sur
  `/moustiquaires`.
- Configurateurs `noindex, follow`, canonique sans paramètres ; `/devis?produit=…` canonique `/devis`.
- Un H1 par page, contenu principal rendu côté serveur ; JSON-LD Organization + WebSite (accueil),
  BreadcrumbList (familles, fiches, guides), Product sans offre (fiches) ; aucun prix, avis, note ou stock.
- 3D chargée à la demande (clic « Vue 3D »), repli 2D ; CLS mesuré à 0 sur les pages testées.

### Constats
| # | Constat | Preuve |
|---|---|---|
| C1 | **FAQ de HelioScreen et Casablanca** : « Le prix est-il affiché en ligne ? **Oui** » et « Peut-on commander en ligne ? **Oui**… s'ajoute au panier » | texte rendu de `/screens/helioscreen`, `/stores-bannes/casablanca` ; grilles désactivées et paiement fermé depuis le 2026-10-26 |
| C2 | **Centre d'aide** : « Peut-on commander en ligne ? Oui pour la structure seule… », « Suivi de commande depuis votre compte » | texte rendu de `/aide` |
| C3 | Titres de fiche « Nom — Nature » : la nature arrive après le nom, sans « sur mesure » ; « pergola bioclimatique » absent alors que c'est la désignation usuelle des pergolas à lames | crawl : `Marbella — Pergola à lames orientables — HELIOSTORES` |
| C4 | Titres de famille sans « sur mesure » ni terme de recherche principal (`Screens extérieurs et screens de toiture`) | crawl |
| C5 | 5 pages de contenu (`/aide`, `/cookies`, `/mentions-legales`, `/confidentialite`, `/livraison-installation`) partagent la description générique du site | crawl : 5 descriptions identiques |
| C6 | `/devis` : titre « Demander un devis » et description courte, sans nature de produit | crawl |
| C7 | Photo principale des fiches sans `srcset` ni priorité ; écrans mobiles à densité 2–3 téléchargent l'original (Casablanca : 279 Ko) | HTML rendu ; LCP labo mobile Casablanca 5,1–5,6 s |
| C8 | Vignettes de galerie (zone 80 px) servies en 640 px (~70 Ko chacune), téléchargées en concurrence avec la photo principale | mesure réseau de la fiche Casablanca |
| C9 | `/modes-de-paiement` indexable alors que tous les moyens sont « Envisagé — non disponible » | HTML : `index, follow` |
| C10 | Pages 404 : deux balises robots (`noindex` et `index, follow`) | HTML de `/references`, `/pergolas/inexistant` |
| C11 | H1 des familles et fiches réduits au nom (« Pergolas », « Marbella ») | crawl |
| C12 | `Product` sans `offers`/`review`/`aggregateRating` : non éligible aux extraits produit (Google exige l'un des trois) | doc. Google « Product snippet » (2026-09-08) |
| C13 | Aucun moyen de saisir le CA HT réellement encaissé hors ligne ; aucune vue par origine | `Quote` : attribution, qualification, statut, montant proposé TTC, mais pas d'encaissement hors commande en ligne |
| C14 | Messagerie : `contact@heliostores.com` sans MX ni SMTP (`MAIL_PROVIDER=hold`) | runbook § 5 bis ; inchangé |
| C15 | Sitemap sans `lastmod` pour l'accueil, les familles, `/devis`, `/contact` (présent pour fiches, guides, pages de contenu) | sitemap public |

### Hypothèses
- Les requêtes « pergola bioclimatique », « store screen », « store banne », « moustiquaire plissée », combinées à
  « sur mesure », sont les plus proches de l'offre. **Non vérifié** : aucune donnée de volume ni de requête. À
  confirmer avec le rapport « Performances » de la Search Console après quelques semaines d'impressions.
- Le LCP des fiches est le principal point faible de performance mobile (mesures de laboratoire seulement).

### Données manquantes
- Requêtes, impressions, clics, pages indexées (Search Console / Bing) ; Core Web Vitals terrain (CrUX).
- Zones réellement desservies, conditions de pose, garanties, réalisations authentiques.
- Dépenses d'acquisition (coût par prospect), coût de revient (marge).

## Backlog priorisé

Effort : S (< 1 h), M (demi-journée), L (> 1 jour). État au 2026-10-26.

| Prio | URL / composant | Constat | Impact commercial | Correction | Effort | Vérification | État |
|---|---|---|---|---|---|---|---|
| P0 | FAQ HelioScreen, Casablanca (base + `heliostores-data.ts`) | C1 | promesse fausse (prix, panier) → déception, litige, perte de confiance | réponses conformes au mode sur devis, mêmes questions | S | texte rendu | **fait** |
| P0 | `/aide` (base + `default-pages.ts`) | C2 | idem | texte remplacé, même structure, liens vers guides | S | texte rendu | **fait** |
| P0 | Titres des fiches (`productTitle`) | C3 | compréhension et clic sur la requête produit | « Nature Nom sur mesure » (sans « sur mesure » pour tailles définies) ; « Pergola bioclimatique » dans le `<title>` des pergolas à lames | S | crawl, test unitaire | **fait** |
| P0 | Suivi commercial (admin) | C13 | impossible de relier source → vente → CA | champs « Montant HT encaissé », date, motif ; écran « Suivi par origine » + CSV | M | parcours admin sur copie de la base | **fait** |
| P1 | Titres et descriptions des familles, `/devis` | C4, C6 | clic depuis les résultats | réécriture sans promesse | S | crawl | **fait** |
| P1 | Descriptions des pages de contenu | C5 | doublons, extraits peu clairs | description propre à chaque page | S | crawl : 0 doublon | **fait** |
| P1 | Galerie des fiches | C7, C8 | LCP mobile, abandon avant le CTA | variante 1080 px, `srcset` + `sizes` exacts, `fetchpriority` haute sur la photo, basse sur les vignettes | M | LCP labo, captures | **fait** |
| P1 | `/modes-de-paiement` | C9 | page « non disponible » dans les résultats | `noindex, follow` tant qu'aucun moyen n'est actif | S | HTML | **fait** |
| P1 | Search Console / Bing | données | pilotage impossible | vérification, sitemap, inspection d'URL (procédure `changes-and-validation.md` § 6) | S | rapports | **à faire (client)** |
| P1 | Messagerie | C14 | notifications et réponses non reçues | boîte et SMTP (runbook § 5 bis) | M | e-mail de test | **à faire (client)** |
| P2 | H1 familles et fiches | C11 | compréhension de la page (faible : titre, fil d'Ariane et nature visibles) | ex. « Pergolas sur mesure », « Pergola Marbella » | S | captures | **proposition non implémentée** (texte visible, validation requise) |
| P2 | Pages 404 | C10 | aucun (404 non indexée) | une seule balise `noindex` | S | HTML | à faire |
| P2 | `lastmod` accueil et familles | C15 | faible | dates de modification réelles du catalogue | S | sitemap | à faire |
| P2 | Product sans offre | C12 | aucun extrait produit possible | rien tant que le prix n'est pas validé ; ne jamais ajouter de faux `Offer` | — | test des résultats enrichis | accepté |
| P2 | Guide d'achat, FAQ et comparatif sous les familles | — | aide au choix | voir `content-plan-90-days.md` | M | — | **proposition non implémentée** (nouvelles sections) |
| P2 | Nouveaux contenus comparatifs | — | requêtes de comparaison | 5 brouillons (`content-plan-90-days.md`) | L | — | **brouillons** (nouvelles pages : validation requise) |

Corrections et preuves : `docs/seo/changes-and-validation.md`. Matrice des intentions : `docs/seo/keyword-page-map.csv`.
