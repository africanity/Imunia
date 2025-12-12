const { Router } = require("express");
const vaccineRequestController = require("../controllers/vaccineRequestController");
const { requireAuth } = require("../middleware/auth");

const router = Router();

// Récupérer les demandes de vaccin
router.get("/", requireAuth, vaccineRequestController.getVaccineRequests);

// Programmer un rendez-vous à partir d'une demande
router.post("/:id/schedule", requireAuth, vaccineRequestController.scheduleVaccineRequest);

// Annuler une demande
router.delete("/:id", requireAuth, vaccineRequestController.cancelVaccineRequest);

module.exports = router;

