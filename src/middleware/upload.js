const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Créer le dossier uploads/campaigns s'il n'existe pas
const uploadDir = path.join(__dirname, "../../uploads/campaigns");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Générer un nom de fichier unique avec timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

// Filtre pour accepter uniquement les vidéos et PDFs
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
    "application/pdf",
  ];

  // Vérifier aussi par extension au cas où le mime type n'est pas détecté
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = [".mp4", ".mov", ".avi", ".webm", ".pdf"];

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Type de fichier non autorisé. Seuls les vidéos (MP4, MOV, AVI, WEBM) et PDFs sont acceptés.",
      ),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max
  },
});

module.exports = upload;



