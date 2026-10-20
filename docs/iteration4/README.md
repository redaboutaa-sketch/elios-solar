# Itération 4 — recette reproductible, 3D sur mesure, visuel de devis, validation des références

Statut au 2026-10-19. Données commerciales toujours en **démonstration** ; paiements réels désactivés.

| Fonction | Statut | Détail |
|---|---|---|
| Recette navigateur complète contre Docker | Implémentée et testée | Une campagne unique (`scripts/e2e-docker.sh`), sans relance automatique ; job CI `e2e-docker` sur la même pile Docker |
| Anti-force brute | Implémenté et testé | Limite par IP (better-auth, 3 / 10 s) + verrou par compte (5 échecs / 15 min, indépendant de l'IP) ; `TRUSTED_PROXIES` ; parcours e2e 13 |
| 3D du sur-mesure | Implémentée et testée | Cotes saisies (largeur, longueur, hauteur), implantation, finition, fermetures par segment, équipements ; hors bornes = pas de scène ; « faisabilité technique à valider sur devis » ; repli 2D |
| Visualisation jointe au devis | Implémentée et testée | Image figée à l'émission (empreinte + version de configuration), contrôle format/poids/dimensions, ré-encodage, stockage privé, PDF de devis, compte client et administration ; repli plan 2D |
| Écran de validation des références | Implémenté et testé ; instruction fournisseur restante | Brouillon → à vérifier → validé / rejeté, validation sur version précise, sources, divergences, manques, conséquences, historique ; ne rend jamais une référence achetable |
| Câble du store banne | Dépendance fournisseur précise | 3 m (fictif, seed) et 7,5 m (observé sur la référence) conservés comme sources distinctes ; public : « longueur à confirmer » |

## Pourquoi la CI était verte alors que Docker échouait

1. **Relance automatique en CI** : `retries: 1` quand `CI` est défini. Le dernier journal CI affichait « 3 flaky » : les connexions
   admin bloquées par la limite (3 connexions / 10 s par IP et par chemin, règle intégrée de better-auth) réussissaient au 2e essai.
   Contre Docker, sans relance, ces parcours échouaient. → `retries: 0` et `failOnFlakyTests` partout.
2. **Une connexion admin par parcours** : 4 specs × 2 projets se connectaient par formulaire. → projet Playwright `setup` : une
   seule connexion par le vrai formulaire, état de session réutilisé (`helpers.loginAdmin`).
3. **Quotas applicatifs partagés** (devis 10 / 10 min, commande, contact) : tous les parcours avaient la même IP, et les compteurs
   persistaient d'une campagne à l'autre dans le même processus. → chaque parcours agit comme un client distinct (IP simulée de la
   plage de test RFC 2544 en X-Forwarded-For, `tests/e2e/fixtures.ts`), quotas conservés.
4. **Environnement** : la CI lançait `next start` sur l'hôte (URL publique joignable, e-mail admin défini) ; le conteneur ne
   joignait pas l'URL publique (corrigé en itération 3 par `INTERNAL_APP_URL`). → job CI `e2e-docker` construit les mêmes images
   et lance le même compose que la préproduction.
5. **Course dans `createAccount`** : `waitForURL(/\/compte/)` était déjà satisfait par `/compte/inscription` ; plus rapide en
   image de production, le parcours quittait la page avant la pose du cookie. → attente de la sortie de la page d'inscription.

## Constat de sécurité corrigé

Sans proxy de confiance, `next start` conserve un `X-Forwarded-For` fourni par le client et better-auth l'accepte : en changeant
l'en-tête à chaque requête, la limite par IP des connexions était contournable (6 × 401, jamais 429). Correctifs : verrou par
compte indépendant de l'IP, `TRUSTED_PROXIES`, limiteur applicatif aligné sur la résolution d'IP de better-auth, port toujours lié à
127.0.0.1 (Traefik réécrit l'en-tête pour une source non fiable). Vérifié par `tests/e2e/13-anti-force-brute.spec.ts`.

## Données techniques sourcées

`TechnicalSpec` : chaque valeur porte sa provenance — `DEMO_SEED` (fictive), `OBSERVED_REFERENCE` (relevée sur la référence, avec
date et emplacement), `SUPPLIER_CONFIRMED` (document ou écrit fournisseur). Seule une confirmation fournisseur unique est affichée
comme certaine ; deux confirmations contradictoires restent « à confirmer ». La validation d'une donnée technique ajoute une ligne
`SUPPLIER_CONFIRMED` sans effacer les autres. Les écrans de validation et de famille affichent la provenance de chaque valeur.

Même vérification appliquée à la 3D du sur-mesure : l'éclairage « inclus » de la gamme sur mesure n'est pas chiffré par le
moteur et la référence observée est contradictoire (texte « rubans LED intégrés » mais option « LED - Sur mesure » vendue à part) ;
la scène et la liste des éléments représentés ne montrent donc un éclairage que si l'option Bandes LED est choisie.

## Limites connues

- Un devis demandé en invité n'est consultable que par l'e-mail de confirmation (pas en ligne).
- Une règle de compatibilité recréée par le seed change d'identifiant : un dossier qui la vise signale « cible introuvable ».
- Pas de séparation obligatoire auteur / validateur d'un dossier (un seul compte admin en recette).
- Verrous et quotas en mémoire : réinitialisés au redémarrage du conteneur (instance unique).

## Contrôle X-Forwarded-For (2026-10-20)

Le contrôle initial n'était **pas suffisant** : `getIP` (better-auth) et les quotas de l'application ne lisent que les en-têtes,
et `next start` conserve un X-Forwarded-For fourni par le client. Un pair joignant directement le port de l'application
(autre conteneur du réseau partagé `traefik-public`, tunnel SSH) pouvait donc choisir son IP.

Correctif (`969d583`) : la garde `docker/xff-guard.cjs`, préchargée par le serveur autonome, est appliquée **avant** Next.
- Si le pair TCP n'appartient pas à `TRUSTED_PROXIES`, l'en-tête est remplacé par l'adresse réelle du pair.
- Si le pair est déclaré, la chaîne est conservée et le pair est ajouté à la fin.

better-auth retient ensuite la première adresse non fiable en partant de la droite.

Preuves :
- `tests/unit/xff-guard.test.ts` : 4 tests.
- Sonde depuis un conteneur éphémère sur `traefik-public` avec rotation de l'en-tête : 401 ×3 puis 429.
- Même sonde depuis la passerelle déclarée : la chaîne est acceptée.

Le verrou par compte (5 échecs, 15 min) s'applique dans tous les cas.

En préproduction, `TRUSTED_PROXIES` désigne la passerelle hôte du réseau interne. C'est le chemin du tunnel SSH et du lanceur
de recette : les utilisateurs SSH de l'hôte restent donc de confiance. Derrière Traefik, il faut y mettre l'adresse
du conteneur Traefik, jamais le sous-réseau partagé. Le serveur de développement (`pnpm dev`) ne charge pas la garde ;
il n'est pas exposé.
