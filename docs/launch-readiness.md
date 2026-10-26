# Préparation au lancement — état au 2026-10-26

> Document publiable : aucun secret, aucun montant. Détail des éléments attendus : `docs/client-inputs.md` et
> Administration → Registre de lancement. Procédures : `docs/production-runbook.md`.

## Verdict

- **Niveau A (site public sur devis)** : **prêt techniquement, non ouvert**. La production `heliostores.com` est
  déployée sur le serveur (pile distincte, données de test purgées) et contrôlée en local. Trois blocages externes
  restent : **DNS** du domaine (chez GoDaddy, hors de nos accès), **identité légale** du vendeur, **pages légales**
  validées. Les notifications par e-mail ne sont pas opérationnelles (aucun SMTP fourni) : les demandes sont suivies dans
  l'administration.
- **Niveau B (encaissement en ligne)** : **non activé**. Aucun prix public validé (Casablanca et HelioScreen passés sur
  devis le 2026-10-26), aucun compte Stripe identifié, aucune recette sandbox possible. Le site n'est **pas prêt à
  vendre** en ligne ; il est prêt à recevoir des demandes de devis dès son ouverture.

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
