# Itération 3 — Paiement fractionné : rapport

## Fichiers
Créés :
- `src/server/payment/installments-rules.ts` (règles pures), `installments.ts`, `installments-sim.ts`
- `src/app/api/webhooks/payment/installments-sim/route.ts`
- `src/app/(boutique)/commande/[id]/paiement-fractionne-simule/{page,actions}.tsx|ts`
- `src/app/(boutique)/commande/[id]/annulation/actions.ts` (repli carte)
- `src/components/checkout/payment-method-line.tsx`
- `src/app/admin/paiement/page.tsx`, `src/server/actions/admin/installments.ts`
- `tests/unit/installments.test.ts`, `tests/integration/installments.test.ts`, `tests/e2e/10-paiement-fractionne.spec.ts`
- `docs/paiement-fractionne.md`, ce fichier

Modifiés :
- `src/server/payment/index.ts` (`startPayment(orderId, { method, installments })`, `PaymentError`, rattachement par PaymentIntent, remboursements partiels / en attente / échoués idempotents, événement d'échec ignoré après succès)
- `src/server/payment/stripe.ts` (session Klarna/Alma via `allowed_payment_method_types`, métadonnées, `normalizeStripeEvent` : `payment_intent.payment_failed`/`canceled`, `charge.refunded` cumulatif, `refund.updated`/`refund.failed`)
- `src/server/actions/cart.ts` (`checkoutAction` uniquement), `src/components/checkout/checkout-form.tsx`, `src/app/(boutique)/commande/page.tsx`, `.../confirmation/page.tsx`, `.../annulation/page.tsx`
- `src/app/admin/commandes/[id]/page.tsx` (moyen, échéances, frais, remboursements échoués, « Simuler un remboursement »)
- `.env.example` (fin : `INSTALLMENTS_SIM_WEBHOOK_SECRET`)
- Pas de modification de `prisma/schema.prisma`, `src/server/order/service.ts` ni `src/server/actions/admin/orders.ts`.

## Vérifications
- `pnpm typecheck` : OK (après `pnpm exec next typegen` pour les nouvelles routes)
- `pnpm lint` : 0 erreur (1 avertissement préexistant hors périmètre)
- `pnpm test:unit` : 6 fichiers, 105 tests OK
- `VITEST_DB_SETUP=1 pnpm vitest run tests/integration/installments.test.ts` : 13/13 OK
- `tests/integration/orders.test.ts` : 11/11 OK
- `E2E_NO_SERVER=1 pnpm playwright test tests/e2e/10-paiement-fractionne.spec.ts` : 2/2 (desktop + mobile) OK, lancé avec un compte admin e2e dédié (`E2E_ADMIN_EMAIL=e2e-admin-fractionne@test.invalid`, mot de passe aléatoire) parce qu'une exécution Playwright parallèle d'un autre agent réinitialisait le compte admin e2e partagé. Le test restaure les réglages d'origine en fin d'exécution.

## Simulé
Page hébergée du prestataire, acceptation / refus / abandon, remboursement admin : simulateur `INSTALLMENTS_SIM` (événements HMAC, aucune transaction).
Session Stripe Klarna/Alma et webhooks Stripe : code en place, normalisation et chaîne d'ingestion testées sur des événements construits, jamais exécutés contre Stripe.

## Pour activer le réel
Compte Stripe FR validé ; Alma et/ou Klarna activés dans le Dashboard ; contrat prestataire (frais client, confirmation écrite du « sans frais », URL CGU) ; clauses CGV Alma ; `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY` (sk_live_), `STRIPE_WEBHOOK_SECRET` ; endpoint `/api/webhooks/stripe` abonné aux événements listés dans `docs/paiement-fractionne.md` ; dans `/admin/paiement` : prestataire, bornes, échéances, « compte marchand validé » + date/référence, puis activation production.

## Limites
Klarna FR plafonné à 3 000 € (la plupart des pergolas en sont exclues) ; Alma à 5 000 €. Litiges non traités automatiquement. Remboursement réel via le Dashboard Stripe uniquement. Note de validation marchand dans le journal d'audit (aucune colonne dédiée). Offre affichée calculée sur le panier puis revalidée sur la commande.
