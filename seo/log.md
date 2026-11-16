# Journal SEO / GEO

Une ligne par changement. État : **proposé** (PR ouverte), **fusionné**, **déployé** (commit en production). Les
changements antérieurs au 2026-11-16 sont décrits dans `docs/seo/` (audits du 2026-10-26 et du 2026-11-13).

| Date | Page / périmètre | Changement | Branche / PR | État |
|---|---|---|---|---|
| 2026-11-16 | 8 fiches tarifées (JSON-LD) | `Offer` sans `price` → `AggregateOffer` avec `lowPrice` = prix d'appel TTC affiché (base fiscale conservée) | PR #3 → `8c082e5` | déployé le 2026-11-16 |
| 2026-11-16 | `/guides/prise-de-mesures` | Conseils de relevé de chaque famille et pose rendus côté serveur (section « Ce qu'il faut mesurer, famille par famille »), avec liens vers les fiches ; logique partagée avec l'outil interactif (`src/domain/measure-advice.ts`) | PR #3 → `8c082e5` | déployé le 2026-11-16 |
| 2026-11-16 | `/guides/adossee-ou-autoportee`, `/guides/autorisation-urbanisme`, `/guides/choisir-toile-et-motorisation` | Liens contextuels vers `/pergolas`, guides et `/devis` ; noms de modèles du tableau des toiles liés aux fiches (indexables) plutôt qu'aux configurateurs `noindex`, lien « Configurer » conservé | PR #3 → `8c082e5` | déployé le 2026-11-16 |
| 2026-11-16 | `seo/` | Mémoire SEO (contexte, carte des requêtes, backlog, panel IA, rapport) et automatisation (`seo/automation/`) | PR #3 → `8c082e5` | déployé le 2026-11-16 |
| 2026-11-16 | serveur | Minuteries installées depuis cette branche : `heliostores-seo-daily.timer` (07:00) et `heliostores-seo-weekly.timer` (lundi 08:30), essais réussis | PR #3 → `8c082e5` | installé, réinstallé depuis `8c082e5` |
