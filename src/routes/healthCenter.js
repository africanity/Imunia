const { Router } = require("express");
const healthCenterController = require("../controllers/healthCenterController");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.get("/", requireAuth, healthCenterController.listHealthCenters);
router.post("/", requireAuth, healthCenterController.createHealthCenter);
router.put("/:id", requireAuth, healthCenterController.updateHealthCenter);
router.get(
  "/:id/delete-summary",
  requireAuth,
  healthCenterController.getHealthCenterDeletionSummary,
);
router.delete("/:id", requireAuth, healthCenterController.deleteHealthCenter);

module.exports = router;