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
| Pergolas | <https://demo-elios.beaverdata.eu/pergolas> |
| Fiche Pergola SB400 | <https://demo-elios.beaverdata.eu/pergolas/pergola-sb400> |
| Fiche Pergola SB500 | <https://demo-elios.beaverdata.eu/pergolas/pergola-sb500> |
| Screens | <https://demo-elios.beaverdata.eu/screens> · fiche <https://demo-elios.beaverdata.eu/screens/screen-refleksol-120-ziiip> |
| Stores bannes | <https://demo-elios.beaverdata.eu/stores-bannes> · fiche <https://demo-elios.beaverdata.eu/stores-bannes/store-banne-casablanca> |
| Configurateurs | <https://demo-elios.beaverdata.eu/configurateur> (SB400, SB500, REFLEKSOL 120 ZiiiP, CASABLANCA) |
| Demande de devis | <https://demo-elios.beaverdata.eu/devis> |
| Compte client | <https://demo-elios.beaverdata.eu/compte> |
| Administration | <https://demo-elios.beaverdata.eu/admin> |
| Tarifs fournisseur (privé, administrateurs) | <https://demo-elios.beaverdata.eu/admin/catalogue/tarifs-fournisseur> |
| Validation des références | <https://demo-elios.beaverdata.eu/admin/catalogue/validations> |

## 2. Accès administrateur (aucun secret n'est stocké ni affiché)

Le seul administrateur présent est celui des campagnes de test, avec un mot de passe aléatoire renouvelé à chaque campagne.
Créez le vôtre sur le VPS, depuis `/opt/pergola`, avec une saisie masquée :

```bash
docker compose -f docker/compose.prod.yml --env-file .env.prod run --rm -it migrate pnpm admin:bootstrap
```

Le script demande l'e-mail, puis le mot de passe (12 caractères minimum, non affiché ni journalisé). Ne passez pas le mot de passe
en argument ou en variable dans un terminal journalisé. Après 5 échecs, le compte est verrouillé 15 minutes.

## 3. Vérifications suggérées (≈ 25 min)

1. **Identité et navigation** : logo HELIOSTORES, trois familles Pergolas — Screens — Stores bannes, pied de page sans coordonnées inventées.
2. **Fiches** : galerie de visuels fabricant (nature et crédit sous chaque image), « Prix établi sur devis », onglet *Caractéristiques* avec
   sources et valeurs « à confirmer » (ex. largeur max. du REFLEKSOL : 4 m fiche / 7 m catalogue), *Documents* (liens vers les documents officiels ALUPROF).
3. **Configurateur SB400** : projection hors pas de 20 cm (message et valeur voisine proposée), largeur > 4 m refusée, spots (nombre de points
   selon les dimensions), LED + spots (cumul à confirmer), screen souhaité sur un côté (étude au devis). Vue 3D : cotes, poteaux, lames, spots.
4. **SB500** : pas de 25 cm, moteurs, poteaux supplémentaires, plusieurs modules (composés au devis).
5. **REFLEKSOL 120 ZiiiP** : largeur 4,5 m (accepté, « à confirmer »), moteur Altus WT avec une largeur < 73 cm (refusé), pose en niche, 3D.
6. **CASABLANCA** : avancée 3,1 m avec 3 m de largeur (refusé : 3,51 m minimum), pose sur chevrons, commande électrique (à confirmer), 3D.
7. **Devis** : depuis un configurateur, avec un compte client fictif (`…@example.invalid`) : la visualisation est jointe (plan 2D pour une
   pergola sans WebGL), le compte et le PDF montrent le récapitulatif et « Prix : établi sur devis » (aucun total).
8. **Administration** : devis (récapitulatif, origine du prospect, qualification), *Tarifs fournisseur* (montants internes, versions brouillon,
   activation / retour arrière), *Validation des références* (dossier REFLEKSOL), *Médiathèque* (provenance des visuels).
9. **Ancien catalogue** : un ancien lien (`/configurateur?gamme=pergola-solis`) affiche un avis et propose de recommencer avec un modèle actuel.

Il n'existe plus de parcours d'achat en ligne : aucun tarif public n'est validé. Le paiement reste en mode test.

Remarques : notez l'URL et l'heure. Les journaux de l'application contiennent l'identifiant de requête utile au diagnostic.
