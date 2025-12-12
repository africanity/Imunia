const { Router } = require("express");
const campaignController = require("../controllers/campaignController");
const { requireAuth } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = Router();

router.get("/", requireAuth, campaignController.getCampaigns);
router.post("/", requireAuth, campaignController.createCampaign);
router.put("/:id", requireAuth, campaignController.updateCampaign);
router.delete("/:id", requireAuth, campaignController.deleteCampaign);
router.patch(
  "/:id/medias",
  requireAuth,
  upload.single("file"),
  campaignController.addMedia,
);
router.delete("/:id/medias", requireAuth, campaignController.removeMedia);

module.exports = router;

