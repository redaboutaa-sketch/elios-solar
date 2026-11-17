# Backlog SEO / GEO

Ordre : impact probable sur les demandes de devis qualifiées, puis effort. Un élément « en PR » n'est **pas** en
production. Gravité : F (bloque exploration/indexation d'une page commerciale), R (indexable mais ne peut pas bien
se classer ou convertir), C (autorité, liens, visibilité IA), M (mineur).

| # | Action | Page(s) | Grav. | Effort | Confiance | Statut |
|---|---|---|---|---|---|---|
| B1 | Offre `Product` sans champ `price` requis (seulement `priceSpecification.minPrice`) → `AggregateOffer.lowPrice` égal au prix d'appel affiché | 8 fiches tarifées | R | 30 min | élevée (doc Google « Product snippet ») | déployé (`8c082e5`, 2026-11-16) |
| B2 | Conseils de mesure présents dans le HTML serveur pour une seule combinaison (pergola autoportante) → section serveur « famille par famille » | `/guides/prise-de-mesures` | R | 1 h | élevée (HTML observé) | déployé (`8c082e5`, 2026-11-16) |
| B3 | Guides sans lien vers les fiches : liens contextuels (adossée/autoportante, urbanisme) ; tableau toiles → fiches au lieu des configurateurs `noindex` | 3 guides | R | 30 min | moyenne | déployé (`8c082e5`, 2026-11-16) |
| B15 | Métadonnées (titre, canonique, robots) diffusées après le `<head>` lors d'un rendu dynamique pour les User-Agents absents de la liste Next.js (`HTML_LIMITED_BOT_UA_RE` : Googlebot et Bingbot y sont, **pas** GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot) ; observé le 2026-11-16 sur `/stores-bannes/casablanca` et `/pergolas/malaga` → option documentée `htmlLimitedBots` dans `next.config.ts` (docs Next.js `metadata-and-og-images.md`) | toutes les pages dynamiques | R (GEO) | 30 min | élevée (code Next.js lu, observation reproduite) | **déployé** (`8d8d424`, 2026-11-17 ; après : ClaudeBot et GPTBot 24/24 dans le `<head>` en production) : liste Next.js + 13 robots d'IA ; sonde quotidienne ajoutée. Mesure avant : 1 réponse en flux sur 6 pour ClaudeBot sur 2 fiches en production (0/6 pour Bingbot) ; après, en local : 0/30 pour GPTBot et ClaudeBot |
| B4 | Lacune : aucun contenu pour « store banne coffre, semi-coffre ou sans coffre » (4 modèles vendus) → guide de choix fondé sur les données des fiches | nouveau guide (au plus 2/mois) | R | 3 h | moyenne (pas de volume sourcé) | à faire (revue mensuelle) |
| B5 | H1 des fiches = nom commercial seul (« HelioPro ») alors que la requête porte sur la nature (« store banne sans coffre ») ; proposer un sur-titre visible ou un H1 « nature + nom » | 14 fiches | R | 1 h | moyenne | proposition : touche au design validé, accord client requis |
| B6 | Titres courts et génériques des guides (« Prise de mesures — HELIOSTORES », « Choisir sa pergola — HELIOSTORES ») | 6 guides | M→R | 30 min | faible sans données | attendre un signal Search Console (pas de réécriture sans mesure) |
| B7 | URL établies portant les anciens noms (`/pergolas/malaga` = HelioSky…) | 9 fiches | C | élevé (redirections) | moyenne | proposition séparée uniquement ; ne pas modifier |
| B8 | Vignettes de galerie 80 px avec `alt=""` (décoratives, doublons de la vue principale) | fiches | M | — | élevée | conforme si décoratives ; rien à faire |
| B9 | Vignettes chargées en 640 px pour 78 px affichés (`scripts/media-variants.ts`) | fiches | M | 1 h | élevée | repris de l'audit du 13/11 |
| B10 | `llms.txt` absent (404) | / | M | 30 min | faible : aucun effet de classement documenté | facultatif, faible priorité |
| B11 | Search Console et Bing Webmaster Tools : accès non disponibles ici ; indexation non vérifiée | site | C | client | — | demandé au client (`docs/seo/audit-2026-11-13.md` § 3) |
| B12 | Panel IA (15 questions) : aucune mesure réelle encore ; Claude (runner) seul moteur accessible | — | C | hebdo | — | à mesurer au passage hebdomadaire (voir `ai-prompts.md`) |
| B13 | Descriptions MoskiUp / MoskiSlide > 160 caractères (données catalogue) | 2 fiches | M | 15 min | élevée | à la prochaine synchronisation du catalogue |
| B14 | Redirection `http://www` → `https://www` → apex : deux sauts | www | M | Traefik partagé | élevée | ne pas toucher (réseau Traefik partagé) |

Opportunités externes (propositions, rien n'est envoyé) : `docs/seo/partnerships-and-geo.md`.
