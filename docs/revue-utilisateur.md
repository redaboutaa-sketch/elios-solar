# Guide de revue utilisateur — préproduction ELIOS SOLAR

Préproduction **en démonstration** : catalogue, prix, délais et stocks fictifs ; paiement simulé (aucun débit réel) ;
e-mails conservés dans le journal d'envoi (Administration → E-mails), non distribués.

## 1. Accès

URL de revue : **https://demo-elios.beaverdata.eu**. Le navigateur demande un identifiant et un mot de passe de revue (`revue-client`).
Ils sont stockés sur le VPS dans `/root/elios-solar-revue.txt`, lisible par root uniquement :

```bash
ssh root@76.13.44.177 'cat /root/elios-solar-revue.txt'
```

Transmettez l'URL et l'identifiant par un canal (e-mail), et le mot de passe par un autre (SMS, appel). Ne mettez jamais les deux
dans le même message. Pour changer ou révoquer l'accès, voir `docs/preprod-https.md`.

Le tunnel SSH (`ssh -N -L 3401:127.0.0.1:3401 root@76.13.44.177`) reste disponible pour le diagnostic, mais la connexion à un
compte se fait par l'URL HTTPS.

| Page | Lien |
|---|---|
| Accueil | <https://demo-elios.beaverdata.eu/> |
| Catalogue pergolas | <https://demo-elios.beaverdata.eu/pergolas> |
| Fiche produit | <https://demo-elios.beaverdata.eu/pergolas/pergola-solis> |
| Configurateur standard | <https://demo-elios.beaverdata.eu/configurateur?gamme=pergola-solis> |
| Configurateur store banne | <https://demo-elios.beaverdata.eu/configurateur/store-banne> |
| Sur-mesure | <https://demo-elios.beaverdata.eu/configurateur/sur-mesure> |
| Demande de devis | <https://demo-elios.beaverdata.eu/devis> |
| Compte client | <https://demo-elios.beaverdata.eu/compte> |
| Administration | <https://demo-elios.beaverdata.eu/admin> |
| Validation des références | <https://demo-elios.beaverdata.eu/admin/catalogue/validations> |

## 2. Accès administrateur (aucun secret n'est stocké ni affiché)

Le seul administrateur présent est celui des campagnes de test, avec un mot de passe aléatoire renouvelé à chaque campagne.
Créez le vôtre sur le VPS, depuis `/opt/pergola`, avec une saisie masquée :

```bash
docker compose -f docker/compose.prod.yml --env-file .env.prod run --rm -it migrate pnpm admin:bootstrap
```

Le script demande l'e-mail, puis le mot de passe (12 caractères minimum, non affiché ni journalisé). Ne passez pas le mot de passe
en argument ou en variable dans un terminal journalisé. Après 5 échecs, le compte est verrouillé 15 minutes.

## 3. Vérifications suggérées (≈ 20 min)

1. **Accueil → catalogue → fiche** : bandeau « démonstration », prix TTC, mention des données à confirmer.
2. **Configurateur standard** : changer la dimension, la couleur, la pose et les options. Le prix, la vue 3D et le récapitulatif
   suivent. Sur mobile ou sans WebGL, un plan 2D s'affiche.
3. **Store banne** : le câble indique « longueur à confirmer ».
4. **Sur-mesure** : saisir largeur, profondeur et hauteur hors bornes (message de borne), puis dans les bornes. Ajouter des fermetures,
   des segments et des équipements : la 3D suit. Les assemblages non confirmés basculent « sur devis ».
5. **Devis** depuis le sur-mesure : créer un compte client fictif (`…@example.invalid`), envoyer. Dans le compte, le devis montre
   le visuel exporté, la mention « visualisation non contractuelle » et le PDF.
6. **Panier → commande → paiement simulé** : la commande passe « payée (démo) », aucun prestataire réel n'est appelé.
7. **Administration** : tableau de bord (liste des blocages de lancement), devis (visuel figé une fois émis, PDF),
   commandes, journal, **Catalogue → Validation des références** (dossier câble 3 m / 7,5 m, statuts brouillon → à vérifier → validé
   ou rejeté, historique).
8. **Anti-force brute** : 5 mauvais mots de passe sur un compte client entraînent un verrouillage temporaire du compte.

Remarques : notez l'URL et l'heure. Les journaux de l'application contiennent l'identifiant de requête utile au diagnostic.
