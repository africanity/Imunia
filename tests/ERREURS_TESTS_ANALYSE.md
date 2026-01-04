# Analyse des Erreurs dans les Tests Unitaires

## Résumé
47 tests échouent sur 863 tests totaux. Les erreurs sont dues à des changements dans la logique backend qui ne sont pas reflétés dans les tests.

## ⚠️ IMPORTANT : Ne pas modifier le backend
Toutes les corrections doivent être faites dans les tests uniquement.

---

## 📋 Erreurs par Fichier

### 1. `tests/unit/stockController.test.js` (10 erreurs)

#### `addStockREGIONAL` / `addStockDISTRICT` / `addStockHEALTHCENTER`
**Problème** : Les tests s'attendent à ce que `res.json` soit appelé, mais ce n'est pas le cas.
**Cause probable** : La logique de transfert a changé (unified transfer logic). Les fonctions retournent probablement `pendingTransfer` avec un message différent, ou la logique de réponse a changé.
**Tests affectés** :
- `addStockREGIONAL › devrait ajouter du stock régional avec succès`
- `addStockDISTRICT › devrait ajouter du stock district avec succès (REGIONAL)`
- `addStockHEALTHCENTER › devrait ajouter du stock health center avec succès (DISTRICT)`

#### `deleteStockNATIONAL` / `deleteStockREGIONAL` / `deleteStockDISTRICT` / `deleteStockHEALTHCENTER`
**Problème** : Les tests s'attendent à `{ success: true }` mais ne reçoivent rien.
**Cause probable** : La réponse a changé (peut-être `204 No Content` ou un message différent).
**Tests affectés** :
- `deleteStockNATIONAL › devrait supprimer le stock national avec succès`
- `deleteStockREGIONAL › devrait supprimer le stock régional avec succès (REGIONAL)`
- `deleteStockDISTRICT › devrait supprimer le stock district avec succès (DISTRICT)`
- `deleteStockHEALTHCENTER › devrait supprimer le stock health center avec succès (AGENT ADMIN)`

#### `deleteLot`
**Problème 1** : Test s'attend à `403` mais reçoit `400`.
**Cause probable** : La validation de `lotId` manquant se déclenche avant la vérification de permission.
**Test affecté** : `deleteLot › devrait retourner 403 si utilisateur n'est pas NATIONAL`

**Problème 2** : Test s'attend à `deletedIds` dans la réponse mais ce n'est pas présent.
**Cause probable** : Le format de réponse de `deleteLot` a changé.
**Test affecté** : `deleteLot › devrait supprimer un lot avec succès`

#### `confirmPendingTransfer`
**Problème** : Test s'attend à ce que `res.json` soit appelé, mais ce n'est pas le cas.
**Cause probable** : La logique de confirmation a changé.
**Test affecté** : `confirmPendingTransfer › devrait confirmer un transfert avec succès (REGIONAL)`

---

### 2. `tests/unit/eventLogController.test.js` (2 erreurs)

#### `getEventLogs`
**Problème** : Le format de réponse a changé. Les événements sont formatés avec plus de champs (`details`, `entityId`, `entityName`, `metadata`, `subtype`, `user` object).
**Test affecté** : `getEventLogs › devrait retourner les événements avec pagination par défaut`
**Solution** : Adapter le mock pour correspondre au format réel (avec `user` object formaté).

#### `deleteMultipleEventLogs`
**Problème** : Message différent : "événement(s) supprimé(s)" au lieu de "événements supprimés".
**Test affecté** : `deleteMultipleEventLogs › devrait supprimer plusieurs événements avec succès`
**Solution** : Changer le message attendu dans le test.

---

### 3. `tests/unit/vaccineRequestController.test.js` (1 erreur)

#### `cancelVaccineRequest`
**Problème** : `prisma.vaccineRequest.update` n'est pas appelé.
**Cause probable** : La logique d'annulation a changé (peut-être via une transaction ou un service).
**Test affecté** : `cancelVaccineRequest › devrait annuler une demande avec succès`

---

### 4. `tests/unit/regionController.test.js` (3 erreurs)

#### `createRegion`
**Problème** : `prisma.region.findFirst` n'est pas mocké dans les tests.
**Cause** : Le code utilise maintenant `findFirst` pour vérifier les doublons, mais le mock ne l'inclut pas.
**Test affecté** : `createRegion() › devrait créer une région avec succès`
**Solution** : Ajouter `findFirst: jest.fn()` au mock de `prisma.region`.

#### `deleteRegion`
**Problème** : Test s'attend à `204` mais ne reçoit rien.
**Cause probable** : La réponse a changé (peut-être `200` avec un message JSON).
**Tests affectés** :
- `deleteRegion() › devrait supprimer une région avec toutes ses données liées`
- `deleteRegion() › devrait gérer le cas où la région n'a pas de données liées`

---

### 5. `tests/unit/dashboardController.test.js` (1 erreur)

#### `getNationalDashboardStats`
**Problème** : Format de requête Prisma changé pour `vaccine.findMany`.
**Cause** : La structure de `_count.select.completedByChildren` a changé (maintenant avec `where: {}`).
**Test affecté** : `getNationalDashboardStats › devrait retourner les statistiques nationales avec succès`

---

### 6. `tests/unit/adviceController.test.js` (3 erreurs)

#### `createAdvice` / `updateAdvice` / `deleteAdvice`
**Problème** : Les réponses ne correspondent pas (201, 204, etc.).
**Cause probable** : Les codes de statut ou le format de réponse ont changé.
**Tests affectés** :
- `createAdvice › devrait créer un conseil avec succès sans âge` (attendu 201)
- `updateAdvice › devrait mettre à jour un conseil avec succès` (pas de réponse)
- `deleteAdvice › devrait supprimer un conseil avec succès` (attendu 204)

---

### 7. `tests/unit/reportController.test.js` (2 erreurs)

#### `getRegionDetails`
**Problème** : Utilise maintenant `select: { id: true, name: true }` au lieu de `include: { communes: { include: { district: true } } }`.
**Cause** : Correction Prisma (suppression des `include` incorrects).
**Test affecté** : `getRegionDetails › devrait retourner les détails de la région avec succès`
**Solution** : Adapter le test pour utiliser `select` au lieu de `include`.

#### `getHealthCenterDetails`
**Problème** : 
1. Format de réponse changé (plus de `agentPhone` dans `agentStats`).
2. Format des données plus détaillé (monthlyVaccinations, vaccineDistribution avec valeurs réelles).
**Cause** : Corrections Prisma (suppression de `phone` du select User) et format de réponse plus complet.
**Test affecté** : `getHealthCenterDetails › devrait retourner les détails du centre de santé avec succès`
**Solution** : 
- Retirer `agentPhone` du test.
- Utiliser `expect.any(Array)` ou des valeurs réelles pour `monthlyVaccinations` et `vaccineDistribution`.

---

### 8. `tests/unit/vaccineController.test.js` (2 erreurs)

#### `ScheduleVaccine`
**Problème** : Test s'attend à `400` pour genre incompatible, mais ne reçoit rien.
**Cause probable** : La logique a changé (maintenant un warning non-bloquant au lieu d'une erreur 400).
**Test affecté** : `ScheduleVaccine › devrait retourner 400 si vaccin spécifique au genre et genre incompatible`
**Solution** : Adapter le test pour la nouvelle logique (warning au lieu d'erreur).

#### `deleteVaccineCalendar`
**Problème** : Retourne `404` au lieu de `204`.
**Cause probable** : Le calendrier n'est pas trouvé dans le mock, ou la logique a changé.
**Test affecté** : `deleteVaccineCalendar › devrait supprimer un calendrier avec succès`

---

### 9. `tests/unit/childrenController.test.js` (1 erreur)

#### `requestPhotos`
**Problème** : `notificationService.notifyPhotoRequest` n'est plus appelé.
**Cause probable** : La logique de notification a changé.
**Test affecté** : `requestPhotos › devrait demander des photos avec succès`

---

### 10. `tests/unit/systemSettingsController.test.js` (2 erreurs)

#### `getSystemSettings`
**Problème** : `res.json` n'est jamais appelé.
**Cause probable** : La fonction a complètement changé (peut-être maintenant async et utilise Prisma).
**Tests affectés** :
- `getSystemSettings › devrait retourner les paramètres système par défaut`
- `getSystemSettings › devrait toujours retourner les mêmes valeurs`

---

### 11. `tests/unit/userController.test.js` (7 erreurs)

#### Création d'utilisateurs (`createRegional`, `createDistricit`, `createAgentAdmin`, `createAgentStaff`)
**Problème** : Les données créées incluent maintenant :
- `activationToken`, `activationExpires`
- `password: ""`
- `isActive: false`
- Plus de `phone`

**Cause** : Changement dans la logique de création (tous les utilisateurs sont créés inactifs avec token d'activation).
**Tests affectés** :
- `createRegional › devrait créer un utilisateur régional avec succès`
- `createDistricit › devrait créer un utilisateur district avec succès`
- `createAgentAdmin › devrait créer un agent ADMIN avec succès`
- `createAgentStaff › devrait créer un agent STAFF avec succès`
**Solution** : Adapter les tests pour inclure les nouveaux champs et retirer `phone`.

#### `activateUser`
**Problème 1** : Messages d'erreur différents :
- "Utilisateur non trouvé." au lieu de "Activation invalide."
- "Ce compte est déjà actif." au lieu de "Activation invalide."

**Problème 2** : Ajout de `emailVerified: true` dans l'update.

**Tests affectés** :
- `activateUser › devrait retourner 400 si utilisateur introuvable`
- `activateUser › devrait retourner 400 si utilisateur déjà actif`
- `activateUser › devrait activer un utilisateur avec succès`

#### `getHealthCenterAgents`
**Problème** : Plus de `phone` dans le `select`.
**Cause** : Correction Prisma (champ `phone` n'existe pas sur User).
**Test affecté** : `getHealthCenterAgents › devrait retourner la liste des agents du centre de santé avec succès`

---

### 12. `tests/unit/superadminController.test.js` (9 erreurs)

#### `updateEntity`
**Problème** : Ne retourne pas 404 si entité non trouvée.
**Cause probable** : La logique de vérification a changé (peut-être dans un try/catch qui ne retourne pas 404).
**Test affecté** : `updateEntity › devrait retourner 404 si entité non trouvée`

#### `getEntityDeletionSummary`
**Problème 1** : `prisma.commune.count` n'est pas mocké.
**Problème 2** : Ne retourne pas 404 si entité non trouvée.
**Cause** : La fonction délègue à d'autres contrôleurs (regionController, etc.), donc les mocks ne sont pas suffisants.
**Tests affectés** :
- `getEntityDeletionSummary › devrait retourner le résumé de suppression pour une région`
- `getEntityDeletionSummary › devrait retourner 404 si entité non trouvée`
**Solution** : Mocker les contrôleurs délégués ou adapter les tests.

#### `deleteEntity`
**Problème** : Ne retourne pas de réponse JSON.
**Cause probable** : La fonction délègue à d'autres contrôleurs qui ont changé leur format de réponse.
**Test affecté** : `deleteEntity › devrait supprimer une région avec cascade`

#### `createUser`
**Problème 1** : Retourne `{ user: ... }` au lieu de l'objet directement.
**Problème 2** : Message d'erreur différent : "Les champs prénom, nom et email sont obligatoires" au lieu de "Email, firstName, lastName et role sont requis".
**Tests affectés** :
- `createUser › devrait créer un utilisateur NATIONAL avec succès`
- `createUser › devrait retourner 400 si email manquant`

#### `updateUser`
**Problème** : `prisma.user.update` n'est jamais appelé.
**Cause probable** : La logique a changé ou il y a une condition qui empêche l'update.
**Test affecté** : `updateUser › devrait mettre à jour un utilisateur avec succès`

#### `getUserDeletionSummary`
**Problème** : `prisma.children.count` n'est pas mocké.
**Test affecté** : `getUserDeletionSummary › devrait retourner le résumé de suppression pour un utilisateur`
**Solution** : Ajouter les mocks manquants.

#### `getAppSettings`
**Problème** : Ne retourne pas les valeurs par défaut si aucun paramètre.
**Cause probable** : La fonction a changé et ne retourne plus de valeurs par défaut si `appSettings.findFirst` retourne `null`.
**Test affecté** : `getAppSettings › devrait retourner les valeurs par défaut si aucun paramètre`

---

## 🎯 Actions Recommandées

1. **Vérifier d'abord le backend** pour comprendre les changements réels (sans modifier).
2. **Adapter les tests** pour correspondre à la nouvelle logique :
   - Formats de réponse
   - Codes de statut
   - Messages d'erreur
   - Structures de données
   - Mocks manquants

3. **Priorités** :
   - ✅ Corriger les mocks manquants (findFirst, count, etc.)
   - ✅ Adapter les formats de réponse (messages, structures)
   - ✅ Corriger les tests qui s'attendent à des codes de statut différents
   - ✅ Adapter les tests qui vérifient des champs qui n'existent plus (phone)

---

## 📝 Notes Importantes

- **Ne pas modifier le backend** - Toutes les corrections doivent être dans les tests.
- Certains tests peuvent nécessiter une refonte complète si la logique a fondamentalement changé.
- Pour les fonctions qui délèguent à d'autres contrôleurs (comme `getEntityDeletionSummary`), il faudra soit mocker ces contrôleurs, soit adapter la stratégie de test.
