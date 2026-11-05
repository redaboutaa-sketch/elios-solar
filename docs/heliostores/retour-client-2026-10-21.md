# Retour client du 2026-10-21 — suivi

> Document publiable : aucun montant. Décisions du 2026-10-23 : les prix « Prix final HELIOSTORES » publiés et les noms
> HELIO sont **conservés** (choix confirmés).

## 1. Accueil : choisir une famille par un dessin

| | |
|---|---|
| Demande | Entrée épurée : le visiteur clique sur le dessin du produit, puis découvre les modèles de la famille ; trois familles. |
| Changement | Premier écran : titre puis trois grandes cartes dessinées (Pergolas, Screens, Stores bannes), entièrement cliquables vers la collection ; accordéon au survol et au focus, cartes horizontales sur mobile (les trois tiennent dans le premier écran à 390 × 844). Photographies juste en dessous (« En situation ») et dans les fiches. En-tête sur fond plein. |
| Source | Dessins SVG originaux existants (`src/components/illustrations/sketches.tsx`, variante sans façade). Les deux captures client citées (`810B9F6D…`, `85D59E26…`) ne sont **pas** sur le serveur. |
| Vérification | e2e `15-retour-client` (bureau et mobile : trois cartes visibles dans le premier écran, clic vers la collection, pas de débordement). |
| Décision | Valider le rendu ; transmettre les deux captures pour comparaison. |

## 2. Noms commerciaux

| | |
|---|---|
| Demande | Ne plus présenter SB400, SB500, REFLEKSOL, ZIP120, CASABLANCA ; séparer identifiant, référence, nom, slug, historique ; noms provisoires modifiables. |
| Changement | Noms HELIO conservés (provisoires). Fiche famille en administration : identifiant interne stable, référence fournisseur, nom commercial modifiable, slug public, anciens slugs (redirigés en 308) et historique des noms (`legacySlugs`, `nameHistory`). Un nom modifié dans l'administration n'est plus écrasé aux déploiements (`commercialEditedAt`). Noms de moteurs, capteurs et box ajoutés au filtre public (`PUBLIC_FORBIDDEN_NAMES`). |
| Source | `nomenclature.md` ; migration `20261023150000_retour_client`. |
| Vérification | tests unitaires nomenclature (aucun nom fournisseur dans les données publiques), intégration (nom modifié conservé par le seed), e2e catalogue (pages publiques). |
| Décision | Noms définitifs. Textes alternatifs des photos en préproduction : import des médias à relancer (voir § 9). |

| Réf. fournisseur (interne) | Nom provisoire |
|---|---|
| SB 400 | HELIO Horizon |
| SB500 | HELIO Panorama |
| REFLEKSOL 120 ZiiiP | HELIO Ombra |
| CASABLANCA | HELIO Riviera (niveaux Essentiel, Confort) |
| CORSICA | HELIO Azur (niveau Premium, brouillon) |
| VERANDA FTS | HELIO Verrière (brouillon) |

## 3. Stores bannes : niveaux

| | |
|---|---|
| Demande | Gamme courte Essentiel / Confort / Premium ; distinguer modèles différents et packs du même modèle. |
| Changement | **2 modèles physiques, 3 niveaux.** Essentiel et Confort sont deux packs du **même** store HELIO Riviera ; Premium est **HELIO Azur**, un autre modèle (brouillon : aucune page, aucun prix). Choix du niveau dans le configurateur (Essentiel → manivelle ; Confort → motorisation), comparatif sur la page Stores bannes. |
| Source | Catalogue THYSENS p. 111–135 ; brochure ALUPROF Stores bannes p. 13, 29 ; supplément technique STORES p. 46, 51, 83 ; DT-E CASABLANCA p. 6, 18–19. |
| Vérification | tests unitaires (niveau ↔ commande, Premium non configurable, aucune LED sur HELIO Riviera) ; e2e (comparatif, niveaux, prérequis). |
| Décision | Moteur, télécommande et capteurs du niveau Confort ; validation et tarif du modèle Premium. |

| Niveau | Modèle | Usage | Compris (documenté) | Options | Dimensions | Source |
|---|---|---|---|---|---|---|
| Essentiel | HELIO Riviera | simple, à la manivelle | coffre avec joint, bras à chaîne Flyer, manivelle 150/180/220 cm | — | 2 à 6 m × 1,6 à 3,6 m | fiche CASABLANCA ; THYSENS p. 114–115 |
| Confort | HELIO Riviera (même store) | motorisé | + motorisation (à définir), télécommande radio | automatisme vent-soleil, capteur de vibrations, box (à confirmer) | identiques | DT-E CASABLANCA p. 6 |
| Premium | HELIO Azur (autre modèle) | motorisé, éclairé | coffre, barre carrée, uniquement motorisé | LED profil bas, bras LED (3,1 / 3,6 m), capteurs météo (à confirmer) | 2,05 à 7 m × 1,6 à 3,6 m | THYSENS p. 118–119 ; brochure p. 13 ; supplément p. 51, 83 |

Écartés : Bora (screen vertical), gamme balcon (avancée ≤ 1,8 m), Silver Plus et Malta (absents des documents actuels du
fabricant), Madeira (absent du catalogue du distributeur). Éclairage LED **non proposé** sur HELIO Riviera.

## 4. Accessoires et options

| | |
|---|---|
| Demande | Télécommandes, box, smartphone, capteurs, LED, accessoires ; compatibilités, prérequis, inclus/supplément, cumul, tarif ou devis ; comportement au vent par produit. |
| Changement | Options enrichies : prérequis de commande (`requiresControlKind`, `requiresControls`), prérequis rédigé, exclusions, quantité, tarif « devis ». Ajouts : HELIO Connect (box), capteur de pluie, capteurs vent/soleil précisés (HELIO Horizon) ; box (HELIO Ombra, moteur io seulement) ; télécommande, automatisme vent-soleil, capteur de vibrations, box (HELIO Riviera) ; LED profil bas et bras LED (HELIO Azur). Comportement au vent propre à chaque système, affiché au configurateur. |
| Source | DT-E SB400PRO p. 44–47, 52 ; DT-E REFLEKSOL p. 27 ; notice des screens p. 10 ; DT-E CASABLANCA p. 6, 18–19 ; listes d'accessoires des pages fabricant (sans compatibilité). |
| Vérification | tests unitaires (option motorisée refusée avec la manivelle ; box du screen refusée hors moteur io ; vent différent par produit ; options toujours au devis). |
| Décision | Compatibilité des capteurs et de la box avec la télécommande fournie d'HELIO Horizon (documentés seulement pour la version io) ; capteurs d'HELIO Panorama ; prix des options (montants oraux non repris). |

| Produit | Comportement au vent documenté |
|---|---|
| HELIO Horizon | lames ouvertes si côtés ouverts, fermées si côtés fermés ; contradiction interne de la notice : **à confirmer** |
| HELIO Panorama | **non documenté** |
| HELIO Ombra | screen relevé dans son coffre |
| HELIO Riviera | store replié ; à enrouler au-delà de la classe de vent |

## 5. Calcul des prix

| | |
|---|---|
| Demande | Explication vérifiable ; exemple ; fiche de décisions ; ne pas publier de prix fournisseur. |
| Changement | `explication-prix.md` (publiable) et annexe chiffrée privée (`private/heliostores/prices/explication-prix-exemple.md`) ; `decisions-tarifaires.md`. FAQ corrigées (lecture exacte des cotes). Aucun montant estimatif de l'ancien catalogue n'est visible (pages redirigées). |
| Source | classeur importé v1 (empreinte `d9e57623dcd6…`), écran Tarifs. |
| Vérification | revue des pages publiques (e2e catalogue), simulateur Tarifs. |
| Décision | Points T1 à T11 de `decisions-tarifaires.md`, en priorité la nature de « Prix final HELIOSTORES ». |

## 6. Guides et installation

| | |
|---|---|
| Demande | Espace « Guides et installation », guides visuels fidèles aux notices, version web et PDF, brouillons jusqu'à validation. |
| Changement | Rubrique renommée ; guides d'accompagnement HELIO Riviera et HELIO Ombra (sommaire, préparation, pièces, étapes avec la page de la notice, points de contrôle, avertissements cités) et PDF ; HELIO Horizon et HELIO Panorama : « notice à obtenir ». Administration : aperçu, validation technique (qui, quand), publication. Rien n'est public tant qu'un guide n'est pas validé et publié. |
| Source | DT-E CASABLANCA (éd. 5, 2019), DT-E Refleksol ZiiiP (éd. 7, 2022), notices d'utilisation stores et screens ; visuels fabricant autorisés (schémas de pose, coulisse). |
| Vérification | intégration (publication impossible sans validation ; guide sans étape non publiable) ; e2e (404 public, aperçu et PDF en administration). |
| Décision | Validation technique des deux guides ; accord pour reproduire les figures des notices ; notices manquantes (§ 9). |

## 7. Réalisations et production

| | |
|---|---|
| Demande | Deux ensembles distincts, administration des médias, légendes, produits, ordre ; aucun faux chantier. |
| Changement | Type « Réalisation HELIOSTORES » ou « Production et savoir-faire », légende, site de production (partenaire), emplacements « à fournir » (3 + 3, brouillons). Publication refusée pour un emplacement, une démonstration ou un visuel fournisseur présenté comme réalisation ; photo de partenaire décrite comme telle. Pages publiques masquées (404) tant qu'aucun contenu réel n'est fourni. |
| Source | aucune photo de chantier ni de fabrication fournie. |
| Vérification | intégration (emplacements, idempotence) ; e2e (rubriques masquées). |
| Décision | Photos réelles, produit, contexte, localisation publiable ; site de production. |

## 8. Modes de paiement

| | |
|---|---|
| Demande | Présenter les moyens disponibles ou envisagés, sans présenter l'envisagé comme actif. |
| Changement | Page `/modes-de-paiement` et tableau en administration, calculés depuis la configuration : carte (simulée en préproduction), acompte et solde sur devis (envisagé), virement (envisagé), paiement en plusieurs fois (envisagé, inactif). Aucun pourcentage, mensualité ni gratuité. Paiements réels toujours désactivés. |
| Source | `src/server/payment/*` (intégrations conservées). |
| Vérification | intégration et e2e (états, aucun pourcentage). |
| Décision | P1 à P4 de `decisions-tarifaires.md`. |

## 9. Documents et médias à fournir

- Notices de montage : HELIO Horizon (modèle standard), HELIO Panorama, notice d'installation séparée d'HELIO Riviera, notices des moteurs.
- Accord pour reproduire les figures des notices dans les guides.
- Photos de réalisations et de production ; les deux captures de référence de l'accueil.
- Fiche, tarif et photos du modèle Premium (HELIO Azur).
- Textes alternatifs en préproduction : relancer l'import des médias (`pnpm media:heliostores --dir … --apply`, dossier privé monté en lecture seule).
