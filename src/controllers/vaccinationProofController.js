const prisma = require("../config/prismaClient");
const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = path.join(__dirname, "../../uploads/vaccination-proofs");

// Créer le dossier s'il n'existe pas
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/children/:childId/vaccination-proofs
 * Upload une ou plusieurs preuves de vaccination pour un enfant
 */
const uploadVaccinationProofs = async (req, res, next) => {
  try {
    const { childId } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "Aucun fichier fourni",
      });
    }

    // Vérifier que l'enfant existe et récupérer les informations nécessaires
    const child = await prisma.children.findUnique({
      where: { id: childId },
      include: {
        healthCenter: {
          select: { name: true, id: true },
        },
      },
    });

    if (!child) {
      return res.status(404).json({
        message: "Enfant non trouvé",
      });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      // Vérifier le type MIME ou l'extension
      const ext = path.extname(file.originalname).toLowerCase();
      const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
      const isValidMime = ALLOWED_MIME_TYPES.includes(file.mimetype) || file.mimetype.startsWith("image/");
      const isValidExt = allowedExts.includes(ext);
      
      if (!isValidMime && !isValidExt) {
        return res.status(400).json({
          message: `Type de fichier non autorisé: ${file.mimetype || ext || "inconnu"}. Types autorisés: JPEG, PNG, WebP, PDF`,
        });
      }

      // Vérifier la taille
      if (file.size > MAX_FILE_SIZE) {
        return res.status(400).json({
          message: `Fichier trop volumineux: ${file.originalname}. Taille maximale: 10MB`,
        });
      }

      // Générer un nom de fichier unique
      const fileExt = path.extname(file.originalname);
      const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${fileExt}`;
      const filePath = path.join(UPLOAD_DIR, uniqueFileName);

      // Déplacer le fichier du dossier temporaire vers le dossier de destination
      fs.renameSync(file.path, filePath);

      // Enregistrer dans la base de données
      // Pour le mobile, utiliser le nom du fichier comme titre par défaut
      let title = file.originalname.replace(/\.[^/.]+$/, ""); // Nom sans extension
      // S'assurer que le titre n'est pas vide (fallback sur le nom complet si nécessaire)
      if (!title || title.trim() === "") {
        title = file.originalname || "Document sans nom";
      }
      const proof = await prisma.childVaccinationProof.create({
        data: {
          childId,
          title: title.trim(),
          filePath: `uploads/vaccination-proofs/${uniqueFileName}`,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedBy: null, // Mobile upload, pas d'utilisateur
        },
      });

      uploadedFiles.push({
        id: proof.id,
        title: proof.title,
        fileName: proof.fileName,
        fileSize: proof.fileSize,
        mimeType: proof.mimeType,
        uploadedAt: proof.uploadedAt,
      });
    }

    // Réinitialiser photosRequested à false après l'upload de nouvelles photos
    await prisma.children.update({
      where: { id: childId },
      data: {
        photosRequested: false,
      },
    });

    // Envoyer un email aux agents pour les informer que de nouvelles photos ont été uploadées
    try {
      const { sendNewPhotosUploadedEmail } = require("../services/emailService");
      const agents = await prisma.user.findMany({
        where: {
          role: "AGENT",
          agentLevel: "ADMIN",
          healthCenterId: child.healthCenterId,
        },
        select: { email: true },
      });

      if (agents.length > 0) {
        const agentEmails = agents.map((a) => a.email).filter(Boolean);
        if (agentEmails.length > 0) {
          await sendNewPhotosUploadedEmail({
            agentEmails,
            childName: `${child.firstName} ${child.lastName}`,
            parentName: child.fatherName || child.motherName || "Parent",
            healthCenterName: child.healthCenter?.name || "Non spécifié",
          });
        }
      }
    } catch (emailError) {
      console.error("Erreur envoi email agents (nouvelles photos):", emailError);
      // Ne pas bloquer le processus si l'email échoue
    }

    res.status(201).json({
      success: true,
      message: `${uploadedFiles.length} fichier(s) uploadé(s) avec succès`,
      files: uploadedFiles,
      needsVerification: true, // Nécessite vérification par l'agent
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/children/:childId/vaccination-proofs
 * Récupère toutes les preuves de vaccination d'un enfant
 */
const getVaccinationProofs = async (req, res, next) => {
  try {
    const { childId } = req.params;

    // Vérifier que l'enfant existe et que l'utilisateur a accès
    const child = await prisma.children.findUnique({
      where: { id: childId },
      select: { id: true },
    });

    if (!child) {
      return res.status(404).json({
        success: false,
        message: "Enfant non trouvé",
        proofs: [],
      });
    }

    const proofs = await prisma.childVaccinationProof.findMany({
      where: { childId },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        title: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        uploadedBy: true,
        uploadedAt: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      proofs,
    });
  } catch (error) {
    console.error("Erreur getVaccinationProofs:", error);
    next(error);
  }
};

/**
 * GET /api/vaccination-proofs/:proofId/file
 * Récupère le fichier d'une preuve de vaccination
 */
/**
 * GET /api/vaccination-proofs/:proofId/base64
 * Récupère une image de preuve de vaccination en base64 (pour affichage direct)
 */
const getProofFileBase64 = async (req, res, next) => {
  try {
    const { proofId } = req.params;

    const proof = await prisma.childVaccinationProof.findUnique({
      where: { id: proofId },
      select: {
        filePath: true,
        fileName: true,
        mimeType: true,
        child: {
          select: {
            id: true,
            healthCenterId: true,
            healthCenter: {
              select: {
                id: true,
                districtId: true,
                district: {
                  select: {
                    id: true,
                    communeId: true,
                    commune: {
                      select: {
                        id: true,
                        regionId: true,
                        region: {
                          select: {
                            id: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!proof) {
      return res.status(404).json({
        message: "Preuve de vaccination non trouvée",
      });
    }

    // Vérifier l'accès
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        message: "Non authentifié",
      });
    }

    const child = proof.child;
    if (!child) {
      return res.status(404).json({
        message: "Enfant non trouvé",
      });
    }

    let hasAccess = false;

    if (user.role === "NATIONAL") {
      hasAccess = true;
    } else if (user.role === "REGIONAL") {
      const regionId = child.healthCenter?.district?.commune?.regionId || 
                       child.healthCenter?.district?.commune?.region?.id;
      hasAccess = user.regionId && regionId && user.regionId === regionId;
    } else if (user.role === "DISTRICT") {
      const districtId = child.healthCenter?.districtId || 
                        child.healthCenter?.district?.id;
      hasAccess = user.districtId && districtId && user.districtId === districtId;
    } else if (user.role === "AGENT") {
      const childHealthCenterId = child.healthCenterId || child.healthCenter?.id;
      hasAccess = user.healthCenterId && childHealthCenterId && 
                  user.healthCenterId === childHealthCenterId;
    }

    if (!hasAccess) {
      return res.status(403).json({
        message: "Accès refusé",
      });
    }

    // Vérifier que c'est une image (par mimeType ou extension)
    const isImageFile = proof.mimeType?.startsWith("image/") || false;
    const fileName = proof.fileName || "";
    const extension = fileName.toLowerCase().split(".").pop();
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
    const isImageByExtension = imageExtensions.includes(extension);
    
    if (!isImageFile && !isImageByExtension) {
      return res.status(400).json({
        message: "Ce endpoint est uniquement pour les images",
      });
    }

    const fullPath = path.join(__dirname, "../../", proof.filePath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        message: "Fichier non trouvé sur le serveur",
      });
    }

    // Lire le fichier et le convertir en base64
    const fileBuffer = fs.readFileSync(fullPath);
    const base64String = fileBuffer.toString("base64");
    const dataUrl = `data:${proof.mimeType};base64,${base64String}`;

    // IMPORTANT: Définir le Content-Type comme JSON pour éviter le téléchargement
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    
    res.json({
      success: true,
      dataUrl,
      mimeType: proof.mimeType,
      fileName: proof.fileName,
    });
  } catch (error) {
    next(error);
  }
};

const getProofFile = async (req, res, next) => {
  try {
    const { proofId } = req.params;

    const proof = await prisma.childVaccinationProof.findUnique({
      where: { id: proofId },
      select: {
        filePath: true,
        fileName: true,
        mimeType: true,
        child: {
          select: {
            id: true,
            healthCenterId: true,
            healthCenter: {
              select: {
                id: true,
                districtId: true,
                district: {
                  select: {
                    id: true,
                    communeId: true,
                    commune: {
                      select: {
                        id: true,
                        regionId: true,
                        region: {
                          select: {
                            id: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!proof) {
      return res.status(404).json({
        message: "Preuve de vaccination non trouvée",
      });
    }

    // Vérifier l'accès (seuls les agents du même centre, district, région ou national peuvent voir)
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        message: "Non authentifié",
      });
    }

    const child = proof.child;
    if (!child) {
      return res.status(404).json({
        message: "Enfant non trouvé",
      });
    }

    let hasAccess = false;

    if (user.role === "NATIONAL") {
      hasAccess = true;
    } else if (user.role === "REGIONAL") {
      const regionId = child.healthCenter?.district?.commune?.regionId || 
                       child.healthCenter?.district?.commune?.region?.id;
      hasAccess = user.regionId && regionId && user.regionId === regionId;
    } else if (user.role === "DISTRICT") {
      const districtId = child.healthCenter?.districtId || 
                        child.healthCenter?.district?.id;
      hasAccess = user.districtId && districtId && user.districtId === districtId;
    } else if (user.role === "AGENT") {
      const childHealthCenterId = child.healthCenterId || child.healthCenter?.id;
      hasAccess = user.healthCenterId && childHealthCenterId && 
                  user.healthCenterId === childHealthCenterId;
    }

    if (!hasAccess) {
      console.log("Accès refusé - Debug:", {
        userRole: user.role,
        userRegionId: user.regionId,
        userDistrictId: user.districtId,
        userHealthCenterId: user.healthCenterId,
        childHealthCenterId: child.healthCenterId || child.healthCenter?.id,
        childDistrictId: child.healthCenter?.districtId || child.healthCenter?.district?.id,
        childRegionId: child.healthCenter?.district?.commune?.regionId || child.healthCenter?.district?.commune?.region?.id,
      });
      return res.status(403).json({
        message: "Accès refusé",
      });
    }

    const fullPath = path.join(__dirname, "../../", proof.filePath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        message: "Fichier non trouvé sur le serveur",
      });
    }

    // Définir les headers pour forcer l'affichage inline (pas de téléchargement)
    const mimeType = proof.mimeType || "application/octet-stream";
    
    // Pour les images, NE PAS mettre de Content-Disposition pour forcer l'affichage
    // Pour les autres fichiers, mettre inline
    if (mimeType.startsWith("image/")) {
      res.setHeader("Content-Type", mimeType);
      // Pas de Content-Disposition pour les images - le navigateur les affichera directement
    } else {
      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(proof.fileName)}"`,
      );
    }
    
    // Empêcher le cache
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/vaccination-proofs/:proofId
 * Supprime une preuve de vaccination
 */
const deleteProof = async (req, res, next) => {
  try {
    const { proofId } = req.params;

    const proof = await prisma.childVaccinationProof.findUnique({
      where: { id: proofId },
      include: {
        child: {
          select: {
            id: true,
            healthCenterId: true,
            healthCenter: {
              select: {
                id: true,
                districtId: true,
                district: {
                  select: {
                    id: true,
                    communeId: true,
                    commune: {
                      select: {
                        id: true,
                        regionId: true,
                        region: {
                          select: {
                            id: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!proof) {
      return res.status(404).json({
        message: "Preuve de vaccination non trouvée",
      });
    }

    // Vérifier l'accès (seuls les agents du même centre, district, région ou national peuvent supprimer)
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        message: "Non authentifié",
      });
    }

    const child = proof.child;
    if (!child) {
      return res.status(404).json({
        message: "Enfant non trouvé",
      });
    }

    let hasAccess = false;

    if (user.role === "NATIONAL") {
      hasAccess = true;
    } else if (user.role === "REGIONAL") {
      const regionId = child.healthCenter?.district?.commune?.regionId || 
                       child.healthCenter?.district?.commune?.region?.id;
      hasAccess = user.regionId && regionId && user.regionId === regionId;
    } else if (user.role === "DISTRICT") {
      const districtId = child.healthCenter?.districtId || 
                        child.healthCenter?.district?.id;
      hasAccess = user.districtId && districtId && user.districtId === districtId;
    } else if (user.role === "AGENT") {
      const childHealthCenterId = child.healthCenterId || child.healthCenter?.id;
      hasAccess = user.healthCenterId && childHealthCenterId && 
                  user.healthCenterId === childHealthCenterId;
    }

    if (!hasAccess) {
      console.log("Accès refusé - Debug:", {
        userRole: user.role,
        userRegionId: user.regionId,
        userDistrictId: user.districtId,
        userHealthCenterId: user.healthCenterId,
        childHealthCenterId: child.healthCenterId || child.healthCenter?.id,
        childDistrictId: child.healthCenter?.districtId || child.healthCenter?.district?.id,
        childRegionId: child.healthCenter?.district?.commune?.regionId || child.healthCenter?.district?.commune?.region?.id,
      });
      return res.status(403).json({
        message: "Accès refusé",
      });
    }

    // Supprimer le fichier du système de fichiers
    const fullPath = path.join(__dirname, "../../", proof.filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // Supprimer l'entrée de la base de données
    await prisma.childVaccinationProof.delete({
      where: { id: proofId },
    });

    res.json({
      success: true,
      message: "Preuve de vaccination supprimée avec succès",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/children/:childId/vaccination-proofs/upload
 * Uploader un document depuis le backoffice avec titre
 */
const uploadProofFromBackoffice = async (req, res, next) => {
  try {
    const { childId } = req.params;
    const { title } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Aucun fichier fourni",
      });
    }

    const trimmedTitle = title?.trim();
    if (!trimmedTitle || trimmedTitle === "") {
      // Supprimer le fichier uploadé si le titre est manquant
      const filePath = path.join(UPLOAD_DIR, file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(400).json({
        success: false,
        message: "Le titre du document est requis",
      });
    }

    // Vérifier que l'enfant existe
    const child = await prisma.children.findUnique({
      where: { id: childId },
      select: { id: true },
    });

    if (!child) {
      // Supprimer le fichier uploadé
      const filePath = path.join(UPLOAD_DIR, file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(404).json({
        success: false,
        message: "Enfant non trouvé",
      });
    }

    // Vérifier le type MIME ou l'extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    const isValidMime = ALLOWED_MIME_TYPES.includes(file.mimetype) || file.mimetype.startsWith("image/");
    const isValidExt = allowedExts.includes(ext);
    
    if (!isValidMime && !isValidExt) {
      // Supprimer le fichier uploadé
      const filePath = path.join(UPLOAD_DIR, file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(400).json({
        success: false,
        message: `Type de fichier non autorisé: ${file.mimetype || ext || "inconnu"}. Types autorisés: JPEG, PNG, WebP, PDF`,
      });
    }

    // Vérifier la taille
    if (file.size > MAX_FILE_SIZE) {
      // Supprimer le fichier uploadé
      const filePath = path.join(UPLOAD_DIR, file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(400).json({
        success: false,
        message: `Fichier trop volumineux: ${file.originalname}. Taille maximale: 10MB`,
      });
    }

    // Créer l'entrée dans la base de données
    const proof = await prisma.childVaccinationProof.create({
      data: {
        childId,
        title: trimmedTitle,
        filePath: `uploads/vaccination-proofs/${file.filename}`,
        fileName: file.originalname || "fichier",
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: req.user?.id || null,
      },
    });

    res.status(201).json({
      success: true,
      message: "Document uploadé avec succès",
      proof: {
        id: proof.id,
        title: proof.title,
        fileName: proof.fileName,
        mimeType: proof.mimeType,
        fileSize: proof.fileSize,
        uploadedBy: proof.uploadedBy,
        uploadedAt: proof.uploadedAt,
      },
    });
  } catch (error) {
    // Supprimer le fichier uploadé en cas d'erreur
    if (req.file) {
      const filePath = path.join(UPLOAD_DIR, req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    next(error);
  }
};

module.exports = {
  uploadVaccinationProofs,
  uploadProofFromBackoffice,
  getVaccinationProofs,
  getProofFileBase64,
  getProofFile,
  deleteProof,
};

