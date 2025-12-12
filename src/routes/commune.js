const { Router } = require("express");
const communeController = require("../controllers/communeController");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.get("/", requireAuth, communeController.listCommunes);
router.post("/", requireAuth, communeController.createCommune);
router.put("/:id", requireAuth, communeController.updateCommune);
router.get(
  "/:id/delete-summary",
  requireAuth,
  communeController.getCommuneDeletionSummary,
);
router.delete("/:id", requireAuth, communeController.deleteCommune);

module.exports = router;