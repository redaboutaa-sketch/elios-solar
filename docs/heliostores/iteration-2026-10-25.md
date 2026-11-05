# Itération du 2026-10-25 — quatre familles, visualisation liée, navigation, Stripe

> Document publiable : aucun montant, aucun secret. Recherches fournisseur détaillées (privées, hors dépôt) :
> `private/heliostores/research/{pergolas,screens,awnings,moustiquaires}.md` et leurs inventaires `*-documents.json`,
> `*-media.json`.

Statuts : **livré** (codé, testé, déployé) · **partiel** (livré avec une limite indiquée) · **dépendance externe**
(attend une pièce, une décision ou un accès du client).

## 1. Demandes et statuts

| # | Demande | Statut | Détail |
|---|---|---|---|
| 1 | Quatre familles et nouvelle nomenclature | livré | Malaga, Marbella, Sevilla ; HelioScreen, HelioRoof Screen ; Casablanca, Corsica, Jamaica, Madera ; MoskiFold, MoskiFold 2 (MoskiUp, MoskiSlide, MoskiFix en brouillon). Voir `nomenclature.md`. |
| 1 | SB 350 / SB 450 ≠ SB 400 / SB 500 | livré | Nouvelles fiches sourcées ; SB 400 / SB 500 retirés (archivés, historique conservé), jamais renommés. |
| 1 | Correspondances vérifiées | livré | Même produit ⇒ renommage + 308 : REFLEKSOL 120 ZiiiP = R 120 ZiiiP (HelioScreen), CASABLANCA, CORSICA. Produits différents ⇒ page explicative : SB 400, SB 500, VERANDA FTS (≠ Veranda). |
| 1 | Anciennes configurations, devis, commandes | livré | Conservés ; configurateur d'un modèle retiré ⇒ page « Ce modèle n'est plus proposé » + choix de gamme, sans conversion. |
| 2 | Moustiquaires : système exact | partiel / dépendance | Correspondance proposée (MPH HARMONY, MPH DUAL, MZN, MRP, MRS), confiance moyenne, **à confirmer par le client** ; dimensions maximales non documentées pour MZN, MRP, MRS ⇒ brouillons. |
| 2 | Stores bannes : lecture basique / intermédiaire / équipé | livré | Calculée depuis les règles (manœuvre, éclairage) ; mentionnée comme non issue du fabricant ; protection de la toile (ordre inverse) affichée dans le comparatif. Plus de faux niveaux Essentiel / Confort / Premium. |
| 3 | Télécommandes, box, capteurs, LED, fermetures coulissantes | livré | Option seulement si documentée ; sinon **souhait étudié au devis**. MB-OpenSlide = « Fermetures latérales coulissantes (vitrage) », accessoire. Comportement au vent propre à chaque produit. Page `/accessoires`. |
| 3 | Aide au choix des toiles et motorisations | livré | `/guides/choisir-toile-et-motorisation` (toiles et manœuvres documentées, compris, conseil). |
| 4 | Visualisation liée à la configuration | livré | Dessin paramétrique 2D par défaut (même entrée que le serveur : cotes, pose, teinte, toile, LED, capteur, supports, fermetures, toiture lames ou toile, screen de toiture, moustiquaire), vues Face / Trois quarts / Dessus, éléments mobiles, export, image jointe au devis ; 3D à la demande (pergola, screen, store), toiture toile en 3D ; onglet « Photos » distinct et signalé ; vues Intérieur et Ambiance nuit retirées (LED représentées allumées). |
| 4 | Dimensions autorisées | livré | Tailles fixes (Malaga) sans curseur libre ; valeurs discrètes en boutons ; demande hors gamme explicite (jamais commandable en ligne). |
| 5 | Accueil quatre panneaux, sketch moustiquaire | livré | Dessin original de moustiquaire plissée ; cartes utilisables sans survol sur mobile. |
| 5 | Qualité des visuels | partiel / dépendance | Images en plus grande résolution disponible chez le fabricant (aucune version plus grande n'existe pour la plupart, < 1200 px) ; store banne entièrement visible : photo de brochure 1759 px (Madera, attribution probable). Marbella : aucune image du modèle exact. |
| 6 | Navigation latérale, menu mobile | livré | Familles et modèles, options et accessoires, installation et guides, prise de mesures, références, paiement, contact ; rubrique active ; repliable ; un seul menu de catalogue. |
| 6 | Configurateur : étapes, Précédent / Suivant, liens, choix conservés | livré | Brouillon local par modèle ; confirmation seulement pour « Recommencer » sans enregistrement. |
| 7 | Mobile : curseurs, saisie, + / −, récapitulatif compact | livré | Barre basse compacte (étape, prix, action) ; 3D chargée à la demande. |
| 8 | Identité : bleu-vert dominant, orange d'accent | livré (orange provisoire) | Orange **proposé** (non extrait du logo) : `identite.md` § 4. |
| 9 | Installation, guides, mesures | partiel / dépendance | Bibliothèque des documents publiés par modèle (versions, statuts existants ; nouveaux types : notice de montage, guide de mesure, vidéo) ; outil de prise de mesures (4 familles, schémas, poses, report dans le configurateur). Guides d'installation : Casablanca et HelioScreen rédigés (brouillons, validation technique à faire) ; Malaga, Marbella, Sevilla, HelioRoof Screen, Madera : notices disponibles ou à obtenir, synthèse non rédigée. Aucune vidéo fournie. |
| 10 | Page Références | livré (vide) | `/references` : Réalisations clients / Production et fabrication ; administration avec crédit, autorisation, localisation publiable, statut ; publication refusée sans photo, autorisation ou produit. Aucun contenu réel fourni : catégories vides, sans faux projet. |
| 11 | Tarifs | livré | Classeur déjà importé (SB 400, SB 500, REFLEKSOL, CASABLANCA, VERANDA FTS) : rien à réimporter, aucun doublon. Grilles CASABLANCA et REFLEKSOL suivent leur produit renommé ; grilles SB 400 / SB 500 conservées mais jamais appliquées à SB 350 / SB 450. Nouveaux modèles : sur devis. Base du prix de vente expliquée dans l'administration. |
| 12 | Stripe | partiel / dépendance | Code complet (moyens dynamiques, virement, Alma conforme, devis, webhooks, remboursements, événements tardifs, garde-fous). **Aucun compte raccordé** (pas de clé) : paiement simulé. Procédure : `stripe.md`. |
| 13 | Suivi des prospects | livré | Origine (campagne, page d'entrée) → devis → commande issue du devis → encaissé / remboursé, visible sur le devis en administration. |

## 2. Éléments à fournir ou à décider (client / fournisseur)

1. Moustiquaires : confirmer la correspondance de chaque nom (MPH HARMONY, MPH DUAL, MZN ou MZH, MRP ou MZP, MRS ou
   MRSZ) ; dimensions maximales de MZN, MRP, MRS ; couleurs de toile ; contenu du kit et notices.
2. Malaga : quelle série d'avancées publier (3,40 / 3,85 / 4,30 / 4,75 m ou 3,6 / 4,0 / 4,4 / 4,8 m) ; capteur de vent
   compatible ; notice graphique de montage.
3. Marbella : valeur de vent publiable ; émetteur livré ; capteur antigel inclus ou option ; photos du modèle exact.
4. Sevilla : classe de vent (84 Pa ou 70 Pa) ; commande livrée ; coloris des toiles.
5. HelioRoof Screen : **Veranda ou Veranda FTS ?** (la fiche et la grille transmises portent sur FTS) ; largeur
   minimale ; classe de vent (2 ou 1).
6. HelioScreen : la fiche transmise décrit en partie le screen classique sans zip (barre anti-vent, guidage câble) ;
   largeur maximale (7, 5 ou 4 m) ; largeurs minimales par moteur.
7. Stores bannes : LED de série ou option (Corsica, Madera) ; moteurs, télécommandes et capteurs fournis ; Madera :
   documentation technique, poses autres que murale, disponibilité chez le distributeur.
8. Tarifs des nouveaux modèles et des options (les 150–250 € évoqués ne sont pas appliqués).
9. Orange de marque définitif.
10. Photos de réalisations et de production, avec autorisations ; vidéos éventuelles.
11. Stripe : clés de **test** du compte HELIOSTORES, `acct_…`, activation des moyens de paiement, exemption de la route
    webhook au niveau du proxy de préproduction (décision d'exploitation) ; entité vendeuse et documents commerciaux
    avant toute bascule réelle.

## 3. Contrôles (2026-10-25)

| Contrôle | Résultat |
|---|---|
| Typage, lint | OK (0 erreur, 2 avertissements existants) |
| Tests unitaires | 245 / 245 |
| Tests d'intégration | 97 / 97 (dont parcours Stripe différés et tardifs, paiement de devis) |
| Build Docker | OK |
| Recette navigateur en dev (1440 + 390, une campagne, sans relance) | 67 réussis, 2 échecs, 4 ignorés (écritures Tarifs sur mobile, voulu) ; les 2 échecs (libellé monétaire du paiement de devis) corrigés, spec rejouée : 7 / 7 |
| Recette HTTPS contre la préproduction | 63 réussis, 6 échecs, 4 ignorés : les 6 échecs sont `13-anti-force-brute` (le proxy remplace l'adresse IP que le test fait varier ⇒ 429 plus tôt ; la protection fonctionne ; spec verte dans le job CI e2e-docker) |
| Captures 390 / 768 / 1440 px en préproduction | accueil, Pergolas, Stores bannes, Moustiquaires, configurateur Sevilla, fiche Madera |
| Préproduction | authentifiée (401 sans identifiants), `robots.txt` Disallow, administrateur de recette supprimé, aucune grille de test active, aucun guide publié |
