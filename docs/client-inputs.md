# Éléments à fournir — liste consolidée (2026-10-26)

> Une seule liste, tenue à jour dans **Administration → Registre de lancement** (statut, réponse, validation datée et
> nominative). Ce document en est le résumé publiable : aucun montant, aucun secret. Ne transmettez **aucune clé ni
> aucun mot de passe** par message : déposez-les dans le fichier d'environnement du serveur ou faites-le faire par
> l'exploitant, en session.

## A. Bloquent l'ouverture publique de heliostores.com

| # | Élément attendu | Responsable | Conséquence tant qu'il manque |
|---|---|---|---|
| A1 | **DNS** chez GoDaddy : supprimer les deux `A @` « WebsiteBuilder Site » (`76.223.105.230`, `13.248.243.5`) et déconnecter le domaine du site Website Builder ; garder `A @ 76.13.44.177`, `AAAA @ 2a02:4780:7:f4ca::1`, `CNAME www heliostores.com.` | client (accès registraire) | **seul blocage restant** : la plupart des visiteurs IPv4 arrivent sur l'ancien site GoDaddy |
| A2 | Identité légale : **fournie et publiée le 2026-10-26** (THYSENS, registres officiels). Reste : n° de TVA intracommunautaire à vérifier dans VIES ; relecture du gérant | client | mentions publiées sans n° de TVA |
| A3 | Pages légales : mentions, confidentialité et cookies **publiées le 2026-10-26** ; relecture par le gérant ou un juriste recommandée. CGV seulement si vente en ligne | client (juriste) | — |

## B. Nécessaires au niveau A (site sur devis) mais non bloquants

| # | Élément | Responsable | Conséquence |
|---|---|---|---|
| B1 | **SMTP** ou API d'envoi (hôte, port, identifiant, secret déposé sur le serveur), expéditeur `@heliostores.com`, SPF/DKIM/DMARC, adresse de réception des demandes | client | aucun e-mail : accusé de réception client non envoyé ; demandes suivies dans Administration → Devis (tableau de bord « Devis nouveaux ») |
| B2 | Zones réellement desservies (France, Belgique…), livraison et pose, partenaires | client | aucune zone annoncée ; chaque demande est qualifiée par un conseiller |
| B3 | Compte administrateur de production : la personne habilitée crée son accès (saisie masquée, § 3.7 du runbook) | client | aucun accès à l'administration de production |

## C. Données produits (le site publie déjà ce qui est vérifiable)

| # | Produit | Donnée | Conséquence actuelle |
|---|---|---|---|
| C1 | MoskiFold, MoskiFold 2, MoskiUp, MoskiSlide, MoskiFix | correspondance écrite nom commercial ↔ système fabriqué | MoskiFold / MoskiFold 2 : présentation + demande d'étude (cotes souhaitées, aucune borne publiée) ; les trois autres en brouillon |
| C2 | MoskiUp, MoskiSlide, MoskiFix | dimensions min./max., notices, contenu des kits | brouillon |
| C3 | Malaga | série d'avancées fabriquée (deux séries dans les documents) | série documentée proposée, autre cote = étude hors gamme |
| C4 | Marbella | photos du modèle exact ; résistance au vent | dessin seul ; aucune valeur de vent |
| C5 | Sevilla | résistance au vent | aucune valeur publiée |
| C6 | HelioRoof Screen | Veranda standard ou Veranda FTS (confirmation explicite) | aucune donnée FTS reprise ; sur devis |
| C7 | HelioScreen | largeur maximale (7 / 5 / 4 m selon le document) | au-delà de la valeur concordante : validé au devis |
| C8 | Casablanca, Corsica, Jamaica, Madera | LED de série ou en option ; moteur, télécommande, capteurs fournis | options « à confirmer », chiffrées au devis |

## D. Prix et vente en ligne (niveau B)

| # | Élément | Conséquence actuelle |
|---|---|---|
| D1 | Casablanca, HelioScreen : validation datée et nominative des prix publics — devise (les fiches parlent de DH), HT/TTC et taux de TVA, éléments inclus (moteur, toile, pose, livraison), validité | grilles **désactivées le 2026-10-26** : « Sur devis », aucun achat direct ; réactivables en un clic (Administration → Tarifs → reprendre en brouillon → publier) |
| D2 | Prix de vente des nouveaux modèles et des options (aucune marge ni conversion ne sera inventée) | sur devis |
| D3 | Stripe : identifiant `acct_…` attendu, entité titulaire (doit être le vendeur des mentions légales), clés **de test** déposées sur le serveur, moyens de paiement activés au tableau de bord | encaissement fermé ; aucune recette Stripe réelle possible |
| D4 | Conditions de vente en ligne : acompte/solde, rétractation pour le sur-mesure, délais, garanties | pas de vente en ligne |

## E. Contenus et marque (non bloquants)

| # | Élément | Conséquence |
|---|---|---|
| E1 | Orange de marque définitif | orange provisoire `#C2410C` |
| E2 | Photos authentiques de réalisations et de fabrication, avec crédit et autorisation | rubrique Références retirée du menu |
| E3 | Notices, vidéos, documents publiables | aucun onglet vidéo ; guides d'installation non publiés |
| E4 | Accès Google Search Console et Bing Webmaster Tools (propriétaire du domaine) | outils non raccordés (voir `docs/seo-geo-plan-90-days.md`) |
| E5 | Destination de sauvegarde hors du VPS | sauvegardes locales seulement |

Recommandation de sécurité : changer le mot de passe de revue de la préproduction (procédure : `docs/preprod-https.md`).
