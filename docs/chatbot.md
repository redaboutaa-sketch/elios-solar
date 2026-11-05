# Chat du site — fonctionnement réel et raccordement d'un assistant LLM

> État au 2026-10-31 (production) : **aide immédiate déterministe + collecte des demandes**. Aucun fournisseur LLM
> n'est configuré : aucune réponse n'est générée par une IA, aucun crédit n'est consommé.

## 1. Ce qui existe

| Fonction | État | Code |
|---|---|---|
| Bulle et panneau (ordinateur et mobile) | en service | `src/components/chat/chat-widget.tsx` |
| Aide immédiate (thèmes, réponses validées) | en service | `src/domain/chat-guide.ts`, `src/server/chat/guide.ts` |
| Réponse automatique à chaque message (sans LLM) | en service | `src/server/chat/auto-reply.ts` |
| Conversation enregistrée, séparée par visiteur | en service | `src/server/chat/service.ts` (cookie `es_guest` ou compte) |
| Consultation et réponse dans l'administration | en service | Administration → Conversations |
| Présence d'un conseiller | réelle (administrateur actif < 5 min) | `advisorsOnline` |
| Notifications par e-mail | **en attente** : `MAIL_PROVIDER=hold`, aucun SMTP | Administration → E-mails |
| Assistant LLM | prêt, **désactivé** (aucune clé) | `src/server/chat/assistant.ts` |

### Mode A — aide immédiate (sans LLM)
- Thèmes proposés (Nos produits, Prix et devis, Délais de livraison, Prendre les mesures, Pose et installation,
  Couleurs, Fermer les côtés) : réponse immédiate, **rien n'est enregistré**, aucune donnée demandée.
- Message libre : enregistré dans la conversation (consentement, e-mail obligatoire si personne n'est connecté), puis
  réponse déterministe aussitôt visible, avec liens vers les pages du site :
  - produit cité (nom HELIO, ancien nom ou identifiant) → description publiée, statut de prix (affiché par le
    configurateur pour une grille publiée, sinon sur devis), « caractéristiques en cours de confirmation » le cas échéant ;
  - thème reconnu → réponse du thème ;
  - commande, paiement, garantie, SAV, réclamation → « traité par l'équipe », transmission enregistrée ;
  - sinon → « Je n'ai pas de réponse validée », la demande reste pour l'équipe.
- Sources : familles publiées ou sur devis (nom, description courte), grilles de vente en vigueur (présence seulement),
  délai publié (`src/domain/delivery.ts`), contact public. Jamais de montant, de stock, de délai, de certification, de
  compatibilité ni de référence fournisseur inventés ou divulgués.
- Libellé « Aide automatique » ; jamais présentée comme un conseiller. Statut affiché : « Un conseiller est connecté »
  ou « Aucun conseiller connecté : votre message est enregistré pour l'équipe » (sans messagerie, aucune « réponse par
  e-mail » n'est promise).
- Plus aucune réponse automatique dès qu'un conseiller a répondu ou qu'une transmission est demandée.

### Suivi par l'équipe
Administration → Conversations : fil complet (client, « Aide automatique », conseiller, système), liens vers projet,
devis ou commande, assignation, statut, réponse (le client la voit dans le panneau ; sans SMTP, il n'est pas averti
par e-mail : répondre aussi depuis sa propre messagerie, runbook § 5 bis).

## 2. Mode B — assistant LLM (facultatif)

Une API LLM n'est **pas** nécessaire pour l'aide guidée. Elle ne l'est que pour générer des réponses en langage
naturel. Aucun modèle local n'est installé sur le VPS partagé.

### Configuration (fichier d'environnement du serveur uniquement)
Noms conformes aux conventions existantes du projet (`AI_*`, équivalents de `CHAT_PROVIDER`, `CHAT_MODEL`,
`CHAT_API_KEY`) :

| Variable | Valeur |
|---|---|
| `AI_PROVIDER` | vide (désactivé), `anthropic` ou `openai_compatible` |
| `ANTHROPIC_API_KEY` | clé (anthropic) |
| `AI_API_KEY` | clé (openai_compatible) |
| `AI_MODEL` | modèle (obligatoire pour openai_compatible ; anthropic : `claude-sonnet-5-5` par défaut) |
| `AI_BASE_URL` | URL du service, https obligatoire (ex. `https://api.deepseek.com`) |
| `AI_MAX_TOKENS` | plafond par réponse (600) |
| `AI_TIMEOUT_MS` | délai maximal (20 000 ms) |
| `AI_DAILY_LIMIT` | réponses LLM par 24 h, tous visiteurs (200) ; au-delà, aide immédiate |

Ne jamais coller une clé dans la conversation, un ticket, une URL, le dépôt ou un terminal journalisé : la déposer
directement dans `.env.heliostores-prod` (600), puis redéployer (`scripts/deploy-production.sh <TAG>`).

### DeepSeek (possibilité, non retenue à ce jour) — vérifié le 2026-10-31 sur api-docs.deepseek.com
- API compatible OpenAI : `https://api.deepseek.com`, point `/chat/completions`, en-tête `Authorization: Bearer`.
- Modèles listés : `deepseek-flash`, `deepseek-v4-pro`. Tarification par million de jetons (entrée avec ou sans
  cache, sortie), tarif réduit hors heures de pointe ; page « Models & Pricing » de la documentation.
- Conservation des données et localisation des serveurs : **non indiquées** sur ces pages — à vérifier dans la
  politique de confidentialité du fournisseur avant toute activation (transfert hors UE possible).
- Configuration : `AI_PROVIDER=openai_compatible`, `AI_BASE_URL=https://api.deepseek.com`, `AI_MODEL=<modèle>`,
  `AI_API_KEY=<clé>`.

### Garde-fous
- Réponses fondées sur le catalogue publié, les documents publiés et le délai publié (prompt système) ; aucun prix
  calculé par le modèle (le moteur tarifaire déterministe reste seul à chiffrer).
- Coordonnées masquées avant envoi (e-mail, téléphone, adresse) ; nom et e-mail de la conversation jamais transmis.
- Réponse écartée (repli sur l'aide immédiate) si elle contient un montant, une référence fournisseur ou un ancien
  nom ; repli aussi en cas d'erreur, de délai dépassé, de refus ou de plafond atteint.
- Aucune action sur devis, commande ou paiement ; accès limité à la conversation du visiteur ; limites existantes :
  10 messages / 5 min par visiteur, 2 000 caractères, 20 derniers messages transmis.

### Avant activation (décision du client, registre `chat-fournisseur-llm`)
1. Choix du fournisseur et du modèle ; budget mensuel ; plafond quotidien.
2. Vérification de la politique de conservation du fournisseur et des transferts hors UE.
3. Mise à jour de la politique de confidentialité (sous-traitant, finalité, durée) — publication validée.
4. Test sur la préproduction, puis production.

## 3. Conservation
Conversations purgées 180 jours après clôture et 365 jours sans activité (tâche quotidienne, runbook § 6).

## 4. Tests
`tests/unit/chat-guide.test.ts`, `tests/integration/chat-assistant.test.ts` (fournisseur factice local : réponse,
indisponibilité, réponse écartée, plafond, coordonnées masquées, arrêt après un conseiller), `tests/integration/chat.test.ts`,
`tests/e2e/09-chat.spec.ts`, `tests/e2e/18-chat-aide.spec.ts` (ouverture/fermeture ordinateur et mobile, thèmes non
enregistrés, réponse utile, transmission, consultation en administration, séparation des conversations).
