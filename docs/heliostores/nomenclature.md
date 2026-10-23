# Nomenclature commerciale HELIOSTORES

Décision client du 2026-10-22 : le site présente les produits et équipements sous des noms commerciaux
HELIOSTORES. Les références du fournisseur restent des données internes, consultables dans l'administration
(bloc « Correspondance fournisseur » de la fiche famille) et dans les sources. Elles ne sont jamais envoyées au
navigateur.

Code : `src/domain/nomenclature.ts` (noms publics), `src/server/catalog/legacy-slugs.ts` (anciens identifiants,
redirections), `src/server/catalog/heliostores-data.ts` (contenus), `src/domain/public-sanitize.ts` (filtre public
et garde-fou `PUBLIC_FORBIDDEN_NAMES`).

## Produits

| Réf. fournisseur (interne) | Nom commercial | Famille | URL canonique | Ancienne URL (redirection 308) |
|---|---|---|---|---|
| SB 400 (SunBreaker 400) | HELIO Horizon | Pergolas | `/pergolas/helio-horizon` | `/pergolas/pergola-sb400` |
| SB500 (SunBreaker 500) | HELIO Panorama | Pergolas | `/pergolas/helio-panorama` | `/pergolas/pergola-sb500` |
| REFLEKSOL 120 ZiiiP | HELIO Ombra | Screens | `/screens/helio-ombra` | `/screens/screen-refleksol-120-ziiip` |
| CASABLANCA | HELIO Riviera | Stores bannes | `/stores-bannes/helio-riviera` | `/stores-bannes/store-banne-casablanca` |
| VERANDA FTS | HELIO Verrière (appellation réservée) | aucune | aucune page (brouillon) | aucune (404, comme avant) |
| CORSICA | HELIO Azur (proposition, 2026-10-23) | Stores bannes | aucune page (brouillon) | — |

Les configurateurs suivent le même schéma : `/configurateur/<ancien>` est redirigé vers `/configurateur/<nouveau>`.
La requête est conservée (`?projet=…`, `?ligne=…`). `/devis?produit=<ancien>` est redirigé vers
`/devis?produit=<nouveau>`. Aucune redirection ne pointe vers une autre source de redirection : il n'y a donc pas de
boucle (test `tests/unit/nomenclature.test.ts`).

HELIO Verrière garde son statut brouillon et reste hors catalogue : pas de famille publique, pas de prix public,
pas de page ni de configurateur.

## Séparation des données

| Donnée | Rôle | Public |
|---|---|---|
| `id` (clé primaire), SKU | identifiants techniques, **inchangés** | non |
| `slug` | identifiant public et segment d'URL, renommé (`helio-…`) | oui |
| `name`, descriptions, SEO, FAQ, libellés des règles | contenu commercial | oui |
| `supplierRef` (famille, moteur, équipement) | désignation exacte du fournisseur | non |
| `manufacturer`, `brand` | fabricant et marque établis par les sources | non |
| `sources`, `sourceRef`, questions ouvertes | traçabilité | non |
| caractéristique `manufacturer_reference` | traçabilité | non (filtrée par `publicSpecs`) |

Les pages publiques, l'instantané du configurateur et les données structurées passent par `publicSystemRules` et
`publicSpecs`. Ces fonctions retirent `sources`, `supplierRef` et les caractéristiques internes. La fiche n'affiche
plus de ligne « Référence » (remplacée par « Gamme »).

## Motorisations

Le libellé public est « Motorisation radio » uniquement quand la référence nomme le protocole radio (RTS ou io).
Dans les autres cas, il est « Motorisation électrique ». Aucune source ne confirme une commande filaire : le libellé
« Motorisation filaire » n'est donc pas employé. Les modèles qui imposent des largeurs minimales ou des câbles
différents restent des choix distincts. Aucun moteur n'est présenté comme fabriqué par HELIOSTORES.

| Produit | Ancien code | Nouveau code | Libellé public | Désignation fournisseur (interne) |
|---|---|---|---|---|
| HELIO Panorama | `elero_picolo_xl_rts` | `radio_rts` | Motorisation radio — commande RTS | Moteur Elero Picolo XL — commande RTS |
| HELIO Panorama | `elero_picolo_xl_io` | `radio_io` | Motorisation radio — commande io | Moteur Elero Picolo XL — commande IO |
| HELIO Panorama | `pergola_24v_io` | `motor_24v_io` | Motorisation 24 V — commande radio io uniquement | Moteur Pergola 24 V — commande IO uniquement |
| HELIO Ombra | `m45_10_26` | `electric_1` | Motorisation électrique — modèle 1 | Moteur M45-10/26 |
| HELIO Ombra | `variieco_m_10_14` | `electric_2` | Motorisation électrique — modèle 2 | Moteur VariEco M 10/14 |
| HELIO Ombra | `jet_10_17` | `electric_3` | Motorisation électrique — modèle 3 | Moteur Jet 10/17 |
| HELIO Ombra | `suntop_m` | `electric_4` | Motorisation électrique — modèle 4 | Moteur SunTop M |
| HELIO Ombra | `altus_wt` | `electric_5` | Motorisation électrique — modèle 5 | Moteur Altus WT |
| HELIO Ombra | `dm45eaf_s_10_26` | `electric_6` | Motorisation électrique — modèle 6 | Moteur DM45EAF/S-10/26 |
| HELIO Ombra | `suntop_868_m_10_14` | `electric_7` | Motorisation électrique — modèle 7 | Moteur SunTop 868 M 10/14 |
| HELIO Ombra | `altus_50_rts_10_17` | `radio_rts` | Motorisation radio — commande RTS | Moteur Altus 50 RTS 10/17 |
| HELIO Ombra | `sunilus_scr_io_10_17` | `radio_io` | Motorisation radio — commande io | Moteur SUNILUS SCR IO 10/17 |
| HELIO Verrière | `two_motors_fts` | `two_motors` | Motorisation électrique — deux moteurs et contrôleur | deux moteurs + contrôleur FTS |
| HELIO Horizon | (inclus) | — | Motorisation électrique 24 V | Moteur 24 V |
| HELIO Riviera | `electric` | inchangé | Motorisation électrique (moteur à définir) | — |

Les codes ont changé parce qu'ils partaient au navigateur (valeurs des listes du configurateur). Les configurations
enregistrées et les paniers ont été migrés : le choix du client est conservé.

## Équipements

| Nom | Appliqué à | Descriptif | Désignation fournisseur |
|---|---|---|---|
| HELIO Pilot | HELIO Horizon (inclus) | télécommande radio 1 ou 6 canaux, qui ouvre, ferme et oriente les lames | Commande radio BleBox 1 ou 6 canaux |
| HELIO Pilot | HELIO Panorama (inclus) | télécommande radio 5 canaux | Commande radio 5 canaux |
| HELIO Lumière | HELIO Horizon, HELIO Panorama (option) | bandeau LED périphérique (COB 3200 K) ; spots LED dans les lames | Éclairage LED périphérique ; spots LED |
| HELIO Vent / HELIO Soleil | HELIO Ombra (option, à confirmer) | automatisme qui relève le screen par vent fort et le déroule selon l'ensoleillement | Automatisme (capteurs vent / soleil) |

Complété le 2026-10-23 (retour client du 2026-10-21), toutes options **sur devis** :

| Nom | Appliqué à | Prérequis | Désignation fournisseur (interne) | Statut |
|---|---|---|---|---|
| HELIO Connect — box de pilotage par smartphone | HELIO Horizon, HELIO Ombra, HELIO Riviera | commande radio io compatible (documentée pour la version io de la pergola ; listée seulement pour le screen et le store) | TaHoma Switch | à confirmer |
| HELIO Vent / HELIO Soleil | HELIO Horizon (capteurs vent et soleil), HELIO Ombra, HELIO Riviera (vent-soleil), HELIO Azur | motorisation ; capteur compatible avec le moteur | Eolis io, Soliris io, Sunis io (pergola io) ; automatisme vent-soleil (store) | à confirmer |
| Capteur de pluie | HELIO Horizon | commande radio io | Ondeis 24V | à confirmer |
| Capteur de vibrations | HELIO Riviera | motorisation | capteurs de choc listés par le fabricant | à confirmer |
| HELIO Pilot — télécommande radio | HELIO Riviera (niveau Confort) | motorisation | émetteur de commande à distance | à confirmer |
| HELIO Lumière | HELIO Azur (profil bas, bras éclairés) | commande d'éclairage à définir | LED profil bas ; bras LED 3100 / 3600 mm | à confirmer |

Non appliqués : **HELIO Confort** (aucun appareil de chauffage documenté ; seul un récepteur pour radiateurs existe
pour la version io de la pergola, et la notice interdit les sources de chaleur par convection sous le toit) ; éclairage
LED sur HELIO Riviera (non proposé par le fabricant).

**Comportement au vent, propre à chaque système** (`rules.wind`) : store banne replié (HELIO Riviera) ; screen relevé
dans son coffre (HELIO Ombra) ; lames ouvertes ou fermées selon les côtés, à confirmer (HELIO Horizon) ; non documenté
(HELIO Panorama).

**Stores bannes : niveaux** — HELIO Riviera Essentiel (manivelle) et Confort (motorisé, télécommande ; automatisme en
option) sont deux équipements du **même** store ; Premium = **HELIO Azur** (réf. CORSICA), autre modèle, en brouillon.
Comparatif : `retour-client-2026-10-21.md`.

## Migration des données (`prisma/migrations/20261022090000_heliostores_nomenclature`)

**Mis à jour** (références vivantes) :
- slug des familles ;
- règles de compatibilité ;
- tarifs de pose, promotions, grilles ;
- réalisations ;
- lignes de tarif fournisseur ;
- cibles de validation (`<slug>#<clé>`) ;
- fermetures souhaitées des règles ;
- configurations enregistrées (`input` et `result.input`) ;
- lignes de panier.

**Non modifiés** (historique émis) :
- instantanés des devis et lignes de commande : un devis déjà émis garde le nom qu'il portait ;
- visuels de devis, e-mails ;
- journaux d'audit, événements de validation.

Les nouveaux devis, e-mails et PDF utilisent les noms commerciaux. Le migrateur refuse de s'exécuter si un ancien et
un nouveau slug coexistent. Il a été vérifié sur une copie de la base de dev, avec des lignes de contrôle (slug,
code moteur, fermeture souhaitée) ; un second passage est sans effet.

## Mentions fournisseur conservées

- **Documents officiels** : 14 documents du fabricant (déclarations des performances, suppléments techniques,
  notices, brochures). Ce sont des liens vers le site du fabricant, archivés et absents du site depuis le
  2026-10-21. Leurs titres et numéros n'ont pas été modifiés.
- **Sources et traçabilité** : registre `SOURCES`, `sourceRef`, crédits et provenance des médias, questions
  ouvertes, notes de validation, `docs/heliostores/*.md`. Ces données sont internes et nécessaires pour prouver
  l'origine des valeurs.
- **Termes techniques publics conservés** :
  - **RTS / io** : protocoles radio. Information de compatibilité utile pour une télécommande existante ; RTS
    renvoie à un fabricant de moteurs, pas au fournisseur des produits.
  - **chaîne Flyer** : type de chaîne.
  - **Soltis, Sunworker, Serge, Polyscreen** : collections de toiles de fabricants de tissus tiers.
  - **Codes de teinte** : RAL, FSM, DB, VSR.
  - **Normes** : EN 1090, EN 13561, EN 13659.
  - **Le mot générique « fabricant »**, sans nom.

## Visuels

Les 41 visuels publiés ont été contrôlés sur planche contact. Aucun ne porte de logo ni de texte du fournisseur.
Les fichiers servis sont réencodés : pas de bloc EXIF ou XMP, et un nom de fichier haché. Les textes alternatifs et
légendes emploient les noms commerciaux.

Ces visuels restent des photos et rendus du fournisseur. Un connaisseur peut reconnaître le dessin d'un produit (par
exemple les joues ovales du coffre de HELIO Riviera) ou retrouver une image publiée ailleurs. Ils ne sont jamais
présentés comme des réalisations HELIOSTORES : la rubrique « Réalisations » reste fermée.
