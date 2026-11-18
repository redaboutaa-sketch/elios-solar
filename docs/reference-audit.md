# Audit de la référence publique (pergolux.fr)

- **Date du relevé** : 2026-10-19 (11h15–11h30 CEST)
- **Méthode** : pages publiques uniquement, sans achat, sans envoi de formulaire, sans
  contournement de protection. Relevé par requêtes HTTP (`curl`) sur les pages HTML
  publiques et sur les points d'accès JSON publics de la plateforme Shopify
  (`/products.json`, `/collections/<handle>/products.json`, `/products/<handle>.json`),
  puis lecture des scripts publics du thème (`app-sidewalls.js`, `app-assembly-options.js`,
  `app-mounting-bracket.js`, `app-save-configuration.js`) pour comprendre la logique
  du configurateur. Aucun navigateur interactif n'a été utilisé pour le relevé
  (voir *Limites*).
- **Instantané structuré** (sans textes marketing) : `docs/reference/observed-catalogue-2026-10-19.json`.
- **Statut des informations** : `observed` (vu sur la page le jour du relevé),
  `supplier_verified` (confirmé par un fournisseur — aucun à ce jour), `demo`
  (donnée de démonstration interne), `unknown`, `conflicting`.

> Les prix et contenus relevés sont ceux d'un concurrent. Ils ne sont **pas** nos
> tarifs, et aucune technologie de marque, avis, label ou photo n'est réutilisé.
> Ils servent uniquement à la matrice de parité fonctionnelle.

## 1. Navigation et pages observées

Menu principal (observed) : Pergolas (Pergola 4, Pergola 4 Pro, Pergola 4 Pro Max,
Pergola Sur mesure, Tout voir), Accessoires, Stores bannes, Showroom, Réalisations,
Centre d'aide, Contact, Comparer les pergolas. Pied de page : pages éditoriales
(pergola bioclimatique, en kit, adossée, autoportée, aluminium, sur mesure, store
banne), blog, programme créateurs, plan du site, droit de rétractation, garantie,
confidentialité, suivi de commande, enregistrement de garantie, rappel téléphonique,
visite vidéo. Bandeau promotionnel avec compte à rebours (non repris : urgence
artificielle).

Collections : `pergola` (1 produit listé via JSON, le menu en liste 4), `accessoires`
(7 produits), `auvent`, `carport`, `pavillon`, `toit-de-terrasse`, `pergola-metal`,
`pergola-3x3m`… (vides, pages SEO). Les collections nominatives d'influenceurs sont
hors périmètre.

## 2. Familles et variantes observées (catalogue JSON public)

| Famille | Handle | Options | Variantes | Prix TTC observés (promo active) | Statut |
|---|---|---|---|---|---|
| Pergola 4 (manuelle) | `pergola` | Couleur ×4, Dimensions ×7, Type de construction ×2 | 56 | 3 190 → 7 790 € (barré 4 290 → 10 390) | observed |
| Pergola 4 Pro (motorisée, LED gouttière) | `pergola-pro` | idem | 56 | 4 090 → 10 090 € | observed |
| Pergola 4 Pro Max (motorisée, LED lames) | `pergola-pro-max` | Couleur ×3, Dimensions ×7, Type ×2 | 42 | 5 490 → 13 790 € | observed |
| Pergola Série 4 Sur Mesure | `pergola-custom-design` | « ID » = porteur de prix (100 paliers 2 249 → 20 564) | 100 | 4 590 → 38 287 € | observed (mécanisme interne de prix) |
| Store banne | `store-banne` | Taille ×12, Couleur du coffre ×2, Couleur du tissu ×2 | 48 | 799 → 1 839 € (barré 999 → …) | observed |
| Paroi vitrée | `paroi-vitree-pergolux` | Couleur ×2 (Anthracite, Blanc), Dimensions 3/4/5/6 m, Options ×3 (coulissant sans cadre, coulissant avec cadre, fixe) | 24 | 1 449 → 2 899 € | observed |
| Persienne aluminium | `panneau-mural-a-lattes-daluminium` | Couleur ×2, Dimensions 3/4/5/6 m, Type de construction ×2 | 12 (5 m et 6 m : une seule couleur par type) | 1 259 → 2 379 € | observed |
| Store vertical ZIP | `store-vertical-pergolux` | Couleur ×3 (Anthracite, Blanc, Noir), Dimensions 3/4/5/6 m | 12 | 809 → 1 769 € | observed |
| Bandes LED | `pergolux-bandes-led` | Couleur d'éclairage ×2 (Blanc chaud, RGB), Dimensions ×7, Type ×2 | 28 | 299 → 789 € | observed |
| Lampe chauffante | `pergolux-heater` | Couleur ×2, Watt (1500 W, 2000 W — 2000 W en anthracite seulement) | 3 | 249 / 269 € | observed |
| Everglow (lanterne) | `pergolux-everglow` | Couleur ×2, Taille (Moyen, Grande) | 4 | 339 / 369 € | observed |
| Anémomètre (store banne) | `weather-vibration-sensor` | Couleur ×2 | 2 | 99 € | observed |
| Supports store banne (mur/plafond, 2 ou 3) | `pergolux-awning-brackets` | Montage ×2, Brackets ×2, Couleur ×2 | 8 | 0 € (inclus) | observed |
| Câble 6 m store | `awning-eu-6m-cable` | — | 1 | 0 € | observed |
| Bâche de protection colis | `bache-impermeable-pergolux-pour-pergola` | Couleur ×2 | 2 | 9 € | observed (hors périmètre) |
| Génération précédente : Pergola S3, Sundream S3, Skydance S3 | `pergolux-pergola-s3`, `pergolux-sundream-s3`, `pergolux-skydance-s3` | mêmes axes ; Skydance S3 : 4 dimensions, autoportée seulement | 56 / 56 / 12 | 2 589 → 12 209 € ; ruptures nombreuses | observed (fin de série, non reprise au catalogue) |
| Accessoires sur mesure (paroi vitrée, persienne, store vertical, LED) | `glass-wall-custom-made`, `slatwall-custom-design`, `screen-custom-design`, `led-stripes-custom-design` | porteurs de prix par paliers | 38 / 67 / 26 / 2 | — | observed ; `slatwall-custom-design` : grille de prix **conflicting** (prix décroissants au-delà de l'ID 5000) |
| Service de montage | `service-de-montage` | produit à 0 € dont le prix est calculé côté client | 1 | calculé | observed |

Dimensions standard : 3×3, 3×4, 3×5, 3×6, 4×4, 4×5, 4×6 m (observed). Finitions : Anthracite,
Blanc, Anthracite avec lames blanches, Noir (Pro Max sans Noir). Toutes les combinaisons
couleur × dimension × implantation sont présentes et « disponibles » dans le JSON du jour
pour les trois gammes Série 4 (observed ; la disponibilité réelle est inconnue pour nous).

Nomenclature SKU observée (utile pour l'import fournisseur) : `PER|SUN|SKY_MA_GL_<COULEUR>_<LxL>_<FRE|WAL>_04`,
`GWA_AC_<COULEUR>_<300..600>_<FRL|FRA|FIX>_02`, `ASW_AC_EU_ROS_<300..600>_<FRE|WAL>_01`,
`PSC_AC_<COULEUR>_<300..600>_ZIP_02`, `PLE_ACEU_<WHI|RGB>_<LxL>_<FRE|WAL>_03`,
`AWN_MA_EU_<ANT|WHI>_<LLPP>_<GRY|BEG>_01`, `HEA_AC_…`, `EVE_AC_…`.

## 3. Contenu inclus et caractéristiques (observed sur fiches)

- **Pergola 4** : toit à lames manuel (manivelle), 1 rail accessoire par gouttière,
  **aucun éclairage inclus** (bandes LED en option), sans électricité. Fiche technique
  : hauteur de passage 2 350 mm, hauteur totale 2 606 mm, poteaux 120×120 mm, poutres
  175×108 mm (185×108 mural), platine 160×160 mm, lames 166,5 mm, surface max 22,93 m²,
  portée libre max 5 m, distance max entre poteaux 4,56 m, ancrage non compris,
  montage 2–5 h à deux, livraison incluse. Documents PDF adossée/autoportée annoncés.
- **Pergola 4 Pro** : toit motorisé, lames double paroi, **éclairage LED à intensité
  variable inclus**, 2 rails accessoires par poutre, télécommande/app Bluetooth/domotique.
- **Pergola 4 Pro Max** : motorisée, lames plus larges, **éclairage intégré aux lames
  inclus**, profil renforcé « sans poteau central » pour grandes portées, 3 rails.
- Les tableaux de charges vent/neige par dimension sont publiés (unknown pour nous :
  non repris comme performance, seulement comme exemple de structure de données).
- **Store banne** : coffre intégral, motorisé, **LED intégrée et télécommande incluses**,
  largeurs 2 / 2,5 / 3 / 3,5 / 4 / 5 / 6 m, avancées 1,5 / 2 / 2,5 / 3 m, supports
  muraux **ou** plafond inclus (choix à la commande, 2 ou 3 supports selon largeur),
  fixations non incluses, 230 V, câble 7,5 m sortie gauche, anémomètre en option.
  **Variantes réellement vendues (12)** : 2×1,5 ; 3×2 ; 3×2,5 ; 3,5×2,5 ; 3,5×3 ;
  4×2,5 ; 4×3 ; 4×3,5 ; 5×2,5 ; 5×3 ; 5×3,5 ; 6×3 — pas de produit cartésien.
- **Paroi vitrée** : verre trempé 10 mm (sans cadre) / 8 mm (avec cadre), fixe ou
  coulissante. Note fiche : « le côté de 6 m nécessite un pilier central ; sélectionner
  deux éléments de 3 m ».
- **Store vertical** : ZIP, hauteur réglable, « compatible sur les quatre côtés », même
  note sur le côté 6 m. Couleur Noir disponible (seule fermeture compatible avec une
  pergola noire d'après la règle de filtrage, voir §4).
- **Persienne** : variantes Autoportée/Adossée (kit de fixation différent — unknown :
  raison non documentée sur la fiche).
- **Bandes LED** : variantes par dimension de pergola et implantation ; se clipse dans
  la gouttière ; blanc chaud ou RGB. Redondant avec le Pro (LED gouttière incluse) :
  la fiche ne l'exclut pas explicitement (**unknown**).
- **Lampe chauffante** : infrarouge, se clipse dans la gouttière ; 2000 W seulement en anthracite.

## 4. Logique du configurateur observée (scripts publics du thème)

Configurateur standard (`/pages/pergola-4-configurator`, également intégré à chaque fiche) :

1. Couleur → 2. Dimension → 3. Type de construction → 4. **Parois latérales** (grille de
   « côtés ») → 5. Accessoires optionnels (LED, chauffage, Everglow…) → 6. Options de
   montage (DIY / professionnel, prix calculé) → 7. Récapitulatif « Votre configuration ».
- **Grille des côtés** (module `app-sidewalls.js`, observed) : pour une dimension A×B,
  2 côtés de A et 2 côtés de B. Si B = 6 m, le côté de 6 m est **divisé en 2 segments
  de 3 m** (poteau de jonction) → 2 côtés de A + 4 segments de 3 m. En implantation
  adossée, le mur occupe un côté : le côté le plus long est retiré (A>B ⇒ un côté A
  retiré, sinon un côté B retiré) ; avec B = 6 m adossée, il reste 2×A + 2 segments de 3 m.
- **Un seul élément par côté/segment** (slot exclusif) : pas d'empilement.
- Filtrage des parois : taille du côté = taille de la paroi ; couleur de la paroi incluse
  dans la couleur de la pergola (« Anthracite avec lames blanches » accepte Anthracite ;
  « Noir » n'accepte que les parois noires — seul le store vertical existe en noir).
- La persienne porte une option Autoportée/Adossée qui suit l'implantation choisie.
- **Montage professionnel** : prix = métadonnée par variante de pergola (ex. 905,06 €
  et 1 117,91 € relevés sur deux variantes Pro) + 134,03 € par paroi latérale ; produit
  « Service de montage » ajouté au panier avec le total calculé **côté client**
  (observed — nous ferons ce calcul côté serveur).
- **Sauvegarde de configuration** : formulaire e-mail (Klaviyo) avec URL paramétrée
  (`?sidewalls=…&assembly=…`) — pas de projet persistant côté serveur (observed).
- **Comparateur** « Spécifications » intégré aux fiches (tableau vs « gamme équivalente »).

Configurateur sur mesure (`/products/pergola-custom-design`, observed) :
- Curseurs : largeur 1 880 → 4 000 mm (3 900 max si adossée), longueur 1 580 → 5 960 mm
  par pas de 150 mm, hauteur 1 000 → 3 000 mm (pas 1 mm, défaut 2 620).
- Formule de prix embarquée : prix de base + prix au m² au-delà d'une surface minimale,
  multiplicateur, remise ; parois (store, vitrage, persienne) avec base + prix au m².
  Tailles minimales des parois (par ex. 1 580–1 620 mm). Ces valeurs sont les leurs :
  **non reprises** ; notre sur-mesure fonctionne en devis tant qu'aucune grille
  fournisseur n'est validée (voir `launch-blockers.md`).
- Six emplacements de parois : gauche, droite, avant-gauche, avant-droite,
  arrière-gauche, arrière-droite ; options chauffage, LED blanc, LED RGB ; implantation.

## 5. Éléments non repris volontairement

Avis clients et notes, compteurs (« 100 000+ clients »), labels (« 15+ récompenses »),
comptes à rebours, mentions technologiques de marque (SnapFIT, RainLUX, etc.),
comparatif « 11 concurrents », garantie 10 ans (texte juridique PERGOLUX GmbH), photos et
vidéos, paiement fractionné (Alma) — non reproduits.

## 6. Limites du relevé

- Pas de navigateur interactif lors du relevé : les interactions (modales, mini-configurateur,
  rendu mobile du concurrent) sont déduites des scripts publics, pas observées à l'écran.
- Les tableaux « Informations techniques » de Pro et Pro Max sont injectés dynamiquement :
  seules les descriptions ont été lues (nombre de rails, éclairage inclus).
- Stock et délais : indicateurs dynamiques par entrepôt, non relevés.
- Le catalogue peut changer ; ce relevé doit être refait avant toute décision commerciale.
