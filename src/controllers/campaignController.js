const prisma = require("../config/prismaClient");
const { notifyNewCampaign } = require("../services/notificationService");
const { logEventAsync } = require("../services/eventLogService");

const getCampaigns = async (req, res, next) => {
  try {
    let whereClause = {};

    // Si l'utilisateur est régional, filtrer par sa région
    if (req.user.role === "REGIONAL" && req.user.regionId) {
      whereClause.regionId = req.user.regionId;
    } else if (req.user.role === "DISTRICT") {
      // Si l'utilisateur est district, filtrer par la région de son district
      if (!req.user.districtId) {
        return res.json({ campaigns: [] });
      }
      
      const district = await prisma.district.findUnique({
        where: { id: req.user.districtId },
        select: {
          commune: {
            select: {
              regionId: true,
            },
          },
        },
      });

      if (!district?.commune?.regionId) {
        return res.json({ campaigns: [] });
      }

      whereClause.regionId = district.commune.regionId;
    }

    const campaigns = await prisma.campaign.findMany({
      where: whereClause,
      include: {
        region: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startDate: "desc",
      },
    });

    res.json({ campaigns });
  } catch (error) {
    console.error("Error in getCampaigns:", error);
    next(error);
  }
};

const createCampaign = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "REGIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { title, description, startDate, endDate, regionId } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({
        message: "Le titre, la date de début et la date de fin sont requis",
      });
    }

    let finalRegionId = regionId;

    // Si l'utilisateur est régional, utiliser sa région
    if (req.user.role === "REGIONAL") {
      if (!req.user.regionId) {
        return res.status(400).json({
          message: "Votre compte n'est pas associé à une région",
        });
      }
      finalRegionId = req.user.regionId;
    } else if (!finalRegionId) {
      return res.status(400).json({ message: "La région est requise" });
    }

    // Vérifier que la région existe
    const region = await prisma.region.findUnique({
      where: { id: finalRegionId },
    });

    if (!region) {
      return res.status(404).json({ message: "Région introuvable" });
    }

    const campaign = await prisma.campaign.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        regionId: finalRegionId,
        medias: [],
      },
      include: {
        region: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Créer des notifications pour tous les enfants de la région
    // On le fait après la réponse pour ne pas ralentir la création de la campagne
    setImmediate(async () => {
      try {
        // Récupérer tous les enfants de la région via les centres de santé
        const healthCenters = await prisma.healthCenter.findMany({
          where: {
            district: {
              commune: {
                regionId: finalRegionId,
              },
            },
          },
          select: {
            id: true,
          },
        });

        const healthCenterIds = healthCenters.map((hc) => hc.id);

        if (healthCenterIds.length > 0) {
          const children = await prisma.children.findMany({
            where: {
              healthCenterId: {
                in: healthCenterIds,
              },
            },
            select: {
              id: true,
            },
          });

          // Créer une notification pour chaque enfant
          for (const child of children) {
            try {
              await notifyNewCampaign({
                childId: child.id,
                campaignTitle: campaign.title,
              });
            } catch (notifError) {
              console.error(`Erreur notification pour enfant ${child.id}:`, notifError);
              // Continuer avec les autres enfants même si une notification échoue
            }
          }

          console.log(`✅ ${children.length} notifications créées pour la campagne "${campaign.title}"`);
        }
      } catch (error) {
        console.error("Erreur création notifications campagne:", error);
        // Ne pas faire échouer la création de la campagne si les notifications échouent
      }
    });

    // Enregistrer l'événement
    logEventAsync({
      type: "CAMPAIGN",
      action: "CREATE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "CAMPAIGN",
      entityId: campaign.id,
      entityName: campaign.title,
      details: {
        title: campaign.title,
        description: campaign.description,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        regionId: campaign.regionId,
      },
    });

    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
};

const updateCampaign = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "REGIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { id } = req.params;
    const { title, description, startDate, endDate, regionId } = req.body;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        region: true,
      },
    });

    if (!campaign) {
      return res.status(404).json({ message: "Campagne introuvable" });
    }

    // Vérifier les permissions
    if (req.user.role === "REGIONAL") {
      if (!req.user.regionId || campaign.regionId !== req.user.regionId) {
        return res.status(403).json({
          message: "Vous ne pouvez modifier que les campagnes de votre région",
        });
      }
    }

    let finalRegionId = regionId || campaign.regionId;

    if (req.user.role === "REGIONAL") {
      finalRegionId = req.user.regionId;
    } else if (regionId && regionId !== campaign.regionId) {
      // Vérifier que la nouvelle région existe
      const region = await prisma.region.findUnique({
        where: { id: regionId },
      });

      if (!region) {
        return res.status(404).json({ message: "Région introuvable" });
      }
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && {
          description: description?.trim() || null,
        }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(finalRegionId !== campaign.regionId && { regionId: finalRegionId }),
      },
      include: {
        region: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Enregistrer l'événement
    logEventAsync({
      type: "CAMPAIGN",
      action: "UPDATE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "CAMPAIGN",
      entityId: id,
      entityName: updated.title,
      details: {
        before: {
          title: campaign.title,
          description: campaign.description,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          regionId: campaign.regionId,
        },
        after: {
          title: updated.title,
          description: updated.description,
          startDate: updated.startDate,
          endDate: updated.endDate,
          regionId: updated.regionId,
        },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const deleteCampaign = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "REGIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return res.status(404).json({ message: "Campagne introuvable" });
    }

    // Vérifier les permissions
    if (req.user.role === "REGIONAL") {
      if (!req.user.regionId || campaign.regionId !== req.user.regionId) {
        return res.status(403).json({
          message: "Vous ne pouvez supprimer que les campagnes de votre région",
        });
      }
    }

    await prisma.campaign.delete({
      where: { id },
    });

    // Enregistrer l'événement
    logEventAsync({
      type: "CAMPAIGN",
      action: "DELETE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "CAMPAIGN",
      entityId: id,
      entityName: campaign.title,
      details: {
        title: campaign.title,
        description: campaign.description,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        regionId: campaign.regionId,
      },
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const addMedia = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "REGIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { id } = req.params;
    let url, type;

    // Si un fichier a été uploadé
    if (req.file) {
      // Construire l'URL du fichier uploadé
      const fileUrl = `/uploads/campaigns/${req.file.filename}`;
      url = fileUrl;

      // Déterminer le type selon l'extension
      const ext = req.file.originalname.toLowerCase();
      if (ext.endsWith(".pdf")) {
        type = "pdf";
      } else if (
        ext.endsWith(".mp4") ||
        ext.endsWith(".mov") ||
        ext.endsWith(".avi") ||
        ext.endsWith(".webm")
      ) {
        type = "video";
      } else {
        return res.status(400).json({
          message: "Type de fichier non supporté",
        });
      }
    } else {
      // Sinon, utiliser les données du body (URL)
      url = req.body.url;
      type = req.body.type;

      if (!url || !type) {
        return res.status(400).json({
          message: "L'URL et le type sont requis, ou un fichier doit être uploadé",
        });
      }

      if (!["video", "pdf"].includes(type)) {
        return res.status(400).json({
          message: "Le type doit être 'video' ou 'pdf'",
        });
      }
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return res.status(404).json({ message: "Campagne introuvable" });
    }

    // Vérifier les permissions
    if (req.user.role === "REGIONAL") {
      if (!req.user.regionId || campaign.regionId !== req.user.regionId) {
        return res.status(403).json({
          message: "Vous ne pouvez modifier que les campagnes de votre région",
        });
      }
    }

    const medias = Array.isArray(campaign.medias) ? campaign.medias : [];
    
    // Récupérer le titre depuis le body ou utiliser le nom du fichier
    let title = req.body.title?.trim() || "";
    if (!title && req.file) {
      // Si pas de titre fourni et fichier uploadé, utiliser le nom du fichier sans extension
      const path = require("path");
      title = path.basename(req.file.originalname, path.extname(req.file.originalname));
    }
    
    if (!title) {
      return res.status(400).json({
        message: "Le titre du média est requis",
      });
    }

    const newMedia = { url: url.trim(), type, title: title.trim() };

    // Vérifier si le média existe déjà (par URL)
    if (medias.some((m) => m.url === newMedia.url)) {
      return res.status(409).json({
        message: "Ce média existe déjà dans cette campagne",
      });
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        medias: [...medias, newMedia],
      },
      include: {
        region: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const removeMedia = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "REGIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { id } = req.params;
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        message: "L'URL est requise",
      });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return res.status(404).json({ message: "Campagne introuvable" });
    }

    // Vérifier les permissions
    if (req.user.role === "REGIONAL") {
      if (!req.user.regionId || campaign.regionId !== req.user.regionId) {
        return res.status(403).json({
          message: "Vous ne pouvez modifier que les campagnes de votre région",
        });
      }
    }

    const medias = Array.isArray(campaign.medias) ? campaign.medias : [];
    const filteredMedias = medias.filter((m) => m.url !== url);

    if (medias.length === filteredMedias.length) {
      return res.status(404).json({
        message: "Média introuvable dans cette campagne",
      });
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        medias: filteredMedias,
      },
      include: {
        region: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  addMedia,
  removeMedia,
};

