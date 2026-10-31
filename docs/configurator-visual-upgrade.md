# Configurateur visuel — amélioration du 2026-10-31

## Référence observée (neo10.com, 2026-10-31)

Configurateur « Pergola Poteau 160x160 bioclimatique autoportée sur mesure », examiné avec un navigateur automatisé,
sans compte, sans ajout au panier ni envoi de formulaire (cookies refusés). Observé :
- visuel du produit à gauche, champs à droite ; l'image (rendu serveur) se régénère après chaque choix ;
- ajout d'un store sur « Face avant » puis d'une paroi vitrée sur « Face gauche » : l'image montre aussitôt le store
  (toile blanche) et le vitrage (translucide) sur les faces choisies ; changement de longueur : prix recalculé ;
- côtés choisis par pictogrammes (face mise en évidence) ; teintes en pastilles rondes portant le code RAL et parfois
  un nom (« 9010 BLANC », « Chêne doré ») ; prix et actions dans une barre fixe en bas d'écran.
Non testé : comportement mobile du site de référence, enregistrement d'un projet, devis (formulaires non envoyés).
Seuls les principes d'interaction sont repris ; ni code, ni image, ni identité graphique.

## Ce qui change chez HELIOSTORES (même configurateur, même état)

Une seule configuration (`SystemInput`) alimente les champs, le dessin 2D, la vue 3D, le récapitulatif, le calcul
tarifaire serveur, le projet enregistré, le devis et son visuel figé. Rien n'est dupliqué :
- **Fermetures par côté** — chaque choix apparaît aussitôt sur le dessin, du côté indiqué, et disparaît quand on le
  retire. Matériaux distincts : HelioSlide VERRE (verre translucide, montants, reflet), HelioSlide ALU (panneaux
  aluminium opaques à joints), screen (toile semi-opaque sous coffre, barre de charge). Contour en tirets = assemblage
  non confirmé ; sous chaque côté : « Représenté sur le dessin · compatibilité à confirmer sur devis ». Côté mur
  (pose adossée) : aucune fermeture possible (inchangé).
- **Repères** Avant / Arrière (mur) / Gauche / Droite sur le dessin (trois quarts et dessus ; gauche/droite en vue de
  face). Quand seul le côté gauche est fermé, la vue trois quarts se place côté gauche pour le montrer.
- **Teintes** — pastilles avec échantillon, nom RAL Classic officiel (s'il existe ; jamais inventé pour FSM, DB ou un
  décor), code, aspect (mat…), coche et cadre pour la sélection (pas seulement la couleur), groupe radio au clavier
  (flèches), libellé accessible complet. Seules les teintes du modèle ; « à confirmer » conservé ; mention « aperçu
  écran indicatif, nuancier de référence ». Le dessin et la 3D suivent immédiatement.
- **Mobile** — bouton « Aperçu » dans la barre du configurateur : panneau flottant (à gauche, hors de la bulle du chat)
  avec le dessin du même modèle, mis à jour à chaque choix, fermable ; les champs restent accessibles.
- Inchangés : curseurs et saisies précises, étapes, vue 3D à la demande (three.js chargé au clic), capture du devis
  (dessin rasterisé du même état), sans « Intérieur » ni « Ambiance nuit ».

## Limites honnêtes
- La teinte des lames suit celle de la structure (aucune donnée de teinte de lame distincte pour ces modèles).
- HelioSlide VERRE et ALU restent des **souhaits étudiés au devis** : aucune compatibilité garantie, aucune dimension
  ni mécanisme inventés (HelioSlide ALU : correspondance SYSTEM SLIDE à confirmer).
- HelioLux et HelioRoof : caractéristiques en cours de confirmation (transcodification du 2026-10-31).

## Tests
`tests/e2e/19-configurateur-visuel.spec.ts` (dimensions, teintes au clavier, ajout/retrait par côté, changements
rapides, vue côté gauche, pose adossée, enregistrement puis restauration, aperçu mobile), `tests/e2e/02`, `03`, `16`
(adaptés aux pastilles), `tests/unit/colours.test.ts`.
