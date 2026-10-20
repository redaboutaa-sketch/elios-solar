# Registre des médias HELIOSTORES

Source du registre : `src/server/media/heliostores-media.ts` (manifeste commité, sans fichier binaire). Les fichiers préparés restent dans `private/heliostores/media-staging/`, exclu de Git et de Docker. Ils sont importés dans la médiathèque par `pnpm media:heliostores --dir <dossier> --apply`.

**Autorisation :** usage autorisé par le client pour le site HELIOSTORES (instruction du 2026-10-20). Ces visuels présentent le produit du fabricant. Ils ne sont **jamais** présentés comme des réalisations HELIOSTORES : chaque légende publique indique la nature (photographie fournisseur, rendu ou schéma fabricant) et le crédit.

**Traitement :**
- les images originales sont extraites des PDF (calques image incorporés, sans le filigrane du distributeur, qui est un calque distinct) ou récupérées sur aluprof.com ;
- les vues détourées sont recomposées avec leur masque alpha, sans agrandissement ;
- deux variantes WebP sont produites : 1 600 px au plus et 640 px pour les vignettes ;
- l'empreinte SHA-256 de l'original est conservée dans `Media.provenance`.

**Écartés :**
- visuels nommés « Pergola_400_Pro » sur la page SB 400 : autre produit (SB 400 PRO) ;
- image « Pergola_SB500 » publiée sur la page SB 400 : à vérifier ;
- étiquette énergie et façades sans produit identifiable (page R 120 ZiiiP) ;
- ouvertures de section non légendées du catalogue (p. 4–5) ;
- texture de fond (p. 114) ;
- images des pages SB 450 / SB 550, qui montrent des systèmes MB-OpenSky.

## Conservation et restauration lors d'un redéploiement

**Où sont les médias :**
- les **fichiers** se trouvent dans le volume Docker nommé `elios_solar_uploads`, monté sur `/app/uploads` dans `app` et `migrate` ;
- les visuels figés des devis sont dans son sous-dossier `quotes/` ;
- les **métadonnées** sont en base : `Media.path`, `Media.provenance` (variantes, empreinte, source) et `ProductMedia` pour les associations.

**Redéploiement** (`docker compose … build` puis `up -d`) :
- les images sont reconstruites, mais le volume nommé n'est ni recréé ni vidé : les médias sont conservés ;
- vérifié lors des trois redéploiements du 2026-10-20 ;
- ne jamais lancer de suppression globale de volumes (`docker volume prune`, `down -v`).

**Sauvegarde avant chaque redéploiement** :

```bash
MEDIA_VOLUME=elios_solar_uploads scripts/backup.sh backups/preprod
```

- produit le dump de la base et l'archive du volume (lu en lecture seule), avec leurs empreintes SHA-256 ;
- `backups/` est exclu de Git.

**Restauration** :

```bash
MEDIA_RESTORE_VOLUME=elios_solar_uploads scripts/restore.sh backups/preprod/db_<horodatage>.dump backups/preprod/media_<horodatage>.tar.gz
```

- la base est d'abord restaurée et contrôlée dans une base isolée, et ne bascule que si `RESTORE_TARGET_URL` est fourni ;
- l'archive des médias est extraite dans le volume : les fichiers sont ajoutés ou remplacés, aucun n'est supprimé.

Un aller-retour sauvegarde → restauration dans un volume temporaire a été vérifié le 2026-10-20 : empreintes identiques au volume réel (visuels produits, documents, visuels figés des devis).

**Reconstitution sans archive** : si un fichier manque mais que la base est intacte, relancer l'import depuis le dossier privé (monté en lecture seule) :

```bash
docker compose -f docker/compose.prod.yml --env-file .env.prod run --rm \
  -v /opt/pergola/private/heliostores/media-staging:/staging:ro migrate pnpm media:heliostores --dir /staging --apply
```

- une entrée dont le fichier ou la vignette manque est régénérée (testé) ;
- les autres ne sont pas réécrites ;
- les visuels figés des devis ne peuvent pas être régénérés : seule l'archive les restaure.

**Contrôle après redéploiement** : chaque galerie doit contenir exactement les visuels du manifeste, sans image cassée.

```bash
REVIEW_USER=revue-client REVIEW_PASSWORD="$(sed -n 's/^Mot de passe : //p' /root/elios-solar-revue.txt)" \
  pnpm exec tsx scripts/check-public-media.ts https://demo-elios.beaverdata.eu
```

Résultat du 2026-10-20 :
- SB400 16/16, SB500 3/3, REFLEKSOL 9/9, CASABLANCA 13/13 ;
- images principales et vignettes chargées et décodées ;
- accueil et collections sans image cassée.

En CI, les fichiers fabricant, privés, sont absents : la recette n'y vérifie que l'état vide des galeries. Ce contrôle sur la préproduction est donc le seul qui vérifie le contenu réel des galeries.

## Visuels publiés

| Produit | Rôle | Nature | Modèle représenté | Source | Rattachement | Texte alternatif |
|---|---|---|---|---|---|---|
| pergola-sb400 | hero | photo | SunBreaker 400 | Catalogue THYSENS (7).pdf, p. 11 — photo de la page SunBreaker 400 ; même photo au catalogue SB400 p. 2 | confirmé | Pergola SB400 gris anthracite adossée à une maison contemporaine, lames ouvertes projetant des ombres rayées sur la terrasse |
| pergola-sb400 | gallery | rendu | SB 400 | https://aluprof.com/app/default/assets/images/11335Zdj%C4%99cie_g%C5%82%C3%B3wne_CA%C5%81A_RAMKA.jpg.webp (page https://aluprof.com/en/product/sb-400, 2026-10-20) | confirmé | Pergola SB400 autoportante à quatre poteaux, structure gris anthracite, vue de face |
| pergola-sb400 | gallery | rendu | SB 400 | https://aluprof.com/files/products_images/78436Opcje_montazu_przyscienna.jpg.webp (page https://aluprof.com/en/product/sb-400, 2026-10-20) | confirmé | Pergola SB400 adossée à un mur, lames fermées, vue en perspective |
| pergola-sb400 | gallery | rendu | SB 400 | https://aluprof.com/files/products_images/11693Opcje_montazu_wolnostojaca.jpg.webp (page https://aluprof.com/en/product/sb-400, 2026-10-20) | confirmé | Pergola SB400 autoportante, lames fermées, vue en perspective |
| pergola-sb400 | gallery | rendu | SB 400 | https://aluprof.com/app/default/assets/images/Pergola-SB-400-LED-folder-2020.webp (page https://aluprof.com/en/product/sb-400, 2026-10-20) | confirmé | Pergola SB400 à six poteaux composée de deux modules, lames entrouvertes |
| pergola-sb400 | detail | rendu | SB 400 | https://aluprof.com/app/default/assets/images/SB-400-Ledy-z-dolu.webp (page https://aluprof.com/en/product/sb-400, 2026-10-20) | confirmé | Vue de dessous de la toiture à lames d'une SB400 avec éclairage LED périphérique allumé |
| pergola-sb400 | gallery | rendu | SB 400 | https://aluprof.com/app/default/assets/images/Pergola-400-LED-8014-plus-9016_1.webp (page https://aluprof.com/en/product/sb-400, 2026-10-20) | confirmé | Pergola SB400 à structure brune et lames blanches, vue en perspective |
| pergola-sb400 | gallery | rendu | SB 400 | https://aluprof.com/app/default/assets/images/Pergola400-orto-FSM-small_2.webp (page https://aluprof.com/en/product/sb-400, 2026-10-20) | confirmé | Pergola SB400 vue de dessus en perspective, lames de toiture fermées, teinte FSM 71319 |
| pergola-sb400 | detail | rendu | SunBreaker 400 | Catalogue THYSENS (7).pdf, p. 10 — détail de la page SunBreaker 400 ; même image au catalogue SB400 p. 1 | confirmé | Détail d'angle de la SB400 : poutre, chéneau intégré et départ de poteau |
| pergola-sb400 | detail | rendu | SB 400 | https://aluprof.com/files/products_images/47066nowy_dach_sb_400_plaski_copy.jpg.webp (page https://aluprof.com/en/product/sb-400, 2026-10-20) | confirmé | Poutre de la SB400 ouverte montrant le moteur et le mécanisme d'entraînement des lames |
| pergola-sb400 | detail | rendu | SB 400 | https://aluprof.com/app/default/assets/images/widok-silnika.webp (page https://aluprof.com/en/product/sb-400, 2026-10-20) | confirmé | Détail du vérin d'orientation des lames logé le long de la poutre de la SB400 |
| pergola-sb400 | technical | schéma | SB 400 | https://aluprof.com/app/default/assets/images/Pergola-SB-400-nowe-odprowadzanie-wody-odprowadzanie-wody.webp (page https://aluprof.com/en/product/sb-400, 2026-10-20) | confirmé | Vue éclatée de l'angle d'une SB400 montrant le chéneau et l'évacuation des eaux par le poteau |
| pergola-sb400 | technical | rendu | SB 400 | https://aluprof.com/app/default/assets/images/Pergola-400-profil-belki_1.webp (page https://aluprof.com/en/product/sb-400, 2026-10-20) | confirmé | Profilé de poutre en aluminium de la SB400, vue isolée |
| pergola-sb400 | technical | rendu | SB 400 | https://aluprof.com/app/default/assets/images/Pergola-400-profil-piora_1.webp (page https://aluprof.com/en/product/sb-400, 2026-10-20) | confirmé | Profilé de lame orientable en aluminium de la SB400, vue isolée |
| pergola-sb400 | technical | schéma | SB 400 | https://aluprof.com/files/products_images/50890Wymiary_Pergoli_400_kopia.jpg.webp (page https://aluprof.com/en/product/sb-400, 2026-10-20) | confirmé | SB400 avec cotes maximales : projection 7000 mm, largeur 4000 mm, hauteur 2800 mm |
| pergola-sb400 | gallery | rendu | SunBreaker 400 | Catalogue THYSENS (7).pdf, p. 10 — vue produit de la page SunBreaker 400 | confirmé | Pergola SB400 autoportante détourée, lames fermées, éclairage périphérique |
| pergola-sb500 | hero | photo | SunBreaker 500 (selon la mise en page du catalogue) | Catalogue THYSENS (7).pdf, p. 7 — photo de la page SunBreaker 500 | partiel : photo non légendée, rattachée par sa page ; le store vertical visible n'est pas inclus | Grande pergola à lames gris anthracite adossée à une maison en briques, store vertical baissé sur la façade, terrasse en bois |
| pergola-sb500 | gallery | rendu | SunBreaker 500 | Catalogue THYSENS (7).pdf, p. 6 — vue produit de la page SunBreaker 500 | confirmé | Pergola SB500 autoportante détourée, lames fermées, éclairage périphérique |
| pergola-sb500 | detail | rendu | SunBreaker 500 | Catalogue THYSENS (7).pdf, p. 6 — détail de la page SunBreaker 500 | confirmé | Détail d'angle de la SB500 : lames, poutre et éclairage intégré |
| screen-refleksol-120-ziiip | hero | photo | REFLEKSOL 120 ZiiiP (selon la mise en page du catalogue) | Catalogue THYSENS (7).pdf, p. 67 — photo de la page REFLEKSOL 120 ZiiiP ; même photo sur la page fabricant R 120 ZiiiP | partiel : photo non légendée, rattachée par sa page | Séjour lumineux avec grandes baies vitrées équipées de screens gris partiellement descendus |
| screen-refleksol-120-ziiip | gallery | rendu | R 120 ZiiiP | https://aluprof.com/files/products_images/69695Refleksol_ZiiiP120_FSM_orto.jpg.webp (page https://aluprof.com/en/product/refleksol-120-ziiip, 2026-10-20) | confirmé | Screen REFLEKSOL 120 ZiiiP avec coffre carré et coulisses, toile claire déroulée, teinte FSM 71319 |
| screen-refleksol-120-ziiip | gallery | rendu | REFLEKSOL 120 ZiiiP | Catalogue THYSENS (7).pdf, p. 66 — vue produit de la page REFLEKSOL 120 ZiiiP | confirmé | Screen REFLEKSOL 120 ZiiiP détouré, coffre gris anthracite et toile claire |
| screen-refleksol-120-ziiip | gallery | rendu | R 120 ZiiiP | https://aluprof.com/app/default/assets/images/Refleksol-ZiiiP-120-Niestandardowy-.webp (page https://aluprof.com/en/product/refleksol-120-ziiip, 2026-10-20) | confirmé | Screen REFLEKSOL 120 ZiiiP de grande dimension, toile grise déroulée |
| screen-refleksol-120-ziiip | detail | rendu | R 120 ZiiiP | https://aluprof.com/files/products_images/10520Plastex__detal__Cord.jpg.webp (page https://aluprof.com/en/product/refleksol-120-ziiip, 2026-10-20) | confirmé | Vue éclatée de la coulisse en deux parties du REFLEKSOL 120 ZiiiP avec joints et fermeture à glissière |
| screen-refleksol-120-ziiip | detail | rendu | R 120 ZiiiP | https://aluprof.com/files/products_images/93523Refleksol_ZiiiP_Wiatr.jpg.webp (page https://aluprof.com/en/product/refleksol-120-ziiip, 2026-10-20) | confirmé | Détail de la coulisse avec flèches symbolisant le vent retenu par la toile |
| screen-refleksol-120-ziiip | detail | rendu | REFLEKSOL 120 ZiiiP | Catalogue THYSENS (7).pdf, p. 66 — détail de la page REFLEKSOL 120 ZiiiP | confirmé | Coupe du coffre du REFLEKSOL 120 ZiiiP montrant le tube d'enroulement et le moteur |
| screen-refleksol-120-ziiip | detail | rendu | R 120 ZiiiP | https://aluprof.com/files/products_images/77496R120_ZiiiP__rewizja.jpg.webp (page https://aluprof.com/en/product/refleksol-120-ziiip, 2026-10-20) | confirmé | Coffre du REFLEKSOL 120 ZiiiP avec trappe de visite frontale ouverte |
| screen-refleksol-120-ziiip | technical | schéma | R 120 ZiiiP | https://aluprof.com/app/default/assets/images/69841120ziiip.jpg.webp (page https://aluprof.com/en/product/refleksol-120-ziiip, 2026-10-20) | confirmé | Coupe cotée du coffre du REFLEKSOL 120 ZiiiP : 126 mm |
| store-banne-casablanca | hero | rendu | CASABLANCA AWNING | https://aluprof.com/app/default/assets/products_images/2017-08-08-wizualizacja_casablanca.webp (page https://aluprof.com/en/product/casablanca-awning, 2026-10-20) | confirmé | Store banne CASABLANCA gris déployé au-dessus d'une terrasse en bois avec salon de jardin |
| store-banne-casablanca | gallery | rendu | CASABLANCA AWNING | https://aluprof.com/app/default/assets/images/casablanca_FSM_71319.webp (page https://aluprof.com/en/product/casablanca-awning, 2026-10-20) | confirmé | Store CASABLANCA déployé, coffre et bras FSM 71319, toile grise |
| store-banne-casablanca | gallery | rendu | CASABLANCA AWNING | https://aluprof.com/app/default/assets/images/casablanca_RAL_9010.webp (page https://aluprof.com/en/product/casablanca-awning, 2026-10-20) | confirmé | Store CASABLANCA déployé, coffre et bras blancs RAL 9010, toile grise |
| store-banne-casablanca | gallery | rendu | CASABLANCA AWNING | https://aluprof.com/app/default/assets/images/casablanca_RAL_1015.webp (page https://aluprof.com/en/product/casablanca-awning, 2026-10-20) | confirmé | Store CASABLANCA déployé, coffre et bras beige RAL 1015, toile grise |
| store-banne-casablanca | gallery | rendu | CASABLANCA AWNING | https://aluprof.com/app/default/assets/images/casablanca_RAL_8014.webp (page https://aluprof.com/en/product/casablanca-awning, 2026-10-20) | confirmé | Store CASABLANCA déployé, coffre et bras marron RAL 8014, toile grise |
| store-banne-casablanca | gallery | rendu | CASABLANCA AWNING | https://aluprof.com/app/default/assets/images/casablanca_RAL_9006.webp (page https://aluprof.com/en/product/casablanca-awning, 2026-10-20) | confirmé | Store CASABLANCA déployé, coffre et bras gris aluminium RAL 9006, toile grise |
| store-banne-casablanca | gallery | rendu | CASABLANCA | Catalogue THYSENS (7).pdf, p. 114 — vue produit de la page CASABLANCA | confirmé | Store banne CASABLANCA détouré, coffre ouvert et bras dépliés |
| store-banne-casablanca | detail | rendu | CASABLANCA AWNING | https://aluprof.com/app/default/assets/images/Casablanca-transparent.webp (page https://aluprof.com/en/product/casablanca-awning, 2026-10-20) | confirmé | Coffre fermé du store CASABLANCA en vue transparente montrant la toile enroulée |
| store-banne-casablanca | detail | rendu | CASABLANCA AWNING | https://aluprof.com/files/products_images/61754Casablanca__zamykana_kaseta.jpg.webp (page https://aluprof.com/en/product/casablanca-awning, 2026-10-20) | confirmé | Joue latérale et coffre fermé du store CASABLANCA, vue rapprochée |
| store-banne-casablanca | detail | rendu | CASABLANCA AWNING | https://aluprof.com/files/products_images/25617Casablanca__lancuch_flyera.jpg.webp (page https://aluprof.com/en/product/casablanca-awning, 2026-10-20) | confirmé | Articulation d'un bras du store CASABLANCA avec chaîne Flyer |
| store-banne-casablanca | technical | schéma | CASABLANCA AWNING | https://aluprof.com/files/products_images/29270dosicany.jpg.webp (page https://aluprof.com/en/product/casablanca-awning, 2026-10-20) | confirmé | Schéma coté de la pose murale du store CASABLANCA |
| store-banne-casablanca | technical | schéma | CASABLANCA AWNING | https://aluprof.com/files/products_images/82666dosufitu.jpg.webp (page https://aluprof.com/en/product/casablanca-awning, 2026-10-20) | confirmé | Schéma coté de la pose au plafond du store CASABLANCA |
| store-banne-casablanca | technical | schéma | CASABLANCA AWNING | https://aluprof.com/files/products_images/39545dokrokwi.jpg.webp (page https://aluprof.com/en/product/casablanca-awning, 2026-10-20) | confirmé | Schéma coté de la pose sur chevrons du store CASABLANCA |
