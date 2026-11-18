# Comparatif marché, coût d'achat net et recommandation de prix (2026-11-04)

> Document publiable : aucun montant, aucun taux de marge. Coûts, marges, relevés chiffrés et recommandations restent
> dans l'administration (réservée aux administrateurs) et dans `private/heliostores/market-2026-11/` (hors Git, hors Docker).

## 1. Où et pour qui

Administration → Tarifs → **Comparatif marché** (`/admin/tarifs/comparatif-marche`) :

| Page | Usage |
|---|---|
| `/admin/tarifs/comparatif-marche` | étude d'une configuration réelle (produit, implantation, cotes, teinte, commande, options, version de vente) |
| `…/releves` et `…/releves/<id>` | relevés concurrents : filtres (produit, pays, comparabilité, revendeur, dates, statut), saisie, correction motivée, archivage, historique, import CSV |
| `…/politique` | politique de coût versionnée : remise revendeur et date d'effet, éligibilité des postes, coûts directs par défaut, objectifs, ancienneté, tolérance, arrondi |
| `…/export?type=releves\|simulation\|propositions` | exports CSV internes |

Accès : rôle administrateur vérifié côté serveur sur chaque page, chaque action et chaque export (404 pour tout autre
rôle, redirection vers la connexion pour un visiteur). Aucun module public ne lit ces tables (test
`supplier-prices.test.ts`). Le journal ne contient ni taux ni montant.

## 2. Coût d'achat net (paramètre interne, jamais une remise client)

Décision du client du 2026-11-04 : remise revendeur de 37 % sur le prix catalogue éligible. Elle est enregistrée comme
**version 1 de la politique de coût** et se modifie par une nouvelle version datée (aucune version n'est réécrite). Les
prix publics et la politique de vente (prix de vente = prix catalogue, décision du 2026-11-02) sont inchangés.

Ordre des calculs (liste de prix 09.2026) :
1. **Structure** (cellule de la grille catalogue, lue à la même cellule que la grille de vente, même variante) :
   éligible par défaut → achat net = catalogue × (1 − remise), arrondi au centime.
2. **Pourcentages** (décor, RAL…) : « % du prix du système après application de la remise » → appliqués à la structure
   nette ; jamais remisés une seconde fois.
3. **Montants fixes et tableaux** (centrale radio, moteurs, télécommandes, LED, poteaux, capteurs…) : remise appliquée
   seulement si le poste est déclaré éligible ; « non éligible » → prix catalogue ; **éligibilité inconnue** (par défaut)
   → coût **non établi**, signalé ; une hypothèse prudente (prix catalogue sans remise) sert au plancher.
4. **Éléments « à chiffrer »** : coût manquant, signalé.

Affichage séparé : A prix catalogue fournisseur HT ; B coût d'achat net HT (postes établis, inconnus, manquants) ;
C prix de vente HT et D TTC (TVA 20 %, France) ; marge brute (€) = vente HT − achat net HT ; marge brute en % du prix ;
taux de marge sur coût ; contribution après coûts directs renseignés.

## 3. Coûts directs et contribution

Transport, pose, frais de paiement, acquisition, provision SAV, commission Beaver Data : chacun **renseigné**
(montant HT ou pourcentage avec son assiette : prix de vente HT, TTC encaissé ou marge brute), **inconnu** ou **sans
objet**, et marqué « facturé au client à part » le cas échéant (livraison et pose chiffrées séparément au devis : hors
contribution du produit, signalées). Valeurs par défaut : tous inconnus, sauf la commission (3 % du prix de vente HT,
hypothèse « applicable » affichée). Un coût inconnu n'est jamais compté comme zéro : la contribution est alors
**partielle**, jamais présentée comme un bénéfice net.

## 4. Comparables

Relevé : revendeur, fabricant (indépendance), modèle, URL exacte, date, pays, devise ; cotes, implantation, toiture,
commande, options ; prix constaté HT/TTC, nature (configuration précise, taille fixe, « à partir de »), prix normal et
promotionnel, fin de promotion ; périmètre (livraison, pose, moteur, télécommande, LED, screen, vitrage : inclus, en
supplément avec montant vérifiable, absent, inconnu) ; garantie, matériau, lames ou toile, résistance, SAV ;
comparabilité (forte, partielle, insuffisante) et sa raison ; citations ; accès à la source.

Une offre est **retenue** pour une configuration seulement si : comparabilité forte ; même produit de référence, même
marché, euros ; base fiscale établie (TTC converti avec la TVA validée du marché : France 20 % ; Belgique non convertie) ;
relevé non ancien (seuil réglable, 120 jours par défaut) ; prix d'une configuration ou d'une taille fixe (jamais un
« à partir de ») ; prix normal (une promotion sans prix normal vérifiable est écartée) ; cotes à ±10 % par côté (réglable,
aucune normalisation au m²) ; même implantation ; périmètre équivalent, un écart n'étant normalisé que si son montant
est vérifiable. Sinon l'offre est **présentée séparément** avec ses écarts poste par poste.

## 5. Recommandation

- Position du prix actuel (écart à la médiane, offres moins chères / plus chères), nombre d'offres retenues et
  indépendantes, dates, fourchette, médiane.
- **Plancher** : objectif de marge brute ou de contribution fixé par l'administrateur (aucun par défaut : sans
  objectif, ni plancher ni prix conseillé) ; coût prudent ; coûts pris en compte et manquants listés.
- **Scénarios** : compétitif (1er quartile), aligné (médiane), premium (3e quartile, « non étayé » sans justification
  par des différences vérifiables). Un scénario sous le plancher n'est jamais recommandé ; si le marché est sous le
  plancher, l'écart est affiché avec l'invitation à revoir coûts, périmètre ou positionnement.
- **Prix conseillé** : scénario aligné, arrondi au multiple de 10 € TTC le plus proche (règle réglable), relevé au
  multiple supérieur s'il passait sous le plancher ; variation, marge, contribution et confiance (élevée : ≥ 5 offres
  indépendantes ; moyenne : ≥ 3 ; **indicative** : moins de 3 ; **simulation interne** : aucune).
- Porte sur la configuration étudiée seulement.

## 6. Proposition et brouillon (aucune publication)

« Préparer la proposition » enregistre un brouillon lié à la version de vente utilisée et à la politique de coût
(instantané : coûts, comparables retenus, confiance). « Créer un brouillon de grille » reprend cette version en
brouillon et modifie **une seule cellule** (celle de la configuration, suppléments inchangés). Vérification et
publication restent manuelles dans Tarifs ; pour une règle sur toute la grille : « Recalculer » puis « Comparer »
(cellules affectées). Une proposition sous le plancher ou « premium » sans justification est refusée.

## 7. Première étude (2026-11-04) — sources

Relevés publics consultés sans commande, panier, compte ni demande de devis (49 relevés importés, France) :

| Revendeur | Pages | Accès |
|---|---|---|
| PERGOLUX (pergolux.fr, PERGOLUX GmbH) | fiches `pergola`, `pergola-pro`, `pergola-pro-max`, `pergolux-sundream-s3`, `pergolux-skydance-s3`, `pergola-custom-design`, `store-vertical-pergolux`, `store-banne` ; `/pages/10-ans-de-garantie`, `/policies/shipping-policy` | prix par taille dans les données de variantes ; **HT/TTC non indiqué** ; sur mesure : prix d'entrée seulement |
| NEO10 (neo10.com, confirmé ; neo.com sans rapport) | fiches pergolas 100/120/160, stores Lewis et Isaac ; `/page/livraisons`, CGV, garanties | deux tailles fixes chiffrées ; configurateur sur mesure non lisible |
| Castorama (dont marketplace) | catégorie pergolas bioclimatiques et fiches 4ALU Vali, Salto, Klikstrom, Green Outside, Summer, Ombréa, Sunny Inch, TILA, Sunlight | prix TTC, livraison souvent incluse |
| Sunny Inch, Vente-unique, Truffaut, 100 % Menuiseries, Fenestrazur | fiches pergolas bioclimatiques et à toile | prix TTC ; deux « à partir de » |
| Leroy Merlin, Bricomarché, Mr Bricolage, ManoMano, Le Roi de la Fenêtre, Usine Online | — | inaccessibles (403 / 503) |

Constats (sans montant) :
- **Aucune offre fortement comparable** n'est retenue : livraison comprise chez presque tous les revendeurs (montant
  non vérifiable ; chez nous au devis), LED comprises (option chez nous), HT/TTC non indiqué par PERGOLUX, kits à
  monter soi-même, caractéristiques non documentées (épaisseurs, résistance, moteur). Les recommandations affichées
  sont donc des **simulations internes**, pas des prix de marché.
- HelioSky (3,50 m de large) : aucune offre de même largeur ; HelioLux : aucune toile PVC plissée équivalente (toiles
  acryliques ou polyester enroulables, souvent adossées, en promotion).
- Données à obtenir pour fiabiliser : coût réel de livraison et de pose, éligibilité à la remise des postes fixes
  (centrale radio, télécommandes, moteurs, LED, poteaux), objectif de marge, base HT/TTC de PERGOLUX, prix sur mesure
  des configurateurs (saisie manuelle prévue), frais de paiement, coût d'acquisition, provision SAV.

Import en production : runbook § 2 sexies.
