const { Router } = require("express");
const vaccinationProofController = require("../controllers/vaccinationProofController");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const router = Router();

// Récupérer une image en base64 (pour affichage direct sans téléchargement)
router.get(
  "/:proofId/base64",
  optionalAuth,
  vaccinationProofController.getProofFileBase64,
);

// Récupérer un fichier de preuve (avec token en paramètre pour affichage direct)
router.get(
  "/:proofId/file",
  optionalAuth, // Accepter le token dans le header OU en paramètre
  vaccinationProofController.getProofFile,
);

// Supprimer une preuve
router.delete(
  "/:proofId",
  requireAuth,
  vaccinationProofController.deleteProof,
);

module.exports = router;

