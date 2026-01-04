const { Router } = require("express");
const notificationController = require("../controllers/notificationController");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.get("/", requireAuth, notificationController.getNotifications);
router.get("/unread-count", requireAuth, notificationController.getUnreadNotificationsCount);
router.patch("/:id/read", requireAuth, notificationController.markNotificationAsRead);
router.patch("/read-all", requireAuth, notificationController.markAllNotificationsAsRead);
router.delete("/:id", requireAuth, notificationController.deleteNotificationById);
router.delete("/all", requireAuth, notificationController.deleteAll);
router.delete("/read/all", requireAuth, notificationController.deleteAllRead);

module.exports = router;

