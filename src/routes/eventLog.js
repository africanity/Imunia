const express = require("express");
const router = express.Router();
const eventLogController = require("../controllers/eventLogController");
const { requireAuth } = require("../middleware/auth");

// Toutes les routes nécessitent une authentification
router.use(requireAuth);

// Récupérer les événements avec filtres et pagination
router.get("/", eventLogController.getEventLogs);

// Récupérer les statistiques
router.get("/stats", eventLogController.getEventLogStats);

// Supprimer un événement
router.delete("/:id", eventLogController.deleteEventLog);

// Supprimer plusieurs événements
router.delete("/", eventLogController.deleteMultipleEventLogs);

module.exports = router;
