const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");
const dashboardController = require("../controllers/dashboardController");

const router = Router();

router.get(
  "/national",
  requireAuth,
  dashboardController.getNationalDashboardStats,
);
router.get(
  "/agent",
  requireAuth,
  dashboardController.getAgentDashboardStats,
);
router.get(
  "/regional",
  requireAuth,
  dashboardController.getRegionalDashboardStats,
);
router.get(
  "/district",
  requireAuth,
  dashboardController.getDistrictDashboardStats,
);

module.exports = router;

