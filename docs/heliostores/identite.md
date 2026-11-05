# Identité visuelle HELIOSTORES — application au site

> Document publiable. Il décrit ce qui a été fourni par le client, ce qui en a été dérivé pour le site, et ce qui
> relève de simples choix d'interface. Aucune charte graphique n'a été fournie : rien ici ne doit être présenté
> comme une charte officielle de la marque.

## 1. Élément source (fourni par le client)

| Élément | Détail |
| --- | --- |
| Fichier | `PHOTO-2026-10-20-17-17-24.jpg` (JPEG, 1230 × 347 px), conservé hors dépôt (`inputs/heliostores/`, privé) |
| Contenu | logo « HELIO » + soleil rayé servant de point du « i » (vert foncé), « STORES » (sauge), petit ® en haut à droite, sur fond noir pur |
| Usage | fourni par le client pour son site : les fichiers dérivés ci-dessous peuvent être publiés dans `public/brand/` |
| Non fourni | typographie, version vectorielle, charte, déclinaisons claires, pictogramme isolé |

Le **noir** est le fond de la photographie, pas nécessairement une couleur de marque.

## 2. Couleurs mesurées sur le logo

Médiane des pixels de cœur de chaque zone, fond exclu :

| Zone | HEX | Fiabilité |
| --- | --- | --- |
| HELIO + soleil | `#44664D` | bonne |
| STORES | `#8AB4A8` | bonne |
| ® | `#B0B8A6` | faible (glyphe minuscule, artefacts JPEG) |

**Les couleurs RAL des produits (armatures, toiles, lames) n'ont aucun rapport avec les couleurs du site** : elles
décrivent les finitions fabricant proposées au configurateur et ne doivent pas être déduites de la palette ci-dessous.

## 3. Fichiers dérivés (provenance)

Tous générés par `scripts/brand-assets.ts` (`pnpm exec tsx scripts/brand-assets.ts`, nécessite le fichier source
privé). Aucune lettre n'est redessinée ni recolorée ; aucun logo vectoriel n'a été inventé.

| Fichier | Dérivation |
| --- | --- |
| `public/brand/heliostores-logo.png` | 1240 × 347, fond transparent (logo d'origine 1230 × 347, sans rééchantillonnage, élargi de 10 px à droite pour le ® agrandi). Alpha reconstruit pixel par pixel : le fond étant noir, chaque pixel vaut ≈ α × couleur de premier plan ; α est obtenu par projection (moindres carrés) du pixel sur la couleur connue de sa zone (HELIO + soleil : x < 516 ; ® : x ≥ 1160 et y < 129 ; STORES : le reste), bruit JPEG < 4 % ramené à 0. Couleur : pixel d'origine dé-prémultiplié (p / α) au cœur, glissement progressif vers la couleur mesurée sur les bords très transparents (pour éviter le bruit amplifié). Recomposé sur noir, l'écart avec l'original est de 0,16 niveau en moyenne (max. 18 sur quelques pixels de bord). **Variante pour fonds sombres** (couleurs d'origine). |
| `public/brand/heliostores-logo.webp` | même image, WebP (qualité 92, alpha sans perte), 1240 × 347, sans version @2x. |
| `public/brand/heliostores-logo-plaque.png` / `.webp` | **seule variante pour fonds clairs** : le logo intact posé sur une plaque sombre arrondie `#0B0F0D` (marges 60 / 40 px, rayon 36 px), 1360 × 427. |
| `public/brand/heliostores-soleil.png` | recadrage 86 × 86 du soleil (point du i ; boîte mesurée x 311–384, y 48–121, marge 6 px), sans retouche. |
| `src/app/icon.png` (512 × 512) | soleil agrandi (Lanczos, ≈ 4,7×, donc légèrement adouci) centré à 68 % sur un carré arrondi `#0B0F0D`, coins transparents. Remplace l'ancien `icon.svg` (marque ELIOS). |
| `src/app/apple-icon.png` (180 × 180) | même composition, carré plein (iOS arrondit lui-même). |
| `public/brand/heliostores-icone-512.png` | même composition, carré plein 512 × 512 (usages hors Next : réseaux, manifeste éventuel). |

Câblage : conventions de fichiers Next.js `app/icon.png` et `app/apple-icon.png` (balises `<link rel="icon">` et
`apple-touch-icon` générées automatiquement).

### Règles d'usage

- Fond sombre : logo transparent d'origine (en-tête, pied de page, e-mails, PDF). Surface utilisée : `#0B0F0D`.
- Fond clair : **uniquement** la plaque sombre. Ne jamais poser le logo transparent sur du blanc : « STORES »
  `#8AB4A8` n'y atteint que 2,29:1.
- Contraste du logo sur la surface sombre : HELIO `#44664D` 2,99:1 (3,25:1 sur le noir d'origine) — c'est le
  contraste de l'œuvre fournie ; les logotypes sont exemptés des seuils WCAG, mais l'`alt` « HELIOSTORES » est
  toujours présent.
- Ne pas recolorer, étirer, redessiner ou « vectoriser » le logo. Une version vectorielle doit venir du client.

## 4. Palette du site (tokens `src/app/globals.css`) — itération du 2026-10-25

Demande du client : intégrer le **bleu-vert du logo** et un **orange**. Décision de présentation par défaut :
bleu-vert dominant (identité, navigation), orange en accent sur les actions prioritaires, fonds neutres pour les produits.

- **Bleu-vert** : `#8AB4A8`, mesuré sur le logo (« STORES », § 2), teinte 163°. Il devient `brand-400` ; les autres
  nuances `brand-*` en sont **dérivées pour l'interface** (même teinte, luminosité ajustée), pas des couleurs officielles.
- **Orange** : **aucun orange n'existe dans les fichiers de marque fournis.** `accent-600` `#C2410C` est une
  **proposition provisoire** choisie pour son contraste (texte blanc 5,18:1), centralisée dans les tokens
  (`--color-accent-*`, classes `.btn-accent` / `.btn-cta`). Elle n'est **pas** extraite du logo et doit être remplacée
  si le client fournit sa référence d'orange.
- Le vert « HELIO » `#44664D` reste celui du logo (`helio-700`) ; il n'est plus la couleur des boutons.
- Les états (erreur, avertissement, rubrique active) ne reposent jamais sur la seule couleur : libellés « Impossible »
  / « à confirmer », filet de la rubrique active, icônes.

| Token | HEX | Dérivation | Usage |
| --- | --- | --- | --- |
| `brand-50` / `100` / `200` / `300` | `#EEF5F3` `#E0ECE9` `#D0E1DC` `#A8C7BE` | teintes claires de `#8AB4A8` | fonds, survols, rubrique active |
| `brand-400` | `#8AB4A8` | **logo (STORES)** | décor, fonds sombres (jamais en texte sur fond clair : 2,29:1) |
| `brand-500` | `#4E8878` | assombri | anneau de focus, bordures actives |
| `brand-600` / `700` / `800` / `900` | `#437567` `#396558` `#30544A` `#233E36` | assombris | liens, navigation, titres, survols |
| `accent-600` / `700` / `800` | `#C2410C` `#9A3412` `#7C2D12` | **proposition provisoire** | actions prioritaires (Suivant, Commander, Demander le devis, Configurer) |
| `helio-700` | `#44664D` | **logo (HELIO)** | réservé (logo, illustrations) |
| `sage-*`, `night`, `sand-*`, `ink`, `anthracite`, `stone-*` | inchangés | — | voir version précédente ci-dessous |

Contrastes de la nouvelle palette (WCAG 2.x, calculés) : blanc sur `accent-600` 5,18:1 (AA), sur `accent-700` 7,1:1 ;
`brand-600` sur blanc 5,28:1, `brand-700` 6,61:1, `brand-800` 8,42:1 (AA) ; `brand-500` sur blanc 4,10:1 (anneau de
focus ≥ 3:1, jamais en texte courant).

### Palette précédente (itération du 2026-10-21, pour mémoire)

#### Contrastes de la palette précédente

| Couple | Ratio | Verdict |
| --- | --- | --- |
| blanc sur `brand-700` `#44664D` (`.btn-accent`) | 6,45:1 | AA texte |
| blanc sur `brand-800` (survol) / `brand-900` (actif) | 8,63:1 / 12,18:1 | AAA |
| `brand-700` sur blanc (liens) | 6,45:1 | AA |
| `brand-600` `#4B6F54` sur blanc / `sand-50` / `sand-100` | 5,67 / 5,32 / 4,98:1 | AA |
| `brand-500` `#54795E` sur blanc / `sand-50` | 4,91 / 4,61:1 | AA ; ≥ 3:1 pour l'anneau de focus |
| blanc sur `brand-500` (pastilles) | 4,91:1 | AA |
| `ink` sur blanc / `sand-50` | 16,57 / 15,55:1 | AAA |
| `stone-700` sur `sand-50` / `sand-100` | 6,04 / 5,65:1 | AA |
| `sand-50` sur `anthracite` (`.btn-primary`) | 12,87:1 | AAA |
| `sand-50` sur `brand-900` (bandeau préproduction) | 11,43:1 | AAA |
| `night` sur `sage-400` (bouton « Devis ») | 8,43:1 | AAA |
| `sage-300` / `sand-200` / `sand-300` sur `night` (textes de l'en-tête et du pied) | 10,74 / 14,96 / 12,22:1 | AAA |
| `sage-400` (focus) sur `night` | 8,43:1 | ≥ 3:1 |
| **`sage-400` `#8AB4A8` sur blanc** | **2,29:1** | **interdit pour du texte** (décor ou fond sombre seulement) |
| `#B0B8A6` (®) sur blanc | 2,05:1 | non utilisé |

## 5. Typographie

Aucune typographie de marque n'a été fournie. Le lettrage du logo ressemble à une linéale géométrique grasse ;
**le site utilise, par choix d'interface**, Montserrat (titres, depuis la refonte « catalogue » du 2026-10-21) et Inter (texte), chargées par `next/font/google`. Ce ne
sont pas les polices de la marque et elles ne doivent pas être présentées comme telles. À remplacer si le client
fournit sa typographie.

## 6. Application

- En-tête : surface `night` avec le logo transparent, trois familles (Pergolas — Screens — Stores bannes) avec
  sous-menus produits, puis Conseil, Aide et bouton Devis ; bandeau « Préproduction — paiement en ligne en
  mode test. » tant que le site n'est pas indexable.
- Pied de page : logo, familles, liens légaux, coordonnées **uniquement** issues de Réglages (SiteSettings), mention
  « Visuels non contractuels. » (aucune référence au fabricant ni au fournisseur, décision du 2026-10-21).
- Métadonnées : titre « %s — HELIOSTORES », `openGraph.siteName`, `theme-color` `#0B0F0D` ; indexation inchangée
  (préproduction non indexable).
- PDF configuration/devis : bandeau `night` avec le logo PNG intégré, titres en `brand-700`. Les configurations
  de systèmes (`priceMode: "quote"`) impriment le récapitulatif et le prix de la structure (€ HT, grille du
  classeur), ou « Prix : sur devis pour ces dimensions » hors grille ; options, pose et livraison au devis.
- E-mails : bandeau sombre avec le logo (image distante, `alt` « HELIOSTORES »), titres et liens `brand-700`.
- Les documents déjà émis (numéros de devis, PDF et instantanés stockés) ne sont pas réécrits.

## 7. Nom et identité juridique

« HELIOSTORES » est la marque publique. L'identité juridique du vendeur (raison sociale, SIRET, adresse…) n'est pas
validée : `BRAND.legalIdentityPending` reste `true` et ces données viennent exclusivement des Réglages. Les
identifiants techniques (dépôt `elios-solar`, conteneurs, volumes, bases, cookies) sont volontairement inchangés.

## Symbole ® (demande client du 2026-10-23)

Le logo fourni porte déjà un ® (38 × 35 px, environ 30 % de la hauteur des capitales). À la taille d'affichage de
l'en-tête (28 px de haut), il ne faisait plus que 3 px et n'était pas lisible. Sur demande du client, ce même glyphe
a été agrandi 1,75 fois (88 × 81 px avec sa marge, rééchantillonnage Lanczos de ses propres pixels : même dessin, même
couleur), bord gauche et bas conservés, au-dessus de la fin de « STORES ». Le reste du logo est inchangé au pixel près.
La plaque est recomposée à l'identique (marges 60 / 40 px, rayon 36 px, `#0B0F0D`).

Le symbole ® signale une marque **enregistrée** : son emploi suppose un enregistrement en vigueur (INPI, EUIPO ou
OMPI) pour les produits concernés. À défaut, le retirer ou utiliser « ™ ».

