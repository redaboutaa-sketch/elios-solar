# Paiements Stripe — état, raccordement et bascule

> Document publiable : aucun secret, aucun identifiant de compte, aucun montant.

## 1. État au 2026-10-25

| Élément | État |
|---|---|
| Compte Stripe | **non raccordé** : aucune clé n'est présente dans l'environnement (dev ni préproduction). L'adresse e-mail de l'administrateur Stripe indiquée par le client permet d'administrer le compte, mais ce n'est ni une clé ni un identifiant `acct_…` : aucun compte n'a pu être identifié. |
| Prestataire actif | `PAYMENT_PROVIDER=demo` : paiement **simulé** (aucun débit). |
| Code Stripe | prêt et testé (unitaires + intégration, événements simulés en base, aucun appel réseau). |
| Paiement réel | désactivé : une clé `sk_live_…` est **refusée** tant que `PAYMENT_LIVE_ENABLED` ≠ `true`. |

## 2. Ce que fait le code

- **Paiement en ligne (« card »)** : Stripe Checkout hébergé, **moyens de paiement dynamiques** activés dans le
  Dashboard et éligibles pour le client (carte, Apple Pay et Google Pay sur appareil compatible, PayPal et Bancontact
  s'ils sont activés et disponibles pour son pays). Le site n'affiche **aucun bouton** de moyen de paiement : c'est
  la page Stripe qui ne présente que les moyens réellement disponibles. Le fractionné et le virement en sont exclus
  (`excluded_payment_method_types`) car ils ont leurs propres contrôles.
- **Virement bancaire** : Customer Stripe + `customer_balance` (`eu_bank_transfer`, IBAN virtuel du pays
  `MERCHANT_COUNTRY`). `checkout.session.completed` non payé ⇒ paiement **en attente** (jamais « payé »), échéance de la
  commande reportée de `BANK_TRANSFER_HOLD_DAYS` jours (défaut 7, paramètre d'exploitation à confirmer) ;
  `payment_intent.partially_funded` ⇒ montant reçu suivi ; `checkout.session.async_payment_succeeded` ⇒ payée.
  Une capture de virement envoyée par le client ne vaut jamais paiement.
- **Paiement en plusieurs fois (Alma / Klarna)** : uniquement après contrôle serveur de l'éligibilité, sur le montant
  recalculé. Alma (documentation Stripe revérifiée le 2026-10-25) : **particuliers uniquement (B2C)**, **paiement
  domestique** (client et marchand dans le même pays), 2/3/4 fois, **50 € à 5 000 €**, clients FR/BE/ES/IT/LU/NL. Pas
  de frais client inventé, pas d'échéancier inventé, jamais de découpage d'une commande pour passer sous un plafond.
  Le client déclare « Particulier / Professionnel » à la commande.
- **Paiement d'un devis accepté** : l'administrateur ouvre le paiement depuis le devis (montant TTC du devis, taux de
  TVA saisi) ; le client règle sur `/commande/<id>/payer` (compte avec l'e-mail du devis). Une seule commande par
  devis ; le devis émis n'est pas modifié.
- **Webhooks** (`/api/webhooks/stripe`, signature vérifiée, traitement idempotent par identifiant d'événement) :
  succès, refus (`payment_intent.payment_failed`, `async_payment_failed`), abandon / expiration
  (`checkout.session.expired`, `payment_intent.canceled`), montant différent ⇒ refusé, remboursements complets ou
  partiels (`charge.refunded`, `refund.updated`, `refund.failed`), virement en attente puis rapproché, **événement
  tardif** (fonds reçus sur une commande expirée ou annulée ⇒ jamais réactivée automatiquement : signalée « à
  examiner » en administration pour confirmer ou rembourser). Un retour navigateur ne marque jamais une commande payée.
- **Garde-fous du compte** : à la première création de session, le compte est lu (`accounts.retrieveCurrent`) ; si
  `STRIPE_ACCOUNT_ID` est défini et diffère, le paiement est refusé (aucun encaissement sur un autre compte du même
  administrateur). Le compte et l'environnement (test / live) sont enregistrés sur chaque paiement et affichés en
  administration.
- **Hors périmètre** : Shop Pay (non fourni par Stripe) ; acompte (pourcentage non décidé) ; Stripe Connect et toute
  modification de la destination des fonds (la commission commerciale de 3 % est un sujet distinct, non transformé en
  prélèvement).

## 3. Raccordement (préproduction, MODE TEST)

Secrets attendus (dans `.env.prod`, jamais dans le dépôt ni dans une conversation) :

| Variable | Valeur attendue |
|---|---|
| `PAYMENT_PROVIDER` | `stripe` |
| `STRIPE_SECRET_KEY` | clé **de test** `sk_test_…` (ou clé restreinte `rk_test_…`) du compte HELIOSTORES |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` du point de terminaison webhook de préproduction |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` (réservée à une future intégration Elements ; Checkout n'en a pas besoin) |
| `STRIPE_ACCOUNT_ID` | `acct_…` du compte vérifié (recommandé) |
| `MERCHANT_COUNTRY` | pays de l'entité vendeuse (`FR` par défaut) |
| `PAYMENT_LIVE_ENABLED` | absent (ne mettre `true` qu'à la bascule réelle validée) |

Procédure (à réaliser par l'administrateur du compte, connecté au Dashboard Stripe) :
1. Vérifier dans le Dashboard l'entité du compte (raison sociale, pays, `acct_…`) et rester en **mode test**.
2. Paramètres → Moyens de paiement : activer carte, Apple Pay / Google Pay, et si souhaité PayPal, Bancontact,
   virement bancaire, Alma (Alma exige une demande d'activation et un compte éligible).
3. Développeurs → Webhooks : ajouter `https://demo-elios.beaverdata.eu/api/webhooks/stripe` avec les événements
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `checkout.session.expired`, `payment_intent.payment_failed`, `payment_intent.canceled`,
   `payment_intent.requires_action`, `payment_intent.partially_funded`, `charge.refunded`, `refund.updated`,
   `refund.failed` ; copier le secret de signature.
   La préproduction est protégée par une authentification basique : Stripe ne peut pas l'atteindre tant que la route
   webhook n'est pas exemptée au niveau du proxy. **Cette exemption est une décision d'exploitation** (non faite :
   « ne pas supprimer les protections de revue ») ; à défaut, tester avec `stripe listen --forward-to` sur le VPS.
4. Renseigner les variables du § 3 dans `.env.prod` (éditeur sur le serveur, jamais par copier-coller dans un ticket),
   puis redéployer.
5. Recette en mode test : cartes de test Stripe (succès, refus, 3-D Secure), annulation, expiration, remboursement
   complet et partiel depuis le Dashboard, virement simulé (`fund_cash_balance` sur le client de test) ; vérifier en
   administration le statut, la référence et le compte/environnement de chaque paiement.

## 4. Bascule en paiement réel (non faite)

À vérifier **avant** de mettre une clé live et `PAYMENT_LIVE_ENABLED=true` :
- l'entité vendeuse du compte Stripe, les bénéficiaires des fonds et le compte bancaire de versement correspondent au
  montage déclaré (qui vend, qui facture, qui encaisse) ; l'accès de l'administrateur ne remplace pas cette vérification ;
- les documents commerciaux (CGV, mentions légales, factures) portent l'identité du vendeur (aujourd'hui absente :
  `legalIdentityPending`) et les clauses exigées par Alma s'il est activé ;
- les prix publiés et la TVA sont validés (voir `decisions-tarifaires.md`) ;
- un paiement réel de faible montant est réalisé puis remboursé par l'administrateur, sur décision explicite.
