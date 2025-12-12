const { Router } = require("express");
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.post("/login", authController.login);
router.get("/logout", requireAuth, authController.logout);

module.exports = router;