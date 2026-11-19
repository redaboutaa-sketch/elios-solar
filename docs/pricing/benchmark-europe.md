# Benchmark marché européen et « Mes prix conseillés » par niveaux (2026-11-19)

> Document publiable : **aucun montant, aucun coût, aucune marge**. Les relevés chiffrés, les captures, les lots de
> collecte et les rapports avant / après sont privés (`private/heliostores/market-2026-11-19/`, hors Git, hors Docker)
> et consultables dans l'administration (administrateurs seulement). Outils : skill `/benchmark-marche-europe`,
> `scripts/market/`, `src/domain/market-benchmark.ts`, `src/server/market/advice.ts`.

## 1. Diagnostic de départ (production, 2026-11-19, avant changement)

Constat vérifié dans le code et les données (lecture seule de la production, puis copie isolée) :
« Mes prix conseillés » affichait **0 produit réellement comparé sur 9** et « marché insuffisant » partout ; les prix
conseillés reproduisaient la politique de marge.

### Relevés

| Mesure | Valeur |
|---|---|
| Relevés actifs / archivés / total | 107 / 47 / 154 (une seule source : import du 04 au 13/11) |
| Période | 2026-11-04 → 2026-11-13 (aucun relevé périmé) |
| Pays, devise | 107 FR, EUR (aucun autre pays) |
| Revendeurs distincts / marques distinctes / URL distinctes | 16 / 38 / 104 |
| Doublons (même URL pour un même produit) | 2 |
| Par produit | HelioMax 55 · HelioLux 19 · HelioSun 12 · HelioScreen 10 · HelioShade 4 · HelioPro 4 · HelioSky 1 · HelioRoof 1 · HelioSquare 1 |
| Comparabilité enregistrée | forte 6 · partielle 76 · insuffisante 25 |
| HT/TTC non indiqué | 41 (dont 28 PERGOLUX sur HelioMax) |
| Prix « à partir de » | 15 |
| Implantation non indiquée | 18 |
| Cotes incomplètes (largeur ou avancée absente) | 23, dont les 10 screens (hauteur saisie, avancée vide) |

### Motifs de rejet (moteur d'origine, configuration de référence de chaque produit)

| Motif | Relevés concernés | Seul motif |
|---|---:|---:|
| Périmètre différent non normalisable (livraison, LED, télécommande…) | 106 | 4 |
| Comparabilité « partielle » (seule « forte » était admise) | 76 | — |
| Dimensions hors ±10 % ou non indiquées | 70 | — |
| HT/TTC non établi | 41 | — |
| Implantation différente | 32 | — |
| Comparabilité « insuffisante » | 25 | — |
| Implantation non indiquée | 18 | — |
| Prix « à partir de » | 15 | — |

Critère qui éliminait **toutes** les offres : le **périmètre**. La livraison, facturée à part chez nous, est comprise
chez presque tous les revendeurs, sans montant séparable. Le moteur traitait cet écart comme rédhibitoire, alors
qu'il signifie seulement que le prix concurrent est un majorant.

### Classement des causes

| Nature | Constat |
|---|---|
| **Anomalies de code** | (1) Screens : la hauteur était ignorée (seule l'avancée était comparée), d'où « dimensions non indiquées » pour 10 relevés sur 10. (2) Implantation exigée pour les screens et stores, qui n'ont qu'une seule pose, d'où « implantation non indiquée » pour 10 relevés sur 10. (3) Notre propre screen était compté « absent » du panier HelioScreen, d'où un écart « screen » sur les 10 relevés. (4) Configuration HelioSun/HelioShade sans télécommande face à un marché radio, sans le dire. |
| **Règles trop restrictives** | Comparabilité binaire (seule « forte » retenue) mêlant jugement technique et périmètre ; livraison comprise = exclusion totale ; aucune distinction entre comparaison directe, indicative et contexte ; minimum de trois offres fortes avant toute fourchette. |
| **Données mal collectées** | HT/TTC non établi (PERGOLUX, Sunny Inch), prix « à partir de » au lieu d'un prix configuré, cotes incomplètes, motorisation non lue. |
| **Données réellement insuffisantes** | Un seul relevé pour HelioSky (largeur 3,5 m unique), HelioRoof et HelioSquare ; aucun revendeur du même système fournisseur ; aucun pays hors France. |

Pertinence des filtres conservés (aucun n'est gardé « parce qu'il existe ») :

| Filtre | Décision | Pourquoi |
|---|---|---|
| Cotes à ±10 %, sans normalisation au m² | conservé | Le prix d'un store ou d'une pergola n'est pas proportionnel à la surface. Entre 10 et 25 % d'écart, l'offre est montrée en contexte (C). |
| Implantation (autoportante / adossée) | conservé pour les pergolas, retiré pour les produits à pose unique | Une pergola autoportante coûte plus cher, avec deux poteaux et une poutre en plus. |
| Motorisation manuelle / motorisée | conservé | L'écart de prix est structurel. Radio et filaire restent comparables, avec la différence documentée. |
| Livraison | **assoupli** | Livraison inconnue : produit seul comparé. Livrée sans montant : prix observé conservé, signalé, en usage indicatif. Aucune déduction inventée. |
| HT/TTC inconnu | conservé | Un montant dont on ignore la base fiscale ne peut pas être ramené au HT. Il reste affiché, hors calcul. |
| Prix « à partir de » | conservé (niveau D) | La configuration n'est pas identifiable. |
| Promotion | **précisé** | Promotion datée : comparaison au prix normal. Sans date de fin, ou « prix conseillé » barré : comparaison au prix payé, prix barré affiché. |
| Ancienneté | conservé, avec un palier | « À revérifier » à la moitié du seuil réglable de la politique (120 jours par défaut), « périmé » au-delà. |
| Minimum de trois offres | **déplacé** | Aucun minimum pour afficher une fourchette. Trois vendeurs directs indépendants minimum pour aligner le prix conseillé sur le marché. |

## 2. Outils de collecte

Inventaire avant installation : WebSearch, WebFetch, `curl`, Playwright (déjà présent pour les tests), Python
(pdfplumber de l'audit tarifaire), scripts d'import existants (`scripts/market-observations.ts`, import CSV de
l'administration).

**Plugin Apify pour Claude Code** : vérifié sur la documentation officielle (apify.com/plugin, docs.apify.com,
2026-11-19).
- Le plugin est gratuit et open source.
- Il exige un compte Apify (connexion OAuth au premier usage).
- Chaque exécution d'un collecteur consomme des crédits de la plateforme.
- Il n'existe pas de collecteur dédié aux configurateurs de stores ou de pergolas.
- Les collecteurs génériques reposent sur des proxys rotatifs, ce qui contourne les protections anti-bot (exclu par
  la mission).

**Décision : non installé, non utilisé.** Les configurateurs ont été pilotés avec Playwright (prix de la
configuration sélectionnée, capture privée).

Aucun service payant, aucune clé, aucun compte n'a été utilisé.

## 3. Périmètre réellement étudié (collecte du 2026-11-19)

Ce n'est **pas** une étude européenne exhaustive. Il s'agit de quatre lots, d'environ 60 requêtes web chacun, sur
les pages publiques consultées.

| Pays | Sites ayant fourni des relevés | Remarques |
|---|---|---|
| France | Rue du Store, Usine Online, Sunny Inch, Castorama, Brico Dépôt, Vente-unique, Truffaut (plus les 107 relevés du 04-13/11) | Leroy Merlin (captcha) et Mr Bricolage (403) inaccessibles ; PERGOLUX : aucune mention HT/TTC trouvée, nouveaux relevés non ajoutés |
| Belgique | Zelfbouwmarkt, Ekstravert, Brico.be, fenetre24 | gamma.be inaccessible (429) |
| Allemagne | DM Handel, markise24 et fenster-sparfuchs (une seule société), steg-platten, Rollo Rieper, BAUR, Fensterwerke³, Terrassendach-Buddy | hornbach.de (anti-bot) et ebay.de (403) inaccessibles ; Markilux et Weinor : prix sur devis |
| Pays-Bas | Uit Holland, Praxis, Toppy (contexte HelioSlide) | hornbach.nl (anti-bot) et gamma.nl (429) inaccessibles ; zonweringtekoop : prix sans cotes ni TVA |
| Espagne | aucune | leroymerlin.es (403) ; cortinadecor : page supprimée |
| Pologne (revendeurs du même système, livraison UE à vérifier) | e-markizy (une seule société, aussi shopsun), dopasujrolety | sunoff.pl et e-markizy.eu : TLS invalide |
| Royaume-Uni | non étudié | groupe distinct prévu par le moteur |

Sources inaccessibles : aucune n'a été contournée. Fabricants (aluprof.com) : aucun prix public, vente par
installateurs.

## 4. Méthode : niveaux, usages et calcul

Une comparaison porte sur une **configuration précise**. Pour chaque produit sont étudiées :
- la configuration d'appel ;
- des tailles courantes réellement disponibles (`BENCH_SIZES`), ramenées aux valeurs autorisées et validées par le
  moteur. Une taille indisponible n'est pas forcée et la raison est affichée.

Stores bannes : la motorisation radio est « à chiffrer » dans notre catalogue. La commande motorisée entièrement
chiffrée (filaire) est donc étudiée, et l'écart radio est documenté.

### Niveaux

| Niveau | Définition | Usage |
|---|---|---|
| A — même système | Système fournisseur **cité par la page**, cotes à ±10 %, même implantation et même motorisation, périmètre connu ou ajustable par des montants documentés | Comparaison directe. Elle pilote le prix conseillé à partir de trois vendeurs indépendants. |
| B — équivalent technique | Même catégorie et usage, cotes et équipements proches, différences listées | Fourchette indicative |
| C — alternative commerciale | Même besoin, différences importantes : entrée de gamme, autre toiture, autre coffre, manuel face à motorisé, autres cotes | Contexte, hors calcul |
| D — non exploitable | Prix « à partir de », cotes absentes, devise sans conversion datée, fiche incohérente, rejet | Exclu |

Le niveau proposé par l'analyste est **plafonné** par les données de chaque configuration, et chaque plafond est
expliqué.

Trois dimensions sont gardées à part du niveau :
- la fraîcheur : récent, à revérifier ou périmé ;
- la qualité de la preuve : capture et extrait, extrait cité, URL seule ;
- la complétude du prix : produit seul, livraison inconnue, livré, posé, HT/TTC.

Aucun score en pourcentage n'est calculé.

Règles de périmètre :
- **Livraison inconnue** : produit seul comparé, aucune conclusion sur le coût livré.
- **Livraison comprise sans montant** : prix observé conservé, signalé.
- **Pose comprise sans montant** : comparée à part.
- **TVA inconnue** : jamais convertie.
- **TTC étranger** : ramené au HT par le taux normal de son pays (FR 20, BE 21, DE 19, NL 21, ES 21, PL 23 %).
- **Devise étrangère** : montant d'origine et conversion datée et sourcée (taux BCE, unités de devise pour 1 €).
- **Prix local hors France et Belgique** : indicatif tant que la livraison vers la France ou la Belgique n'est pas
  citée.
- **Équipement inconnu** : ni inclus ni absent.

Indépendance et doublons :
- une société vendeuse compte **une fois**, quel que soit le nombre de ses annonces ou de ses domaines ;
- les doublons (même vendeur, modèle, cotes) ne comptent pas ;
- une offre atypique (hors de la moitié à deux fois la médiane) est signalée et sortie du calcul.

### Recommandation (affichée séparément)

1. **Prix à la marge cible** : achat net ÷ (1 − 25 %). La remise de 37 % ne s'applique qu'aux postes éligibles
   confirmés. Les moteurs, télécommandes et centrales d'éligibilité inconnue gardent leur prix de vente : la marge
   est alors « non garantie ».
2. **Positionnement marché** : fourchette des vendeurs directs dès trois vendeurs, sinon fourchette indicative
   (directs et équivalents), avec effectifs et vendeurs exclus.
3. **Prix conseillé** :
   - la marge cible par défaut ;
   - la médiane des vendeurs directs à partir de trois vendeurs indépendants, jamais sous le plancher ;
   - sinon la fourchette sert de repère.
   - Si le marché est sous la marge cible, le **conflit est affiché**, jamais masqué.
4. **Marge estimée** au prix conseillé, avant et après l'arrondi commercial TTC (terminaison 99 €, sur le total
   seulement, règle et tests existants). La marge brute n'est pas un bénéfice net : un coût inconnu ne vaut jamais
   zéro.

Rien n'est publié automatiquement. « Préparer un brouillon » crée une proposition et un brouillon de grille qui ne
modifie **que la cellule** de la configuration, affichée avant l'action. La publication reste manuelle dans Tarifs.

## 5. Collecte et preuve

Chaque relevé enregistre :
- l'URL, le vendeur (et sa société), le fabricant et le système cité ;
- le pays, la langue et la devise ;
- la date et la méthode de collecte ;
- la configuration : cotes et unités, implantation, toiture ou toile, commande, moteur et télécommande, LED, capteurs,
  fermetures ;
- les prix normal et promotionnel, avec date et conditions ;
- la base fiscale, la conversion de devise, la livraison et la pose ;
- la garantie et les caractéristiques documentées ;
- les différences et les champs inconnus ;
- des citations mot pour mot et une capture privée ;
- le statut de validation (à valider, validé, à revérifier, rejeté).

Les faits (citations, montants) sont séparés des interprétations (niveau, raison, différences). Le contenu des sites
concurrents est traité comme une donnée non fiable.

Format des lots : JSON `{ lot, collectedAt, records: [...], sources: [...] }`, dont les champs sont ceux de
l'administration (export CSV). Contrôle avant import :
- `scripts/market/check-lot.ts` vérifie le schéma, la présence du montant dans les citations, la capture, les doublons
  et les niveaux A sans système cité ;
- une relecture humaine d'un échantillon (au moins un relevé par vendeur de niveau A) complète le contrôle ; les
  corrections tracées sont dans `revue.py` (privé).

Import : `scripts/market-observations.ts`.
- Il est idempotent.
- Une offre relevée de nouveau archive l'ancienne (historique conservé).
- L'empreinte des prix publics est identique avant et après.
- L'import CSV administratif accepte les anciens exports (colonnes du benchmark facultatives) et contrôle chaque ligne.

Aucune collecte n'a lieu au chargement d'une page d'administration. Aucune tâche planifiée n'est créée : la mise à
jour est manuelle, par le skill.

## 6. Résultats avant / après (copie isolée de la production, puis production)

| | Avant | Après |
|---|---|---|
| Relevés actifs | 107 (FR) | 183 (FR 121, BE 12, DE 22, NL 3, PL 25) |
| Anciens relevés reclassés (à valider) | — | 106 actifs : B 39, C 45, D 22 (1 ancien relevé remplacé par une nouvelle lecture de la même offre) |
| Nouveaux relevés | — | 77 : A 44, B 19, C 14 |
| Sociétés vendeuses distinctes | 16 revendeurs (marketplaces confondues) | 48 |
| Produits comparés | 0 / 9 | 9 / 9 (au moins une configuration avec fourchette) |
| Produits avec comparaison directe (même système) | 0 | 4 : HelioMax, HelioScreen, HelioRoof et HelioSun (manuel), en majorité « produit seul — livraison inconnue » |

Par produit (niveaux du meilleur classement de chaque relevé) :

| Produit | A | B | C | D | Lecture |
|---|---:|---:|---:|---:|---|
| HelioSky | 9 | 4 | 1 | 2 | revendeurs SB350 allemands, livraison vers la France ou la Belgique non citée : indicatif |
| HelioMax | 4 | 13 | 22 | 21 | un revendeur SB450 (Pologne, livre l'UE, coût de livraison inconnu) |
| HelioLux | 0 | 4 | 18 | 5 | aucun revendeur SOLID à prix public ; équivalents à toile rétractable |
| HelioScreen | 8 | 6 | 5 | 4 | revendeurs R120 ZiiiP (DE, PL) |
| HelioRoof | 2 | 0 | 0 | 1 | un revendeur VERANDA V ZiiiP (PL) |
| HelioSun | 2 | 15 | 7 | 4 | revendeurs CASABLANCA (PL) ; notre radio est « à chiffrer » |
| HelioShade | 0 | 2 | 8 | 0 | aucun semi-coffre sur mesure à prix public |
| HelioPro | 0 | 4 | 4 | 1 | équivalents à bras sans coffre |
| HelioSquare | 0 | 4 | 0 | 1 | revendeur MADEIRA (B : télécommande comprise chez lui, non établie chez nous) |

Les montants, positions et conflits marge / marché se lisent dans l'administration et dans le rapport privé.
Constat principal : le marché du même système observé en Pologne et en Allemagne est nettement sous nos prix à la
marge cible sur plusieurs produits. Il est affiché comme **conflit**, sans modification de prix. Ses limites :
livraison vers la France non chiffrée, TVA étrangère, vendeurs uniques.

## 7. Limites et dépendances externes

- **Prix publics du même système en France et en Belgique** : aucun trouvé. Il faudrait un réseau d'installateurs
  ou un accès revendeur, ou des devis demandés par le client lui-même (jamais par l'outil).
- **Coût de livraison des revendeurs polonais et allemands vers la France ou la Belgique** : affiché seulement au
  panier, non relevé (aucun panier). À obtenir par le client.
- **Mention HT/TTC de PERGOLUX** : absente de leurs pages. À confirmer auprès du vendeur.
- **Coûts réels** (livraison, pose, paiement, acquisition, SAV) et **éligibilité à la remise** des moteurs,
  télécommandes, centrales et LED : à confirmer par le fournisseur. Sans eux, la marge reste prudente ou non
  garantie.
- **Validation humaine** des 106 anciens relevés reclassés automatiquement (« à valider ») et des nouveaux relevés.
- **Couverture à étendre** : Espagne et Pays-Bas (sources bloquées ou sans prix configuré), configurateurs français
  non encore pilotés (Storistes, Franciaflex direct, Renson), Royaume-Uni.
- **Budget** : aucun nécessaire pour la méthode actuelle. Un collecteur payant (Apify ou équivalent) n'apporterait
  de valeur qu'avec un budget explicite et sans contournement de protection.
