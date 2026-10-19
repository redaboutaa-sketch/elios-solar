# Tâches

Légende : ✅ fait (codé + vérifié) · 🔄 en cours · ⏳ à faire · ⛔ bloqué (dépendance externe)

## Incrément 1 — diagnostic, audit, modèle
- ✅ Diagnostic VPS (ressources, Docker, Traefik 80/443, ports), Git/GitHub (HTTPS via gh), tmux
- ✅ Identification de REA (MCP de rétro-ingénierie) — clarification demandée, travail séquentiel
- ✅ Audit public de la référence (catalogue JSON, pages, scripts du configurateur) → `reference-audit.md`
- ✅ Matrice de parité `catalogue-parity.csv`, matrice de compatibilité `compatibility-matrix.csv`
- ✅ Modèle de données Prisma (catalogue, règles, configurations, panier, devis, commandes, paiements, stock, e-mails, consentements, audit, contenus)

## Incrément 2 — socle et première tranche
- ✅ Socle Next 16 / Prisma 7 / better-auth / Tailwind 4 ; services dev (PostgreSQL 5433, Mailpit 8025)
- ✅ Moteur de configuration (géométrie, règles, prix, revalidation, adaptation) + 32 tests unitaires
- ✅ Seed idempotent (13 familles, 291 variantes démo, règles, tarifs, pages)
- ✅ Configurateur standard (8 étapes, plan 2D, adaptations, devis, sauvegarde, panier)
- ✅ Panier, commande, paiement démo signé, webhook idempotent, confirmation, compte client
- ✅ Administration : tableau de bord et blocages de lancement, commandes, devis, contacts, catalogue (familles, variantes, règles, tarifs, promotions, sur mesure), contenus, médias (registre des droits), import CSV/JSON, e-mails, réglages, utilisateurs, journal

## Incrément 3 — extension
- ✅ Sur mesure (devis), store banne (variantes réelles), accessoire seul (compatibilité)
- ✅ Projets : versions, partage révocable, duplication, PDF
- ✅ Import fournisseur (CLI `pnpm catalogue:import` + administration, aperçu puis application)

## Incrément 4 — expérience et contenus
- ✅ Accueil, collections (filtres/tri/vide), fiches, comparateur, devis, contact, rappel, aide, guides, pages légales, réalisations, showroom, cookies
- ⏳ Médias réels, documents ⛔ (fournisseur)

## Incrément 5 — vérifications et exploitation
- ✅ Tests d'intégration serveur (14) — voir test-report.md
- ✅ Tests Playwright (11 scénarios × 2 viewports) + captures 390/1440
- ✅ CI GitHub Actions (à observer au premier push) ; Dockerfile + Compose production ; scripts de sauvegarde/restauration (restauration non exécutée)
- 🔄 Draft PR

## Incrément 6
- ⏳ Vue 3D (après stabilisation des règles)
