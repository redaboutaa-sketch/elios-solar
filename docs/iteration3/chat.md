# Chat client ↔ conseiller (itération 3)

## Fonctionnement

- **Widget** (`src/components/chat/chat-widget.tsx`, monté dans `src/app/(boutique)/layout.tsx`) : bouton flottant en bas à droite
  (au-dessus de la barre sticky du configurateur sous `lg` : `bottom: 5.5rem`), panneau `role="dialog"` (focus sur « Fermer »,
  `Échap` ferme, retour du focus au bouton), fil `aria-live="polite"`, saisie limitée à 2 000 caractères (Entrée = envoyer,
  Maj+Entrée = retour à la ligne).
- **Propriétaire** : compte connecté (`userId`) ou visiteur (cookie `es_guest`, créé au premier envoi). À la connexion, les
  conversations invité sont rattachées au compte (`afterSignInAction` → `claimGuestConversations`).
- **Rafraîchissement** : polling toutes les 6 s tant que le panneau est ouvert, via
  `GET /api/chat/messages?conversationId=&after=<ISO>&read=1` (propriétaire vérifié, 404 sinon ; `read=1` met à jour
  `lastCustomerReadAt` au plus une fois par minute, ce qui sert aussi de signal « client actif »).
- **Joindre ma configuration** : liste des projets sauvegardés de l'utilisateur connecté, plus « le projet affiché sur cette
  page » sur `/projets/[token]` (lien par `shareToken` public non révoqué). Par identifiant, la configuration doit appartenir
  au propriétaire (`isOwner`). Un message SYSTEM « Configuration jointe » est ajouté au fil.
- **Fermeture** : le client peut terminer sa conversation ; un nouveau message ouvre alors une nouvelle conversation (avec un
  nouveau consentement).
- **Administration** : `/admin/conversations` (filtres actives / non lues / assignées à moi / non assignées / en attente client /
  fermées / toutes, aperçu du dernier message, liens configuration / devis / commande) et `/admin/conversations/[id]` (fil
  complet, réponse, note interne `meta.internal` invisible du client, changement de statut, « M'assigner »). Ouvrir une
  conversation la marque lue (`lastAdvisorReadAt`). Réponses, notes, statuts et assignations sont journalisés
  (`conversation.reply`, `conversation.note`, `conversation.status`, `conversation.assign`).
- **Tableau de bord** : compteur « Conversations non lues » (conversation non fermée dont `lastAdvisorReadAt` est nul ou
  antérieur à `lastMessageAt`).
- **Compte** : `/compte/echanges` liste les conversations du client (notes internes exclues) ; lien « Mes échanges » dans la
  navigation du compte.
- **Réglages** (`/admin/reglages`, section « Chat ») : `chatEnabled` (désactive le widget et la présence) et
  `chatOfflineMessage` (texte affiché hors ligne ; vide = texte par défaut).

## Présence (jamais simulée)

`advisorsOnline()` = `SiteSettings.chatEnabled` **et** au moins un utilisateur ADMIN/MANAGER non supprimé avec
`lastSeenAt` < 5 minutes. `lastSeenAt` est mis à jour :

- au rendu du layout d'administration (`touchPresence`, requête `UPDATE … WHERE lastSeenAt < now() - 1 min` : au plus une
  écriture par minute) ;
- par `PresencePing` (client, toutes les 60 s et au retour de visibilité de l'onglet) → `POST /api/chat/presence`
  (ADMIN/MANAGER uniquement), car les layouts ne sont pas re-rendus lors des navigations côté client.

Le widget affiche « Un conseiller est disponible » uniquement si ce signal est vrai, sinon « Nos conseillers ne sont pas
connectés : laissez un message, réponse par e-mail ».

## Mode hors ligne et notifications

- Sans conseiller en ligne, la conversation est créée avec `offline = true` ; **e-mail obligatoire** et consentement
  obligatoire. En direct, l'e-mail reste facultatif.
- Nouveau message client → e-mail à `ADMIN_NOTIFICATION_EMAIL` (gabarit `chat-admin-notification`), `dedupeKey`
  `chat-admin:<conversation>:<tranche de 10 min>` : au plus un e-mail par conversation et par tranche.
- Réponse conseiller → e-mail au client (gabarit `chat-advisor-reply`, dedupe `chat-reply:<conversation>:<tranche>`) si la
  conversation est hors ligne, ou si un e-mail est connu et que le client n'a pas lu le fil depuis 10 minutes. Une note
  interne n'envoie jamais d'e-mail. La conversation passe en « En attente du client » et est assignée au premier conseiller
  qui répond.
- Limite de fréquence : 10 messages / 5 minutes par propriétaire (clé compte ou invité, en mémoire, instance unique), message
  de 1 à 2 000 caractères.

## Assistant automatique (facultatif)

`src/server/chat/assistant.ts` : interface `Assistant { answer(ctx): Promise<{ text, handover } | null> }`.
`getAssistant()` renvoie un fournisseur seulement si `AI_PROVIDER=anthropic` **et** `ANTHROPIC_API_KEY` sont définis ; sinon
`null` et le chat est purement humain/différé (aucune mention « IA » ni bouton « Parler à un conseiller » dans le widget).

- Appel HTTP `fetch` à `https://api.anthropic.com/v1/messages` (`x-api-key`, `anthropic-version: 2023-06-01`), modèle
  `AI_MODEL` (défaut `claude-sonnet-5-5`), `max_tokens` 600, délai maximal 20 s, 20 derniers messages.
- Prompt système limité au **catalogue public** (`ensureCatalogSnapshot()` : familles publiées/sur devis, variantes avec prix
  TTC et statut de donnée, règles de compatibilité fermetures/options avec leur statut) et aux **documents publiés publics**
  (titre, type, résumé). Consignes : répondre uniquement à partir de ces données, « Je ne sais pas, je transmets à un
  conseiller » pour tout prix/disponibilité/compatibilité absent ou inconnu, prix DÉMO indicatifs, ne rien inventer, ne
  demander aucune donnée personnelle, proposer la transmission.
- Déclenchement : après chaque message client (`after()` de Next, la réponse HTTP n'attend pas), seulement si la conversation
  n'est ni fermée, ni assignée, ni déjà transmise. Réponse enregistrée `author = ASSISTANT`, affichée avec la mention
  « Assistant automatique — réponse indicative, à confirmer par un conseiller ». Si l'assistant demande la transmission (ou
  si le client clique « Parler à un conseiller »), un message SYSTEM `meta.kind = "handover"` est créé et la conversation
  repasse en OPEN, non assignée, non lue.
- Toute erreur (HTTP, délai, refus, réponse vide) est journalisée et ignorée : bascule silencieuse sur l'humain.

## Données personnelles

- Consentement explicite (case à cocher avec lien `/confidentialite`) avant la création de toute conversation ;
  `consentPrivacy = true` enregistré. Aucune adresse IP n'est stockée (la limite de fréquence du chat est indexée par
  propriétaire, en mémoire).
- Données conservées : nom et e-mail facultatifs (obligatoire hors ligne), messages, liens vers configuration/devis/commande.
- **Durée de conservation proposée** : 180 jours après fermeture, 365 jours sans activité pour une conversation restée ouverte.
  `scripts/purge-conversations.ts` supprime ces conversations (messages en cascade) et journalise le nombre purgé :

  ```bash
  pnpm exec tsx scripts/purge-conversations.ts --dry-run            # simulation
  pnpm exec tsx scripts/purge-conversations.ts --days=180 --inactive-days=365
  ```

  À planifier quotidiennement (cron). Défauts : `CHAT_RETENTION_DAYS`, `CHAT_INACTIVE_DAYS`.
- Compte : l'export (`/compte/donnees`) inclut les conversations (notes internes exclues) ; la suppression du compte supprime
  ses conversations.
- L'assistant ne reçoit que le fil de la conversation (dont le texte saisi par le client) : à mentionner dans la politique de
  confidentialité si `AI_PROVIDER` est activé (sous-traitant, transfert hors UE éventuel).

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `ADMIN_NOTIFICATION_EMAIL` | destinataire des alertes de nouveau message (déjà existante) |
| `AI_PROVIDER` | `anthropic` pour activer l'assistant ; vide sinon |
| `ANTHROPIC_API_KEY` | clé API (jamais commitée) |
| `AI_MODEL` | facultatif, défaut `claude-sonnet-5-5` |
| `CHAT_RETENTION_DAYS`, `CHAT_INACTIVE_DAYS` | durées de purge (défauts 180 / 365) |

## Limites

- Polling (6 s), pas de WebSocket/SSE ; limite de fréquence en mémoire (instance unique, comme `rateLimit`).
- Pas de pièce jointe de fichier, pas d'indicateur « en train d'écrire ».
- Le compteur d'e-mails est regroupé par tranche fixe de 10 min (un message à 10:09 et un autre à 10:11 donnent deux e-mails).
- L'e-mail de réponse renvoie vers la boutique (le visiteur invité retrouve le fil grâce à son cookie sur le même navigateur) ;
  pas de lien magique de reprise de conversation.
- L'assistant n'a pas d'outils (pas d'accès aux commandes/devis) et n'a pas été évalué sur un jeu de questions réel.

## Fichiers

Créés : `src/server/chat/{service,assistant,auto-reply,dto}.ts`, `src/server/actions/chat.ts`,
`src/server/actions/admin/conversations.ts`, `src/app/api/chat/messages/route.ts`, `src/app/api/chat/presence/route.ts`,
`src/components/chat/{chat-widget,presence-ping}.tsx`, `src/components/chat/types.ts`,
`src/app/admin/conversations/{page.tsx,labels.ts,[id]/page.tsx}`, `src/app/(boutique)/compte/echanges/page.tsx`,
`scripts/purge-conversations.ts`, `tests/integration/chat.test.ts`, `tests/e2e/09-chat.spec.ts`.

Modifiés (localement) : `src/app/(boutique)/layout.tsx` (widget + présence initiale), `src/app/admin/layout.tsx`
(`touchPresence` + `PresencePing`), `src/app/admin/page.tsx` (compteur non lues), `src/app/admin/reglages/page.tsx` et
`src/server/actions/admin/settings.ts` (champs chat), `src/server/actions/account.ts` (rattachement, export, suppression),
`src/app/(boutique)/compte/donnees/page.tsx` (textes), `src/components/account/account-nav.tsx` (« Mes échanges »),
`src/server/mail/templates.ts` (2 gabarits), `.env.example` (variables IA et purge, en fin de fichier).

## Vérifications (2026-10-19)

- `pnpm typecheck` : aucune erreur dans le périmètre chat (erreurs restantes dans `scene.tsx` et `demo-data.ts`, autres
  chantiers).
- `pnpm exec eslint` sur le périmètre chat : 0 erreur, 0 avertissement.
- `VITEST_DB_SETUP=1 pnpm vitest run tests/integration/chat.test.ts` : **12/12 réussis** (accès invité/compte/admin, notes
  internes, liaison de configuration, limite de fréquence et longueur, consentement + e-mail hors ligne, dedupe e-mail admin,
  e-mail de réponse hors ligne / client inactif, compteur non lues et transmission, présence, écriture de présence ≤ 1/min,
  assistant `null` sans clé, purge).
- `pnpm exec tsx scripts/purge-conversations.ts --dry-run` : OK (0 conversation à purger sur la base de dev).
- `E2E_NO_SERVER=1 pnpm playwright test tests/e2e/09-chat.spec.ts` : **bloqué par l'environnement**. Le serveur de dev
  (démarré à 12:21) conserve dans `globalThis` un client Prisma antérieur à la migration
  `20261019120000_iteration3_media_stock_grids_chat_installments` (14:56) : `prisma.conversation` (et `prisma.priceGrid`
  pour d'autres chantiers) y est `undefined`. Le widget s'affiche, mais l'envoi échoue. **Il faut redémarrer `pnpm dev`**
  (port 3400) puis relancer ce test.
