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
| `public/brand/heliostores-logo.png` | 1230 × 347 (dimensions et ratio d'origine, aucun rééchantillonnage), fond transparent. Alpha reconstruit pixel par pixel : le fond étant noir, chaque pixel vaut ≈ α × couleur de premier plan ; α est obtenu par projection (moindres carrés) du pixel sur la couleur connue de sa zone (HELIO + soleil : x < 516 ; ® : x ≥ 1160 et y < 129 ; STORES : le reste), bruit JPEG < 4 % ramené à 0. Couleur : pixel d'origine dé-prémultiplié (p / α) au cœur, glissement progressif vers la couleur mesurée sur les bords très transparents (pour éviter le bruit amplifié). Recomposé sur noir, l'écart avec l'original est de 0,16 niveau en moyenne (max. 18 sur quelques pixels de bord). **Variante pour fonds sombres** (couleurs d'origine). |
| `public/brand/heliostores-logo.webp` | même image, WebP (qualité 92, alpha sans perte), 1230 × 347, sans version @2x. |
| `public/brand/heliostores-logo-plaque.png` / `.webp` | **seule variante pour fonds clairs** : le logo intact posé sur une plaque sombre arrondie `#0B0F0D` (marges 60 / 40 px, rayon 36 px), 1350 × 427. |
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

## 4. Palette du site (tokens `src/app/globals.css`)

`brand-700` est la couleur du logo ; les autres nuances sont **dérivées pour l'interface** (même teinte, luminosité
ajustée), pas des couleurs de marque officielles.

| Token | HEX | Dérivation | Usage |
| --- | --- | --- | --- |
| `brand-50` | `#F1F6F2` | teinte très claire de `#44664D` | survols de menus, fonds discrets |
| `brand-100` | `#E2ECE5` | teinte claire | badges, surlignages |
| `brand-200` | `#C5D8CB` | teinte | bordures légères |
| `brand-500` | `#54795E` | `#44664D` éclairci | anneau de focus, bordure d'input active, bordures/indicateurs |
| `brand-600` | `#4B6F54` | `#44664D` légèrement éclairci | texte de lien / survol sur fond clair |
| `brand-700` | `#44664D` | **logo (HELIO + soleil)** | bouton principal `.btn-accent`, titres d'e-mail et PDF, liens |
| `brand-800` | `#36523E` | assombri | survol de `.btn-accent` |
| `brand-900` | `#263A2C` | assombri | bouton actif, bandeau préproduction |
| `sage-200` / `sage-300` | `#C4DBD3` / `#A9C8BE` | teintes de `#8AB4A8` | texte/survol sur fond sombre |
| `sage-400` | `#8AB4A8` | **logo (STORES)** | accent sur fond sombre (bouton « Devis », pastille panier, focus sur fond sombre) |
| `sage-700` | `#4B7468` | `#8AB4A8` assombri | texte sauge sur fond clair si nécessaire |
| `night` | `#0B0F0D` | quasi-noir légèrement vert (proche du fond d'origine) | en-tête, pied de page, plaques, icônes |
| `sand-50…300` | `#F7F8F5` `#EEF1EC` `#DFE4DD` `#C8D0C7` | neutres légèrement verdis | fonds de page, cartes, bordures |
| `ink` | `#1A201C` | neutre foncé | texte courant |
| `anthracite` | `#24302A` | neutre foncé verdi | `.btn-primary` |
| `stone-700` / `stone-800` | `#5B5F63` / `#3A3D41` | inchangés | textes secondaires |
| `success` / `warning` / `danger` / `olive-500` | inchangés | — | états |

### Contrastes (WCAG 2.x, calculés)

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
**le site utilise, par choix d'interface**, Outfit (titres) et Inter (texte), chargées par `next/font/google`. Ce ne
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
