# Analyse des écarts v2 — référence pergolux.fr vs préproduction ELIOS SOLAR

Date : 2026-10-19. Méthode : outils REA (`capture_browser_scenario`, arbres d'accessibilité et
événements, navigateur Chromium 151 lancé par REA) sur les pages publiques de la référence, sans
achat ni envoi de formulaire ; captures Playwright de la référence et de la préproduction à
1440 px et 390 px (conservées hors dépôt pour la référence : droits d'auteur). Détail des
relevés catalogue : `reference-audit.md`, `catalogue-parity.csv`, `compatibility-matrix.csv`.

Légende « statut » : **observé** (vu via REA/captures), **hypothèse** (déduit), **inaccessible**
(non observable sans compte/achat/back-office). Priorité : P1 (bloquant pour une expérience
comparable), P2 (important), P3 (confort).

## A. Navigation et accueil

| # | Constat (page) | Impact client | Correction prévue | Priorité / critère d'acceptation |
|---|---|---|---|---|
| A1 | **Observé** (/) : menu « Pergolas » déroulant (4 gammes + Tout voir), bouton « Comparer les pergolas » permanent dans l'en-tête, téléphone + disponibilité conseillers. Nous : liens plats, pas de téléphone. | Accès direct aux gammes et au comparateur depuis toute page. | Menu déroulant Pergolas (gammes + sur mesure), bouton Comparer dans l'en-tête, téléphone depuis Réglages si renseigné. | P2 — menu accessible clavier ; téléphone affiché seulement s'il est renseigné. |
| A2 | **Observé** (/) : hero plein écran avec photographie de terrasse, titre fort, deux CTA. Nous : hero 2 colonnes avec illustration SVG schématique. | Première impression moins immersive. | Hero plus grand avec rendu SVG enrichi (terrasse, végétation, ciel, mobilier) et typographie plus forte ; photographie à remplacer quand des médias autorisés existent (voir § F). | P1 — hero ≥ 70 vh desktop, visuel cohérent avec une pergola bioclimatique. |
| A3 | **Observé** (/) : cartes de gammes avec galerie 4 vignettes, liste « 7 tailles 4 couleurs / Option Stores / Option Paroi vitrée / Optionnel Store rétractable », prix « À partir de », boutons Configurer + Comparer. Nous : carte simple (illustration, nom, prix). | Différences entre gammes moins lisibles. | Cartes enrichies : vignettes multi-vues, liste d'équipements calculée depuis le catalogue (tailles, finitions, fermetures compatibles, éclairage inclus), Configurer + Comparer. | P1 — chaque carte affiche équipements inclus et options compatibles, issus des règles. |
| A4 | **Observé** (/) : bandeau promotionnel à compte à rebours, avis clients, « 100 000 clients », récompenses, Alma. | — (volontairement non repris : faux avis / urgence artificielle). | Aucune : remplacer par des blocs factuels (étude de projet, montage, garanties légales). | P3 — aucun compteur ni avis non vérifiable. |
| A5 | **Observé** (/) : section « Découvrir l'essentiel » (7 arguments visuels), vidéos clients, promesse (prix transparent, consultation gratuite, montage facile, livraison). | Réassurance. | Section « L'essentiel » factuelle avec pictos (toit, étanchéité, lames, modularité) et promesse adaptée (sans chiffres inventés). | P2. |
| A6 | **Hypothèse** : chat/WhatsApp et rappel HubSpot. | Contact instantané. | Déjà : formulaire de rappel ; pas de chat tiers avant consentement. | P3. |

## B. Collections et fiches produit

| # | Constat | Impact | Correction | Priorité / critère |
|---|---|---|---|---|
| B1 | **Observé** (/collections/accessoires) : cartes avec photo en situation, prix barré, « Compatible avec Toutes les pergolas », pastilles de couleurs disponibles, phrase d'usage. Nous : pictogramme, prix « à partir de » (grille démo erronée : 15 440 € pour une paroi vitrée — **corrigé**), pas de compatibilité affichée. | Le client ne sait pas si l'accessoire convient à sa pergola. | Prix démo corrigés (grille cohérente). Cartes accessoires avec « Compatible avec … » calculé depuis les règles, pastilles couleurs, longueurs disponibles. | P1 — compatibilité affichée par famille, dérivée de `ClosureCompatRule`/`OptionCompatRule`. |
| B2 | **Observé** (/products/pergola-pro) : galerie « 76 photos » en mosaïque, puis « Découvrir l'essentiel », tableau comparatif détaillé des 3 gammes (toit, lames, LED, charges, poteaux, drainage, assemblage, options), avis. Nous : une illustration, description, inclus, caractéristiques, documents, FAQ. | Fiche moins riche, pas de visuels multiples. | Galerie multi-vues générée (3/4, face, plan, détail lames, finitions) avec vignettes ; onglets Description / Caractéristiques / Montage / Réglementation / Garantie ; section comparatif alimentée par le catalogue ; sélection de variantes (finition, dimension, implantation) avec rendu mis à jour. | P1 — ≥ 4 vues par fiche, variantes lisibles, comparatif présent. |
| B3 | **Observé** (/products/store-banne) : mosaïque 56 photos, pictos « Tissu Gris/Beige · Coffre Anthracite/Blanc · 12 tailles 2–6 m · Anémomètre optionnel », bénéfices à puces, « Configurer ». | Lecture rapide de l'offre. | Fiche store : pictos synthèse (tissus, coffre, tailles, option) calculés depuis les variantes ; galerie multi-vues. | P2. |
| B4 | **Observé** : prix barrés permanents (-26 %). | — (non repris : réduction permanente). | Prix barré uniquement si `compareAtCents` est défini par une promotion administrée. | P3 — aucun prix barré sans promotion active. |
| B5 | **Inaccessible** : stocks réels, délais par entrepôt (« Expédition sous 10 à 15 jours ouvrés » observé dans la modale, mais logique interne non visible). | Délais annoncés. | Délai indicatif par référence (`leadTimeDays`, administrable) affiché sur fiche, configurateur et panier. | P2 — délai visible partout où la référence est choisie. |

## C. Configurateur standard

| # | Constat | Impact | Correction | Priorité / critère |
|---|---|---|---|---|
| C1 | **Observé** (REA, /pages/pergola-4-pro-configurator, 390 px) : ordre Couleur → Dimensions (+ lien Sur mesure) → Type de construction → Parois latérales (4 slots « 3m ») → Accessoires optionnels → Options de montage → récapitulatif ; galerie 22 photos en tête. Nous : Gamme → Implantation → Dimension → Finition → Ouvertures → Options → Livraison/montage → Récapitulatif, avec plan 2D. | Comparable ; notre plan 2D est un plus. | Conserver l'ordre (la gamme d'abord permet de comparer) ; ajouter en tête un bloc « Inclus avec cette gamme » et les délais. | P2 — bloc inclus visible avant les options. |
| C2 | **Observé** (REA) : la modale d'un côté liste chaque référence avec prix, remise, disponibilité et délai, « Ajouter au panier » et « Plus d'informations » vers la fiche. Nous : radios par famille puis options, sans délai ni lien fiche. | Moins d'information au moment du choix. | Dans chaque ouverture : prix, délai indicatif, lien « Voir la fiche », raison d'indisponibilité, statut de confiance (démo / à confirmer). | P1 — chaque proposition affiche prix, délai et lien fiche ; chaque refus affiche une raison. |
| C3 | **Observé** (REA) : « Bandes LED : Blanc chaud — Gratuit » sur la Pro avec choix Blanc chaud / RGB. Nous : LED « inclus » sans choix de couleur. | Le client ne peut pas choisir la couleur de l'éclairage inclus. | Option incluse présentée comme « Inclus — choisissez la couleur » (variante sans surcoût, non facturée). | P1 — ligne incluse à 0 € avec couleur choisie dans le récapitulatif et la commande. |
| C4 | **Observé** : montage professionnel 905,06 € calculé côté client ; nous : calcul serveur par dimension + par fermeture. | — | Conserver ; afficher le détail (base + fermetures). | P3. |
| C5 | **Hypothèse** : pas de plan ni de vue par côté sur la référence (slots nommés « 3m » sans orientation). Nous : plan orienté avec mur. | Avantage. | Améliorer le rendu : vue 3/4 réagissant aux fermetures de chaque côté (déjà partiel), finition appliquée. | P2. |
| C6 | **Observé** (REA) : changement de dimension → la modale repart de zéro (`handleVariantChange` vide les slots). Nous : adaptations à confirmer. | Avantage. | Conserver + test existant. | — |

## D. Panier et parcours mobile

| # | Constat | Impact | Correction | Priorité / critère |
|---|---|---|---|---|
| D1 | **Inaccessible** (panier non exercé : pas d'ajout au panier sur la référence par principe) ; le script `app-cart` suggère un tiroir panier avec lignes séparées pergola / parois / montage. | — | Nous : panier page avec lignes composées. Ajouter la **modification d'une configuration depuis le panier** pour toute ligne pergola/store (reprise dans le configurateur puis remplacement de la ligne). | P1 — « Modifier » sur chaque ligne configurable ; après validation, la ligne est remplacée (pas dupliquée). |
| D2 | **Observé** (390 px) : galerie plein écran « 1 / 23 », titre, note, prix, Alma, puis sélection ; menu hamburger. Nous : illustration, titre, description ; barre sticky total dans le configurateur. | Mobile correct, moins visuel. | Fiche mobile : galerie balayable, barre sticky prix + « Configurer » ; configurateur : conserver la barre sticky. | P2 — barre sticky sans masquer le contenu, cibles tactiles ≥ 44 px. |
| D3 | **Observé** (390 px, référence) : compte à rebours et popups. | — | Rien. | — |

## E. Couverture fonctionnelle (vérifiée par rapport aux options publiques)

| Famille | Référence (observé) | Préproduction | Écart |
|---|---|---|---|
| Pergola manuelle / Pro / Pro Max | 7 dimensions × 4/4/3 finitions × 2 implantations ; LED gouttière incluse (Pro, blanc chaud ou RGB), LED lames (Max, blanc chaud) | identique (56/56/42 variantes) | couleur de la LED incluse à choisir (C3) |
| Sur mesure | curseurs largeur/longueur/hauteur, 6 emplacements de parois, prix calculé | formulaire bornes + souhaits par côté, devis | prix sur mesure volontairement absent (grille fournisseur inconnue) |
| Paroi vitrée | 2 couleurs × 4 longueurs × 3 options | identique | — |
| Persienne | couleur × longueur × implantation (5/6 m : une couleur par implantation) | grille complète 2 × 4 × 2 | variantes 5/6 m « supplémentaires » en démo (à confirmer fournisseur) |
| Store vertical ZIP | 3 couleurs × 4 longueurs | identique | — |
| Bandes LED | 2 couleurs × 7 dimensions × 2 implantations | identique | — |
| Lampe chauffante / lanterne / anémomètre | 3 / 4 / 2 variantes | identique | — |
| Store banne | 12 tailles × 2 coffres × 2 toiles ; supports mur/plafond ; câble ; anémomètre | identique | câble 6 m non modélisé (0 €, inclus ?) : **inconnu** |
| Montage professionnel | prix par variante + par paroi | tarifs admin par dimension + par fermeture | — |
| Génération S3 | encore listée (fin de série) | non reprise | volontaire |

## F. Médias manquants (à fournir, droits documentés dans Administration → Médias)
- Photographies en situation par gamme (3/4, face, nuit avec éclairage), par finition (anthracite, blanc, bicolore, noir), adossée et autoportée.
- Détails : lames ouvertes/fermées, gouttière, poteau, rail d'accessoires, télécommande.
- Fermetures : paroi vitrée (fixe, coulissante), persienne, store ZIP, installées sur pergola.
- Store banne : déployé, coffre fermé, toile grise et beige, supports.
- Options : bandes LED blanc chaud et RGB, lampe chauffante, lanterne, anémomètre.
- Vidéos de montage et notices PDF (fournisseur).
En l'absence de ces médias, la préproduction utilise des rendus SVG originaux (aucune image de tiers).

## G. Synthèse des priorités traitées dans cette itération
P1 : A2, A3, B1, B2, C2, C3, D1. P2 : A1, A5, B3, B5, C1, C5, D2. Les autres restent documentés.
