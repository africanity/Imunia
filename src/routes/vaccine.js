const { Router } = require("express");
const vaccineController = require("../controllers/vaccineController");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.post("/", requireAuth, vaccineController.createVaccine);
router.post("/calendar", requireAuth, vaccineController.createVaccineCalendar);
router.put(
  "/calendar/:id",
  requireAuth,
  vaccineController.updateVaccineCalendar
);
router.delete(
  "/calendar/:id",
  requireAuth,
  vaccineController.deleteVaccineCalendar
);
router.get(
  "/calendar/download-pdf",
  requireAuth,
  vaccineController.downloadVaccineCalendarPdf
);
router.get("/", requireAuth, vaccineController.getVaccine);
router.get("/calendar", requireAuth, vaccineController.listVaccineCalendars);
router.get(
  "/calendar/dose-warnings",
  requireAuth,
  vaccineController.listVaccineCalendarDoseWarnings,
);
router.post(
  "/scheduled",
  requireAuth,
  vaccineController.ScheduleVaccine
);
router.get(
  "/scheduled",
  requireAuth,
  vaccineController.listScheduledVaccines
);
router.post(
  "/scheduled/:id/complete",
  requireAuth,
  vaccineController.completeVaccine
);
router.patch(
  "/scheduled/:id",
  requireAuth,
  vaccineController.updateScheduledVaccine
);
router.delete(
  "/scheduled/:id",
  requireAuth,
  vaccineController.cancelScheduledVaccine
);
router.put("/:id", requireAuth, vaccineController.updateVaccine);
router.delete("/:id", requireAuth, vaccineController.deleteVaccine);
router.get("/:id/impact", requireAuth, vaccineController.getVaccineDeleteImpact);

module.exports = router;