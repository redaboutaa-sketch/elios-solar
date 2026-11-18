# Checklist d'activation commerciale — ELIOS SOLAR

Tant qu'une ligne n'est pas cochée, la fonction reste en démonstration. Le tableau de bord d'administration (`/admin`)
recalcule une partie de ces blocages : réglages manquants, pages non publiées, familles en données de démonstration,
paiement en mode démo. **Une validation n'active jamais seule la vente.** Une référence n'est achetable que si son prix,
sa disponibilité et ses compatibilités sont validés.

## A. Données fournisseur (saisie ou import dans l'administration)

| Donnée attendue | Format | Où l'importer / la saisir | Contrôle requis | Débloque |
|---|---|---|---|---|
| Références, libellés, prix de vente, délais, stocks | CSV (`,` ou `;`) ou JSON. Colonnes `sku,familySlug,label,priceCents,compareAtCents,purchasable,stockMode,stockQty,leadTimeDays,dataStatus,attributes` ; prix en **centimes TTC** ; modèle `docs/import/variants.example.csv` | Administration → Import | Rapprochement avec le tarif fournisseur signé ; `dataStatus=SUPPLIER_VERIFIED` uniquement si une pièce existe ; aperçu avant import | Achat en ligne des variantes standard (`purchasable=true`) |
| Caractéristiques techniques (hauteurs, sections, charges vent/neige, câble…) | Valeur, unité, source et référence du document | Catalogue → Familles (section « caractéristiques sourcées ») et Catalogue → Validation des références | Statut SUPPLIER_CONFIRMED avec un document fournisseur ; si deux confirmations divergent, la valeur reste « à confirmer » | Affichage d'une valeur ferme au lieu de « à confirmer » (exemple : longueur du câble de store banne) |
| Dossiers de validation : persiennes 5/6 m, câble 3 m / 7,5 m, compositions | Données proposées, document ou écrit fournisseur | Catalogue → Validation des références | Passage brouillon → à vérifier → validé, par une autre personne que l'auteur si possible ; validation liée à une version précise des données | Assemblage proposé à la vente (sinon sur devis) |
| Matrice de compatibilité (fermetures × dimensions, poteau intermédiaire, LED, persienne par implantation) | Règles par gamme | Catalogue → Règles | Croisement avec la documentation fournisseur ; aucune compatibilité supposée | Options combinables sans passage par un devis |
| Grille sur-mesure (bornes, pas, cellules, suppléments, validité) | Grille tarifaire versionnée | Catalogue → Grilles sur mesure | Statut « vérifié fournisseur », date de validité, puis archivage de la grille **fictive** v1 | Prix ferme du sur-mesure (sinon estimation et devis) |
| Éclairage inclus ou en option (sur-mesure) | Décision et prix | Catalogue → Sur-mesure / Tarifs | Écrit fournisseur (la référence est contradictoire) | Chiffrage et représentation de la LED en sur-mesure |
| Stocks et délais réels | CSV/JSON (colonnes `stockMode`, `stockQty`, `leadTimeDays`) ou saisie | Catalogue → Stocks / Import | Date de relevé ; réservation testée | Délais affichés fermes |
| Tarifs, TVA, promotions | Saisie | Catalogue → Tarifs / Promotions | Suppression du code de démonstration `BIENVENUE5` | Prix publics définitifs |
| Livraison et montage : zones, frais, délais | Saisie par zone | Catalogue → Tarifs (livraison, montage) | Contrat transporteur ou installateur | Frais de livraison et pose réels |
| Médias autorisés, notices, fiches PDF | Image, vidéo ou PDF avec registre des droits | Médias / Documents | Droit d'usage écrit pour chaque fichier | Remplacement des illustrations de démonstration |

## B. Comptes et services externes (configuration serveur, `.env.prod` jamais commité)

| Donnée attendue | Format | Où la renseigner | Contrôle requis | Débloque |
|---|---|---|---|---|
| Identité vendeur : raison sociale, SIRET, TVA, adresse, téléphone, e-mail | Texte | Administration → Réglages | Extrait Kbis | Mentions légales, factures, CGV |
| Textes juridiques : mentions, CGV, confidentialité, rétractation sur-mesure | Texte validé | Contenus → Pages (statut PUBLISHED) | Relecture juridique | Ouverture au public |
| Domaine et certificat | DNS A/AAAA vers 76.13.44.177 / 2a02:4780:7:f4ca::1 | `SITE_DOMAIN`, `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_URL`, `TRAEFIK_ENABLE=true`, `TRUSTED_PROXIES` = adresse de Traefik | Certificat valide, cookies sécurisés, redirections | Accès public HTTPS |
| Stripe (live) | Clés `sk_live`, `pk_live`, secret du webhook | `PAYMENT_PROVIDER=stripe`, `STRIPE_*` ; webhook sur `/api/webhooks/stripe` | Compte vérifié ; paiement test puis remboursement en live | Paiement réel |
| Paiement fractionné (Alma, Klarna…) | Contrat et activation | Administration → Paiement fractionné, case « compte marchand validé » | Frais et « sans frais » confirmés par contrat ; clauses CGV | Paiement en plusieurs fois réel (simulateur aujourd'hui) |
| Envoi d'e-mails | Hôte, port, utilisateur et mot de passe SMTP, ou clé d'API | `SMTP_*`, `MAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL` | SPF, DKIM et DMARC du domaine ; envoi de test | Confirmations, devis, réinitialisation de mot de passe |
| Assistant IA du chat (facultatif) | Clé d'API | `AI_PROVIDER`, `ANTHROPIC_API_KEY` | Mention dans la politique de confidentialité | Réponses automatiques du chat |
| Sauvegardes | Planification et destination | `scripts/backup.sh` (cron hôte) | Restauration testée | Exploitation en production |

Ordre conseillé : B-identité et textes → A-catalogue et compatibilités → domaine → e-mails → Stripe en live → paiement fractionné.
