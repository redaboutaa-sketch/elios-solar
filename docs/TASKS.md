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
- ✅ CI GitHub Actions verte ; Dockerfile + Compose production ; scripts de sauvegarde/restauration (restauration non exécutée)
- ✅ Draft PR #1

## Incrément 6
- ⏳ Vue 3D (après stabilisation des règles)

## Itération 2 — audit REA et présentation
- ✅ Audit comparatif v2 avec REA (`docs/gap-analysis-v2.md`)
- ✅ Correction de la grille de prix démo des fermetures et LED
- ✅ Identité : logo/favicon, menu Pergolas déroulant, bouton Comparer, téléphone
- ✅ Accueil : hero avec scène originale, cartes de gammes enrichies (équipements calculés), section « essentiel »
- ✅ Fiche produit : galerie 4 vues générées, points clés, onglets, comparatif, barre mobile
- ✅ Accessoires : compatibilité calculée (collection + fiche), couleurs, longueurs
- ✅ Configurateur : bloc « inclus », prix/délai/lien par fermeture, couleur de l'éclairage inclus, modification depuis le panier (pergola et store)
- ⏳ Photographies et documents fournisseur (gap-analysis-v2 § F) ⛔ — interfaces livrées en itération 3
- ✅ Vue 3D (itération 3)

## Itération 3 — écarts restants (statuts : `docs/iteration3/README.md`)
- ✅ Médiathèque administrable, rendus originaux identifiés, documents versionnés, espace documentaire, guide de préparation
- ✅ Stocks et délais par référence, import contrôlé, adaptateur fournisseur, estimation de livraison, revalidation au checkout
- ✅ Moteur de grille sur mesure versionnée (import, validation, test, publication), grille fictive séparée
- ✅ Persiennes 5/6 m modulaires (devis), câble inclus vs rallonge 6 m (devis)
- ✅ Vue 3D procédurale (pergola, store banne), export d'image indicative
- ✅ Chat de conseil (présence réelle, hors ligne, admin, assistant IA optionnel)
- ✅ Paiement fractionné : adaptateur Stripe désactivé + simulateur identifié
- ✅ Sauvegarde, restauration isolée, redéploiement Docker 3401, commit exposé
- ⏳ Joindre l'image 3D au devis ; 3D du sur-mesure ; écran de validation des références
- ⛔ Données fournisseur (photos, notices, grille, assemblages, câble, délais réels), comptes Stripe/Alma/Klarna, SMTP, domaine
