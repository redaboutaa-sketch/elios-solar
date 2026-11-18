# Plan de contenus sur 90 jours (2026-10-26)

> Aucun volume de recherche, aucune position, aucun gain n'est annoncé. Les sujets sont choisis d'après l'offre
> réelle du catalogue et les questions de choix qu'elle pose ; ils seront réordonnés selon les requêtes observées
> dans la Search Console.

## Contrainte

Le design et la structure du site sont validés par le client : **aucune nouvelle page, section, FAQ ou tableau n'est
publié sans validation préalable**. Les contenus ci-dessous sont donc des **brouillons** ; les guides existants ont été
réutilisés (liens depuis le centre d'aide) plutôt que dupliqués.

## Contenus existants réutilisés (aucun doublon créé)

| Sujet | Page existante | Couverture |
|---|---|---|
| Pergola adossée ou autoportante | `/guides/adossee-ou-autoportee` | critères d'implantation (sans affirmation par modèle) |
| Choisir sa pergola | `/guides/choisir-sa-pergola` | lames ou toile, tailles définies ou sur mesure, modèles |
| Screen ou store banne / protections solaires | `/guides/comparer-protections-solaires` | tableau de tous les modèles |
| Choisir la toile | `/guides/choisir-toile-et-motorisation` | toiles et commandes par modèle |
| Prendre les mesures | `/guides/prise-de-mesures`, `/guides/preparation-projet` | méthode par type de pose |
| Démarches | `/guides/autorisation-urbanisme` | seuils France, Belgique (règles régionales) |

## Cinq contenus proposés (brouillons, validation requise)

Chaque contenu respectera : réponse utile dans les premières lignes ; critères explicites ; limites honnêtes ; liens
vers la famille, les modèles et le configurateur ; date de révision ; aucune note « meilleur du marché », aucun prix
non validé, aucune signature d'expert inventée.

### 1. Pergola bioclimatique ou pergola à toiture en toile : laquelle choisir ? (priorité 1)
- **Intention** : comparaison avant achat (hypothèse « pergola bioclimatique ou toile »).
- **Réponse courte** : lames orientables (Malaga, Marbella) pour régler l'ombre et la ventilation ; toiture toile
  (Sevilla) pour une couverture tendue motorisée, adossée.
- **Sources disponibles** : règles et caractéristiques sourcées des trois modèles (`src/server/catalog/families/pergolas-2026.ts`).
- **Manque** : comportement à la pluie et au vent pour chaque modèle hors points « à confirmer » ; entretien.
- **Emplacement proposé** : nouveau guide sous `/guides/` (pas de nouvelle rubrique) ; lien depuis `/pergolas`.

### 2. Store screen ou store banne : quelle protection pour quelle façade ? (priorité 1)
- **Réponse courte** : screen vertical (HelioScreen) pour une baie ou une façade exposée au soleil bas ; store banne
  pour ombrager une terrasse en avancée.
- **Sources** : fiches HelioScreen et des quatre stores bannes ; tableau existant de `/guides/comparer-protections-solaires`.
- **Manque** : valeurs de toile (facteur solaire, opacité) validées ; consignes de vent comparables.
- **Remarque** : recouvre en partie le comparatif existant → à intégrer **dans** ce guide plutôt qu'en page séparée
  (texte d'introduction réécrit, volume comparable), sous réserve de validation.

### 3. Quels critères font varier le prix d'une pergola sur mesure ? (priorité 2)
- **Réponse** : dimensions, implantation (adossée/autoportante), motorisation et options, fermetures latérales, pose,
  livraison selon le lieu ; **aucun montant**.
- **Sources** : structure du configurateur et du devis ; délai communiqué.
- **Manque** : validation commerciale des facteurs (ordre d'importance) par HELIOSTORES.

### 4. Moustiquaire plissée : pour quelles ouvertures ? (priorité 2)
- **Réponse** : MoskiFold (un vantail, porte-fenêtre) et MoskiFold 2 (deux vantaux, grandes baies) en demande d'étude.
- **Manque** : bornes dimensionnelles ; MoskiUp, MoskiSlide, MoskiFix restent en brouillon → non cités comme disponibles.

### 5. Comment choisir la toile d'un store extérieur ? (priorité 3)
- **Réutilisation** : `/guides/choisir-toile-et-motorisation` existe → enrichissement plutôt que nouvelle page.
- **Manque** : nuancier, compositions et performances de toile validées par modèle.

## Calendrier indicatif

| Période | Action | Dépendance |
|---|---|---|
| J0–J30 | Valider la structure des contenus 1 et 2 (emplacement, gabarit de guide existant) ; rédiger | validation client ; données « à confirmer » |
| J0–J30 | Lire les questions réelles des demandes (message, origine) pour ajuster les angles | demandes reçues |
| J31–J60 | Publier 1 et 2 après relecture ; liens depuis les familles concernées | validation |
| J31–J60 | Rédiger 3 et 4 | validation commerciale, bornes moustiquaires |
| J61–J90 | Réviser titres et descriptions selon les requêtes observées (Search Console) ; contenu 5 | 60 jours de données |

## Propositions de mise en page (non implémentées, validation requise)
- Guide d'achat court et FAQ visibles sous la sélection de produits des quatre familles.
- Tableau comparatif accessible des modèles d'une famille (les données existent pour les pergolas et les stores bannes).
- H1 descriptifs (« Pergolas sur mesure », « Pergola Marbella ») au lieu du seul nom.
