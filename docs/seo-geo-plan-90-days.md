# SEO et GEO : livraison technique et plan sur 90 jours

Mise à jour : 2026-10-26. Domaine de production retenu : `https://heliostores.com` (`www` redirigé vers le domaine nu par le
proxy). Ce document ne garantit ni position, ni volume de trafic, ni citation dans une réponse d'IA.

## 1. Ce qui est livré (code)

### Exploration et indexation

| Élément | Comportement | Fichiers |
|---|---|---|
| Environnement | Indexable seulement si `SITE_INDEXABLE=true` (production). La préproduction reste en `noindex` partout : balise meta, en-tête `X-Robots-Tag` posé à l'exécution, `robots.txt` en `Disallow: /`, sitemap vide. | `src/app/layout.tsx`, `src/proxy.ts`, `src/lib/robots-header.ts` |
| `robots.txt` | Calculé **à chaque requête**. Avant, il était figé au build, donc une même image aurait servi `Disallow: /` en production. Production : `Allow: /`, sauf `/admin`, `/api/`, `/compte`, `/panier`, `/commande`, `/projets/` et `/comparer` ; `/_next` n'est jamais bloqué ; il indique le sitemap. | `src/app/robots.ts`, `src/server/seo/robots-rules.ts` |
| Sitemap | Calculé à chaque requête. Il contient uniquement les pages canoniques publiées : accueil, quatre familles, accessoires, fiches publiées ou sur devis, guides publiés, guides d'installation publiés, devis, contact, et pages de contenu **publiées**. Il exclut les brouillons, les modèles retirés, les configurateurs, la rubrique Références vide, les pages légales provisoires, ainsi que le compte, le panier, la commande et le paiement. | `src/app/sitemap.ts`, `src/server/seo/sitemap-entries.ts` |
| `noindex` par page | Ces pages sont en `noindex` : compte, panier, commande et paiement, projets partagés (balises déjà présentes). S'y ajoutent les configurateurs (`noindex, follow` : outil à paramètres, la fiche produit est la page de référence), les pages légales non publiées, les modèles retirés et la page 404. | pages concernées |
| URL canoniques | Elles sont absolues, sans paramètre, sur l'accueil, les familles, les fiches, les guides, le devis, le contact, le rappel et les modes de paiement. `/devis?produit=…` pointe vers `/devis`. | métadonnées des pages |
| Redirections | Les anciens slugs renommés redirigent en 308 directement vers la cible finale, sans chaîne (`legacy-slugs.ts`). L'ancien guide `pergola-bioclimatique` redirige en 308 vers `/guides/choisir-sa-pergola`. Les modèles retirés affichent une page explicative en `noindex`. | `src/server/catalog/legacy-slugs.ts`, `src/app/(boutique)/guides/[slug]/page.tsx` |
| Page 404 | Réponse 404 avec liens vers les quatre familles, les guides et le devis. Elle s'affiche dans la boutique (en-tête et navigation) quand une page appelle `notFound()`. | `src/app/not-found.tsx`, `src/app/(boutique)/not-found.tsx` |
| Domaine de démonstration | Aucun lien vers `demo-elios.beaverdata.eu` dans le code. Les URL sont lues depuis `NEXT_PUBLIC_SITE_URL`. | contrôle par recherche |

### Pages vides retirées
- **Références** est retirée de la navigation (menu latéral, menu mobile, pied de page) et du sitemap. `/references`, `/realisations` et `/savoir-faire` répondent 404 tant qu'aucune réalisation ni photo de fabrication authentique n'est publiée. Pour rouvrir la rubrique : publier une fiche, puis passer `PUBLIC_SECTIONS.references` à `true`. Même ouverte, la page reste en 404 sans fiche publiée.
- **Vidéos** : aucun onglet vidéo n'existe. Le titre « Fiches techniques, notices et vidéos » devient « Fiches techniques et notices ».
- **Guides d'installation** : seuls les guides validés et publiés sont listés et indexés (inchangé ; aucun n'est publié aujourd'hui).

### Titres, descriptions, Open Graph
- Fiches : titre « Nom — Nature », dérivé des règles documentées du modèle. Une qualification « à confirmer » n'est jamais retenue. Exemples : « HelioScreen — Store screen extérieur », « Malaga — Pergola à lames orientables », « Sevilla — Pergola à toiture en toile ». Madera reste « Store banne », car son type de coffre est à confirmer. « Bioclimatique » n'est pas employé.
- Les mentions « prix selon vos dimensions » sont retirées des descriptions quand aucun prix public n'existe.
- Open Graph : titre, description, URL, nom du site, langue et image publiée dimensionnée (photo ou rendu du modèle, sinon le logo sur plaque, 1360 × 427).
- Familles : « Pergolas à lames orientables ou à toiture en toile », « Screens extérieurs et screens de toiture », « Stores bannes à coffre, semi-coffre ou sans coffre », « Moustiquaires sur mesure ».

### Données structurées (JSON-LD)

Elles sont générées par des fonctions pures et testées (`src/server/seo/structured-data.ts`) :
- **Organization** (accueil) : nom, URL, logo. Raison sociale, adresse, téléphone et e-mail n'apparaissent que s'ils sont renseignés dans les Réglages. Aujourd'hui, ils sont vides. Un **WebSite** l'accompagne.
- **BreadcrumbList** sur les familles, les fiches et les guides.
- **Product** sur les fiches : nom, description, URL, catégorie (nature), images. **Aucune offre pour un produit sur devis**, donc jamais de prix à 0. Aucune note, aucun avis, aucun stock, aucun GTIN, aucune marque ni fabricant. Une offre n'est émise que pour un prix public strictement positif, avec sa devise et sa base fiscale (`valueAddedTaxIncluded`). Depuis la désactivation des grilles Casablanca et HelioScreen, aucune fiche n'a d'offre.
- **Pas de LocalBusiness** : aucune adresse d'établissement validée. **Pas de hreflang** : une seule version, en français. **Pas de `llms.txt`**.
- Un balisage valide ne rend pas une page éligible aux résultats enrichis. Un Product sans offre n'est pas éligible aux extraits « produit » de Google : c'est voulu.

### Contenus
- **Pages familles** (bloc `FamilyGuide`) : usages, « quel modèle pour quel projet » (calculé depuis les règles), définitions des termes, déroulement mesures → configuration → demande → devis, questions fréquentes et guides utiles. Le comparatif existant est conservé.
- **Fiches** : bloc « l'essentiel ». C'est un tableau HTML rendu côté serveur : type, fabrication, dimensions, pose, commande, consigne de vent, prix. Les valeurs « à confirmer » sont signalées. Il contient aussi les liens vers les guides applicables. Les onglets existants restent dans le HTML initial.
- **Nouveaux guides publiés** (date réelle : 26 octobre 2026), alimentés par les données du catalogue :
  - `/guides/choisir-sa-pergola`
  - `/guides/choisir-son-screen-exterieur`
  - `/guides/choisir-sa-moustiquaire` (types d'ouverture ; modèles publiés ou en préparation)
  - `/guides/comparer-protections-solaires` (tableau de tous les modèles)
  
  « Préparer les mesures » est couvert par `/guides/prise-de-mesures` (outil) et `/guides/preparation-projet`.
- **Guides corrigés** :
  - « Adossée ou autoportante » : réécrit, sans affirmation propre à un modèle.
  - « Autorisation d'urbanisme » : seuils français précisés (40 m² en zone urbaine couverte par un plan local d'urbanisme, pour une extension) et paragraphe sur la Belgique (règles régionales).
  - « Préparer son projet » : retrait de la livraison « sur palette, sur rendez-vous », non établie.
- **Accueil** : retrait de « la structure seule se commande en ligne au prix de la grille » (plus aucun prix public) et du prix « qui suit la grille ».
- **Interdits respectés** : aucune zone desservie, implantation, équipe, garantie, délai ou prix inventé ; aucune page de ville ; aucun nom de fabricant. Un test vérifie ces contenus.

### Performance

Constats :
- Le contenu principal est rendu côté serveur.
- La 3D (`three`) n'est chargée qu'au clic sur « Vue 3D » ou dans le configurateur : aucune requête 3D au chargement des pages mesurées.
- Les images de galerie ont leurs dimensions, dans des conteneurs à ratio fixe.
- Les polices passent par `next/font`.

Correction : les deux polices (Montserrat pour les titres, Inter pour le texte) passent de `display: swap` à `display: optional`. Sur réseau lent, leur arrivée tardive provoquait un décalage de mise en page (CLS mesuré à 0,175 sur un guide et 0,093 sur `/pergolas` ; 0 après correction).

## 2. Mesures de laboratoire (2026-10-26)

Conditions : build de production local (`next start`, base de développement), profil iPhone 13 à 390 px, processeur ralenti 4×, réseau simulé à 1,6 Mbit/s et 150 ms de latence. Deux passages par page ; Playwright avec l'API Performance du navigateur. Lighthouse n'a pas pu être téléchargé dans cet environnement.

| Page | TTFB | FCP | LCP | CLS (avant correction) | Transféré | JS |
|---|---|---|---|---|---|---|
| `/` | 125–313 ms | 0,9–1,9 s | 0,9–1,9 s | 0 | 347 Ko | 170 Ko |
| `/pergolas` | 59–66 ms | 0,9–1,0 s | 0,9–1,0 s | 0–0,093 | 315 Ko | 155 Ko |
| `/pergolas/marbella` | 61–119 ms | 0,9 s | 2,2–2,3 s | 0 | 305 Ko | 171 Ko |
| `/screens/helioscreen` | 79–164 ms | 0,9 s | 2,1 s | 0,001 | 476 Ko | 171 Ko |
| `/guides/choisir-sa-pergola` | 25–45 ms | 0,8–0,9 s | 0,8–0,9 s | 0,175 | 287 Ko | 155 Ko |
| `/configurateur/marbella` | 76–165 ms | 0,9–1,0 s | 2,6–2,8 s | 0 | 348 Ko | 198 Ko |

### 2 bis. Après correction (polices en `display: optional`, mêmes conditions)

| Page | FCP | LCP | CLS |
|---|---|---|---|
| `/` | 0,9–1,7 s | 0,9–1,7 s | 0 |
| `/pergolas` | 0,9–1,2 s | 0,9–1,2 s | 0 |
| `/pergolas/marbella` | 0,9 s | 2,2–2,4 s | 0 |
| `/screens/helioscreen` | 0,9 s | 2,1 s | 0 |
| `/guides/choisir-sa-pergola` | 0,9 s | 0,9 s | 0 |
| `/configurateur/marbella` | 0,9 s | 2,5–2,6 s | 0 |

La source du décalage, identifiée avec l'API Layout Instability, était la recomposition des paragraphes à l'arrivée de la police. La contrepartie : sur une première visite lente, la police de secours ajustée reste affichée.

Le LCP des fiches (environ 2,2 s) correspond à la photo principale, servie par `/api/media` au format WebP. Piste suivante : servir une variante réduite de la photo principale sur mobile.

Limites :
- Il s'agit de mesures de laboratoire, sur le serveur local, sans proxy, sans CDN et sans la latence réelle du VPS.
- Ce ne sont **pas** des Core Web Vitals terrain. Les données réelles (rapport Core Web Vitals de la Search Console, CrUX) n'existeront qu'après ouverture et avec un trafic suffisant.
- Aucun score n'est promis.

## 3. Outils : état des connexions

| Outil | État | Action exacte restante |
|---|---|---|
| Google Search Console | **Non raccordé** (aucun accès disponible dans cette mission) | Après ouverture publique : créer une propriété « Domaine » `heliostores.com`, vérifier par l'enregistrement **TXT** fourni par Google dans la zone DNS (GoDaddy). Sinon, propriété « Préfixe d'URL » et variable `GOOGLE_SITE_VERIFICATION=<jeton>` (balise meta émise seulement en production indexable). Puis soumettre `https://heliostores.com/sitemap.xml`. |
| Bing Webmaster Tools | **Non raccordé** | Importer la propriété depuis la Search Console, ou vérifier par l'enregistrement CNAME/TXT fourni, ou par la variable `BING_SITE_VERIFICATION=<jeton>` (balise `msvalidate.01`). Soumettre le sitemap. |
| Mesure d'audience | **Aucune activée** | Recommandation : un outil auto-hébergé sans cookie (Matomo en mode sans cookie ou Plausible auto-hébergé), désactivé par défaut et mentionné dans la politique de confidentialité. Le site prévoit déjà un script conditionné au consentement (Réglages : `analyticsEnabled` et `analyticsScriptUrl`). Aucun traceur publicitaire n'est ajouté. |
| Suivi CRM prospect → devis → encaissement | Partiel, dans l'application | L'origine (UTM, référent, page d'entrée) est conservée avec la demande et visible dans le devis, puis la commande et l'encaissement dans l'administration. Aucun CRM externe n'est raccordé. |
| Google Business Profile | **Non créé** | Seulement si l'entreprise est éligible (adresse réelle ou zone de service effective) et si ses informations sont validées. Aucune adresse n'est renseignée aujourd'hui. |

**Attribution UTM** (`src/domain/attribution.ts`) :
- conservation dans le `sessionStorage` du navigateur, sans cookie ni envoi ;
- transmission uniquement avec une demande envoyée par le visiteur ;
- champs connus et tronqués seulement ; le référent est réduit à son domaine ; la page d'entrée est conservée sans paramètres ;
- aucune donnée personnelle n'est placée dans une URL ou un événement analytique.

## 4. Robots des moteurs d'IA (option documentée, non activée)

Aujourd'hui, la règle générale (`User-Agent: *`) s'applique à tous les robots. Il ne faut pas confondre :
- les **robots de recherche ou de réponse**, qui citent et renvoient vers la page : Googlebot, Bingbot, OAI-SearchBot, PerplexityBot, Claude-SearchBot ;
- les **robots de collecte pour l'entraînement** : GPTBot, ClaudeBot, Google-Extended (jeton de contrôle et non robot distinct), CCBot, Applebot-Extended.

Si le client souhaite refuser l'entraînement tout en restant visible dans la recherche, ajouter des groupes `Disallow: /` pour GPTBot, ClaudeBot, Google-Extended, CCBot et Applebot-Extended dans `robotsRules`. Il n'existe **pas** de garantie de respect ni de citation. Aucun document privé n'est ouvert à l'exploration.

## 5. Plan d'action sur 90 jours

Responsables : **Client** = HELIOSTORES (direction, commercial) ; **Tech** = exploitation du site ; **Rédaction** = contenu (client ou prestataire).

### J0 à J7 : ouverture vérifiée
| Priorité | Action | Responsable | Dépendance | Livrable | Indicateur |
|---|---|---|---|---|---|
| P0 | Contrôle d'indexabilité en production : `robots.txt`, sitemap, absence de `noindex` et de `X-Robots-Tag` sur les pages publiques, canoniques en `https://heliostores.com` | Tech | DNS et HTTPS de production | compte rendu de contrôle | 0 page publique en `noindex` ; 0 URL du sitemap en erreur |
| P0 | Vérifier la Search Console et Bing (TXT DNS), soumettre le sitemap | Client + Tech | accès GoDaddy et compte Google | propriétés vérifiées | sitemap « réussi » |
| P0 | Inspection d'URL : accueil, quatre familles, trois fiches, deux guides | Tech | Search Console | demandes d'indexation | pages « indexées » |
| P1 | Suivi des erreurs (404, 5xx) et des demandes reçues, avec leur origine | Tech + Client | administration | point quotidien | demandes par jour ; 0 erreur 5xx |
| P1 | Vérifier l'éligibilité au Google Business Profile (adresse réelle ou zone de service effective) | Client | identité juridique validée | décision écrite | profil créé ou écarté |

### J8 à J30 : pages prioritaires et premiers médias
| Priorité | Action | Responsable | Dépendance | Livrable | Indicateur |
|---|---|---|---|---|---|
| P0 | Compléter les données en attente (registre fournisseur), puis enrichir les fiches concernées | Client + Tech | réponses du fournisseur | fiches mises à jour | points « à confirmer » levés |
| P1 | Améliorer les quatre pages familles d'après les premières requêtes observées | Rédaction | 2 à 3 semaines de données Search Console | textes révisés | CTR des pages familles |
| P1 | Publier les guides d'installation validés (notices fournisseur) | Tech + Client | validation technique | guides publiés | pages indexées |
| P1 | Maillage interne : fiche ↔ guide ↔ famille (en place), puis liens contextuels | Rédaction | — | liens ajoutés | pages orphelines : 0 |
| P2 | Collecter les premiers médias authentiques (chantiers, fabrication) avec autorisation écrite | Client | chantiers réalisés | registre des droits | médias publiés |
| P2 | Fiche Google Business Profile si l'entreprise est éligible | Client | J0–J7 | fiche validée | vues, appels, itinéraires |

### J31 à J60 : preuves et partenariats
| Priorité | Action | Responsable | Dépendance | Livrable | Indicateur |
|---|---|---|---|---|---|
| P1 | Rouvrir Références avec des réalisations documentées (lieu au niveau de la ville, avec accord) | Client + Tech | médias autorisés | rubrique publiée | réalisations publiées |
| P1 | Contenus répondant aux questions reçues des prospects (FAQ par famille) | Rédaction | demandes reçues | questions et réponses ajoutées | demandes « hors sujet » en baisse |
| P1 | Page « Devenir partenaire installateur » avec des conditions réelles | Client | conditions définies | page publiée | candidatures |
| P2 | Liens éditoriaux légitimes depuis les sites partenaires (installateurs, prescripteurs) ; aucun achat de liens | Client | partenariats signés | liens obtenus | domaines référents |

### J61 à J90 : optimisation
| Priorité | Action | Responsable | Dépendance | Livrable | Indicateur |
|---|---|---|---|---|---|
| P1 | Analyse des requêtes, des pages et des prospects qualifiés par famille et par pays | Tech + Client | 60 jours de données | rapport | demandes qualifiées par famille et pays |
| P1 | Réécrire titres et descriptions des pages visibles mais peu cliquées | Rédaction | Search Console | métadonnées révisées | CTR en hausse |
| P1 | Améliorer les parcours qui génèrent peu de devis (configurateur → demande) | Tech | statistiques de passage | correctifs | taux configuration → demande |
| P2 | Développer les thèmes qui apportent des contacts utiles (nouveaux guides) | Rédaction | analyse précédente | guides | demandes issues des guides |

## 6. Indicateurs à suivre

**Mesurables directement :**
- pages indexées et erreurs (Search Console, Bing) ;
- impressions et clics hors requêtes de marque ;
- demandes reçues et demandes qualifiées, par famille et par pays (administration, champ d'origine) ;
- taux de passage configuration → demande ;
- devis émis, ventes et encaissements attribuables (devis → commande → paiement dans l'administration) ;
- visites dont le référent est un moteur d'IA (référents chatgpt.com, perplexity.ai, copilot.microsoft.com, gemini.google.com…), visibles dans l'origine des demandes et dans l'outil d'audience s'il est activé.

**Simples observations (non mesurables de façon fiable) :**
- présence ou citation de HELIOSTORES dans les réponses des assistants d'IA, relevée à la main sur un panel fixe de questions ;
- aucun chiffre de « part de voix IA » ne doit être présenté comme une mesure.
