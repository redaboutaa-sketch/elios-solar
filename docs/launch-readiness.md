# Préparation au lancement — état au 2026-10-26 (mis à jour après la bascule)

> Document publiable : aucun secret, aucun montant. Détail des éléments attendus : `docs/client-inputs.md` et
> Administration → Registre de lancement. Procédures : `docs/production-runbook.md`.

## Verdict

- **Niveau A (site public sur devis)** : **bascule préparée, bloquée par le DNS**. Routeur public, HTTPS (Let's
  Encrypt, deux noms), identité THYSENS et pages légales (mentions, confidentialité, cookies) sont en place sur le
  commit `7a70796`. La zone GoDaddy publie encore deux A « WebsiteBuilder Site » (`76.223.105.230`, `13.248.243.5`) à
  côté de `76.13.44.177` : la plupart des visiteurs IPv4 voient l'ancien site GoDaddy (7 sondes externes sur 8). À
  corriger chez GoDaddy (runbook § 4). Les notifications par e-mail ne sont pas opérationnelles (aucun SMTP) : suivi
  manuel des demandes dans l'administration (runbook § 5 bis), qui suppose la création d'un compte administrateur.
- **Niveau B (encaissement en ligne)** : **non activé**. Aucun prix public validé (Casablanca et HelioScreen passés sur
  devis le 2026-10-26), aucun compte Stripe identifié, aucune recette sandbox possible. Le site n'est **pas prêt à
  vendre** en ligne ; il est prêt à recevoir des demandes de devis dès son ouverture.

## Version

Production : commit **`7a70796`** (`/api/health`), CI verte. Préproduction : `e2afbed`. Recette HTTPS complète derrière
Traefik sur `e2afbed` : 69 réussis, 0 échec, 4 ignorés justifiés ; contrôles ciblés de la bascule sur `7a70796`
(`docs/test-report.md`).

## Niveau A — critères

| Critère | État | Preuve / remarque |
|---|---|---|
| Catalogue fiable | ✅ | 11 modèles publiés sur devis ; 3 brouillons ; 3 retirés (page explicative, sans conversion) ; aucune caractéristique « à confirmer » présentée comme acquise |
| Configurateurs = possibilités confirmées | ✅ | choix non confirmés marqués « à confirmer » ; MoskiFold / MoskiFold 2 en demande d'étude (aucune borne publiée) |
| Demande de devis | ✅ | parcours fiche → configuration → coordonnées → demande → confirmation → administration couvert par la recette navigateur |
| Notification | ⚠️ | aucun SMTP : `MAIL_PROVIDER=hold` (messages en file, non marqués « envoyés ») ; canal disponible : tableau de bord de l'administration (« Devis nouveaux ») |
| Paiement désactivé | ✅ | `PAYMENT_PROVIDER=disabled` : panier, commande, paiement de devis et simulateurs refusés côté serveur |
| Prix publiés | ✅ | aucun prix public ; aucun « 0 € » (HTML, JSON-LD, Open Graph) |
| Pages vides retirées | ✅ | Références, réalisations, savoir-faire : 404 et hors menu ; aucun onglet vidéo |
| Indexation (production) | ✅ en local | robots `Allow`, sitemap des pages canoniques publiées, `X-Robots-Tag` seulement sur les pages privées |
| Préproduction protégée | ✅ | 401 sans identifiant, noindex partout |
| Séparation des environnements | ✅ | projet, base, volumes, réseau, secrets et port distincts |
| Sauvegarde et restauration | ✅ | sauvegarde du 2026-10-26, restauration vérifiée dans un PostgreSQL jetable ; **planification et copie externe à prévoir** |
| Retour arrière | ✅ | runbook § 7 (image précédente, routage coupé sans suppression, restauration) |
| DNS / HTTPS | ❌ externe | enregistrements à créer chez GoDaddy (runbook § 4) |
| Identité légale, mentions légales, confidentialité | ❌ externe | Réglages vides ; pages en brouillon |

## Niveau B — critères (aucun satisfait)

| Critère | État |
|---|---|
| Montant de vente validé | ❌ grilles Casablanca / HelioScreen désactivées (devise, inclusions, validité, TVA, validation nominative non établies) ; nouveaux modèles sans grille |
| Configuration techniquement admissible | ⚠️ règles en place, données fournisseur partielles |
| Conditions commerciales | ❌ CGV, acompte, rétractation du sur-mesure non validés |
| Compte Stripe identifié et raccordé | ❌ aucune clé, aucun `acct_…` |
| Recette sandbox Stripe réelle | ❌ impossible sans clés de test |
