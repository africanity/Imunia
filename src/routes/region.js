const { Router } = require("express");
const regionController = require("../controllers/regionController");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.post("/", requireAuth, regionController.createRegion);
router.get("/", requireAuth, regionController.getRegions);
router.put("/:id", requireAuth, regionController.updateRegion);
router.get(
  "/:id/delete-summary",
  requireAuth,
  regionController.getRegionDeletionSummary,
);
router.delete("/:id", requireAuth, regionController.deleteRegion);

module.exports = router;