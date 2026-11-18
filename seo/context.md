# Contexte commercial vérifié (SEO / GEO)

Dernière vérification : 2026-11-17 (Search Console), 2026-11-16 (reste). Chaque fait porte sa source. Dépôt public : **aucun montant, aucun nom de
fournisseur, aucune donnée client** dans ce dossier (les prix se lisent sur les pages publiques).

Statuts utilisés : **vérifié** (lu dans le code ou sur le site public à la date indiquée), **hypothèse** (à confirmer),
**non vérifié** (aucune source accessible).

## Entreprise et marque

| Fait | Statut | Source |
|---|---|---|
| HELIOSTORES est le **nom commercial** ; l'éditeur est **THYSENS**, EURL, RCS Lille Métropole 845 051 432, siège à Villeneuve-d'Ascq (59650) | vérifié | https://heliostores.com/mentions-legales |
| Contact commercial public : contact@heliostores.com | vérifié | pied de page, `/mentions-legales` |
| `Organization` JSON-LD : name HELIOSTORES, legalName THYSENS, e-mail, code postal et ville ; **ni rue ni téléphone** (décision du 2026-10-26) | vérifié | `src/server/seo/structured-data.ts`, page d'accueil |
| Aucun établissement recevant du public validé : pas de `LocalBusiness`, pas de fiche Google Business Profile | vérifié | `docs/seo/audit-2026-11-13.md` § 3 |
| Zones desservies : « confirmées par un conseiller lors de l'étude du projet » ; aucune liste publique | vérifié | https://heliostores.com/livraison-installation |
| Délai de livraison publié : 4 à 7 semaines selon le lieu | vérifié | `/livraison-installation`, `/aide` |
| Pose professionnelle : peut être demandée, étudiée et chiffrée au devis (aucune zone, aucun tarif publiés) | vérifié | `/livraison-installation` |
| Commande en ligne : non, chaque projet est établi sur devis ; paiement en ligne désactivé | vérifié | `/aide` ; `docs/STATE.md` |
| Garantie, certifications, résistance au vent chiffrée, avis clients, réalisations : **non publiés** ; ne rien affirmer | vérifié (absence) | fiches produits, `docs/seo/keyword-page-map.csv` (colonne données manquantes) |
| Photos : certaines sont des visuels fabricants, pas des réalisations HELIOSTORES | vérifié | `/mentions-legales` |

## Catalogue public (noms commerciaux et URL établies)

Les URL gardent les anciens noms de modèles (établies, à ne pas modifier sans proposition séparée).

| Famille | Nom commercial | URL | Nature (titre de la page) | Prix d'appel affiché |
|---|---|---|---|---|
| Pergolas | HelioSky | `/pergolas/malaga` | pergola bioclimatique autoportante, tailles définies | TTC, configuration complète |
| Pergolas | HelioMax | `/pergolas/marbella` | pergola bioclimatique sur mesure, adossée ou autoportante | TTC |
| Pergolas | HelioLux | `/pergolas/sevilla` | pergola à toiture en toile, adossée ou autoportante | TTC |
| Screens | HelioScreen | `/screens/helioscreen` | store screen extérieur zip, niche ou façade | TTC |
| Screens | HelioRoof | `/screens/helioroof-screen` | store de toiture pour véranda | TTC |
| Stores bannes | HelioSun | `/stores-bannes/casablanca` | store banne à coffre | TTC |
| Stores bannes | HelioShade | `/stores-bannes/corsica` | store banne semi-coffre | TTC |
| Stores bannes | HelioPro | `/stores-bannes/jamaica` | store banne sans coffre | TTC |
| Stores bannes | HelioSquare | `/stores-bannes/madera` | store banne à coffre carré | sous-total partiel (moteur à chiffrer), aucun prix structuré |
| Moustiquaires | MoskiFold, MoskiFold 2 | `/moustiquaires/moskifold`, `/moustiquaires/moskifold-2` | plissées, sur étude et devis | aucun |
| Moustiquaires | MoskiUp, MoskiSlide, MoskiFix | `/moustiquaires/moskiup`, `…/moskislide`, `…/moskifix` | enroulable, coulissante, fixe : présentation et étude | aucun |

Sources : sitemap et pages publiques (crawl du 2026-11-16), `src/domain/categories.ts`, catalogue en base.
Les poses, dimensions et équipements de chaque modèle viennent de `systemRules` (base) et s'affichent sur les fiches :
toujours les citer depuis la page, jamais de mémoire.

## Prix (règles, sans montant)

- Prix d'appel « À partir de … € TTC » calculé par le moteur sur une configuration complète, arrondi commercial TTC
  (terminaison 99 €) ; HT affiché en second. Source : `docs/pricing/prix-conseilles.md` § 1 bis et § 2.
- JSON-LD `Product` : prix structuré seulement pour une configuration complète, identique au prix affiché (vérifié le
  2026-11-16 sur les 8 fiches tarifées). **Ne jamais modifier le moteur tarifaire depuis le travail SEO.**

## Parcours de conversion (ce qui compte)

- Conversion mesurée : **demande de devis enregistrée** (`Quote`, hors données de démonstration) et demande de contact
  (`ContactRequest`). Attribution transmise avec la demande (référent, utm, page d'entrée), sans cookie ; tableau
  `/admin/acquisition`. Un clic sur « Demander un devis » n'est **pas** un devis.
- Pas de mesure d'audience (aucun cookie d'analyse : `/cookies`). Ne pas modifier le consentement.
- Search Console : accès en **lecture seule** depuis le 2026-11-17 (propriété de domaine `sc-domain:heliostores.com`,
  compte de service, scope `webmasters.readonly` ; clé hors dépôt dans `private/`, jamais dans Git).
  Mesure du 2026-11-17 (**vérifié**, API Search Console) :
  - inspection d'URL des 37 URL du sitemap : **1 indexée** (`/`, dernière exploration 2026-10-10), **36 « inconnues
    de Google »** (jamais explorées) ;
  - sitemap : dernière lecture par Google le 2026-10-26 (34 URL soumises à l'époque, 37 aujourd'hui), 0 erreur ;
  - performances du 2026-10-19 au 2026-11-15 : 2 impressions, 0 clic, page `/` uniquement, position moyenne 6.
  Conséquence : le frein principal est la **découverte et l'indexation**, avant le contenu ou les titres.
  Le même jour, une heure après le renvoi du sitemap par le propriétaire : 1 indexée, **8 « détectées, actuellement
  non indexées »**, 28 inconnues. Suivi chaque semaine par `seo/automation/gsc_index_check.py`.
- Bing Webmaster Tools : aucun accès.

## Robots

- `robots.txt` : tout autorisé sauf espaces privés et techniques (`/admin`, `/api/` hors `/api/media/`, `/compte`,
  `/panier`, `/commande`, `/projets/`, `/comparer`). Aucun blocage des robots de recherche ou d'IA.
- Contrôle du 2026-11-16 : HTTP 200 pour Googlebot, bingbot, OAI-SearchBot, GPTBot, ChatGPT-User, ClaudeBot,
  Claude-SearchBot, PerplexityBot, CCBot sur une fiche produit ; prix et contenu présents dans le HTML serveur.
- Distinction recherche / entraînement (documentation officielle) : `Google-Extended` n'affecte ni l'inclusion ni le
  classement dans Google Search (https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers).
  Aucun blocage d'entraînement n'a été décidé par le client : rien n'est bloqué.
