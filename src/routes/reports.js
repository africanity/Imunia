const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");
const reportController = require("../controllers/reportController");

const router = Router();

// Rapports pour les agents
router.get("/agent", requireAuth, reportController.getAgentReports);

// Rapports pour les régions
router.get("/regional", requireAuth, reportController.getRegionalReports);

// Rapports pour les districts
router.get("/district", requireAuth, reportController.getDistrictReports);

// Rapports pour le niveau national
router.get("/national", requireAuth, reportController.getNationalReports);

// Détails d'une région (drill-down)
router.get("/region/:regionName", requireAuth, reportController.getRegionDetails);

// Détails d'un district (drill-down)
router.get("/district/:regionName/:districtName", requireAuth, reportController.getDistrictDetails);

// Détails d'un centre de santé (drill-down)
router.get("/healthcenter/:regionName/:districtName/:healthCenterName", requireAuth, reportController.getHealthCenterDetails);

module.exports = router;






