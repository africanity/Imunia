const { Router } = require("express");
const childrenController = require("../controllers/childrenController");
const vaccinationProofController = require("../controllers/vaccinationProofController");
const { requireAuth } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = Router();

// Configuration multer pour les preuves de vaccination
const proofUploadDir = path.join(__dirname, "../../uploads/vaccination-proofs");
if (!fs.existsSync(proofUploadDir)) {
  fs.mkdirSync(proofUploadDir, { recursive: true });
}

const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, proofUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const proofUpload = multer({
  storage: proofStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Type de fichier non autorisé. Types autorisés: JPEG, PNG, WebP, PDF`,
        ),
        false,
      );
    }
  },
});

router.post("/", requireAuth, childrenController.createChildren);
router.get("/parents", requireAuth, childrenController.getParentsOverview);
router.get("/:id/vaccinations", requireAuth, childrenController.getChildVaccinations);
router.post(
  "/:id/vaccinations/:bucket",
  requireAuth,
  childrenController.createManualVaccinationEntry,
);
router.put(
  "/:id/vaccinations/:bucket/:entryId",
  requireAuth,
  childrenController.updateManualVaccinationEntry,
);
router.delete(
  "/:id/vaccinations/:bucket/:entryId",
  requireAuth,
  childrenController.deleteManualVaccinationEntry,
);
router.put("/:id", requireAuth, childrenController.updateChildren);
router.delete("/:id", requireAuth, childrenController.deleteChild);
router.get("/", requireAuth, childrenController.getChildren);
router.put("/:id/activate", requireAuth, childrenController.activateChild);
router.put("/:id/request-photos", requireAuth, childrenController.requestPhotos);

// Routes pour les preuves de vaccination
router.post(
  "/:childId/vaccination-proofs",
  requireAuth,
  proofUpload.array("files", 10), // Maximum 10 fichiers (pour mobile)
  vaccinationProofController.uploadVaccinationProofs,
);
router.post(
  "/:childId/vaccination-proofs/upload",
  requireAuth,
  proofUpload.single("file"), // Un seul fichier avec titre (pour backoffice)
  vaccinationProofController.uploadProofFromBackoffice,
);
router.get(
  "/:childId/vaccination-proofs",
  requireAuth,
  vaccinationProofController.getVaccinationProofs,
);



module.exports = router;