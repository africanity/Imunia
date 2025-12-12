const { Router } = require("express");
const adviceController = require("../controllers/adviceController");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.get("/", requireAuth, adviceController.getAdvice);
router.post("/", requireAuth, adviceController.createAdvice);
router.put("/:id", requireAuth, adviceController.updateAdvice);
router.delete("/:id", requireAuth, adviceController.deleteAdvice);

module.exports = router;


