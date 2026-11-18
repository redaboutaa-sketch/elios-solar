# Itération 3 — Médiathèque, rendus et espace documentaire

## Fichiers créés
- `src/server/media/rank.ts` — `rankProductMedia(items, ctx)` / `scoreProductMedia` (pur, sans import serveur).
- `src/server/media/types.ts` — type `PublishedMedia`, libellés de nature, listes `MEDIA_NATURES` / `MEDIA_STATUSES`.
- `src/server/media/queries.ts` — `publishedMediaFor(familySlug, { finishCode?, mounting?, variantSku? })` : médias PUBLISHED, droits non expirés, classés.
- `src/server/media/upload.ts` — validation (taille, type, signature binaire, sharp) + stockage d'un fichier reçu.
- `src/server/media/demo-renders.ts` — `buildRenderSpecs`, `renderToPng`, `seedDemoRenders(prisma)` (sans `server-only`).
- `scripts/generate-renders.ts` — `pnpm renders:generate [slug…]`.
- `src/server/documents/versions.ts` — `latestPerGroup`, cycle `DRAFT → REVIEW → PUBLISHED → ARCHIVED`, libellés.
- `src/server/documents/service.ts` — `createDocument`, `createNextVersion`, `transitionDocument` (règles de publication).
- `src/server/documents/queries.ts` — `publicDocumentsForFamily`, `customerDocuments`, `familyIdsOrderedBy`.
- `src/server/actions/admin/documents.ts` — actions serveur documents (audit à chaque étape).
- `src/app/admin/documents/page.tsx` — espace documentaire (groupes, versions, workflow, téléversement PDF).
- `src/app/admin/medias/associations/page.tsx` — associations média ↔ famille (rôle, légende, ordre, finition, implantation, SKU, tags).
- `src/components/admin/media-labels.ts`, `src/components/catalog/document-list.tsx`.
- `src/app/(boutique)/compte/documents/page.tsx` — documents PUBLIC + CUSTOMER des familles commandées + guide.
- `src/app/(boutique)/guides/preparation-projet/page.tsx` — guide original avec 3 schémas SVG.
- Tests : `tests/unit/media-rank.test.ts`, `tests/integration/documents.test.ts`, `tests/e2e/07-medias-documents.spec.ts`.

## Fichiers modifiés
- `src/server/actions/admin/media.ts` — nature, statut, date, droits (note, date de fin), titre, options visibles, ordre, vidéo externe https sans fichier ; transitions brouillon → validé → publié / dépublié / refusé (registre des droits complet exigé, droits non expirés) ; associations (`linkMediaAction`, `updateLinkAction`, `unlinkMediaAction` : seuls les médias PUBLISHED). Un média publié dont la nature ou les droits changent repasse « validé ».
- `src/app/admin/medias/page.tsx` — formulaire complet, filtres (statut, nature, recherche), pagination, actions de validation.
- `src/server/media/storage.ts` — ajout de `storeMediaBuffer` et `removeMediaByUrl` (aucun changement de l'existant).
- `src/components/illustrations/scene.tsx`, `pergola.tsx` — ciel dégradé (jour / soirée étoilée), nuages, halo solaire, lames en relief, ombres portées, terrasse bois, mobilier, jardinières, végétation ; ajout de `shade()`, `RoofDetailArt` ; `AwningArt` accepte `extended`, `evening`, `title` ; `ClosureArt` accepte `title`. Props existantes inchangées.
- `src/components/catalog/product-gallery.tsx` — médias publiés si présents (+ plan coté), sinon vues SVG ; exports `MediaGallery`, `PublishedGallery`. Mentions « Visualisation 3D — rendu, pas une photographie » / « Photographie » (+ crédit), « Options visibles non comprises dans le prix : … » ; vidéo : `<video>` pour un fichier .mp4/.webm/.ogg, sinon simple lien externe (aucun iframe).
- `src/app/(boutique)/pergolas/[slug]/page.tsx` — galerie alimentée selon finition / implantation, onglet « Documents », lien vers le guide. L'onglet Garantie ne liste plus `f.documents` (qui affichait aussi les brouillons).
- `src/app/(boutique)/accessoires/[slug]/page.tsx`, `stores-bannes/[slug]/page.tsx` — galerie publiée (repli SVG) et section Documents.
- `src/components/account/account-nav.tsx` — lien « Documents ».
- `src/app/(boutique)/guides/[slug]/page.tsx` (lien « Autres guides »), `src/app/sitemap.ts` (URL du guide).
- `package.json` — script `renders:generate` uniquement.

## Rendus générés
Pour chaque gamme pergola × finition : en situation autoportée (hero pour la 1re finition), en situation adossée, trois quarts autoportée et adossée, soirée (seulement si l'éclairage est inclus), détail du toit (schéma) ; plus un exemple équipé par gamme (paroi vitrée + store ZIP, listés dans `visibleOptions`). Store banne : déployé avec 2 toiles (gris, beige), le soir, replié. Fermetures / options : rendu de principe ; parois, persiennes et stores aussi en situation. 79 PNG de 1600 px (≈ 7 Mo) sur la base de dev, en 6 s ; une relance donne 0 création (clé `renderConfig.key`, fichier régénéré s'il manque). Chaque rendu est créé avec nature RENDER, statut PUBLISHED, source « Rendu original ELIOS SOLAR — scène procédurale », licence « interne », crédit « ELIOS SOLAR », un texte alternatif commençant par « Visualisation 3D (rendu) », et une `ProductMedia` qui porte rôle, finition, implantation et ordre. Le seed crée aussi un seul document DEMO : « Notice de montage — à fournir par le fournisseur » (DRAFT, audience CUSTOMER, Solis Pro).

## Règles documentaires
- Publier exige un PDF joint. Une notice, une fiche technique, un certificat ou une garantie exige en plus `dataStatus = SUPPLIER_VERIFIED`. Les contenus techniques non vérifiés restent donc en brouillon.
- Publier la version N archive les autres versions publiées du groupe. La boutique n'affiche que la dernière version PUBLISHED de chaque groupe, avec l'audience PUBLIC ; l'espace client ajoute CUSTOMER pour les familles commandées (identifiées par le SKU des lignes et par l'instantané de configuration).
- Seuls les brouillons peuvent être supprimés. Une version publiée ou archivée n'est pas modifiable : il faut créer une nouvelle version.

## Vérifications exécutées
- `pnpm typecheck` : OK. `pnpm lint` : 0 erreur (1 avertissement préexistant dans `realisations/page.tsx`).
- `pnpm test:unit` : 6 fichiers, 105 tests OK (dont 7 dans `media-rank.test.ts`).
- `VITEST_DB_SETUP=1 pnpm vitest run tests/integration/documents.test.ts` : 4 tests OK (versions, brouillon invisible, refus de publication, audience CUSTOMER / INTERNAL, médias PUBLISHED seulement).
- `E2E_NO_SERVER=1 pnpm playwright test tests/e2e/07-medias-documents.spec.ts` : 2/2 OK (desktop 1440 et mobile 390). Captures : `admin-documents-version`, `admin-documents-publie`, `admin-medias`, `fiche-galerie-rendu`, `fiche-documents`.
- `pnpm renders:generate` (deux fois, idempotent) ; curl en 200 sur `/`, `/pergolas/pergola-solis-pro` (avec et sans `?finition=WHITE&implantation=adossee`), stores, accessoires, guides.

## Reste à faire / limites
- Appel de `seedDemoRenders(prisma)` dans `prisma/seed.ts` : à faire par le coordinateur.
- Les PDF et les images sont servis par `/api/media/<hex>` quel que soit leur statut. Le nom aléatoire n'est pas devinable, mais l'URL d'un brouillon reste accessible à qui la connaît. Pour cloisonner les documents CUSTOMER / INTERNAL, il faudrait une route protégée (à prévoir).
- La page famille admin (`/admin/catalogue/familles/[id]`, actions `catalog.ts`) permet toujours d'associer un média non publié ; la boutique le filtre de toute façon. Un lien vers `/admin/medias/associations` y serait utile (fichier hors périmètre).
- La galerie des cartes de liste (`family-card`, `range-card`) garde les SVG.
- Aucun champ de schéma n'a manqué. Les listes d'énumérations sont dupliquées en littéraux typés (`types.ts`, `versions.ts`) pour ne pas dépendre de l'enum chargé par le serveur de dev.

## Données fournisseur à fournir
- Photographies réelles autorisées par gamme et par finition (autoportée / adossée, jour / soir, détails : lames, gouttière, platines, LED), avec source, licence, crédit, date de prise de vue, durée et territoire des droits, et options visibles.
- Notices de montage PDF par gamme (et par implantation si elles diffèrent), fiches techniques (hauteur de passage, résistance au vent et à la neige, poids, platines, alimentation), certificats / déclarations de performance, conditions de garantie commerciale.
- Store banne : notice, fiche technique (résistance au vent, classe), nuancier des toiles. Fermetures et options : notices de pose et fiches.
- Vidéos éventuelles (fichier mp4 ou URL https de l'hébergeur).
