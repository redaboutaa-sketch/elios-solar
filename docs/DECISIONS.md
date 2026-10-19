# Journal des décisions

| Date | Décision | Motif |
|---|---|---|
| 2026-10-19 | Dépôt initialisé avec un commit `main` minimal puis branche `feat/storefront-configurator` | Dépôt distant vide ; consigne du cahier des charges |
| 2026-10-19 | REA = serveur MCP `rea-agents@6.5.0` + skill `reverse-engineer-anything` (outils de rétro-ingénierie), **pas** un workflow de livraison | Seul « REA » trouvé dans l'environnement ; aucun cycle plan/exécution/revue n'y est défini ⇒ travail séquentiel, clarification demandée |
| 2026-10-19 | Projet neuf : Next.js 16 + Prisma 7 + PostgreSQL + better-auth + Stripe (test) + Mailpit, monolithe | Aucun socle existant dans le dépôt ; adapté à un VPS ; versions vérifiées sur les docs officielles |
| 2026-10-19 | Moteur de configuration pur et partagé client/serveur ; serveur autoritaire | Même code pour aperçu, panier, devis, commande ; testable sans base |
| 2026-10-19 | Prix stockés TTC en centimes + taux de TVA en points de base | Affichage B2C TTC ; TVA déduite par ligne, arrondi commercial |
| 2026-10-19 | Côté ≥ 6 m divisé en 2 segments (poteau intermédiaire) sur toutes les gammes ; fermetures 5 m sur la gamme Max en statut inconnu | Règle observée sur la référence ; non confirmée pour la gamme premium ⇒ devis |
| 2026-10-19 | Pergola noire : paroi vitrée et persienne interdites (n'existent pas en noir), store ZIP noir autorisé | Observé (filtrage couleur du configurateur de référence) |
| 2026-10-19 | Bandes LED : incluses sur la gamme Pro (non refacturées), inconnues sur la gamme Max | Éclairage déjà intégré ; cumul non documenté |
| 2026-10-19 | Sur mesure en devis uniquement, sans prix au m² | Aucune grille fournisseur validée (la formule observée est celle du concurrent) |
| 2026-10-19 | Noms de gammes propres (Solis / Solis Pro / Solis Max, store Ombra) et illustrations SVG originales | Identité propre ; aucun média ni marque du concurrent |
| 2026-10-19 | Prix de démonstration générés par formule (fixe + €/m²), tous marqués `demo` | Ne jamais reprendre les tarifs d'un concurrent |
| 2026-10-19 | Fournisseur de paiement « DEMO » signé HMAC, même chemin de webhook que Stripe | Préproduction vérifiable sans clés réelles |
| 2026-10-19 | Règle ESLint `react/no-unescaped-entities` désactivée | Textes français avec apostrophes dans le JSX |
| 2026-10-19 | `AGENTS.md` généré par `next dev` conservé tel quel | Évite un diff permanent ; pointe vers les docs de la version installée |
| 2026-10-19 | REA (`rea-agents`, `capture_browser_scenario` en mode launch avec le Chromium Playwright) utilisé pour l'audit v2 : arbres d'accessibilité et interactions des pages publiques, sans achat ni formulaire | Outil REA confirmé par le propriétaire ; captures pixel via Playwright, hors dépôt pour la référence |
| 2026-10-19 | Prix démo des fermetures et LED recalculés (erreur de facteur 100 détectée à l'audit v2) | Grille cohérente avec les pergolas, toujours `demo` |
| 2026-10-19 | Éclairage inclus (Pro) : couleur choisie via l'option `bandes-led` marquée `includedInBase`, une seule ligne « inclus » | Comportement observé sur la référence (« Gratuit ») sans refacturation |
| 2026-10-19 | Rendus SVG originaux (scène de terrasse, vues multiples) en attendant des photographies autorisées ; liste des médias manquants dans gap-analysis-v2.md § F | Aucune image de tiers |
