const { Router } = require("express");
const superadminController = require("../controllers/superadminController");
const { requireAuth } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = Router();

// Configuration de multer pour l'upload de logo
const uploadsDir = path.join(__dirname, "..", "..", "frontend", "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `logo-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accepter tous les formats d'image
    const allowedMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Format de fichier non supporté. Utilisez une image."), false);
    }
  },
});

// Toutes les routes nécessitent l'authentification et le rôle superadmin
router.use(requireAuth);
router.use(superadminController.requireSuperAdmin);

// ==================== GESTION DES ENTITÉS ====================
router.get("/entities", superadminController.getAllEntities);
router.get("/entities/:type/:id", superadminController.getEntityDetails);
router.put("/entities/:type/:id", superadminController.updateEntity);
router.get("/entities/:type/:id/delete-summary", superadminController.getEntityDeletionSummary);
router.delete("/entities/:type/:id", superadminController.deleteEntity);

// ==================== GESTION DES UTILISATEURS ====================
router.get("/users", superadminController.getAllUsers);
router.get("/users/:id", superadminController.getUserDetails);
router.post("/users", superadminController.createUser);
router.put("/users/:id", superadminController.updateUser);
router.get("/users/:id/delete-summary", superadminController.getUserDeletionSummary);
router.delete("/users/:id", superadminController.deleteUser);

// ==================== GESTION DES PARAMÈTRES ====================
router.get("/settings", superadminController.getAppSettings);
router.put("/settings", upload.single("logo"), superadminController.updateAppSettings);

module.exports = router;

