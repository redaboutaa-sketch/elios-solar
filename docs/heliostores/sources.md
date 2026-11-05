# Sources et matrice des données HELIOSTORES

Généré depuis `src/server/catalog/heliostores-data.ts`. Une valeur est **établie** quand toutes les sources qui font autorité concordent : fiche du modèle transmise par le client, document fournisseur et site du fabricant. Sinon elle est **à confirmer** et les deux valeurs restent visibles. Aucun tarif ne figure ici ; la revue tarifaire publiable est dans `revue-tarifaire.md`.

## Registre des sources

| Identifiant | Source | Lien |
|---|---|---|
| `fiche-sb400` | Fiche technique PERGOLA SB400 (transmise par le client) | fichier transmis (privé) |
| `fiche-sb500` | Fiche technique PERGOLA SB500 (transmise par le client) | fichier transmis (privé) |
| `fiche-refleksol-120-ziiip` | Fiche technique REFLEKSOL 120 ZIIP (transmise par le client) | fichier transmis (privé) |
| `fiche-casablanca` | Fiche technique STORE BANNE CASABLANCA (transmise par le client) | fichier transmis (privé) |
| `fiche-veranda-fts` | Fiche technique VERANDA FTS (transmise par le client) | fichier transmis (privé) |
| `catalogue-sb400` | Catalogue PERGOLA SB400 (extrait, 2 p.) | fichier transmis (privé) |
| `catalogue-thysens` | Catalogue THYSENS (collection SELT, 161 p.) | fichier transmis (privé) |
| `aluprof-sb-400` | Page fabricant ALUPROF « SB 400 » | https://aluprof.com/en/product/sb-400 |
| `aluprof-r120-ziiip` | Page fabricant ALUPROF « R 120 ZiiiP » | https://aluprof.com/en/product/refleksol-120-ziiip |
| `aluprof-casablanca` | Page fabricant ALUPROF « CASABLANCA AWNING » | https://aluprof.com/en/product/casablanca-awning |
| `aluprof-veranda` | Page fabricant ALUPROF « Veranda » | https://aluprof.com/en/product/veranda |
| `aluprof-selt` | ALUPROF — « Aluprof and Selt join forces » (2025-12-09) | https://aluprof.com/en/company/news/aluprof-and-selt-join-forces |
| `dop-pd-sb400-25` | Déclaration des performances PD/SB400/25 (ALUPROF, 2025-12-05) | fichier transmis (privé) |
| `dop-p-sb400-25` | Déclaration des performances P/SB400/25 — structure (ALUPROF) | fichier transmis (privé) |
| `dop-52-rz-2024` | Déclaration des performances 52/RZ/2024 (SELT) et 30/RZ/2023 | fichier transmis (privé) |
| `dop-08-m-2018` | Déclaration des performances 08/M/2018 (SELT) | fichier transmis (privé) |

## Pergola SB400 (`pergola-sb400`) — PERGOLAS

Référence : SB 400 (SunBreaker 400) · Fabricant : ALUPROF SA (usine d'Opole, ex-SELT) · Marque : SELT by Aluprof

| Caractéristique | Valeur | Source | Localisation | Statut |
|---|---|---|---|---|
| Largeur maximale d'un module | 4 m | Document fournisseur | Catalogue THYSENS p. 11 ; catalogue SB400 p. 2 | établi |
| Largeur maximale d'un module | 4 m | Site du fabricant | aluprof.com/en/product/sb-400 — Maximum width | établi |
| Largeur minimale d'un module | 1,4 m | Document fournisseur | Catalogue THYSENS p. 11 | établi |
| Largeur minimale d'un module | 1,4 m | Fiche du modèle (client) | Fiche SB400 — Spécifications | établi |
| Projection maximale d'un module | 7 m | Document fournisseur | Catalogue THYSENS p. 10–11 | établi |
| Projection maximale d'un module | 7 m | Site du fabricant | aluprof.com/en/product/sb-400 — Maximum projection | établi |
| Projection minimale | 1,4 m | Document fournisseur | Catalogue THYSENS p. 11 | établi |
| Projection minimale | 1,4 m | Fiche du modèle (client) | Fiche SB400 — Spécifications | établi |
| Pas de projection | 200 mm | Fiche du modèle (client) | Fiche SB400 — « disponible tous les 20 cm » | établi |
| Pas de projection | 200 mm | Site du fabricant | aluprof.com/en/product/sb-400 — « multiple of the blade interval (20 cm) » | établi |
| Hauteur maximale | 2,8 m | Document fournisseur | Catalogue SB400 p. 1 (schéma) ; THYSENS p. 10 | établi |
| Hauteur maximale | 2,8 m | Site du fabricant | aluprof.com/en/product/sb-400 — Maximum height | établi |
| Section du poteau | 85 × 150 mm | Document fournisseur | Catalogue SB400 p. 1 ; THYSENS p. 10 | établi |
| Section de la poutre | 85 × 212 mm | Document fournisseur | Catalogue SB400 p. 1 ; THYSENS p. 10 | établi |
| Section de la lame | 216 × 40 mm | Document fournisseur | Catalogue SB400 p. 1 ; THYSENS p. 10 | établi |
| Construction | aluminium extrudé avec éléments en acier | Document fournisseur | Catalogue THYSENS p. 11 | établi |
| Évacuation des eaux | intégrée à la structure | Document fournisseur | Catalogue THYSENS p. 11 | établi |
| Normes de construction citées | PN-EN 1090 et PN-EN 13659 | Document fournisseur | Catalogue THYSENS p. 11 | établi |
| Résistance au vent (EN 13561) | classe 3 ; classe 6 selon EN 13561:2015 (propriété complémentaire) | Document fournisseur | Déclaration des performances PD/SB400/25 (ALUPROF, 2025-12-05) | établi |
| Structure (EN 1090-1) | classe d'exécution EXC2 (acier) | Document fournisseur | Déclaration des performances P/SB400/25 | établi |
| Rotation des lames | 120° ± 2° | Site du fabricant | aluprof.com/en/product/sb-400 | établi |
| Système modulaire | oui | Site du fabricant | aluprof.com/en/product/sb-400 — Modular system | établi |
| Panneaux latéraux cités par le fabricant | Slide, systèmes Ziiip ou Sunbreaker 210 | Site du fabricant | aluprof.com/en/product/sb-400 | établi — Modèles et fixations non précisés : étude au devis. |
| Motorisation | moteur 24 V inclus | Fiche du modèle (client) | Fiche SB400 — Structure incluse | établi |
| Commande | radio BleBox 1 ou 6 canaux, incluse | Fiche du modèle (client) | Fiche SB400 — Structure incluse | établi |
| Joints | noirs uniquement | Fiche du modèle (client) | Fiche SB400 — Spécifications | établi |
| Teintes standard | RAL 9016 mat, FSM 71319, RAL 7016 mat | Document fournisseur | Catalogue THYSENS p. 10 ; catalogue SB400 p. 1 | établi |

Règles du configurateur (sources détaillées dans `systemRules`) :
- Largeur : 1400–4000 mm — fiche-sb400 (Spécifications) ; catalogue-sb400 (p. 2) ; catalogue-thysens (p. 11)
- Projection : 1400–7000 mm, pas 200 mm — fiche-sb400 (Spécifications : « disponible tous les 20 cm ») ; aluprof-sb-400 (« module projection is a multiple of the blade interval (20 cm) ») ; catalogue-sb400 (p. 2) ; catalogue-thysens (p. 11)
- Hauteur de passage : min. non documenté–2800 mm — aluprof-sb-400 (Maximum height 2.8 m) ; catalogue-sb400 (p. 1, schéma « max 2.8 m ») ; catalogue-thysens (p. 10)

## Pergola SB500 (`pergola-sb500`) — PERGOLAS

Référence : SB500 (SunBreaker 500) · Fabricant : SELT (fusionnée avec ALUPROF SA) · Marque : SELT

| Caractéristique | Valeur | Source | Localisation | Statut |
|---|---|---|---|---|
| Largeur maximale d'un module | 5 m | Document fournisseur | Catalogue THYSENS p. 6–7 | établi |
| Largeur minimale d'un module | 1,4 m | Document fournisseur | Catalogue THYSENS p. 7 | établi |
| Largeur minimale d'un module | 1,4 m | Fiche du modèle (client) | Fiche SB500 — Spécifications | établi |
| Projection maximale d'un module | 7 m | Document fournisseur | Catalogue THYSENS p. 6–7 | établi |
| Projection minimale | 2 m | Document fournisseur | Catalogue THYSENS p. 7 | établi |
| Projection minimale | 2 m | Fiche du modèle (client) | Fiche SB500 — Spécifications | établi |
| Pas de projection | 250 mm | Fiche du modèle (client) | Fiche SB500 — « disponible tous les 25 cm » | établi |
| Hauteur maximale | 3,2 m | Document fournisseur | Catalogue THYSENS p. 6 (schéma) | établi |
| Section du poteau | 150 × 150 mm | Document fournisseur | Catalogue THYSENS p. 6 | établi |
| Section de la poutre | 150 × 290 mm | Document fournisseur | Catalogue THYSENS p. 6 | établi |
| Assemblage modulaire | possible | Document fournisseur | Catalogue THYSENS p. 7 | établi |
| Gouttières | 2 incluses, sans évacuation | Fiche du modèle (client) | Fiche SB500 — Spécifications | établi |
| Motorisation | Elero Picolo XL (RTS ou IO) ou Pergola 24 V (IO uniquement) | Fiche du modèle (client) | Fiche SB500 — Motorisation | établi |
| Commande | radio 5 canaux, incluse | Fiche du modèle (client) | Fiche SB500 — Structure incluse | établi |
| Joints | noirs uniquement | Fiche du modèle (client) | Fiche SB500 — Spécifications | établi |
| Normes de construction citées | EN 1090 et EN 13659 | Document fournisseur | Catalogue THYSENS p. 7 | établi — Mention du catalogue ; aucun certificat ni déclaration de performance n'a été transmis. |
| Teintes standard | RAL 9016 mat, FSM 71319, RAL 7016 mat | Document fournisseur | Catalogue THYSENS p. 6 | établi |

Règles du configurateur (sources détaillées dans `systemRules`) :
- Largeur : 1400–5000 mm — fiche-sb500 (Spécifications) ; catalogue-thysens (p. 7)
- Projection : 2000–7000 mm, pas 250 mm — fiche-sb500 (Spécifications : « disponible tous les 25 cm ») ; catalogue-thysens (p. 7)
- Hauteur de passage : min. non documenté–3200 mm — catalogue-thysens (p. 6, schéma « max 3.2 m »)

## Screen REFLEKSOL 120 ZiiiP (`screen-refleksol-120-ziiip`) — SCREENS

Référence : REFLEKSOL 120 ZiiiP (ALUPROF « R 120 ZiiiP ») · Fabricant : ALUPROF SA (usine d'Opole, ex-SELT) · Marque : SELT by Aluprof

| Caractéristique | Valeur | Source | Localisation | Statut |
|---|---|---|---|---|
| Largeur maximale | 7 m | Document fournisseur | Catalogue THYSENS p. 66 | **contradiction — à confirmer** |
| Largeur maximale | 4 m | Fiche du modèle (client) | Fiche REFLEKSOL — « 400 cm (barre anti-vent) / 350 cm (guidage câble) » | **contradiction — à confirmer** — Contradiction avec le catalogue (7 m) ; le guidage câble ne correspond pas au mécanisme ZiiiP. |
| Largeur maximale | 7 m | Site du fabricant | aluprof.com/en/product/refleksol-120-ziiip — Maximum width | **contradiction — à confirmer** |
| Hauteur maximale | 4 m | Document fournisseur | Catalogue THYSENS p. 66 | établi |
| Hauteur maximale | 4 m | Fiche du modèle (client) | Fiche REFLEKSOL — Spécifications | établi |
| Hauteur maximale | 4 m | Site du fabricant | aluprof.com/en/product/refleksol-120-ziiip — Maximum height | établi — Le texte de la même page indique « height of up to 3 m ». |
| Coffre | aluminium extrudé, 126 × 126 mm | Document fournisseur | Catalogue THYSENS p. 66 | établi |
| Résistance au vent | classe 6 (classe 4 au-delà de 4 001 mm de largeur) | Document fournisseur | Catalogue THYSENS p. 67 | établi |
| Résistance au vent déclarée (EN 13659) | classe 6 (480 Pa) jusqu'à 400 × 400 cm ; classe 4 (204 Pa) de 400 à 500 cm × ≤ 300 cm ; classe 2 (84 Pa) pour 700 × 400 cm | Document fournisseur | Déclarations des performances 52/RZ/2024 et 30/RZ/2023 (SELT) — lecture visuelle de documents numérisés | établi |
| Commande | électrique uniquement | Document fournisseur | Catalogue THYSENS p. 66 | établi |
| Commande | électrique uniquement | Fiche du modèle (client) | Fiche REFLEKSOL — Spécifications | établi |
| Usage | extérieur | Document fournisseur | Catalogue THYSENS p. 66 | établi |
| Grandes largeurs | technologie ZOOMTECH® au-delà de 5 m | Document fournisseur | Catalogue THYSENS p. 67 | établi |
| Teintes | palette SELT (catalogue p. 150–151), autre RAL en option | Document fournisseur | Catalogue THYSENS p. 66–67, 150 | établi |

Règles du configurateur (sources détaillées dans `systemRules`) :
- Largeur : 580–7000 mm, au-delà de 4000 mm : à confirmer (la fiche transmise indique 4 m au maximum (3,5 m avec guidage câble) quand le catalogue indique 7 m) — catalogue-thysens (p. 66 — largeur maximale 7 m) ; aluprof-r120-ziiip (Maximum width 7.0 m) ; fiche-refleksol-120-ziiip (Spécifications — 400 cm (barre anti-vent) / 350 cm (guidage câble) ; largeur minimale selon moteur)
- Hauteur : min. non documenté–4000 mm, au-delà de 3000 mm : à confirmer (la page fabricant indique 4 m dans ses caractéristiques mais « up to 3 m » dans son texte) — catalogue-thysens (p. 66 — hauteur maximale 4 m) ; aluprof-r120-ziiip (Maximum height 4.0 m ; texte « height of up to 3 m ») ; fiche-refleksol-120-ziiip (Spécifications — 400 cm)

## Store banne CASABLANCA (`store-banne-casablanca`) — STORES_BANNES

Référence : CASABLANCA (ALUPROF « CASABLANCA AWNING ») · Fabricant : ALUPROF SA (usine d'Opole, ex-SELT) · Marque : SELT by Aluprof

| Caractéristique | Valeur | Source | Localisation | Statut |
|---|---|---|---|---|
| Largeur | 200 à 600 cm | Fiche du modèle (client) | Fiche CASABLANCA — Spécifications | établi |
| Largeur maximale | 6 m | Document fournisseur | Catalogue THYSENS p. 114 | établi |
| Largeur maximale | 6 m | Fiche du modèle (client) | Fiche CASABLANCA — Spécifications | établi |
| Largeur maximale | 6 m | Site du fabricant | aluprof.com/en/product/casablanca-awning | établi |
| Avancée maximale | 3,6 m | Document fournisseur | Catalogue THYSENS p. 114 | établi |
| Avancée maximale | 3,6 m | Fiche du modèle (client) | Fiche CASABLANCA — Spécifications | établi |
| Avancée maximale | 3,6 m | Site du fabricant | aluprof.com/en/product/casablanca-awning | établi |
| Inclinaison | 5° à 40° | Document fournisseur | Catalogue THYSENS p. 114 | établi |
| Inclinaison | 5° à 40° | Site du fabricant | aluprof.com/en/product/casablanca-awning | établi |
| Résistance au vent déclarée (EN 13561) | classe 2 (84 Pa) jusqu'à 410 × 310 cm, classe 1 (48 Pa) au-delà | Document fournisseur | Déclaration des performances 08/M/2018 (SELT) — lecture visuelle de document numérisé | établi |
| Coffre | oui, avec joint | Document fournisseur | Catalogue THYSENS p. 114–115 | établi |
| Lambrequin | non | Document fournisseur | Catalogue THYSENS p. 114 | établi |
| Toiles | 150 références (toiles acryliques) | Document fournisseur | Catalogue THYSENS p. 114, 155 | établi |
| Commande | manuelle par manivelle (150, 180 ou 220 cm) | Fiche du modèle (client) | Fiche CASABLANCA — Spécifications | établi |
| Commandes citées par le catalogue | électrique ou manuelle | Document fournisseur | Catalogue THYSENS p. 114 | établi |
| Teintes standard | RAL 9010, RAL 1015, RAL 8014, RAL 9006, FSM 71319 | Document fournisseur | Catalogue THYSENS p. 114 | établi |
| Teintes standard | RAL 9010, RAL 1015, RAL 8014, RAL 9006, FSM 71319 | Fiche du modèle (client) | Fiche CASABLANCA — Couleurs disponibles | établi |

Règles du configurateur (sources détaillées dans `systemRules`) :
- Largeur : 2000–6000 mm — fiche-casablanca (Spécifications — 200 à 600 cm) ; catalogue-thysens (p. 114 — largeur maximale 6 m)
- Avancée : 1600–3600 mm, valeurs 1600 / 2100 / 2600 / 3100 / 3600 mm — fiche-casablanca (Spécifications — 160 à 360 cm ; tableau des dimensions) ; catalogue-thysens (p. 114 — avancée maximale 3,6 m)
- Avancée 2600 mm → largeur min. 2910 mm — fiche-casablanca
- Avancée 3100 mm → largeur min. 3510 mm — fiche-casablanca
- Avancée 3600 mm → largeur min. 3510 mm — fiche-casablanca

## Store de véranda VERANDA FTS (`veranda-fts`) — brouillon, hors famille

Référence : VERANDA FTS · Fabricant : non établi · Marque : non établie

| Caractéristique | Valeur | Source | Localisation | Statut |
|---|---|---|---|---|
| Largeur | 90 à 450 cm | Fiche du modèle (client) | Fiche VERANDA FTS — Spécifications | établi |
| Longueur maximale | 6,5 m | Document fournisseur | Catalogue THYSENS p. 108 | établi |
| Commande | électrique, deux moteurs + contrôleur FTS | Fiche du modèle (client) | Fiche VERANDA FTS | établi |

Règles du configurateur (sources détaillées dans `systemRules`) :
- Largeur : 900–4500 mm — fiche-veranda-fts (Spécifications — min 90 cm, max 450 cm) ; catalogue-thysens (p. 108 — largeur maximale 4,5 m)
- Longueur (sens de déroulement) : min. non documenté–6500 mm — fiche-veranda-fts (Spécifications — hauteur jusqu'à 650 cm) ; catalogue-thysens (p. 108 — 6,5 m)
