const { Router } = require("express");
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.post("/login", authController.login);
router.post("/refresh", authController.refreshToken);
router.get("/logout", requireAuth, authController.logout);
router.post("/password-reset/request", authController.requestPasswordReset);
router.post("/password-reset/verify", authController.verifyPasswordResetCode);
router.post("/password-reset/resend", authController.resendPasswordResetCode);
router.post("/password-reset/update", authController.updatePasswordAfterReset);

module.exports = router;