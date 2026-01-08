const { Router } = require("express");
const mobileController = require("../controllers/mobileController");
const vaccinationProofController = require("../controllers/vaccinationProofController");
const { requireMobileAuth } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = Router();

// Configuration multer pour les preuves de vaccination (mobile)
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
      "image/*", // Accepter tous les types d'images si le MIME type n'est pas précis
    ];
    
    // Vérifier par MIME type
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    
    // Vérifier par extension de fichier comme fallback
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    
    if (allowedExts.includes(ext)) {
      cb(null, true);
      return;
    }
    
    cb(
      new Error(
        `Type de fichier non autorisé. Types autorisés: JPEG, PNG, WebP, PDF`,
      ),
      false,
    );
  },
});

// Demande de code de vérification
router.post("/request-verification-code", mobileController.requestVerificationCode);

// Renvoyer le code de vérification
router.post("/resend-verification-code", mobileController.resendVerificationCode);

// Inscription parent/enfant (après vérification du code)
router.post("/parent-register", mobileController.parentRegister);

// Vérification du code d'accès
router.post("/verify-access-code", mobileController.verifyAccessCode);

// Connexion avec numéro + PIN
router.post("/parent-login", mobileController.parentLogin);

// Gestion du PIN
router.post("/parent-pin/save", mobileController.saveParentPin);
router.post("/parent-pin/verify", mobileController.verifyParentPin);
router.post("/parent-pin/request-change-code", requireMobileAuth, mobileController.requestChangePinCode);
router.post("/parent-pin/change", requireMobileAuth, mobileController.changeParentPin);
router.post("/parent-pin/forgot-pin-request", mobileController.requestForgotPinCode);
router.post("/parent-pin/verify-forgot-pin-code", mobileController.verifyForgotPinCode);
router.post("/parent-pin/reset-pin", mobileController.resetForgotPin);

// Gestion du numéro de téléphone
router.post("/parent-phone/request-change-code", requireMobileAuth, mobileController.requestChangePhoneCode);
router.post("/parent-phone/change", requireMobileAuth, mobileController.changeParentPhone);

// Marquer les vaccins comme effectués
router.post("/children/:childId/mark-vaccines-done", mobileController.markVaccinesDone);

// Obtenir la liste des régions (pour les parents)
router.get("/regions", mobileController.getRegions);

// Obtenir la liste des centres de santé (pour les parents)
router.get("/health-centers", mobileController.getHealthCenters);

// Obtenir le calendrier vaccinal (pour les parents)
router.get("/vaccine-calendar", mobileController.getVaccineCalendar);

// Obtenir le dashboard d'un enfant (nécessite authentification)
router.get("/children/:childId/dashboard", requireMobileAuth, mobileController.getChildDashboard);

// Obtenir les conseils (optionnel: filtrer par âge de l'enfant)
router.get("/advice", mobileController.getAdvice);

// Obtenir les campagnes de vaccination
router.get("/campaigns", mobileController.getCampaigns);

// Obtenir les rendez-vous d'un enfant (nécessite authentification)
router.get("/children/:childId/appointments", requireMobileAuth, mobileController.getAppointments);

// Obtenir le calendrier vaccinal d'un enfant (nécessite authentification)
router.get("/children/:childId/calendar", requireMobileAuth, mobileController.getCalendar);

// Obtenir les notifications d'un enfant (nécessite authentification)
router.get("/children/:childId/notifications", requireMobileAuth, mobileController.getNotifications);

// Obtenir le nombre de notifications non lues (nécessite authentification)
router.get(
  "/children/:childId/notifications/unread-count",
  requireMobileAuth,
  mobileController.getUnreadNotificationCount,
);

// Marquer toutes les notifications comme lues (nécessite authentification)
router.put("/children/:childId/notifications/mark-all-read", requireMobileAuth, mobileController.markAllNotificationsAsRead);

// Créer une demande de vaccin (nécessite authentification)
router.post("/children/:childId/vaccine-requests", requireMobileAuth, require("../controllers/vaccineRequestController").createVaccineRequest);

// Upload de preuves de vaccination (nécessite authentification)
router.post(
  "/children/:childId/vaccination-proofs",
  requireMobileAuth,
  (req, res, next) => {
    proofUpload.array("files", 10)(req, res, (err) => {
      if (err) {
        // Gérer les erreurs multer
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message: "Fichier trop volumineux. Taille maximale: 10MB",
          });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({
            message: "Trop de fichiers. Maximum: 10 fichiers",
          });
        }
        if (err.message) {
          return res.status(400).json({
            message: err.message,
          });
        }
        return res.status(400).json({
          message: "Erreur lors de l'upload du fichier",
        });
      }
      next();
    });
  },
  vaccinationProofController.uploadVaccinationProofs,
);

module.exports = router;

