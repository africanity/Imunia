const { Router } = require("express");
const userController = require("../controllers/userController");
const { requireAuth } = require("../middleware/auth");

const router = Router();

//router.post("/", requireAuth, userController.createUser);
router.post("/regional", requireAuth, userController.createRegional);
router.post("/district", requireAuth, userController.createDistricit);
router.post("/agent-admin", requireAuth, userController.createAgentAdmin);
router.post("/agent-staff", requireAuth, userController.createAgentStaff);

router.post("/:id/activate", userController.activateUser);

router.get("/", requireAuth, userController.listUsers);
router.get("/health-center/agents", requireAuth, userController.getHealthCenterAgents);
router.get("/me", requireAuth, userController.getSelf);
router.patch("/me", requireAuth, userController.updateSelf);
router.post("/me/verify-email", requireAuth, userController.verifyEmail);
router.post("/me/request-email-change", requireAuth, userController.requestEmailChange);
router.post("/me/verify-email-change", requireAuth, userController.verifyEmailChange);
router.post("/me/request-password-change", requireAuth, userController.requestPasswordChange);
router.post("/me/verify-password-code", requireAuth, userController.verifyPasswordCode);
router.post("/me/change-password", requireAuth, userController.changePassword);

router.get("/:id/delete-summary", requireAuth, userController.getUserDeletionSummary);
router.delete("/:id", requireAuth, userController.deleteUser);

router.put("/regional/:id", requireAuth, userController.updateRegional);
router.put("/district/:id", requireAuth, userController.updateDistrict);
router.put("/agent-admin/:id", requireAuth, userController.updateAgentAdmin);
router.put("/agent-staff/:id", requireAuth, userController.updateAgentStaff);

router.delete("/regional/:id", requireAuth, userController.deleteRegional);
router.delete("/district/:id", requireAuth, userController.deleteDistrict);
router.delete("/agent-admin/:id", requireAuth, userController.deleteAgentAdmin);
router.delete("/agent-staff/:id", requireAuth, userController.deleteAgentStaff);

module.exports = router;