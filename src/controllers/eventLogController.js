const prisma = require("../config/prismaClient");

/**
 * Récupère les événements avec filtres et pagination
 */
const getEventLogs = async (req, res, next) => {
  try {
    // Vérifier que l'utilisateur est SUPERADMIN ou NATIONAL
    if (!["SUPERADMIN", "NATIONAL"].includes(req.user.role)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const {
      type,
      subtype,
      action,
      entityType,
      entityId,
      dateFrom,
      dateTo,
      date,
      sortOrder = "desc", // "asc" ou "desc"
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Construire le where clause
    const where = {};

    if (type) {
      where.type = type;
    }

    if (subtype) {
      where.subtype = subtype;
    }

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    // Filtres de date
    if (date) {
      // Date précise (jour entier)
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else {
      // Plage de dates
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          where.createdAt.gte = fromDate;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          where.createdAt.lte = toDate;
        }
      }
    }

    // Récupérer les événements
    const [events, total] = await Promise.all([
      prisma.eventLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: sortOrder === "asc" ? "asc" : "desc",
        },
        skip,
        take: limitNum,
      }),
      prisma.eventLog.count({ where }),
    ]);

    // Formater les événements pour la réponse
    const formattedEvents = events.map((event) => ({
      id: event.id,
      type: event.type,
      subtype: event.subtype,
      action: event.action,
      user: event.user ? {
        id: event.user.id,
        firstName: event.user.firstName,
        lastName: event.user.lastName,
        email: event.user.email,
        role: event.user.role,
      } : {
        firstName: event.userFirstName || null,
        lastName: event.userLastName || null,
        email: event.userEmail || null,
        role: event.userRole || null,
      },
      entityType: event.entityType,
      entityId: event.entityId,
      entityName: event.entityName,
      details: event.details,
      metadata: event.metadata,
      createdAt: event.createdAt,
    }));

    res.json({
      events: formattedEvents,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Supprime un événement
 */
const deleteEventLog = async (req, res, next) => {
  try {
    // Vérifier que l'utilisateur est SUPERADMIN ou NATIONAL
    if (!["SUPERADMIN", "NATIONAL"].includes(req.user.role)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const { id } = req.params;

    await prisma.eventLog.delete({
      where: { id },
    });

    res.json({ message: "Événement supprimé avec succès" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Événement non trouvé" });
    }
    next(error);
  }
};

/**
 * Supprime plusieurs événements
 */
const deleteMultipleEventLogs = async (req, res, next) => {
  try {
    // Vérifier que l'utilisateur est SUPERADMIN ou NATIONAL
    if (!["SUPERADMIN", "NATIONAL"].includes(req.user.role)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Liste d'IDs invalide" });
    }

    await prisma.eventLog.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    res.json({ message: `${ids.length} événement(s) supprimé(s) avec succès` });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupère les statistiques des types d'événements
 */
const getEventLogStats = async (req, res, next) => {
  try {
    // Vérifier que l'utilisateur est SUPERADMIN ou NATIONAL
    if (!["SUPERADMIN", "NATIONAL"].includes(req.user.role)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const stats = await prisma.eventLog.groupBy({
      by: ["type", "subtype"],
      _count: {
        id: true,
      },
    });

    res.json({ stats });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEventLogs,
  deleteEventLog,
  deleteMultipleEventLogs,
  getEventLogStats,
};

