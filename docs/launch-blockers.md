# Blocages de lancement (à lever avant toute ouverture commerciale)

Statut au 2026-10-19 — la préproduction fonctionne **intégralement en mode test**. Rien de ce qui suit
n'empêche de poursuivre la réalisation ; tout empêche la vente réelle.

## Identité et vendeur
- [ ] Nom commercial définitif (ELIOS SOLAR est provisoire) ; logo et favicon autorisés.
- [ ] Raison sociale, forme, SIRET, TVA, capital, RCS, adresse, téléphone, e-mail (Administration → Réglages).
- [ ] Domaine de production et certificat (Traefik existant), `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_URL`.

## Contenus et médias
- [ ] Mentions légales, CGV (paiement, livraison, garanties, médiation), confidentialité (DPO) : textes validés juridiquement ; passer les pages en PUBLISHED.
- [ ] Photographies / vidéos autorisées avec registre des droits (Administration → Médias) ; remplacer les illustrations SVG.
- [ ] Réalisations et showroom réels (actuellement structures non publiées marquées démo).
- [ ] Notices de montage et fiches techniques PDF par gamme et accessoire.

## Catalogue fournisseur
- [ ] Références, libellés, prix d'achat/vente, délais, stocks ⇒ import CSV/JSON (`docs/import/variants.example.csv`) avec `dataStatus=supplier_verified`.
- [ ] Caractéristiques techniques validées (hauteurs, sections, charges vent/neige, surfaces) ; aujourd'hui `unknown`.
- [ ] Matrice de compatibilité fournisseur : longueurs utiles des fermetures par dimension, poteau intermédiaire par gamme, cumul LED, persienne par implantation, cotes utiles vs commerciales.
- [ ] Grille sur mesure (bornes, pas, prix) ; sinon le sur-mesure reste en devis.
- [ ] Variantes de store banne réellement fabriquées (dimensions, toiles, supports) et options.

## Prix, livraison, montage
- [ ] Tarifs définitifs, TVA, promotions réelles ; retirer le code de démonstration `BIENVENUE5`.
- [ ] Zones et frais de livraison (métropole, Corse, Outre-mer), délais ; transporteur.
- [ ] Zones et tarifs de montage professionnel, partenaire installateur, assurance.

## Prestataires et clés
- [ ] Stripe en production (`PAYMENT_PROVIDER=stripe`, clés live, webhook signé configuré sur `/api/webhooks/stripe`).
- [ ] Fournisseur e-mail (SMTP/API) et adresse d'expédition ; `ADMIN_NOTIFICATION_EMAIL`.
- [ ] Sauvegardes planifiées et restauration testée sur l'environnement de production.

## Juridique / conformité (non certifié)
- [ ] Revue RGPD (durées de conservation documentées dans la politique), bannière cookies conforme au choix d'outils d'audience.
- [ ] Droit de rétractation spécifique au sur-mesure, garanties commerciales si proposées.
