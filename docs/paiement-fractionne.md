# Paiement fractionné (ELIOS SOLAR)

État : **implémenté avec simulateur** ; paiement fractionné réel **désactivé** tant que le compte marchand n'est pas validé (`merchantEligible`) et qu'un prestataire réel n'est pas configuré. Aucune clé ni transaction réelle dans le dépôt.

## 1. Recherche (documentation Stripe officielle, consultée le 2026-10-19)

Sources : <https://docs.stripe.com/payments/klarna> · <https://docs.stripe.com/payments/alma>

| | Klarna (via Stripe) | Alma (via Stripe) |
|---|---|---|
| Marchand FR, EUR | oui | oui (comptes Stripe FR acceptés) |
| Clients | FR (entre autres) | FR, IT, ES, NL, BE, LU |
| Offres FR | 3 fois sans intérêts **1–3 000 €** ; paiement intégral 0–4 000 € ; différé 30 j 0–500 € | 2 / 3 / 4 fois **50–5 000 €** |
| Financement long | non en France | non |
| B2B | non | — |
| Remboursements | complets et partiels jusqu'à 180 j | asynchrones (`refund.updated` / `refund.failed`) |
| Litiges | oui | `charge.dispute.created` |
| Obligations | — | clauses CGV imposées par Alma : achat soumis aux CGU d'Alma, refus possible ⇒ annulation, rétractation 14 jours |

Les deux moyens s'activent dans le Dashboard Stripe (moyens de paiement dynamiques) et se ciblent sur une Checkout Session en mode `payment`.
**Note SDK** : `stripe@23` (API `2026-09-30.endive`) a retiré `payment_method_types` des paramètres de Checkout Session ; l'adaptateur utilise donc `allowed_payment_method_types: ["klarna"]` ou `["alma"]` (filtre sur les moyens dynamiques : le moyen doit être activé dans le Dashboard).

Conséquences pour le site :
- un panier pergola typique (2 500–6 000 €) **dépasse le plafond Klarna FR (3 000 €)** et peut dépasser Alma (5 000 €) : l'éligibilité par montant est contrôlée côté serveur, sur le total recalculé de la commande ;
- les frais client (0 ou non) et le libellé « sans frais » dépendent du contrat marchand : **« sans frais » n'est jamais affiché sans `noFeesConfirmed`**.

## 2. Choix d'architecture

- **Un seul adaptateur Stripe Checkout hébergé**, paramétré par le prestataire (`stripe_klarna` | `stripe_alma`) : pas de donnée bancaire sur le site, webhooks Stripe déjà en place.
- **Simulateur** (`INSTALLMENTS_SIM`) clairement identifié, pour les tests contractuels sans identifiants : page hébergée simulée + webhook signé HMAC, mêmes chemins d'idempotence que la production. Jamais activable en production.

Fichiers :
- `src/server/payment/installments-rules.ts` : règles pures (éligibilité, bornes prestataires, répartition, frais, validation des réglages) ;
- `src/server/payment/installments.ts` : `getInstallmentSettings()` (singleton upsert), `currentEnv()`, état d'exécution, offre ;
- `src/server/payment/installments-sim.ts` : fournisseur simulé, signature HMAC ;
- `src/server/payment/index.ts` : `startPayment(orderId, { method, installments })`, `ingestPaymentEvent` (remboursements partiels/asynchrones/échoués) ;
- `src/server/payment/stripe.ts` : session Klarna/Alma, `normalizeStripeEvent` ;
- `src/app/api/webhooks/payment/installments-sim/route.ts` ; `src/app/(boutique)/commande/[id]/paiement-fractionne-simule/` ;
- `src/app/admin/paiement/page.tsx`, `src/server/actions/admin/installments.ts`.

## 3. Règles

- Environnement : `prod` seulement si `PAYMENT_PROVIDER=stripe` **et** clé `sk_live_…` ; sinon `test`.
- Éligible si : activé pour l'environnement courant (`enabledTest` / `enabledProd`), prestataire ≠ `none`, en prod `merchantEligible` et prestataire réel, montant dans [min, max] des réglages **et** dans les bornes du prestataire (Klarna 100–300 000 c, 3 fois ; Alma 5 000–500 000 c, 2/3/4 fois ; simulateur : bornes des réglages), pays dans `countries` (et accepté par le prestataire), devise EUR. Klarna/Alma exigent en plus que Stripe soit le prestataire actif ; le simulateur est inactif si `PAYMENT_PROVIDER=stripe`.
- Répartition : `other = floor(total/n)`, `first = total − other×(n−1)` (somme exacte).
- Frais : `round(total×feesBps/10000) + feesFixedCents`, inclus dans l'échéancier ; libellé « sans frais » uniquement si frais nuls **et** `noFeesConfirmed`, sinon « frais : X € (selon contrat prestataire) » ou « frais non confirmés ».
- Enregistrement des réglages refusé si `enabledProd` avec `none`/`simulator` ou sans `merchantEligible`, si les bornes/échéances sortent de celles du prestataire, ou si « sans frais confirmé » coexiste avec des frais. La date/note de validation marchand est conservée dans le journal d'audit (pas de colonne dédiée).

## 4. Parcours

1. `/commande` : bloc « Moyen de paiement » (carte par défaut ; options « Paiement en N fois via … » seulement si éligible, avec 1re échéance, suivantes, frais, « sous réserve d'acceptation par le prestataire », lien CGU si `termsUrl`).
2. `checkoutAction` lit `paymentMethod`/`installments` ; `startPayment` revalide sur le total de la commande et refuse avec un message clair.
3. Page hébergée (Stripe ou simulateur) ⇒ webhook ⇒ commande `PAID` / `PAYMENT_FAILED` / `CANCELLED`.
4. Confirmation : moyen utilisé affiché. Annulation : en cas de refus, « Le prestataire n'a pas accepté le paiement fractionné : vous pouvez régler par carte » + bouton de paiement carte (même commande si encore `PENDING_PAYMENT`, sinon `/commande?repli=carte` depuis le panier conservé).
5. Admin : fiche commande = moyen, échéances, frais, événements, remboursements (échecs en rouge), bouton « Simuler un remboursement » pour le simulateur.

Webhooks Stripe gérés : `checkout.session.completed` / `async_payment_succeeded` / `async_payment_failed` / `expired`, `payment_intent.payment_failed` / `canceled` (rattachés à la session connue via le PaymentIntent), `charge.refunded` (cumulatif ⇒ partiel), `refund.updated` / `refund.failed` (Alma asynchrone ; `failed` signalé en admin). Idempotence par `(provider, eventId)` et, pour les remboursements, par référence de remboursement.

## 5. Activer le réel

1. Compte Stripe France validé ; dans le Dashboard, activer **Alma** (recommandé pour les paniers ≤ 5 000 €) et/ou **Klarna** (≤ 3 000 € en 3 fois).
2. Obtenir du prestataire la validation du compte marchand et le **contrat** : frais client éventuels, confirmation écrite du « sans frais », URL des CGU.
3. Ajouter aux CGV les clauses imposées (Alma : achat soumis aux CGU d'Alma, refus possible ⇒ annulation, rétractation 14 jours).
4. Variables : `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY` (sk_live_ en prod), `STRIPE_WEBHOOK_SECRET`.
5. Endpoint webhook Stripe `https://<domaine>/api/webhooks/stripe` abonné à : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, `refund.updated`, `refund.failed`, `charge.dispute.created` (ce dernier est journalisé mais non traité).
6. `/admin/paiement` : prestataire `stripe_alma`/`stripe_klarna`, bornes ≤ celles du prestataire, échéances, frais, CGU, cocher « compte marchand validé » avec date/référence, tester en mode test (clé sk_test_), puis activer en production.

## 6. Simulé vs réel

- Simulé : page `paiement-fractionne-simule`, acceptation/refus/abandon, remboursement admin (aucun prestataire contacté, aucun argent).
- Réel mais non exercé (pas d'identifiants) : création de session Stripe Klarna/Alma, réception des webhooks Stripe (normalisation testée sur des événements construits).

## 7. Limites

- Pas de remboursement réel depuis l'admin (à faire dans le Dashboard Stripe ; les webhooks mettent à jour la commande).
- Les litiges (`charge.dispute.created`) ne sont pas traités automatiquement.
- L'échéancier affiché est indicatif : le prestataire fixe le calendrier exact et peut refuser.
- L'offre affichée sur `/commande` est calculée sur le total du panier ; elle est revalidée sur le total de la commande à la validation.
- Pas de colonne pour la note de validation marchand (journal d'audit).
