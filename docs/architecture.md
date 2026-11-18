# Architecture

## Choix techniques (vérifiés le 2026-10-19 sur les documentations officielles)
- **Next.js 16.4 (App Router, Turbopack, `proxy.ts` au lieu de middleware, APIs de requête asynchrones)**, React 19.3, TypeScript 5.9, Tailwind 4.3.
- **PostgreSQL 16** + **Prisma 7.10** (config dans `prisma.config.ts`, client généré dans `src/generated/prisma`, adaptateur `@prisma/adapter-pg`).
- **better-auth 1.7** (e-mail + mot de passe, sessions en base, réinitialisation, limitation de fréquence) avec champ `role`.
- **Stripe 23** (Checkout hébergé) derrière une interface de fournisseur ; **fournisseur de démonstration** signé HMAC par défaut.
- **nodemailer** vers Mailpit en dev ; file persistante `EmailOutbox` traitée par `scripts/mail-worker.ts` (reprises, idempotence par `dedupeKey`).
- **pdf-lib** pour l'export PDF ; **zod 4** pour la validation ; **pino** pour les journaux (champs sensibles masqués).
- Tests : **Vitest 5** (moteur, intégration base), **Playwright 1.64** (parcours navigateur 390 px / 1440 px).
- Monolithe modulaire déployable en Docker Compose sur VPS (app + PostgreSQL + worker e-mail ; proxy Traefik existant réutilisé).

## Découpage
```
src/domain/        moteur pur : types, géométrie des côtés/segments, évaluation (règles + prix), revalidation, adaptation
src/server/        services serveur : catalogue (chargement, instantané, import), configuration, panier, stock, commande, paiement, devis, contact, mail, pdf, audit
src/server/actions server actions (zod + rate limit + autorisation)
src/app/(boutique) boutique ; src/app/admin administration ; src/app/api webhooks, santé, médias
src/components/    UI (illustrations SVG originales, configurateurs, panier, compte, consentement)
prisma/            schéma, migrations, seed idempotent ; scripts/ exploitation
```

## Flux principaux
1. **Configurateur** : le client calcule un aperçu avec le même moteur (`evaluate`) à partir d'un instantané
   public du catalogue, puis l'action serveur `evaluateAction` confirme (badge « prix confirmé »). Le total
   n'est jamais lu depuis le navigateur : panier, commande et PDF réévaluent depuis l'entrée (`input`).
2. **Projet** : `Configuration` stocke `input`, `result`, versions moteur/catalogue ; lecture = revalidation si
   le catalogue a changé (différence affichée). Jeton de partage aléatoire (24 octets), révocable.
3. **Commande** : `createOrderFromCart` réévalue, crée `Order` + `OrderLine` figées + réservations de stock
   (UPDATE conditionnel atomique), expiration 30 min ; `startPayment` crée `Payment` et l'URL hébergée.
4. **Paiement** : webhook → `ingestPaymentEvent` (unicité `(provider,eventId)`, verrou optimiste) →
   `markOrderPaid` (consomme les réservations, e-mails dédupliqués) ou échec/expiration (libération).
5. **Devis** : snapshot `{input, result}` + e-mails ; administration : statut, montant proposé, validité.
6. **Catalogue** : toute donnée porte un `dataStatus` (demo / observed / supplier_verified / unknown) ;
   les règles de compatibilité sont des lignes éditables (`ClosureCompatRule`, `OptionCompatRule`), la
   règle la plus spécifique l'emporte ; absence de règle = inconnu = devis.

## Sécurité et données personnelles
Secrets uniquement en variables d'environnement (`.env.example` sans valeur) ; cookies de session et
clé invité `httpOnly` ; autorisation serveur (`assertRole`) sur chaque action d'administration ; journal
d'audit ; limitation de fréquence en mémoire ; uploads validés (type, taille, nom aléatoire) ; e-mails
masqués dans les journaux ; export/suppression de compte avec anonymisation des commandes (10 ans).

## Préproduction
`SITE_INDEXABLE=false` ⇒ `noindex`, `robots` interdit tout, sitemap vide, bandeau « préproduction ».
