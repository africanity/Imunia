# Tests d'intégration manquants

## Tests d'intégration existants ✅
1. **auth.test.js** - Login, logout, validation
2. **region.test.js** - CRUD régions (POST, GET, PUT, DELETE, delete-summary)
3. **district.test.js** - CRUD districts + gestion users DISTRICT (POST, GET, PUT, DELETE, delete-summary + users)
4. **healthCenter.test.js** - CRUD healthCenters + gestion agents (POST, GET, PUT, DELETE + agents ADMIN/STAFF)
5. **regional.test.js** - Gestion users REGIONAL (POST, PUT, DELETE, activate)
6. **health.test.js** - Health check endpoint

## Tests d'intégration manquants ❌

### 1. **commune.test.js** - Gestion des communes
**Routes à tester:**
- `POST /api/commune` - Création (NATIONAL, REGIONAL)
- `GET /api/commune` - Liste (NATIONAL, REGIONAL)
- `PUT /api/commune/:id` - Modification (NATIONAL, REGIONAL)
- `GET /api/commune/:id/delete-summary` - Résumé de suppression
- `DELETE /api/commune/:id` - Suppression (NATIONAL, REGIONAL)

**Scénarios:**
- Authentification (401, 403)
- Validation (champs requis, région valide)
- Autorisation (REGIONAL ne peut gérer que ses communes)
- Succès (création, modification, suppression)
- Cascade deletion (districts, healthCenters, children, etc.)

### 2. **children.test.js** - Gestion des enfants
**Routes à tester:**
- `POST /api/children` - Création d'enfant
- `GET /api/children` - Liste des enfants
- `GET /api/children/parents` - Vue d'ensemble des parents
- `GET /api/children/:id/vaccinations` - Vaccinations d'un enfant
- `POST /api/children/:id/vaccinations/:bucket` - Création entrée vaccination manuelle
- `PUT /api/children/:id/vaccinations/:bucket/:entryId` - Modification entrée vaccination
- `DELETE /api/children/:id/vaccinations/:bucket/:entryId` - Suppression entrée vaccination
- `PUT /api/children/:id` - Modification enfant
- `DELETE /api/children/:id` - Suppression enfant
- `PUT /api/children/:id/activate` - Activation enfant
- `PUT /api/children/:id/request-photos` - Demande de photos
- `POST /api/children/:childId/vaccination-proofs` - Upload preuves (mobile)
- `POST /api/children/:childId/vaccination-proofs/upload` - Upload preuve (backoffice)
- `GET /api/children/:childId/vaccination-proofs` - Liste preuves

**Scénarios:**
- Authentification et autorisation par rôle
- Validation des données
- Gestion des vaccinations
- Upload de fichiers (preuves)
- Activation/désactivation

### 3. **stock.test.js** - Gestion des stocks
**Routes à tester (très nombreuses):**
- `GET /api/stock/national/:vaccineId/lots` - Lots nationaux
- `GET /api/stock/regional/:vaccineId/lots` - Lots régionaux
- `GET /api/stock/district/:vaccineId/lots` - Lots district
- `GET /api/stock/health-center/:vaccineId/lots` - Lots healthCenter
- `GET /api/stock/national` - Stock national
- `GET /api/stock/regional` - Stock régional
- `GET /api/stock/district` - Stock district
- `GET /api/stock/health-center` - Stock healthCenter
- `POST /api/stock/national` - Création stock national
- `POST /api/stock/regional` - Création stock régional
- `POST /api/stock/district` - Création stock district
- `POST /api/stock/health-center` - Création stock healthCenter
- `PUT /api/stock/national` - Mise à jour stock national
- `PUT /api/stock/regional` - Mise à jour stock régional
- `PUT /api/stock/district` - Mise à jour stock district
- `PUT /api/stock/health-center` - Mise à jour stock healthCenter
- `PUT /api/stock/add-national` - Ajout stock national
- `PUT /api/stock/add-regional` - Ajout stock régional
- `PUT /api/stock/add-district` - Ajout stock district
- `PUT /api/stock/add-health-center` - Ajout stock healthCenter
- `PUT /api/stock/reduce-national` - Réduction stock national
- `PUT /api/stock/reduce-regional` - Réduction stock régional
- `PUT /api/stock/reduce-district` - Réduction stock district
- `PUT /api/stock/reduce-health-center` - Réduction stock healthCenter
- `POST /api/stock/national/lot/:id/reduce` - Réduction lot national
- `DELETE /api/stock/lots/:id` - Suppression lot
- `DELETE /api/stock/national` - Suppression stock national
- `DELETE /api/stock/regional` - Suppression stock régional
- `DELETE /api/stock/district` - Suppression stock district
- `DELETE /api/stock/health-center` - Suppression stock healthCenter
- `GET /api/stock/stats/national` - Statistiques stock national
- `GET /api/stock/stats/regional` - Statistiques stock régional
- `GET /api/stock/stats/district` - Statistiques stock district
- `GET /api/stock/stats/health-center` - Statistiques stock healthCenter
- `GET /api/stock/health-center/reservations` - Réservations healthCenter
- `GET /api/stock/pending-transfers` - Transferts en attente
- `POST /api/stock/pending-transfers/:transferId/confirm` - Confirmation transfert

**Scénarios:**
- Gestion des stocks par niveau (NATIONAL, REGIONAL, DISTRICT, HEALTHCENTER)
- Opérations CRUD sur les stocks
- Ajout/réduction de stock
- Gestion des lots
- Statistiques
- Transferts entre niveaux
- Réservations

### 4. **vaccine.test.js** - Gestion des vaccins
**Routes à tester:**
- `POST /api/vaccine` - Création vaccin
- `GET /api/vaccine` - Liste vaccins
- `PUT /api/vaccine/:id` - Modification vaccin
- `DELETE /api/vaccine/:id` - Suppression vaccin
- `POST /api/vaccine/calendar` - Création calendrier vaccinal
- `GET /api/vaccine/calendar` - Liste calendriers
- `PUT /api/vaccine/calendar/:id` - Modification calendrier
- `DELETE /api/vaccine/calendar/:id` - Suppression calendrier
- `GET /api/vaccine/calendar/download-pdf` - Téléchargement PDF calendrier
- `GET /api/vaccine/calendar/dose-warnings` - Avertissements doses
- `POST /api/vaccine/scheduled` - Programmer vaccination
- `GET /api/vaccine/scheduled` - Liste vaccinations programmées
- `POST /api/vaccine/scheduled/:id/complete` - Compléter vaccination
- `PATCH /api/vaccine/scheduled/:id` - Modifier vaccination programmée
- `DELETE /api/vaccine/scheduled/:id` - Annuler vaccination programmée

**Scénarios:**
- CRUD vaccins
- Gestion calendriers vaccinaux
- Programmation vaccinations
- Complétion vaccinations
- PDF generation

### 5. **campaign.test.js** - Gestion des campagnes
**Routes à tester:**
- `GET /api/campaigns` - Liste campagnes
- `POST /api/campaigns` - Création campagne
- `PUT /api/campaigns/:id` - Modification campagne
- `DELETE /api/campaigns/:id` - Suppression campagne
- `PATCH /api/campaigns/:id/medias` - Ajout média (upload fichier)
- `DELETE /api/campaigns/:id/medias` - Suppression média

**Scénarios:**
- CRUD campagnes
- Upload de fichiers (médias)
- Gestion des médias

### 6. **advice.test.js** - Gestion des conseils
**Routes à tester:**
- `GET /api/advice` - Liste conseils
- `POST /api/advice` - Création conseil
- `PUT /api/advice/:id` - Modification conseil
- `DELETE /api/advice/:id` - Suppression conseil

**Scénarios:**
- CRUD conseils
- Authentification/autorisation

### 7. **vaccineRequests.test.js** - Gestion des demandes de vaccin
**Routes à tester:**
- `GET /api/vaccine-requests` - Liste demandes
- `POST /api/vaccine-requests/:id/schedule` - Programmer demande
- `DELETE /api/vaccine-requests/:id` - Annuler demande

**Scénarios:**
- Liste des demandes par rôle
- Programmation de rendez-vous
- Annulation de demandes

### 8. **dashboard.test.js** - Tableaux de bord
**Routes à tester:**
- `GET /api/dashboard/national` - Dashboard national
- `GET /api/dashboard/regional` - Dashboard régional
- `GET /api/dashboard/district` - Dashboard district
- `GET /api/dashboard/agent` - Dashboard agent

**Scénarios:**
- Statistiques par rôle
- Authentification/autorisation

### 9. **reports.test.js** - Rapports
**Routes à tester:**
- `GET /api/reports/agent` - Rapports agent
- `GET /api/reports/regional` - Rapports régional
- `GET /api/reports/district` - Rapports district
- `GET /api/reports/national` - Rapports national
- `GET /api/reports/region/:regionName` - Détails région
- `GET /api/reports/district/:regionName/:districtName` - Détails district
- `GET /api/reports/healthcenter/:regionName/:districtName/:healthCenterName` - Détails healthCenter

**Scénarios:**
- Génération rapports par rôle
- Détails par niveau hiérarchique

### 10. **vaccinationProofs.test.js** - Preuves de vaccination
**Routes à tester:**
- `GET /api/vaccination-proofs/:childId` - Liste preuves (déjà dans children?)
- `DELETE /api/vaccination-proofs/:id` - Suppression preuve

**Note:** Certaines routes sont peut-être dans children.test.js

### 11. **systemSettings.test.js** - Paramètres système
**Routes à tester:**
- `GET /api/systemSettings` - Récupération paramètres

**Scénarios:**
- Lecture paramètres système

### 12. **users.test.js** - Endpoints users non couverts
**Routes à tester (complémentaires):**
- `GET /api/users` - Liste users (avec filtres par rôle)
- `GET /api/users/me` - Informations utilisateur connecté
- `PATCH /api/users/me` - Modification compte utilisateur
- `POST /api/users/me/verify-email` - Vérification email
- `GET /api/users/:id/delete-summary` - Résumé suppression user
- `DELETE /api/users/:id` - Suppression user générique
- `GET /api/users/health-center/agents` - Liste agents healthCenter

**Note:** Certains endpoints sont déjà testés dans regional.test.js, district.test.js, healthCenter.test.js

### 13. **mobile.test.js** - API mobile (optionnel, moins prioritaire)
**Routes à tester:**
- Toutes les routes `/api/mobile/*` pour l'application mobile
- Authentification mobile
- Inscription parent
- Login parent
- Gestion PIN
- Dashboard enfant
- Calendrier enfant
- Notifications
- Demandes de vaccin
- etc.

## Priorités recommandées

### Priorité HAUTE 🔴
1. **commune.test.js** - Complète la hiérarchie géographique (région → commune → district → healthCenter)
2. **children.test.js** - Fonctionnalité centrale de l'application
3. **stock.test.js** - Gestion critique des stocks (mais très volumineux, peut être divisé)

### Priorité MOYENNE 🟡
4. **vaccine.test.js** - Gestion des vaccins et calendriers
5. **vaccineRequests.test.js** - Demandes de vaccin
6. **dashboard.test.js** - Tableaux de bord
7. **users.test.js** - Endpoints users complémentaires

### Priorité BASSE 🟢
8. **campaign.test.js** - Campagnes
9. **advice.test.js** - Conseils
10. **reports.test.js** - Rapports
11. **vaccinationProofs.test.js** - Preuves (si pas dans children)
12. **systemSettings.test.js** - Paramètres système
13. **mobile.test.js** - API mobile (peut être testé séparément)


