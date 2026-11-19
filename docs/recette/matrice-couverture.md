# Matrice de couverture fonctionnelle (recette HELIOSTORES)

> Document publiable : aucun montant, aucun identifiant. Inventaire du 2026-11-19 (fonctionnalités réellement présentes
> dans `src/app`, `src/components`, `src/server`). Tests : `tests/e2e/NN-*.spec.ts` (E2E, desktop 1440 + mobile 390),
> `tests/recette/*.spec.ts` (R), `tests/integration/*.test.ts` (I), `tests/unit/*.test.ts` (U), audit des tarifs (A/B/C).
> « Manque » = couverture absente ou partielle après cette campagne ; elle est listée dans les limites du rapport.

## Public

| Fonctionnalité | Produits | Scénario | Attendu | Tests | Manque |
|---|---|---|---|---|---|
| Accueil, quatre familles, logo → accueil | — | premier écran, cartes cliquables, logo | 4 familles visibles, lien accueil sur tout le logo | E2E 15, 16, 17, 20 ; R controle-public | — |
| Navigation latérale et menu mobile | toutes | ouvrir une famille, un modèle | rubrique active, modèle ouvert | E2E 16 | — |
| Fiches, galeries, documents | toutes | fiche, galerie, PDF publié | aucun crédit fabricant, médias chargés | E2E 01, 07 ; R controle-public (médias) | contenu de chaque document PDF non relu |
| Prix d'appel → configuration exacte | modèles tarifés | fiche → « Configurer » | même montant, configuration décrite | E2E 24, 25 ; R controle-public (10 fiches) | — |
| Visuels manquants, liens cassés | pages principales | chargement et défilement | aucune image cassée, aucune réponse média ≥ 400 | R controle-public | liens externes non suivis |
| Cookies refusés / acceptés | — | refuser ; accepter en cours de configuration | aucun script optionnel ; configuration conservée | E2E 04, 20, 27 | — |
| Langues (aperçus) | — | sélecteur, noindex | français intact, aperçus noindex | E2E 20 | traductions non relues |
| Mise en page 390 / 768 / 1440 px | 7 pages | largeur imposée | aucun débordement horizontal | R visuel ; E2E 16 | contrôle visuel humain des captures |

## Configurateurs

| Fonctionnalité | Produits | Scénario | Attendu | Tests | Manque |
|---|---|---|---|---|---|
| Cotes min / intermédiaires / max, saisie et curseurs | pergolas, screens, stores | bornes, pas, valeurs fabriquées | blocage nommé hors domaine | E2E 02, 03, 16, 25 ; U heliostores-rules ; B (1 610 cas) | curseur au clavier non testé |
| Hauteurs et unités | HelioLux, HelioMax, screens | hauteur > 2,5 m, cm/mm | supplément ou blocage nommé | U ; E2E 02 ; B | — |
| Implantation, teintes, toiles, commandes | tous | choix, teinte avec supplément | prix et dessin suivent | E2E 02, 03, 16, 19, 20, 22, 26 | — |
| Toile sans valeur par défaut documentée | HelioLux, HelioScreen, HelioRoof, moustiquaire | nouveau projet | aucune toile présélectionnée ; prix affiché si indépendant de la toile ; devis après choix | E2E 26 ; U tranche-superieure | — |
| Équipements inclus, options, incompatibilités | tous | option soumise à la commande | prérequis affiché, option désactivée | E2E 02, 03, 15 | — |
| Fermetures par côté | pergolas | HelioSlide VERRE à l'avant | sous-total pergola, fermeture « à chiffrer, compatibilité à confirmer » | E2E 26 ; R prix-pdf ; U | — |
| Dessin, 3D, récapitulatif synchronisés | tous | changement de cote, teinte, LED | attributs du dessin, récapitulatif | E2E 16, 19 | — |
| Repli sans WebGL | HelioLux | WebGL indisponible | dessin 2D joint au devis | E2E 02 | — |
| Changements rapides, réponses dans le désordre | HelioLux | 4 cotes successives | dernier état seul affiché | E2E 26 | calcul serveur concurrent non simulé (calcul local synchrone) |
| Étapes, Retour navigateur, actualisation | tous | aller-retour, reload | étape et choix conservés | E2E 16, 20 ; R controle-public | — |
| Prix complet / sous-total partiel / sur devis | tous | structure seule, élément à chiffrer, hors grille | libellé exact, jamais un faux prix complet | E2E 08, 21, 25, 26 ; R prix-pdf ; B | — |

## Projets anciens

| Fonctionnalité | Produits | Scénario | Attendu | Tests | Manque |
|---|---|---|---|---|---|
| Ancienne toile (serge_100, serge_600) | HelioLux | brouillon d'avant la révision | choix nommé, aucun montant, correction en une action, absent après actualisation | E2E 22, 26 ; R prix-pdf | — |
| Ancienne option | HelioLux | wind_automation | signalée, retrait explicite | E2E 22 | — |
| Ancienne fermeture | HelioLux | côté gauche d'un autre système | affichée comme ancien choix (jamais « ouvert ») | E2E 26 | — |
| Ancienne commande, teinte, pose | tous | code inconnu | nommé, bloquant, jamais converti | U (messages) ; composant (liste « choix enregistré plus proposé ») | parcours navigateur commande / pose anciennes |
| Aucun remplacement silencieux de système | tous | brouillon d'un autre système | champs sans objet retirés, choix applicables jamais convertis | E2E 26 | — |

## Compte et devis

| Fonctionnalité | Scénario | Attendu | Tests | Manque |
|---|---|---|---|---|
| Inscription, connexion, déconnexion, mot de passe | changement puis reconnexion | ancien refusé, nouveau accepté | E2E 27, 13 | mot de passe oublié (e-mail) non testé de bout en bout |
| Sauvegarde et reprise d'un projet | projet enregistré, rouvert | même configuration | E2E 02, 19 | — |
| Demande de devis enregistrée côté serveur | formulaire | ligne Quote, instantané inchangé | E2E 02, 21, 25, 26 ; R prix-pdf | — |
| Montant transmis sans altération | devis HelioLux | TTC et cotes réelles = attendu PDF | R prix-pdf (niveau C) | — |
| Image figée et PDF cohérents | devis avec visuel | visuel joint, PDF généré | E2E 02 ; I quote-visual, documents | — |
| Accès privé aux documents | PDF d'un devis | titulaire 200, autre client et visiteur 404 | E2E 27 ; I media-access ; R controle-public | — |
| Séparation des comptes | deux clients | aucune donnée de l'autre | E2E 27 ; I | — |

## Chat

| Fonctionnalité | Scénario | Attendu | Tests | Manque |
|---|---|---|---|---|
| Ouverture, messages, réponse d'un conseiller, reprise | visiteur ↔ conseiller | réponse visible | E2E 09 | — |
| Aide guidée vs LLM raccordé | thèmes, message libre | aide guidée sans LLM ; aucun LLM présenté comme raccordé | E2E 18 ; I chat-assistant | LLM réel : non raccordé (sans objet) |
| Indisponibilité, conversations séparées | hors ligne, deux visiteurs | message hors ligne, séparation | E2E 18 ; I chat | — |
| Aucune promesse d'e-mail sans service | demande collectée | texte sans promesse d'envoi | E2E 18 | — |

## Administration

| Fonctionnalité | Scénario | Attendu | Tests | Manque |
|---|---|---|---|---|
| Droits par rôle | visiteur, client, gestionnaire | accès refusés | E2E 14, 23, 24 ; R controle-public | rôle gestionnaire sur toutes les pages |
| Devis, contacts, acquisition | consultation, qualification | pages lisibles | E2E 02, 27 | export acquisition non vérifié |
| Tarifs : simulation, brouillon, publication, retour arrière | grille de test | publication, désactivation, rejet | E2E 14, 21 ; I tariffs | — |
| Mes prix conseillés, aucune publication automatique | tableau de bord | suggestion sans publication | E2E 24 ; I market | — |
| File d'e-mails, états réels | /admin/emails | fournisseur réel affiché | E2E 27 ; I mail-and-config | envoi SMTP réel (sans objet : non raccordé) |
| Aucun coût ni marge publics | pages publiques | aucune donnée interne | E2E 05 ; R controle-public | — |

## Tarifs (audit indépendant)

| Niveau | Contenu | Outil |
|---|---|---|
| A | PDF → base : cellules vendues, base catalogue, vente, politique, TVA, arrondi | `/audit-tarifs` (`compare_db.py`) |
| B | référence → moteur : exact, intermédiaire, au-delà, sous la grille, sous le minimum, cas signalés | `engine-check.ts` |
| C | navigateur → devis : HelioLux (4 cas, fermeture, ancienne toile), HelioMax, HelioSun | `tests/recette/prix-pdf.spec.ts` |
| Hors périmètre automatisé | suppléments textuels du PDF (options, moteurs, LED) relus à l'import, non réextraits | limite documentée |
